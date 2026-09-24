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
//        NTFY_TOPIC              =  (optional) a long random string, e.g. "ethan-recruiting-x7f2q9"
//                                    — enables push-notification reminders, see below. Leave unset
//                                    to skip pushes entirely (everything else still works).
//        DASHBOARD_URL           =  (optional) e.g. https://recruiting-os-phi.vercel.app — lets the
//                                    daily recap push (see below) open the app when tapped.
//   3. Run setup() once manually — approve all permission prompts
//   4. Triggers (clock icon) → Add Trigger:
//        Function: processRecruitingEmails
//        Event: Time-driven → Every 10 minutes
//   5. (optional, for reminders) Triggers → Add Trigger:
//        Function: checkOaDeadlines
//        Event: Time-driven → Day timer → pick an hour (e.g. 9am–10am)
//   6. (optional, for the daily recap) Triggers → Add Trigger:
//        Function: generateDailyRecap
//        Event: Time-driven → Day timer → pick an hour (e.g. 7am–8am, before your day starts)
//   7. (one-time, to catch up on mail older than the regular job's 30/45-day windows) run
//      runBackfillChunk() manually, repeatedly, until its log says "✓ Backfill complete." —
//      see the BACKFILL section below for how it chunks/resumes across Apps Script's
//      execution time cap. Or add a temporary Trigger (every 5 min) and remove it once done.
//
// PUSH REMINDERS (optional, via ntfy.sh — free, no account, no phone number needed):
//   ntfy.sh is a public push-notification relay: anything POSTed to https://ntfy.sh/<topic>
//   shows up as a real phone push notification to anyone subscribed to that topic. Setup:
//     1. Install the "ntfy" app (iOS/Android) or open https://ntfy.sh/app in a browser.
//     2. Pick a long, hard-to-guess topic name (it's the only thing gating who can push to
//        it — treat it like a secret) and subscribe to it in the app.
//     3. Set NTFY_TOPIC to that same string in Script Properties above.
//   Once set, this script pushes immediately when a thread is classified as OA_INVITE,
//   INTERVIEW_INVITE, OFFER, or REJECTION (see notifyStatusChange()), and once a day
//   (via the checkOaDeadlines trigger above) digests any OA due within 3 days or overdue —
//   see checkOaDeadlines() below. Deliberately not email: the whole point is a notification
//   that doesn't get lost in an inbox that's already full of the emails this script reads.
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
// COST: ~$0.001/email with Haiku (discovery is now ungated — see INBOX_SCAN_QUERY — so this
// scales with total inbox volume in the window, not just recruiting-shaped mail). Plus one
// Sonnet call/day (a few cents) if generateDailyRecap()'s trigger is enabled.
// ─────────────────────────────────────────────────────────────────────────────

const DONE_LABEL      = 'recruiting-done' // visual marker in Gmail only — no longer used to gate processing, since threads can grow replies after being marked done
const RECRUITING_LABEL = 'recruiting'
// Recent Sent-folder threads not yet labeled — catches brand-new cold outreach the user
// sends that never went through an already-labeled thread. 30d bounds the first-run backfill.
const SENT_SCAN_QUERY = `in:sent -label:${RECRUITING_LABEL} newer_than:30d`

// ATS platforms and recruiting-shaped subject phrasing. These USED to gate which inbound
// emails were even discovered (see INBOX_SCAN_QUERY's old form, git history) — that was a
// real gap: a recruiter emailing from a personal address, or an informal reply with no
// ATS-shaped subject, was completely invisible no matter what Claude might have made of it.
// Discovery is ungated now (INBOX_SCAN_QUERY below scans every inbox thread in the window) —
// these constants only feed the classification prompt as a recall hint via
// recruitingShapeHint() and guessCompanyHint(), same "cheap Haiku call vs. silently missed
// application" tradeoff as every other *_RE hint in this file, just applied one level out.
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
// Recent Inbox threads not yet labeled — ungated (no from:/subject: filter): every inbox
// thread in the window gets one Haiku classification call, and Claude alone decides
// UNRELATED vs. not. At ~$0.001/email this is not a real cost concern for one personal
// inbox, and it closes the exact gap the old keyword gate left open. 45d bounds the regular
// 10-minute job's window — see runBackfillChunk() below for historical mail older than this.
const INBOX_SCAN_QUERY = `in:inbox -label:${RECRUITING_LABEL} newer_than:45d`

// Per-search result cap for the regular 10-minute job. Was 25 back when INBOX_SCAN_QUERY was
// keyword-gated to a small subset of inbox mail; raised now that it scans everything in the
// window. Bump further if the log ever reports a search hitting this cap.
const SEARCH_CAP = 150

