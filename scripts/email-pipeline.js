// ─────────────────────────────────────────────────────────────────────────────
// Recruiting Email Pipeline — Google Apps Script
//
// SETUP (one time):
//   1. script.google.com → New project → paste this entire file
//   2. Project Settings (gear icon) → Script Properties → Add:
//        ANTHROPIC_API_KEY       =  sk-ant-api03-...
//        SUPABASE_URL            =  https://<project-ref>.supabase.co
//        SUPABASE_SERVICE_ROLE_KEY = <service role key, from Supabase dashboard → Settings → API>
//        RECRUITING_USER_ID      =  <uuid of the signed-up Supabase account this pipeline writes to>
//   3. Run setup() once manually — approve all permission prompts
//   4. Triggers (clock icon) → Add Trigger:
//        Function: processRecruitingEmails
//        Event: Time-driven → Every 10 minutes
//
// This writes directly to this app's Supabase Postgres tables (contacts, applications,
// interactions) via the raw PostgREST API — Apps Script has no npm, so there's no
// @supabase/supabase-js here, just UrlFetchApp calls with the service-role key (same
// server-side trust model api/_lib/supabaseAdmin.js uses for the Vercel proxies). The
// service-role key bypasses Row Level Security entirely, so unlike every other server-side
// call site in this repo (which derives user_id from a verified session via requireUser()),
// this script has no session to derive from — RECRUITING_USER_ID is a single hardcoded user
// id, since this pipeline serves exactly one recruiting-os account, not a multi-tenant signup
// flow. It's included explicitly on every query/insert below.
//
// COST: ~$0.001/email with Haiku. 300 emails/month = $0.30 from your Anthropic credits.
// ─────────────────────────────────────────────────────────────────────────────

const DONE_LABEL      = 'recruiting-done' // visual marker in Gmail only — no longer used to gate processing, since threads can grow replies after being marked done
const RECRUITING_LABEL = 'recruiting'
// Recent Sent-folder threads not yet labeled — catches brand-new cold outreach the user
// sends that never went through an already-labeled thread. 30d bounds the first-run backfill.
const SENT_SCAN_QUERY = `in:sent -label:${RECRUITING_LABEL} newer_than:30d`

// ATS platforms and recruiting-shaped subject phrasing, used to find *inbound* recruiting
// email without requiring it to be manually labeled first (see INBOX_SCAN_QUERY below). This
// used to be the actual gap: an inbound "thanks for applying" confirmation that was never
// manually labeled 'recruiting' was completely invisible to this script — it only ever looked
// at threads already labeled, or things the user had sent. This is a recall net, not a
// filter — Claude's UNRELATED classification is the real filter, so it's fine (and
// intentional) for the keyword list to be broad and catch some noise; a false positive here
// costs one cheap Haiku call, a false negative here is a missed application.
const ATS_DOMAINS = [
  'greenhouse.io', 'lever.co', 'myworkday.com', 'icims.com', 'smartrecruiters.com',
  'ashbyhq.com', 'jobvite.com', 'taleo.net', 'workable.com', 'breezy.hr', 'jazz.co',
  'bamboohr.com', 'successfactors.com', 'ultipro.com', 'wellfound.com', 'ripplematch.com',
  'paradox.ai', 'gem.com', 'hire.withgoogle.com',
]
const RECRUITING_SUBJECT_KEYWORDS = [
  'application', 'applying', 'applied', 'interview', 'recruiter', 'recruiting',
  'internship', 'offer', '"next steps"', 'assessment', '"phone screen"', 'onsite',
  'candidacy', '"thank you for your interest"', '"hiring team"', 'oa', '"coding challenge"',
]
// Recent Inbox threads not yet labeled, from a known ATS domain or with a recruiting-shaped
// subject — this is what lets a fresh application-confirmation email get picked up without
// the user ever touching Gmail labels. 45d bounds the first-run backfill.
const INBOX_SCAN_QUERY = `in:inbox -label:${RECRUITING_LABEL} newer_than:45d `
  + `(from:(${ATS_DOMAINS.join(' OR ')}) OR subject:(${RECRUITING_SUBJECT_KEYWORDS.join(' OR ')}))`

// Common personal/webmail domains — never treated as a company-name hint even when they don't
// match a known ATS, since "Gmail" or "Outlook" is never the company (see guessCompanyHint).
const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com',
  'aol.com', 'protonmail.com', 'mail.com', 'live.com', 'msn.com',
])

// Broadened after checking against a real referral thread in this account (Omegar
// Chavolla-Zacarias @ Google — "I sent along your resume and you should receive a link today
// inviting you to apply through a referral portal") — the original narrower pattern missed
// that exact phrasing, so "referral portal|link|program" and "referred you" were added.
const REFERRAL_MENTION_RE = /\b(referred by|referred you|referral from|recommended by|thanks to (?:the |your )?(?:introduction|referral)|your referrer|employee referral|referral (?:portal|link|program)|apply(?:ing)? through a referral)\b/i
const APPLICATION_CONFIRMATION_RE = /\b(thank(?:s| you) for (?:your interest|applying)|we(?:'| ha)ve received your application|your application (?:has been received|was submitted|is being reviewed)|application (?:received|submitted|confirmation)|successfully applied)\b/i
// Online Assessment (OA) invites — the coding/skills test companies send after applying
// (HackerRank, CodeSignal, Codility, HackerEarth, or a generic "complete your assessment"
// ATS template), which almost always comes with a completion deadline. Recall net like the
// other *_RE hints above — Claude still makes the final call on type + whether a due date is
// actually stated.
const OA_INVITE_RE = /\b(online assessment|coding assessment|coding challenge|skills assessment|hackerrank|codesignal|codility|hackerearth|complete (?:your|the) assessment|assessment invit)/i

function getKeys() {
  const p = PropertiesService.getScriptProperties()
  return {
    anthropic:   p.getProperty('ANTHROPIC_API_KEY'),
    supabaseUrl: p.getProperty('SUPABASE_URL'),
    supabaseKey: p.getProperty('SUPABASE_SERVICE_ROLE_KEY'),
    userId:      p.getProperty('RECRUITING_USER_ID'),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN — runs every 10 minutes via trigger
// ─────────────────────────────────────────────────────────────────────────────

function processRecruitingEmails() {
  const keys    = getKeys()
  const props   = PropertiesService.getScriptProperties()
  const myEmail = Session.getActiveUser().getEmail().toLowerCase()

  // Three discovery sources, deduped by thread ID since a thread can appear in more than one:
  // (1) threads already labeled 'recruiting' (inbound emails, or previously-discovered
  // sent/inbox threads — see the label-application step below), (2) recent Sent-folder
  // threads not yet labeled, which catches brand-new cold outreach the user sends, and
  // (3) recent Inbox threads not yet labeled that look recruiting-shaped by sender/subject —
  // this is what catches a fresh ATS "application received" email the user never manually
  // labeled (see INBOX_SCAN_QUERY above for why this exists).
  const labeledThreads = GmailApp.search(`label:${RECRUITING_LABEL}`, 0, 25)
  const sentThreads     = GmailApp.search(SENT_SCAN_QUERY, 0, 25)
  const inboxThreads    = GmailApp.search(INBOX_SCAN_QUERY, 0, 25)
  const threadsById     = new Map()
  ;[...labeledThreads, ...sentThreads, ...inboxThreads].forEach(t => threadsById.set(t.getId(), t))
  const threads = [...threadsById.values()]

  if (!threads.length) {
    console.log('No recruiting threads found.')
    return
  }

  const doneLabel       = getOrCreateLabel(DONE_LABEL)
  const recruitingLabel = getOrCreateLabel(RECRUITING_LABEL)
  console.log(`Scanning ${threads.length} thread(s)`)

  threads.forEach(thread => {
    const threadId = thread.getId()
    const seenKey  = `msgcount_${threadId}`
    try {
      const messages = thread.getMessages()
      const seen     = Number(props.getProperty(seenKey) || 0)

      if (messages.length <= seen) return // nothing new since last run

      const msg      = messages[messages.length - 1]
      const subject  = msg.getSubject()
      const from     = msg.getFrom()
      const body     = msg.getPlainBody().slice(0, 4000)
      const date     = Utilities.formatDate(msg.getDate(), 'UTC', 'yyyy-MM-dd')

      // Deterministic meeting signals, extracted before the Claude call so they can be fed
      // in as hints — an attached .ics or a Zoom/Meet/Teams link is more reliable evidence
      // of a real scheduled meeting than asking Claude to spot a date in free text.
      const invite      = extractCalendarInvite(msg)
      const meetingLink = (invite && invite.meetingLink) || extractMeetingLink(body)

      // More deterministic hints, same philosophy as the invite/link ones above: cheap regex
      // signals fed into the prompt rather than left for Claude to infer unaided, since a
      // single-shot Haiku call can miss a referral mention or an ATS confirmation buried in
      // boilerplate. Claude still makes the final call — these only raise recall.
      const applicationHint = APPLICATION_CONFIRMATION_RE.test(subject + ' ' + body)
        ? '\n\nThis email\'s subject/body matches typical automated application-confirmation phrasing ("thank you for applying", "application received", etc.) — likely type APPLICATION_CONFIRMATION unless the content actually indicates a later stage (interview/offer/rejection).'
        : ''
      const referralHint = REFERRAL_MENTION_RE.test(body)
        ? '\n\nThis email appears to mention a referral or recommendation. If a specific person is named as having referred/recommended the candidate, extract their name into "referrer_name".'
        : ''
      const oaHint = OA_INVITE_RE.test(subject + ' ' + body)
        ? '\n\nThis email\'s subject/body matches typical Online Assessment (OA) invite phrasing (HackerRank/CodeSignal/Codility/etc., or a generic "complete your assessment" template) — likely type OA_INVITE. Extract oa_due_date only if the email actually states a completion deadline, and oa_link as the URL the candidate clicks to start/complete the assessment.'
        : ''
      const companyHint = guessCompanyHint(from)

      console.log(`→ "${subject}" from ${from} (${messages.length - seen} new message(s))`)

      const data = extractWithClaude(
        keys.anthropic, subject, from, body, date, invite, meetingLink,
        applicationHint + referralHint + oaHint + companyHint,
      )

      if (!data || data.type === 'UNRELATED') {
        console.log('  Skipped — UNRELATED')
        thread.addLabel(doneLabel)
        props.setProperty(seenKey, String(messages.length))
        return
      }

      // Claude's own meeting_link guess (from prompt JSON) is only a fallback for cases the
      // regex above missed — the deterministic sources win when present.
      data.meeting_link = meetingLink || data.meeting_link || null

      if (invite) {
        // An attached calendar invite is ground truth for timing — overrides Claude's
        // text-guessed date/format rather than merely supplementing it.
        data.interview_date = Utilities.formatDate(invite.start, 'UTC', 'yyyy-MM-dd')
        data.interview_time = invite
        if (!['INTERVIEW_INVITE', 'OFFER'].includes(data.type)) data.type = 'INTERVIEW_INVITE'
        if (!data.interview_format) data.interview_format = data.meeting_link ? 'video' : data.interview_format
      }

      // Header-derived address is authoritative — Claude never guesses contact_email from
      // body text, since that breaks when the newest message is outbound (its 'from' header
      // is the user's own address, not the recruiter's). See findCounterpartAddress().
      const counterpart = findCounterpartAddress(messages, myEmail)
      data.contact_email = counterpart.email || null
      if (!data.contact_name && counterpart.displayName) data.contact_name = counterpart.displayName

      console.log(`  Type: ${data.type} | ${data.contact_name} @ ${data.company}${data.meeting_link ? ` | ${data.meeting_link}` : ''}`)

      const contactId = upsertContact(keys, data)

      if (['APPLICATION_CONFIRMATION', 'OA_INVITE', 'INTERVIEW_INVITE', 'OFFER', 'REJECTION'].includes(data.type)) {
        upsertApplication(keys, data)
      }

      if (data.interview_date) {
        createCalendarEvent(data)
      }

      // Log every message new since the last run as its own Interactions row (no LLM call —
      // classification above already ran once against the newest message).
      // Simplifying assumption: the whole thread maps to the one contact resolved above,
      // even if a second person is CC'd on some messages.
      for (let i = seen; i < messages.length; i++) {
        const isNewest = i === messages.length - 1
        logMessageInteraction(keys, messages[i], contactId, threadId, myEmail, isNewest ? data.meeting_link : null)
      }

      // A thread discovered via the Sent-folder or Inbox keyword search (not already labeled)
      // gets the 'recruiting' label applied now that it's confirmed relevant — keeps Gmail's
      // own label view consistent and means future runs find it via the primary labeled search.
      const labelNames = thread.getLabels().map(l => l.getName())
      if (!labelNames.includes(RECRUITING_LABEL)) thread.addLabel(recruitingLabel)

      thread.addLabel(doneLabel)
      props.setProperty(seenKey, String(messages.length))
      console.log('  ✓ Written to Supabase')

    } catch (e) {
      console.error(`  ✗ ${e.message}`)
      // Don't update seenKey — will retry next run
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// CLAUDE — classify + extract in one Haiku call
// ─────────────────────────────────────────────────────────────────────────────

function extractWithClaude(apiKey, subject, from, body, date, invite, meetingLink, extraHints) {
  // Deterministic signals (calendar invite attachment, Zoom/Meet/Teams link, application-
  // confirmation phrasing, referral mentions, sender-domain company guess) are handed to
  // Claude as hints rather than left for it to re-derive from free text — see
  // extractCalendarInvite()/extractMeetingLink() and their callers in processRecruitingEmails().
  const inviteHint = invite
    ? `\n\nThis email has a calendar invite attached: "${invite.summary || subject}", scheduled for ${Utilities.formatDate(invite.start, 'UTC', 'yyyy-MM-dd HH:mm')} UTC${invite.location ? ` at/via ${invite.location}` : ''}. Treat this as strong evidence of a real scheduled interview/meeting.`
    : ''
  const linkHint = meetingLink ? `\n\nA video meeting link was found in this email: ${meetingLink}` : ''

  const prompt = `You are processing recruiting emails for a CS student targeting SWE internships.

Analyze this email. Return ONLY valid JSON — no explanation, no markdown.

If not recruiting-related: {"type":"UNRELATED"}

Otherwise return:
{
  "type": "APPLICATION_CONFIRMATION|OA_INVITE|REPLY|INTERVIEW_INVITE|OFFER|REJECTION|NEW_CONTACT|FOLLOW_UP_NEEDED",
  "contact_name": "the recruiter/contact's full name if mentioned in the body or signature, else null — their email address is resolved separately from message headers, not from this field",
  "company": "company name",
  "role": "role title or null",
  "summary": "2-sentence summary of what this email means for the candidate",
  "urgency": "HIGH|MED|LOW",
  "next_action": "one concrete action the candidate should take",
  "follow_up_draft": "3-sentence reply the candidate could send, or null",
  "interview_date": "YYYY-MM-DD if an interview is scheduled, or null",
  "interview_format": "phone|video|onsite|null",
  "meeting_link": "the Zoom/Google Meet/Teams/etc. video call URL if one is mentioned in the body, else null",
  "referrer_name": "the full name of the person who referred/recommended the candidate for this specific role, ONLY if the email explicitly says so (e.g. 'referred by Jane Doe', 'submitted your referral', 'thanks to an employee referral from...'). Otherwise null — never guess.",
  "oa_due_date": "YYYY-MM-DD if this is an Online Assessment invite AND the email states a completion deadline, else null — never guess or estimate a date that isn't actually stated",
  "oa_link": "the URL the candidate clicks to start/complete the Online Assessment, if this is an OA_INVITE, else null"
}

APPLICATION_CONFIRMATION means an automated "we received your application" acknowledgment
(typically from an ATS like Greenhouse/Lever/Workday, or the company's own no-reply address)
where no human has replied yet — this is distinct from REPLY (a human responding) and should
still be returned even though nothing else has happened yet, so the application gets tracked
from the moment it's submitted rather than only once someone replies.

OA_INVITE means the email invites the candidate to complete an Online Assessment — a coding/
skills test, typically via HackerRank/CodeSignal/Codility/HackerEarth or a similar platform.
Extract oa_due_date only when the email explicitly states a completion deadline ("complete by
August 20", "you have 7 days to complete this assessment", etc.) — many OA invites don't state
one at all, in which case leave it null rather than estimating from the email's send date.${inviteHint}${linkHint}${extraHints || ''}

Subject: ${subject}
From: ${from}
Date: ${date}
Body:
${body}`

  const resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method:             'post',
    muteHttpExceptions: true,
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    payload: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 700,
      messages:   [{ role: 'user', content: prompt }],
    }),
  })

  if (resp.getResponseCode() !== 200) {
    throw new Error(`Claude ${resp.getResponseCode()}: ${resp.getContentText().slice(0, 200)}`)
  }

  const text  = JSON.parse(resp.getContentText()).content[0].text
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON in Claude response')
  return JSON.parse(match[0])
}

// ─────────────────────────────────────────────────────────────────────────────
// ADDRESS PARSING — deterministic counterpart resolution from Gmail headers
// ─────────────────────────────────────────────────────────────────────────────

function parseAddress(headerStr) {
  if (!headerStr) return null
  const m = headerStr.match(/(.*)<(.+)>/)
  if (m) return { displayName: m[1].replace(/["']/g, '').trim(), email: m[2].trim().toLowerCase() }
  const email = headerStr.trim().toLowerCase()
  return email ? { displayName: '', email } : null
}

function parseAddressList(headerStr) {
  if (!headerStr) return []
  return headerStr.split(',').map(parseAddress).filter(Boolean)
}

// Resolves the "other party" on a thread from the newest message's headers, so contact
// identification doesn't depend on Claude guessing an email address out of body text —
// which breaks when the newest message is one the user sent (the From header is then the
// user's own address, not the recruiter's). Checks From, then To, then Cc, in that order,
// skipping any address that's the user's own. Simplifying assumption: the whole thread maps
// to one contact even if a second person is CC'd — same assumption the interaction-logging
// loop in processRecruitingEmails() already makes.
function findCounterpartAddress(messages, myEmail) {
  const msg  = messages[messages.length - 1]
  const from = parseAddress(msg.getFrom())
  if (from && from.email !== myEmail) return from

  const candidates = [...parseAddressList(msg.getTo()), ...parseAddressList(msg.getCc())]
  return candidates.find(a => a.email !== myEmail) || { displayName: '', email: null }
}

// A weak company-name guess from the sender's email domain, handed to Claude as a hint (not a
// fact) to cross-check against the actual body text — some automated ATS acknowledgment
// templates never restate the company name in plain prose, so the domain is sometimes the only
// signal available. Skips known ATS platform domains (the company they're hosting for is never
// the ATS vendor's own name) and generic webmail domains (never the company).
function guessCompanyHint(fromHeader) {
  const addr = parseAddress(fromHeader)
  const domain = addr && addr.email ? addr.email.split('@')[1] : null
  if (!domain || GENERIC_EMAIL_DOMAINS.has(domain)) return ''
  if (ATS_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))) return ''

  const labels = domain.split('.')
  const root   = labels.length > 2 ? labels[labels.length - 2] : labels[0] // strip subdomains like mail./careers./no-reply.
  const guess  = root.charAt(0).toUpperCase() + root.slice(1)
  return `\n\nThe sender's email domain is ${domain}, which may indicate the company is "${guess}" — verify against the actual email content and use the real name/casing if stated there instead.`
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE (PostgREST) helpers
// ─────────────────────────────────────────────────────────────────────────────

// Raw HTTP against Supabase's PostgREST API — Apps Script has no npm, so this stands in for
// what api/_lib/supabaseAdmin.js does with @supabase/supabase-js elsewhere in this repo. The
// service-role key bypasses RLS entirely, same trust level as that file's supabaseAdmin().
function supabaseReq(keys, method, path, body) {
  const opts = {
    method,
    muteHttpExceptions: true,
    headers: {
      'apikey':        keys.supabaseKey,
      'Authorization': `Bearer ${keys.supabaseKey}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
    },
  }
  if (body) opts.payload = JSON.stringify(body)

  const resp = UrlFetchApp.fetch(`${keys.supabaseUrl}/rest/v1${path}`, opts)
  const code = resp.getResponseCode()
  if (code >= 400) throw new Error(`Supabase ${code}: ${resp.getContentText().slice(0, 200)}`)
  const text = resp.getContentText()
  return text ? JSON.parse(text) : null
}

// True for a mailbox that's structurally not a person — no-reply/notification/ATS-system
// addresses. Found by checking this fix against real data: an application-confirmation email
// from noreply@google.com (or a Greenhouse relay like no-reply@us.greenhouse-mail.io) was
// resolving as the thread's "counterpart" via findCounterpartAddress() same as any human
// sender would, and upsertContact() dutifully created a contact named "Unknown" for it — real
// automated-sender junk that then polluted company-network-coverage features elsewhere in the
// app (e.g. Pipeline showing "1 contact here" at a company where the only "contact" was a
// no-reply mailbox, not a person). Skipping contact creation for these doesn't lose anything:
// the application itself is still created/updated by upsertApplication() independent of any
// contact_id, and the email is still logged to Interactions with contact_id left null.
const AUTOMATED_SENDER_RE = /^(no-?reply|do-?not-?reply|notification|mailer|automated|system|recruiting|careers|jobs|ats|talent)@|greenhouse-mail\.io$/i

function upsertContact(keys, data) {
  if (!data.contact_name && data.contact_email && AUTOMATED_SENDER_RE.test(data.contact_email)) {
    console.log(`  Skipped contact creation — automated sender (${data.contact_email})`)
    return null
  }

  const today    = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd')
  const followUp = Utilities.formatDate(new Date(Date.now() + 3 * 86400000), 'UTC', 'yyyy-MM-dd')

  // Try to find existing contact by email
  let existingId = null
  if (data.contact_email) {
    const res = supabaseReq(keys, 'get',
      `/contacts?user_id=eq.${keys.userId}&email=eq.${encodeURIComponent(data.contact_email)}&select=id&limit=1`)
    existingId = res?.[0]?.id
  }

  // Status is only set on create, not on every update — otherwise re-processing a thread
  // would silently overwrite a status you'd manually changed in the UI (e.g. to Hot) back to
  // the default 'Cooling'. Everything else refreshes on every run.
  const updateProps = {
    company:          data.company || '',
    last_interaction: today,
    follow_up_date:   followUp,
    urgency:          data.urgency || 'LOW',
    notes:            data.summary || '',
    ...(data.contact_email ? { email: data.contact_email } : {}),
  }

  if (existingId) {
    supabaseReq(keys, 'patch', `/contacts?id=eq.${existingId}`, updateProps)
    console.log(`  Contact updated: ${existingId}`)
    return existingId
  } else {
    const created = supabaseReq(keys, 'post', '/contacts', {
      user_id: keys.userId,
      name:    data.contact_name || 'Unknown',
      status:  '🟡 Cooling',
      ...updateProps,
    })
    console.log(`  Contact created: ${data.contact_name}`)
    return created?.[0]?.id
  }
}

function logMessageInteraction(keys, message, contactId, threadId, myEmail, meetingLink) {
  const from      = parseAddress(message.getFrom())
  const direction = (from && from.email === myEmail) ? 'Outbound' : 'Inbound'
  const date      = Utilities.formatDate(message.getDate(), 'UTC', 'yyyy-MM-dd')
  const plainBody = message.getPlainBody()
  // Surface the meeting link at the top of the summary (only passed for the newest message,
  // the one that was actually classified) so it's visible at a glance in the Interactions row.
  const summary   = meetingLink ? `📅 Meeting link: ${meetingLink}\n\n${plainBody}` : plainBody

  supabaseReq(keys, 'post', '/interactions', {
    user_id:     keys.userId,
    contact_id:  contactId || null,
    type:        'Email',
    direction,
    date,
    channel_ref: threadId,
    summary:     summary.slice(0, 300),
    body:        plainBody.slice(0, 2000),
  })
}

// Ordinal ranking used to stop a later, unrelated signal from *regressing* an application's
// stage — e.g. a second, separate application-confirmation email at the same company (fuzzy
// company match can land on the wrong row) should never knock a 'Phone Screen' back down to
// 'Applied'. REJECTION is exempt from this guard below since a rejection is terminal and can
// legitimately land at any stage.
const STAGE_RANK = { Wishlist: 0, Applied: 1, 'Phone Screen': 2, Onsite: 3, Offer: 4, Rejected: 5 }

// Best-effort name match against existing Contacts, used to resolve a Claude-extracted
// referrer_name into a real referred_by_id — see the "referrer_name" field in
// extractWithClaude()'s prompt. Same ilike-contains approach as the company fuzzy match below;
// a false match just leaves the field pointing at a plausible contact rather than failing loud,
// which is acceptable for a field the app already lets the user correct manually in the UI.
function findContactByName(keys, name) {
  if (!name) return null
  const res = supabaseReq(keys, 'get',
    `/contacts?user_id=eq.${keys.userId}&name=ilike.*${encodeURIComponent(name)}*&select=id&limit=1`)
  return res?.[0]?.id || null
}

function upsertApplication(keys, data) {
  const today = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd')
  const stageMap = {
    APPLICATION_CONFIRMATION: 'Applied',
    OA_INVITE:                'Applied', // OA is a sub-state of Applied, not its own pipeline stage
    INTERVIEW_INVITE:         'Phone Screen',
    OFFER:                    'Offer',
    REJECTION:                'Rejected',
  }
  const stage = stageMap[data.type] || 'Applied'
  const referrerId = data.referrer_name ? findContactByName(keys, data.referrer_name) : null

  // Fuzzy match on company name (same fragile-but-workable approach as the old Notion
  // title-contains filter) — applications has no unique constraint on (user_id, company).
  const res = supabaseReq(keys, 'get',
    `/applications?user_id=eq.${keys.userId}&company=ilike.*${encodeURIComponent(data.company || '')}*&archived=eq.false&order=created_at.desc&limit=1&select=id,stage,referred_by_id,oa_completed`)
  const existing = res?.[0]

  const props = {
    last_activity: today,
    ...(stage === 'Rejected' ? { closed_date: today } : {}),
    ...(data.role ? { role: data.role } : {}),
    // Referred-by is set once and never overwritten automatically, same rationale as contact
    // status below — don't let a later email silently clobber a manually-corrected value.
    ...(referrerId && !existing?.referred_by_id ? { referred_by_id: referrerId } : {}),
    // OA fields only refresh from a fresh OA_INVITE email, and never once the candidate has
    // already marked the assessment completed — otherwise a stray later email (re-fuzzy-matched
    // onto the same application) could resurrect oa_due_date/oa_link for an assessment that's
    // done. Unlike referred_by_id, these DO refresh on every OA_INVITE while still open, since a
    // company sometimes re-sends the same invite with a corrected/extended deadline.
    ...(data.type === 'OA_INVITE' && !existing?.oa_completed
      ? { oa_due_date: data.oa_due_date || null, oa_link: data.oa_link || null, oa_research_checked_at: null }
      : {}),
  }

  if (existing) {
    const currentRank = STAGE_RANK[existing.stage] ?? 0
    const newRank     = STAGE_RANK[stage] ?? 0
    // REJECTION always applies (terminal, can happen from any stage) — every other signal only
    // moves the stage forward, never backward.
    if (stage === 'Rejected' || newRank >= currentRank) props.stage = stage
    supabaseReq(keys, 'patch', `/applications?id=eq.${existing.id}`, props)
    console.log(`  Application updated → ${props.stage || existing.stage}`)
  } else {
    supabaseReq(keys, 'post', '/applications', {
      user_id:      keys.userId,
      company:      data.company || 'Unknown',
      applied_date: today,
      stage,
      ...props,
    })
    console.log(`  Application created → ${stage}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE CALENDAR
// ─────────────────────────────────────────────────────────────────────────────

function createCalendarEvent(data) {
  if (!data.interview_date) return

  // A parsed calendar-invite attachment gives an exact start/end — prefer it over the
  // 2–3pm placeholder window, which is only a fallback for text-only date mentions with no
  // attached invite (see extractCalendarInvite()).
  let start, end
  if (data.interview_time && data.interview_time.start) {
    start = data.interview_time.start
    end   = data.interview_time.end || new Date(start.getTime() + 60 * 60000)
  } else {
    const [y, m, d] = data.interview_date.split('-').map(Number)
    start = new Date(y, m - 1, d, 14, 0)
    end   = new Date(y, m - 1, d, 15, 0)
  }

  const title = `Interview — ${data.company}${data.role ? ` · ${data.role}` : ''}`
  const desc  = [
    data.summary,
    `Format: ${data.interview_format || 'TBD'}`,
    data.meeting_link ? `Meeting link: ${data.meeting_link}` : '',
    `Next action: ${data.next_action || '—'}`,
    data.follow_up_draft ? `\nDraft reply:\n${data.follow_up_draft}` : '',
  ].filter(Boolean).join('\n')

  const opts = { description: desc }
  if (data.meeting_link) opts.location = data.meeting_link

  CalendarApp.getDefaultCalendar().createEvent(title, start, end, opts)
  console.log(`  Calendar event: ${title} on ${data.interview_date}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// MEETING SIGNALS — calendar invites (.ics attachments) and video-call links, detected
// deterministically rather than relying on Claude to spot a date/link in free text. An
// attached invite in particular is authoritative: it has an exact start/end time, unlike a
// date guessed from prose ("let's meet next Tuesday").
// ─────────────────────────────────────────────────────────────────────────────

const MEETING_LINK_RE = /https?:\/\/[^\s<>"')\]]*(?:zoom\.us\/j\/|meet\.google\.com\/|teams\.microsoft\.com\/l\/meetup-join|teams\.live\.com\/meet|webex\.com\/(?:meet|join))[^\s<>"')\]]*/i

function extractMeetingLink(text) {
  if (!text) return null
  const m = text.match(MEETING_LINK_RE)
  return m ? m[0].replace(/[.,)\]]+$/, '') : null
}

// RFC 5545 line-folding: a line that's too long continues on the next physical line, which
// starts with a space or tab. Unfold before parsing so a folded DTSTART/DESCRIPTION doesn't
// silently truncate at the fold point.
function unfoldIcs(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '')
}

function icsField(text, name) {
  // Matches "NAME:value" and "NAME;PARAM=x:value" (e.g. DTSTART;TZID=America/New_York:...)
  const m = text.match(new RegExp(`^${name}(?:;[^:\\n]*)?:(.*)$`, 'im'))
  return m ? m[1].trim() : null
}

// Handles both UTC form (DTSTART:20260815T140000Z) and local/floating form
// (DTSTART:20260815T140000 or DTSTART;TZID=...:20260815T140000). TZID-qualified values are
// treated as local time — good enough here since events this script creates already land on
// the script owner's default calendar timezone.
function parseIcsDate(value) {
  if (!value) return null
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/)
  if (!m) return null
  const [, y, mo, d, h, mi, s, isUtc] = m
  return isUtc
    ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s))
    : new Date(+y, +mo - 1, +d, +h, +mi, +s)
}

function extractCalendarInvite(message) {
  let attachments
  try {
    attachments = message.getAttachments({ includeInlineImages: false })
  } catch (e) {
    return null
  }
  const ics = attachments.find(a =>
    /\.ics$/i.test(a.getName() || '') || (a.getContentType() || '').indexOf('text/calendar') !== -1)
  if (!ics) return null

  try {
    const text        = unfoldIcs(ics.getDataAsString())
    const start        = parseIcsDate(icsField(text, 'DTSTART'))
    if (!start) return null
    const end           = parseIcsDate(icsField(text, 'DTEND'))
    const summary       = icsField(text, 'SUMMARY')
    const location       = icsField(text, 'LOCATION')
    const description    = (icsField(text, 'DESCRIPTION') || '').replace(/\\n/g, '\n')
    const meetingLink    = extractMeetingLink(location) || extractMeetingLink(description)

    return { start, end, summary, location, meetingLink }
  } catch (e) {
    console.error(`  ICS parse failed: ${e.message}`)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SETUP & TESTING
// ─────────────────────────────────────────────────────────────────────────────

// Gmail enforces label names as case-insensitive-unique, so GmailApp.createLabel(name) throws
// if a differently-cased label already exists — which it does here: this account's label is
// "Recruiting" (capitalized, likely renamed by hand at some point in Gmail's UI), not the
// lowercase 'recruiting' this script has always hardcoded. getUserLabelByName() is exact-match
// only, so without this fallback every run would fail before touching a single thread. Reuse
// whatever casing already exists instead of trying to create a colliding duplicate.
function getOrCreateLabel(name) {
  const exact = GmailApp.getUserLabelByName(name)
  if (exact) return exact
  const existing = GmailApp.getUserLabels().find(l => l.getName().toLowerCase() === name.toLowerCase())
  return existing || GmailApp.createLabel(name)
}

// Run this once manually to verify everything is wired up
function setup() {
  const keys = getKeys()

  if (!keys.anthropic) {
    console.log('MISSING: Add ANTHROPIC_API_KEY to Script Properties (gear icon → Script Properties)')
    return
  }
  if (!keys.supabaseUrl || !keys.supabaseKey) {
    console.log('MISSING: Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to Script Properties')
    return
  }
  if (!keys.userId) {
    console.log('MISSING: Add RECRUITING_USER_ID to Script Properties (the Supabase auth.users id this pipeline writes to)')
    return
  }

  getOrCreateLabel(DONE_LABEL)
  getOrCreateLabel(RECRUITING_LABEL)
  console.log('✓ Labels created')
  console.log('✓ Keys found')
  console.log('✓ Setup complete')
  console.log('')
  console.log('Next: Triggers (clock icon) → Add Trigger → processRecruitingEmails → Time-driven → Every 10 minutes')
}

// Send yourself a test email, then run this to process it immediately
function runNow() {
  processRecruitingEmails()
}