function recruitingShapeHint(fromHeader, subject, body) {
  const addr = parseAddress(fromHeader)
  const domain = addr && addr.email ? addr.email.split('@')[1] : null
  const fromAts = !!domain && ATS_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))
  const keywordRe = new RegExp(`\\b(${RECRUITING_SUBJECT_KEYWORDS.map(k => k.replace(/"/g, '')).join('|')})\\b`, 'i')
  if (!fromAts && !keywordRe.test(subject) && !keywordRe.test(body.slice(0, 500))) return ''
  return '\n\nThis email is from a known ATS domain and/or has recruiting-shaped subject/body phrasing — a signal it may be recruiting-related, but still classify UNRELATED if the actual content isn\'t.'
}

// Recall net for relationship-building mail, same philosophy/shape as recruitingShapeHint()
// above — a networking-focused inbox skews toward this kind of mail far more than formal
// application traffic, and neither NEW_CONTACT nor FOLLOW_UP_NEEDED had a hint at all before.
const NETWORKING_SHAPE_KEYWORDS = [
  'nice meeting you', 'great meeting you', 'great to connect', 'great connecting',
  'stay in touch', 'keep in touch', 'coffee chat', 'informational interview', 'career fair',
  'info session', 'happy to help', 'happy to chat', 'would love to connect',
  'thanks for reaching out', 'thanks for connecting', 'introduce you', 'introduction to',
]
function networkingShapeHint(subject, body) {
  const keywordRe = new RegExp(`\\b(${NETWORKING_SHAPE_KEYWORDS.join('|')})\\b`, 'i')
  if (!keywordRe.test(subject) && !keywordRe.test(body.slice(0, 500))) return ''
  return '\n\nThis email has networking-shaped language (relationship-building, an event/introduction, a coffee chat/informational interview) — likely NEW_CONTACT or FOLLOW_UP_NEEDED even with no specific job/application mentioned. Still classify UNRELATED if it\'s genuinely unrelated to the candidate\'s job search or professional network.'
}

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
// Submission confirmations from the same ATS/OA platforms — the counterpart to OA_INVITE_RE,
// used to auto-clear oa_completed instead of relying on the candidate to remember to click
// "Mark completed" in the app (see checkOaDeadlines()'s daily nag, which this stops).
const OA_COMPLETED_RE = /\b(assessment (?:has been |was )?(?:submitted|completed)|(?:submitted|completed) (?:your|the) assessment|thank(?:s| you) for completing|test (?:has been |was )?(?:submitted|completed)|your (?:hackerrank|codesignal|codility|hackerearth) (?:test|assessment) (?:is complete|has been received))\b/i

function getKeys() {
  const p = PropertiesService.getScriptProperties()
  return {
    anthropic:   p.getProperty('ANTHROPIC_API_KEY'),
    supabaseUrl: p.getProperty('SUPABASE_URL'),
    supabaseKey: p.getProperty('SUPABASE_SERVICE_ROLE_KEY'),
    userId:      p.getProperty('RECRUITING_USER_ID'),
    ntfyTopic:   p.getProperty('NTFY_TOPIC'),
    // Optional — lets the daily recap push's tap-to-open link land directly on the
    // dashboard instead of just showing text. Unset means the push still sends, just
    // without a click-through target. e.g. https://recruiting-os-phi.vercel.app
    dashboardUrl: p.getProperty('DASHBOARD_URL'),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUSH NOTIFICATIONS — ntfy.sh, optional (see setup comment above)
// ─────────────────────────────────────────────────────────────────────────────

// Fail-soft and a no-op when NTFY_TOPIC isn't set — a push reminder is a nice-to-have, never
// something that should break email processing or leave a thread unprocessed if it fails.
// UrlFetchApp intermittently throws "Address unavailable" against ntfy.sh specifically — a
// known, reported flakiness in Apps Script's fetch against Cloudflare-fronted origins (this
// project already hit the same class of issue with events.umich.edu's Cloudflare challenge,
// see the Ingestion section above), not a real outage: ntfy.sh itself responds in well under
// a second when hit from anywhere else. A short retry clears it almost every time.
const PUSH_RETRY_ATTEMPTS = 3
const PUSH_RETRY_DELAY_MS = 1500
// notifyStatusChange() only fires for a message this fresh — see the isFreshEnoughToPush
// comment at its call site for why. 2 days covers the 10-min job's own normal latency plus
// weekend/offline gaps without ever treating real catch-up mail as "new."
const PUSH_STALE_THRESHOLD_MS = 2 * 86400000

function sendPush(keys, { title, message, priority = 'default', tags = [], click }) {
  if (!keys.ntfyTopic) return
  for (let attempt = 1; attempt <= PUSH_RETRY_ATTEMPTS; attempt++) {
    try {
      const headers = {
        Title:    title,
        Priority: priority,
        Tags:     tags.join(','),
      }
      // ntfy opens this URL when the notification itself is tapped — the literal
      // "recap I can click" mechanism for generateDailyRecap() below.
      if (click) headers.Click = click
      const resp = UrlFetchApp.fetch(`https://ntfy.sh/${keys.ntfyTopic}`, {
        method:             'post',
        muteHttpExceptions: true,
        payload:            message,
        headers,
      })
      if (resp.getResponseCode() >= 400) {
        throw new Error(`ntfy ${resp.getResponseCode()}: ${resp.getContentText().slice(0, 200)}`)
      }
      return // success
    } catch (e) {
      const lastAttempt = attempt === PUSH_RETRY_ATTEMPTS
      console.error(`  ✗ push attempt ${attempt}/${PUSH_RETRY_ATTEMPTS} failed: ${e.message}${lastAttempt ? ' — giving up' : ' — retrying'}`)
      if (!lastAttempt) Utilities.sleep(PUSH_RETRY_DELAY_MS)
    }
  }
}

// One push per classified thread for the status changes worth interrupting you for — not
// APPLICATION_CONFIRMATION or REPLY, which are routine enough to just show up in the app.
function notifyStatusChange(keys, data) {
  const company = data.company || 'Unknown company'
  const role    = data.role ? ` — ${data.role}` : ''

  if (data.type === 'OA_INVITE') {
    const due = data.oa_due_date ? `\nDue ${data.oa_due_date}` : '\nNo stated deadline — check the assessment page.'
    sendPush(keys, {
      title: `🧪 OA received — ${company}`,
      message: `${role.slice(3) || 'Online Assessment'}${due}${data.oa_link ? `\n${data.oa_link}` : ''}`,
      priority: 'high',
      tags: ['test_tube'],
    })
  } else if (data.type === 'OA_COMPLETED') {
    // Deliberately low priority/default, unlike OA_INVITE — this is a quiet confirmation that
    // the daily checkOaDeadlines() digest will stop nagging about this one, not urgent news.
    sendPush(keys, {
      title: `✅ OA marked complete — ${company}`,
      message: `${role.slice(3) || 'Online Assessment'}\nNo more deadline reminders for this one.`,
      priority: 'default',
      tags: ['white_check_mark'],
    })
  } else if (data.type === 'INTERVIEW_INVITE') {
    sendPush(keys, {
      title: `📞 Interview invite — ${company}`,
      message: `${role.slice(3) || ''}${data.interview_date ? `\nScheduled ${data.interview_date}` : ''}`.trim(),
      priority: 'high',
      tags: ['phone'],
    })
  } else if (data.type === 'OFFER') {
    sendPush(keys, {
      title: `🎉 Offer — ${company}!`,
      message: role.slice(3) || 'Offer received',
      priority: 'urgent',
      tags: ['tada'],
    })
  } else if (data.type === 'REJECTION') {
    sendPush(keys, {
      title: `❌ Rejected — ${company}`,
      message: role.slice(3) || 'Rejection received',
      priority: 'default',
      tags: ['x'],
    })
  }
}

// Daily digest of Online Assessments due soon or overdue — run via its own time-driven
// trigger (see setup comment above), separate from the every-10-minutes email scan, since
// this reads current application state rather than new email.
function checkOaDeadlines() {
  const keys = getKeys()
  if (!keys.ntfyTopic) {
    console.log('NTFY_TOPIC not set — skipping OA deadline check (see setup comment for how to enable).')
    return
  }

  const apps = supabaseReq(keys, 'get',
    `/applications?user_id=eq.${keys.userId}&oa_due_date=not.is.null&oa_completed=eq.false&archived=eq.false`
    + `&select=company,role,oa_due_date,oa_link&order=oa_due_date.asc`)

  const todayMs = new Date(Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd')).getTime()
  const withDays = (apps || []).map(a => ({
    ...a,
    daysUntil: Math.round((new Date(a.oa_due_date).getTime() - todayMs) / 86400000),
  }))
  const dueSoon = withDays.filter(a => a.daysUntil <= 3)

  if (!dueSoon.length) {
    console.log('No OA deadlines due within 3 days.')
    return
  }

  const lines = dueSoon.map(a => {
    const label = a.daysUntil < 0 ? `overdue by ${Math.abs(a.daysUntil)}d`
      : a.daysUntil === 0 ? 'due today' : `due in ${a.daysUntil}d`
    return `${a.company}${a.role ? ` (${a.role})` : ''} — ${label}`
  })
  const urgent = dueSoon.some(a => a.daysUntil <= 1)

  sendPush(keys, {
    title: `⏰ ${dueSoon.length} OA deadline${dueSoon.length > 1 ? 's' : ''} coming up`,
    message: lines.join('\n'),
    priority: urgent ? 'urgent' : 'high',
    tags: ['stopwatch'],
  })
  console.log(`Pushed OA deadline digest: ${dueSoon.length} item(s)`)
}

// "Who did I send the last message to, that never wrote back?" — same rule
// lib/attention.js's awaitingReply() encodes client-side, re-expressed here as a direct
// query+reduce since Apps Script can't import that ES module. Excludes anyone with an
// explicit follow_up_date set (already tracked by that system) and Closed relationships.
function computeAwaitingReply(keys, contacts) {
  const cutoffStr = Utilities.formatDate(new Date(Date.now() - 60 * 86400000), 'UTC', 'yyyy-MM-dd')
  const interactions = supabaseReq(keys, 'get',
    `/interactions?user_id=eq.${keys.userId}&type=in.(Email,LinkedIn)&date=gte.${cutoffStr}`
    + `&select=contact_id,direction,date&order=date.desc`) || []
  const latestByContact = new Map()
  interactions.forEach(i => { if (i.contact_id && !latestByContact.has(i.contact_id)) latestByContact.set(i.contact_id, i) })

  return contacts
    .filter(c => c.status !== '✅ Closed' && !c.follow_up_date)
    .map(c => {
      const last = latestByContact.get(c.id)
      if (!last || last.direction !== 'Outbound') return null
      const days = Math.floor((Date.now() - new Date(last.date).getTime()) / 86400000)
      return days >= 5 ? { name: c.name, company: c.company, days } : null
    })
    .filter(Boolean)
}

// One Sonnet call (heavier judgment than the per-email Haiku classification above) that
// synthesizes the day's raw facts into a short recap + prioritized todolist. Mirrors
// extractWithClaude()'s request/parse shape but against a different model and prompt.
function generateRecapWithClaude(apiKey, bundle) {
  const prompt = `You are summarizing one day of recruiting-related activity for a job-searching student. Return ONLY valid JSON, no explanation, no markdown.

{
  "summary": "2-4 sentence recap of what happened and what matters most right now, written directly to the student ('you applied to...', 'you're waiting on...').",
  "todos": ["3-7 short, specific, prioritized action items — most important first. Each one under 15 words."]
}

Today's raw data (JSON):
${JSON.stringify(bundle)}`

  const resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method:             'post',
    muteHttpExceptions: true,
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    payload: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 800,
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

// Daily AI recap — its own time-driven trigger (same pattern as checkOaDeadlines, added
// alongside it not instead of it). Gathers a day's worth of raw facts via direct
// PostgREST queries (Apps Script can't import lib/attention.js's client-side derivations),
// feeds them to one Sonnet call, writes the result to daily_recaps for TodayTab's in-app
// card, and pushes it via ntfy with a tap-to-open link — the literal "recap I can click".
function generateDailyRecap() {
  const keys = getKeys()
  const todayStr = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd')
  const sinceStr = Utilities.formatDate(new Date(Date.now() - 86400000), 'UTC', 'yyyy-MM-dd')

  const contacts = supabaseReq(keys, 'get',
    `/contacts?user_id=eq.${keys.userId}&archived=eq.false&select=id,name,company,status,follow_up_date`) || []
  const newContacts = supabaseReq(keys, 'get',
    `/contacts?user_id=eq.${keys.userId}&created_at=gte.${sinceStr}&select=name,company`) || []
  const newApplications = supabaseReq(keys, 'get',
    `/applications?user_id=eq.${keys.userId}&created_at=gte.${sinceStr}&select=company,role,stage`) || []
  const openActionItems = supabaseReq(keys, 'get',
    `/email_action_items?user_id=eq.${keys.userId}&completed_at=is.null&dismissed_at=is.null`
    + `&select=summary,priority,due_date`) || []
  const oaApps = supabaseReq(keys, 'get',
    `/applications?user_id=eq.${keys.userId}&oa_due_date=not.is.null&oa_completed=eq.false&archived=eq.false`
    + `&select=company,role,oa_due_date&order=oa_due_date.asc`) || []
  const overdueFollowUps = contacts.filter(c => c.follow_up_date && c.follow_up_date < todayStr && c.status !== '✅ Closed')
    .map(c => ({ name: c.name, company: c.company, followUpDate: c.follow_up_date }))
  const awaitingReply = computeAwaitingReply(keys, contacts)

  const bundle = { newContacts, newApplications, openActionItems, oaDueSoon: oaApps, overdueFollowUps, awaitingReply }
  const hasAnything = Object.values(bundle).some(arr => arr.length > 0)
  if (!hasAnything) {
    console.log('Nothing to recap today.')
    return
  }

  const { summary, todos } = generateRecapWithClaude(keys.anthropic, bundle)

  supabaseReq(keys, 'post', '/daily_recaps?on_conflict=user_id,date', {
    user_id:      keys.userId,
    date:         todayStr,
    summary_text: summary,
    todo_json:    todos,
  }, 'resolution=merge-duplicates,return=representation')

  sendPush(keys, {
    title:    '📋 Your daily recap',
    message:  [summary, ...todos.map(t => `• ${t}`)].join('\n'),
    priority: 'default',
    tags:     ['clipboard'],
    click:    keys.dashboardUrl || undefined,
  })
  console.log(`Daily recap generated and pushed: ${todos.length} todo(s)`)
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
  // (3) recent Inbox threads not yet labeled (see INBOX_SCAN_QUERY above — ungated, every
  // inbox thread in the window).
  const labeledThreads = GmailApp.search(`label:${RECRUITING_LABEL}`, 0, SEARCH_CAP)
  const sentThreads     = GmailApp.search(SENT_SCAN_QUERY, 0, SEARCH_CAP)
  const inboxThreads    = GmailApp.search(INBOX_SCAN_QUERY, 0, SEARCH_CAP)
  const threadsById     = new Map()
  ;[...labeledThreads, ...sentThreads, ...inboxThreads].forEach(t => threadsById.set(t.getId(), t))
  const threads = [...threadsById.values()]

  if (!threads.length) {
    console.log('No recruiting threads found.')
    return
  }

  console.log(`Scanning ${threads.length} thread(s)`)
  processThreadList(threads, keys, props, myEmail)
}

// Core per-thread processing loop, shared by the regular 10-minute job above and
// runBackfillChunk() below — the only difference between them is which threads get handed
// in and over what date window they were discovered.
function processThreadList(threads, keys, props, myEmail) {
  const doneLabel       = getOrCreateLabel(DONE_LABEL)
  const recruitingLabel = getOrCreateLabel(RECRUITING_LABEL)

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
      // A push should mean "this just happened" — without this gate, the first run after
      // widening INBOX_SCAN_QUERY (or any runBackfillChunk() call) re-surfaces months of
      // real-but-historical INTERVIEW_INVITE/OFFER/REJECTION mail, each firing a push, which
      // burns through ntfy.sh's free-tier daily quota in seconds and blocks today's genuinely
      // new notifications (hit exactly this in production, see git history). Contacts/
      // applications/action-items/calendar events still get written regardless of age —
      // only the push is age-gated.
      const isFreshEnoughToPush = (Date.now() - msg.getDate().getTime()) <= PUSH_STALE_THRESHOLD_MS

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
      const oaCompletedHint = OA_COMPLETED_RE.test(subject + ' ' + body)
        ? '\n\nThis email\'s subject/body matches typical Online Assessment submission-confirmation phrasing ("assessment submitted", "thank you for completing", etc.) — likely type OA_COMPLETED, an automated receipt that the candidate finished the OA (distinct from OA_INVITE, which is the invitation to start it).'
        : ''
      const companyHint = guessCompanyHint(from)
      const shapeHint = recruitingShapeHint(from, subject, body)
      const networkingHint = networkingShapeHint(subject, body)

      console.log(`→ "${subject}" from ${from} (${messages.length - seen} new message(s))`)

      const data = extractWithClaude(
        keys.anthropic, subject, from, body, date, invite, meetingLink,
        applicationHint + referralHint + oaHint + oaCompletedHint + companyHint + shapeHint + networkingHint,
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

      let applicationId = null
      let shouldPush    = false
      if (['APPLICATION_CONFIRMATION', 'OA_INVITE', 'OA_COMPLETED', 'INTERVIEW_INVITE', 'OFFER', 'REJECTION'].includes(data.type)) {
        applicationId = upsertApplication(keys, data)
        // OA_COMPLETED with no matching application means there was nothing to mark done (no
        // tracked OA at that company) — nothing changed, so no push, unlike every other type
        // here which always has something worth surfacing.
        if (data.type === 'OA_COMPLETED' && !applicationId) {
          console.log('  Skipped push — OA_COMPLETED but no matching tracked application')
        } else if (isFreshEnoughToPush) {
          shouldPush = true
        } else {
          console.log(`  Skipped push — message is older than ${PUSH_STALE_THRESHOLD_MS / 86400000}d (catch-up scan, not a new event)`)
        }
      }

      // Orthogonal to `type` — Claude flags a concrete next step whenever the email implies
      // one, regardless of which (if any) contacts/applications row it also drove. See
      // extractWithClaude()'s action_item/action_priority/action_due_date fields.
      if (data.action_item) {
        upsertActionItem(keys, {
          gmailMessageId: msg.getId(),
          threadId,
          contactId,
          applicationId,
          summary: data.action_item,
          priority: data.action_priority || 'medium',
          dueDate: data.action_due_date || null,
        })
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

      // Pushed only after seenKey is durably saved — if anything above throws, we land in the
      // catch below and never reach here, so a retry (which reprocesses the same message since
      // seenKey wasn't advanced) can never fire a second push for a message already pushed once.
      if (shouldPush) notifyStatusChange(keys, data)

    } catch (e) {
      console.error(`  ✗ ${e.message}`)
      // Don't update seenKey — will retry next run
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKFILL — one-time historical catch-up beyond the regular job's rolling windows
// (newer_than:30d/45d above). Resumable and chunked: Apps Script caps a single execution at
// ~6 minutes on a consumer Google account, which a year of mail plus one Haiku call per
// thread will not fit inside. Each call processes one BACKFILL_CHUNK_DAYS-day slice working
// backward from "today" (or from wherever the last call left off) and stores its progress in
// PropertiesService, so re-running it repeatedly — manually from the editor, or via a
// temporary frequent time-driven trigger removed once done — eventually covers the whole
// BACKFILL_TOTAL_DAYS window. Reuses processThreadList(), the exact same discovery+
// classification path the regular 10-minute job uses, just against inbox+sent threads
// outside its window (already-labeled threads don't need backfilling — that search has no
// date bound and is already scanned continuously by the regular job).
// ─────────────────────────────────────────────────────────────────────────────

const BACKFILL_TOTAL_DAYS = 365 // how far back to backfill — edit before running for a different window
const BACKFILL_CHUNK_DAYS = 14  // per-call window size, kept small to stay well inside the execution time cap
const BACKFILL_SEARCH_CAP = 200 // per-chunk, per-folder search cap — raise if the log reports a chunk hitting it

function runBackfillChunk() {
  const keys    = getKeys()
  const props   = PropertiesService.getScriptProperties()
  const myEmail = Session.getActiveUser().getEmail().toLowerCase()

  const todayMs  = new Date(Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd')).getTime()
  const targetMs = todayMs - BACKFILL_TOTAL_DAYS * 86400000
  const cursorMs = Number(props.getProperty('backfill_cursor_ms') || todayMs)

  if (cursorMs <= targetMs) {
    console.log(`Backfill already complete — cursor is at or past ${BACKFILL_TOTAL_DAYS} days ago. Run resetBackfillCursor() to redo it.`)
    return
  }

  const chunkStartMs  = Math.max(cursorMs - BACKFILL_CHUNK_DAYS * 86400000, targetMs)
  const newerThanDays = Math.ceil((todayMs - chunkStartMs) / 86400000)
  const olderThanDays = Math.max(Math.ceil((todayMs - cursorMs) / 86400000), 0)
  const dateClause    = `newer_than:${newerThanDays}d` + (olderThanDays > 0 ? ` older_than:${olderThanDays}d` : '')

  const inboxThreads = GmailApp.search(`in:inbox -label:${RECRUITING_LABEL} ${dateClause}`, 0, BACKFILL_SEARCH_CAP)
  const sentThreads  = GmailApp.search(`in:sent -label:${RECRUITING_LABEL} ${dateClause}`, 0, BACKFILL_SEARCH_CAP)
  const threadsById  = new Map()
  ;[...inboxThreads, ...sentThreads].forEach(t => threadsById.set(t.getId(), t))
  const threads = [...threadsById.values()]

  console.log(`Backfill chunk (${dateClause}): ${threads.length} thread(s)`
    + ((inboxThreads.length >= BACKFILL_SEARCH_CAP || sentThreads.length >= BACKFILL_SEARCH_CAP) ? ' — capped, consider raising BACKFILL_SEARCH_CAP' : ''))

  if (threads.length) processThreadList(threads, keys, props, myEmail)

  props.setProperty('backfill_cursor_ms', String(chunkStartMs))
  const doneDays = Math.ceil((todayMs - chunkStartMs) / 86400000)
  console.log(`Backfill progress: covered the last ${doneDays}/${BACKFILL_TOTAL_DAYS} days.`
    + (chunkStartMs <= targetMs ? ' ✓ Backfill complete.' : ' Run runBackfillChunk() again to continue.'))
}

// Run once before starting a fresh backfill (or to redo it after changing BACKFILL_TOTAL_DAYS).
function resetBackfillCursor() {
  PropertiesService.getScriptProperties().deleteProperty('backfill_cursor_ms')
  console.log('Backfill cursor reset — the next runBackfillChunk() call starts from today.')
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

  const prompt = `You are processing a CS student's email for two equally-in-scope purposes: (1)
formal recruiting-process signals (an application, assessment, interview, offer, or rejection at a
specific company) and (2) professional networking — anyone who could plausibly help their job
search or is worth tracking as a relationship, even with no specific application mentioned at all:
someone met at a career fair or event, an alum or employee at a company being friendly, a
coffee-chat or informational-interview thread, a referral offer, or general relationship-building/
"let's stay in touch" mail. Neither category is more important than the other — a purely
networking email with no job attached is just as relevant as a formal application update.

Analyze this email. Return ONLY valid JSON — no explanation, no markdown.

If genuinely unrelated to the candidate's job search or professional network (personal mail,
spam, newsletters, unrelated logistics, etc.): {"type":"UNRELATED"}

Otherwise return:
{
  "type": "APPLICATION_CONFIRMATION|OA_INVITE|OA_COMPLETED|REPLY|INTERVIEW_INVITE|OFFER|REJECTION|NEW_CONTACT|FOLLOW_UP_NEEDED",
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
  "oa_link": "the URL the candidate clicks to start/complete the Online Assessment, if this is an OA_INVITE, else null",
  "contact_phone": "a phone number for the sender, ONLY if one is explicitly given in their email signature/body (e.g. a mobile number under their name) — otherwise null, never guess or use a company switchboard number",
  "action_item": "a specific one-line next step the candidate should personally take, phrased as an instruction (e.g. 'Reply to Jane about Tuesday's 2pm call', 'Submit the HackerRank assessment', 'Confirm the onsite date by Friday') — ONLY when the email actually implies the candidate needs to do something. Otherwise null. This is independent of 'type' above: an APPLICATION_CONFIRMATION can still have a null action_item, and a plain REPLY can carry a high-priority one.",
  "action_priority": "'high'|'medium'|'low', matching how time-sensitive/important the action_item is — null if action_item is null",
  "action_due_date": "YYYY-MM-DD if the email states or clearly implies a deadline for action_item, else null — never guess a date that isn't actually stated or clearly implied"
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
one at all, in which case leave it null rather than estimating from the email's send date.

OA_COMPLETED means an automated receipt confirming the candidate already finished/submitted the
Online Assessment ("Your assessment has been submitted", "Thank you for completing the test") —
this is the counterpart to OA_INVITE and should only be used for a genuine submission receipt,
never for the original invite itself or a reminder to complete an assessment that's still open.

NEW_CONTACT means this introduces or continues a relationship with someone potentially useful to
the candidate's professional network — met at a career fair/event, an alum, a friendly employee at
a company of interest, someone offering to help or make an introduction — even if no specific
job/application is mentioned at all. This should be used often for a networking-focused inbox, not
treated as a rare fallback.

FOLLOW_UP_NEEDED means a networking thread (not tied to a specific application stage) whose
natural next step is for the candidate to follow up — say thanks, schedule a call, check in again
later. Prefer this over REPLY when the email is relationship-building rather than a reply within a
formal application process.${inviteHint}${linkHint}${extraHints || ''}

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
function supabaseReq(keys, method, path, body, prefer) {
  const opts = {
    method,
    muteHttpExceptions: true,
    headers: {
      'apikey':        keys.supabaseKey,
      'Authorization': `Bearer ${keys.supabaseKey}`,
      'Content-Type':  'application/json',
      'Prefer':        prefer || 'return=representation',
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
  let existingPhone = null
  if (data.contact_email) {
    const res = supabaseReq(keys, 'get',
      `/contacts?user_id=eq.${keys.userId}&email=eq.${encodeURIComponent(data.contact_email)}&select=id,phone&limit=1`)
    existingId = res?.[0]?.id
    existingPhone = res?.[0]?.phone
  }

  // Status is only set on create, not on every update — otherwise re-processing a thread
  // would silently overwrite a status you'd manually changed in the UI (e.g. to Hot) back to
  // the default 'Cooling'. Everything else refreshes on every run. Phone follows the same
  // non-clobber rule as referred_by_id below — a later email's opportunistic signature
  // extraction should never overwrite a number already on file (e.g. one entered by hand).
  const updateProps = {
    company:          data.company || '',
    last_interaction: today,
    follow_up_date:   followUp,
    urgency:          data.urgency || 'LOW',
    notes:            data.summary || '',
    ...(data.contact_email ? { email: data.contact_email } : {}),
    ...(data.contact_phone && !existingPhone ? { phone: data.contact_phone } : {}),
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

  // OA_COMPLETED only means anything against an application we're already tracking an OA for —
  // with no fuzzy company match, there's nothing to mark done, and creating a fresh "Unknown"
  // application row from a submission receipt alone would just be noise (see the else-branch
  // below, which every other type here is fine falling into).
  if (data.type === 'OA_COMPLETED' && !existing) {
    console.log('  No matching application for OA_COMPLETED — skipped')
    return null
  }

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
    // The whole point of OA_COMPLETED: flips the flag checkOaDeadlines() filters on, so the
    // daily digest stops nagging about this one starting from its next run.
    ...(data.type === 'OA_COMPLETED' ? { oa_completed: true } : {}),
  }

  if (existing) {
    const currentRank = STAGE_RANK[existing.stage] ?? 0
    const newRank     = STAGE_RANK[stage] ?? 0
    // REJECTION always applies (terminal, can happen from any stage) — every other signal only
    // moves the stage forward, never backward.
    if (stage === 'Rejected' || newRank >= currentRank) props.stage = stage
    supabaseReq(keys, 'patch', `/applications?id=eq.${existing.id}`, props)
    console.log(`  Application updated → ${props.stage || existing.stage}`)
    return existing.id
  } else {
    const created = supabaseReq(keys, 'post', '/applications', {
      user_id:      keys.userId,
      company:      data.company || 'Unknown',
      applied_date: today,
      stage,
      ...props,
    })
    console.log(`  Application created → ${stage}`)
    return created?.[0]?.id
  }
}

// One row per email message that carried an actionable next step (see extractWithClaude's
// action_item field) — unique on (user_id, gmail_message_id) so re-processing a thread never
// duplicates a row (upsert, not insert-only, since a re-run should still refresh
// summary/priority/due_date if Claude's read of the same message ever changes).
function upsertActionItem(keys, { gmailMessageId, threadId, contactId, applicationId, summary, priority, dueDate }) {
  supabaseReq(keys, 'post', '/email_action_items?on_conflict=user_id,gmail_message_id', {
    user_id:          keys.userId,
    gmail_message_id: gmailMessageId,
    thread_id:        threadId || null,
    contact_id:       contactId || null,
    application_id:   applicationId || null,
    summary,
    priority,
    due_date:         dueDate,
  }, 'resolution=merge-duplicates,return=representation')
  console.log(`  Action item: ${summary}`)
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
  if (!keys.ntfyTopic) {
    console.log('NOTE: NTFY_TOPIC not set — push reminders disabled (everything else still works). See setup comment at the top of this file.')
  } else {
    console.log('✓ NTFY_TOPIC found — push reminders enabled')
  }
  console.log('')
  console.log('Next: Triggers (clock icon) → Add Trigger → processRecruitingEmails → Time-driven → Every 10 minutes')
  console.log('Optional: Triggers → Add Trigger → checkOaDeadlines → Time-driven → Day timer, for daily OA-deadline pushes')
  console.log('Optional: Triggers → Add Trigger → generateDailyRecap → Time-driven → Day timer, for the daily AI recap')
  console.log('One-time: run runBackfillChunk() repeatedly (or via a temporary frequent Trigger) to catch up on older mail')
}

// Send yourself a test email, then run this to process it immediately
function runNow() {
  processRecruitingEmails()
}

// Manually trigger the OA-deadline digest push (normally runs once/day via its own trigger)
function runOaCheckNow() {
  checkOaDeadlines()
}

// Manually trigger the daily recap (normally runs once/day via its own trigger)
function runDailyRecapNow() {
  generateDailyRecap()
}

// Sends one test push to confirm NTFY_TOPIC is wired up correctly
function testPush() {
  const keys = getKeys()
  if (!keys.ntfyTopic) {
    console.log('NTFY_TOPIC not set — nothing to test.')
    return
  }
  sendPush(keys, { title: '✅ Test push', message: 'If you see this, ntfy.sh is wired up correctly.', priority: 'default', tags: ['white_check_mark'] })
  console.log('Sent — check your ntfy app.')
}
