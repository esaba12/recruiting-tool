// Multi-tenant port of scripts/email-pipeline.js (Google Apps Script) — same discovery
// queries, same networking-aware classification prompt, same upsert/dedup logic, just a
// different transport: Gmail REST API instead of GmailApp, @supabase/supabase-js instead of
// raw PostgREST UrlFetchApp calls, and each user's own BYOK Anthropic key (getUserKey())
// instead of one hardcoded ANTHROPIC_API_KEY.
//
// Deliberately NOT ported (yet — the Apps Script version still owns these for the personal
// account): calendar-invite (.ics) parsing / interview calendar-event creation (needs the
// Calendar API + ICS parsing, a separate chunk of work), ntfy push notifications, and the
// daily recap. This module only does discovery → classify → upsert
// contacts/applications/interactions/action items.
import { supabaseAdmin } from './supabaseAdmin.js'
import { decrypt } from './crypto.js'
import { getUserKey } from './keys.js'

// ── Discovery queries + recall-hint constants (ported verbatim) ─────────────────────────
const SENT_SCAN_QUERY = 'in:sent newer_than:30d'
const INBOX_SCAN_QUERY = 'in:inbox newer_than:45d'
const SEARCH_CAP = 150

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
const NETWORKING_SHAPE_KEYWORDS = [
  'nice meeting you', 'great meeting you', 'great to connect', 'great connecting',
  'stay in touch', 'keep in touch', 'coffee chat', 'informational interview', 'career fair',
  'info session', 'happy to help', 'happy to chat', 'would love to connect',
  'thanks for reaching out', 'thanks for connecting', 'introduce you', 'introduction to',
]
const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'icloud.com',
  'aol.com', 'protonmail.com', 'mail.com', 'live.com', 'msn.com',
])
const REFERRAL_MENTION_RE = /\b(referred by|referred you|referral from|recommended by|thanks to (?:the |your )?(?:introduction|referral)|your referrer|employee referral|referral (?:portal|link|program)|apply(?:ing)? through a referral)\b/i
const APPLICATION_CONFIRMATION_RE = /\b(thank(?:s| you) for (?:your interest|applying)|we(?:'| ha)ve received your application|your application (?:has been received|was submitted|is being reviewed)|application (?:received|submitted|confirmation)|successfully applied)\b/i
const OA_INVITE_RE = /\b(online assessment|coding assessment|coding challenge|skills assessment|hackerrank|codesignal|codility|hackerearth|complete (?:your|the) assessment|assessment invit)/i
const AUTOMATED_SENDER_RE = /^(no-?reply|do-?not-?reply|notification|mailer|automated|system|recruiting|careers|jobs|ats|talent)@|greenhouse-mail\.io$/i
const MEETING_LINK_RE = /https?:\/\/[^\s<>"')\]]*(?:zoom\.us\/j\/|meet\.google\.com\/|teams\.microsoft\.com\/l\/meetup-join|teams\.live\.com\/meet|webex\.com\/(?:meet|join))[^\s<>"')\]]*/i
const STAGE_RANK = { Wishlist: 0, Applied: 1, 'Phone Screen': 2, Onsite: 3, Offer: 4, Rejected: 5 }

export function recruitingShapeHint(fromHeader, subject, body) {
  const addr = parseAddress(fromHeader)
  const domain = addr && addr.email ? addr.email.split('@')[1] : null
  const fromAts = !!domain && ATS_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))
  const keywordRe = new RegExp(`\\b(${RECRUITING_SUBJECT_KEYWORDS.map(k => k.replace(/"/g, '')).join('|')})\\b`, 'i')
  if (!fromAts && !keywordRe.test(subject) && !keywordRe.test(body.slice(0, 500))) return ''
  return '\n\nThis email is from a known ATS domain and/or has recruiting-shaped subject/body phrasing — a signal it may be recruiting-related, but still classify UNRELATED if the actual content isn\'t.'
}

export function networkingShapeHint(subject, body) {
  const keywordRe = new RegExp(`\\b(${NETWORKING_SHAPE_KEYWORDS.join('|')})\\b`, 'i')
  if (!keywordRe.test(subject) && !keywordRe.test(body.slice(0, 500))) return ''
  return '\n\nThis email has networking-shaped language (relationship-building, an event/introduction, a coffee chat/informational interview) — likely NEW_CONTACT or FOLLOW_UP_NEEDED even with no specific job/application mentioned. Still classify UNRELATED if it\'s genuinely unrelated to the candidate\'s job search or professional network.'
}

export function guessCompanyHint(fromHeader) {
  const addr = parseAddress(fromHeader)
  const domain = addr && addr.email ? addr.email.split('@')[1] : null
  if (!domain || GENERIC_EMAIL_DOMAINS.has(domain)) return ''
  if (ATS_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))) return ''
  const labels = domain.split('.')
  const root = labels.length > 2 ? labels[labels.length - 2] : labels[0]
  const guess = root.charAt(0).toUpperCase() + root.slice(1)
  return `\n\nThe sender's email domain is ${domain}, which may indicate the company is "${guess}" — verify against the actual email content and use the real name/casing if stated there instead.`
}

export function extractMeetingLink(text) {
  if (!text) return null
  const m = text.match(MEETING_LINK_RE)
  return m ? m[0].replace(/[.,)\]]+$/, '') : null
}

// ── Address parsing (ported verbatim) ────────────────────────────────────────────────────
export function parseAddress(headerStr) {
  if (!headerStr) return null
  const m = headerStr.match(/(.*)<(.+)>/)
  if (m) return { displayName: m[1].replace(/["']/g, '').trim(), email: m[2].trim().toLowerCase() }
  const email = headerStr.trim().toLowerCase()
  return email ? { displayName: '', email } : null
}
export function parseAddressList(headerStr) {
  if (!headerStr) return []
  return headerStr.split(',').map(parseAddress).filter(Boolean)
}
export function findCounterpartAddress(messages, myEmail) {
  const msg = messages[messages.length - 1]
  const from = parseAddress(msg.from)
  if (from && from.email !== myEmail) return from
  const candidates = [...parseAddressList(msg.to), ...parseAddressList(msg.cc)]
  return candidates.find(a => a.email !== myEmail) || { displayName: '', email: null }
}

// ── Gmail REST (replaces GmailApp) ───────────────────────────────────────────────────────
async function mintAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || `Token refresh failed (${res.status})`)
  return data.access_token
}

async function gmailFetch(accessToken, path) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

async function searchMessageIds(accessToken, q, cap) {
  const data = await gmailFetch(accessToken, `messages?${new URLSearchParams({ q, maxResults: String(cap) })}`)
  return data.messages || []
}

export function findHeader(headers, name) {
  const h = (headers || []).find(h => h.name.toLowerCase() === name.toLowerCase())
  return h ? h.value : null
}

// Recursive MIME part walker — prefers the first text/plain part found, falls back to a
// naive tag-strip of text/html if no plain part exists anywhere in the tree.
export function extractPlainBody(payload) {
  if (!payload) return ''
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf8')
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf8')
      }
    }
    for (const part of payload.parts) {
      const nested = extractPlainBody(part)
      if (nested) return nested
    }
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  return ''
}

export function parseGmailMessage(msg) {
  const headers = msg.payload?.headers || []
  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: findHeader(headers, 'Subject') || '',
    from: findHeader(headers, 'From') || '',
    to: findHeader(headers, 'To') || '',
    cc: findHeader(headers, 'Cc') || '',
    date: new Date(Number(msg.internalDate)),
    plainBody: extractPlainBody(msg.payload).slice(0, 4000),
  }
}

async function getThreadMessages(accessToken, threadId) {
  const thread = await gmailFetch(accessToken, `threads/${threadId}?format=full`)
  return (thread.messages || []).map(parseGmailMessage)
}

// ── Claude classification (same prompt as the Apps Script version, minus the calendar-
// invite hint — .ics parsing isn't ported yet, see module comment) ─────────────────────
async function classifyEmail(apiKey, { subject, from, body, date, meetingLink, extraHints }) {
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

NEW_CONTACT means this introduces or continues a relationship with someone potentially useful to
the candidate's professional network — met at a career fair/event, an alum, a friendly employee at
a company of interest, someone offering to help or make an introduction — even if no specific
job/application is mentioned at all. This should be used often for a networking-focused inbox, not
treated as a rare fallback.

FOLLOW_UP_NEEDED means a networking thread (not tied to a specific application stage) whose
natural next step is for the candidate to follow up — say thanks, schedule a call, check in again
later. Prefer this over REPLY when the email is relationship-building rather than a reply within a
formal application process.${linkHint}${extraHints || ''}

Subject: ${subject}
From: ${from}
Date: ${date}
Body:
${body}`

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!resp.ok) throw new Error(`Claude ${resp.status}: ${(await resp.text()).slice(0, 200)}`)
  const json = await resp.json()
  const text = json.content[0].text
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON in Claude response')
  return JSON.parse(match[0])
}

// ── Supabase writes (ported from the raw-PostgREST version to real supabase-js calls) ───
async function upsertContact(db, userId, data) {
  if (!data.contact_name && data.contact_email && AUTOMATED_SENDER_RE.test(data.contact_email)) {
    return null
  }
  const today = new Date().toISOString().slice(0, 10)
  const followUp = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)

  let existingId = null
  let existingPhone = null
  if (data.contact_email) {
    const { data: rows } = await db.from('contacts').select('id,phone')
      .eq('user_id', userId).eq('email', data.contact_email).limit(1)
    existingId = rows?.[0]?.id
    existingPhone = rows?.[0]?.phone
  }

  const updateProps = {
    company: data.company || '',
    last_interaction: today,
    follow_up_date: followUp,
    urgency: data.urgency || 'LOW',
    notes: data.summary || '',
    ...(data.contact_email ? { email: data.contact_email } : {}),
    ...(data.contact_phone && !existingPhone ? { phone: data.contact_phone } : {}),
  }

  if (existingId) {
    await db.from('contacts').update(updateProps).eq('id', existingId)
    return existingId
  }
  const { data: created } = await db.from('contacts').insert({
    user_id: userId, name: data.contact_name || 'Unknown', status: '🟡 Cooling', ...updateProps,
  }).select('id').single()
  return created?.id || null
}

async function findContactByName(db, userId, name) {
  if (!name) return null
  const { data } = await db.from('contacts').select('id')
    .eq('user_id', userId).ilike('name', `%${name}%`).limit(1)
  return data?.[0]?.id || null
}

async function upsertApplication(db, userId, data) {
  const today = new Date().toISOString().slice(0, 10)
  const stageMap = {
    APPLICATION_CONFIRMATION: 'Applied',
    OA_INVITE: 'Applied',
    INTERVIEW_INVITE: 'Phone Screen',
    OFFER: 'Offer',
    REJECTION: 'Rejected',
  }
  const stage = stageMap[data.type] || 'Applied'
  const referrerId = data.referrer_name ? await findContactByName(db, userId, data.referrer_name) : null

  const { data: rows } = await db.from('applications')
    .select('id,stage,referred_by_id,oa_completed')
    .eq('user_id', userId).ilike('company', `%${data.company || ''}%`).eq('archived', false)
    .order('created_at', { ascending: false }).limit(1)
  const existing = rows?.[0]

  const props = {
    last_activity: today,
    ...(stage === 'Rejected' ? { closed_date: today } : {}),
    ...(data.role ? { role: data.role } : {}),
    ...(referrerId && !existing?.referred_by_id ? { referred_by_id: referrerId } : {}),
    ...(data.type === 'OA_INVITE' && !existing?.oa_completed
      ? { oa_due_date: data.oa_due_date || null, oa_link: data.oa_link || null, oa_research_checked_at: null }
      : {}),
  }

  if (existing) {
    const currentRank = STAGE_RANK[existing.stage] ?? 0
    const newRank = STAGE_RANK[stage] ?? 0
    if (stage === 'Rejected' || newRank >= currentRank) props.stage = stage
    await db.from('applications').update(props).eq('id', existing.id)
    return existing.id
  }
  const { data: created } = await db.from('applications').insert({
    user_id: userId, company: data.company || 'Unknown', applied_date: today, stage, ...props,
  }).select('id').single()
  return created?.id || null
}

async function upsertActionItem(db, userId, { gmailMessageId, threadId, contactId, applicationId, summary, priority, dueDate }) {
  await db.from('email_action_items').upsert({
    user_id: userId,
    gmail_message_id: gmailMessageId,
    thread_id: threadId || null,
    contact_id: contactId || null,
    application_id: applicationId || null,
    summary,
    priority,
    due_date: dueDate,
  }, { onConflict: 'user_id,gmail_message_id' })
}

async function logMessageInteraction(db, userId, message, contactId, threadId, myEmail, meetingLink) {
  const from = parseAddress(message.from)
  const direction = (from && from.email === myEmail) ? 'Outbound' : 'Inbound'
  const summary = meetingLink ? `📅 Meeting link: ${meetingLink}\n\n${message.plainBody}` : message.plainBody

  await db.from('interactions').insert({
    user_id: userId,
    contact_id: contactId || null,
    type: 'Email',
    direction,
    date: message.date.toISOString().slice(0, 10),
    channel_ref: threadId,
    summary: summary.slice(0, 300),
    body: message.plainBody.slice(0, 2000),
  })
}

// ── Entry point — scans one connected Gmail mailbox, returns updated thread_progress ────
export async function scanGmailConnection(connection) {
  const db = supabaseAdmin()
  const userId = connection.user_id
  const myEmail = connection.connected_email.toLowerCase()

  const anthropicKey = await getUserKey(userId, 'anthropic')
  if (!anthropicKey) {
    return { threadProgress: connection.thread_progress || {}, scanned: 0, skipped: 'no_anthropic_key' }
  }

  const refreshToken = decrypt(connection.refresh_token_ciphertext)
  const accessToken = await mintAccessToken(refreshToken)

  const [inboxIds, sentIds] = await Promise.all([
    searchMessageIds(accessToken, INBOX_SCAN_QUERY, SEARCH_CAP),
    searchMessageIds(accessToken, SENT_SCAN_QUERY, SEARCH_CAP),
  ])
  const threadIds = [...new Set([...inboxIds, ...sentIds].map(m => m.threadId))]

  const threadProgress = { ...(connection.thread_progress || {}) }
  let scanned = 0

  for (const threadId of threadIds) {
    try {
      const messages = await getThreadMessages(accessToken, threadId)
      const seen = threadProgress[threadId] || 0
      if (messages.length <= seen) continue

      const msg = messages[messages.length - 1]
      const meetingLink = extractMeetingLink(msg.plainBody)

      const applicationHint = APPLICATION_CONFIRMATION_RE.test(msg.subject + ' ' + msg.plainBody)
        ? '\n\nThis email\'s subject/body matches typical automated application-confirmation phrasing ("thank you for applying", "application received", etc.) — likely type APPLICATION_CONFIRMATION unless the content actually indicates a later stage (interview/offer/rejection).'
        : ''
      const referralHint = REFERRAL_MENTION_RE.test(msg.plainBody)
        ? '\n\nThis email appears to mention a referral or recommendation. If a specific person is named as having referred/recommended the candidate, extract their name into "referrer_name".'
        : ''
      const oaHint = OA_INVITE_RE.test(msg.subject + ' ' + msg.plainBody)
        ? '\n\nThis email\'s subject/body matches typical Online Assessment (OA) invite phrasing (HackerRank/CodeSignal/Codility/etc., or a generic "complete your assessment" template) — likely type OA_INVITE. Extract oa_due_date only if the email actually states a completion deadline, and oa_link as the URL the candidate clicks to start/complete the assessment.'
        : ''
      const companyHint = guessCompanyHint(msg.from)
      const shapeHint = recruitingShapeHint(msg.from, msg.subject, msg.plainBody)
      const networkingHint = networkingShapeHint(msg.subject, msg.plainBody)

      const data = await classifyEmail(anthropicKey, {
        subject: msg.subject, from: msg.from, body: msg.plainBody,
        date: msg.date.toISOString().slice(0, 10), meetingLink,
        extraHints: applicationHint + referralHint + oaHint + companyHint + shapeHint + networkingHint,
      })

      if (!data || data.type === 'UNRELATED') {
        threadProgress[threadId] = messages.length
        scanned++
        continue
      }

      data.meeting_link = meetingLink || data.meeting_link || null

      const counterpart = findCounterpartAddress(messages, myEmail)
      data.contact_email = counterpart.email || null
      if (!data.contact_name && counterpart.displayName) data.contact_name = counterpart.displayName

      const contactId = await upsertContact(db, userId, data)

      let applicationId = null
      if (['APPLICATION_CONFIRMATION', 'OA_INVITE', 'INTERVIEW_INVITE', 'OFFER', 'REJECTION'].includes(data.type)) {
        applicationId = await upsertApplication(db, userId, data)
      }

      if (data.action_item) {
        await upsertActionItem(db, userId, {
          gmailMessageId: msg.id, threadId, contactId, applicationId,
          summary: data.action_item, priority: data.action_priority || 'medium', dueDate: data.action_due_date || null,
        })
      }

      for (let i = seen; i < messages.length; i++) {
        const isNewest = i === messages.length - 1
        await logMessageInteraction(db, userId, messages[i], contactId, threadId, myEmail, isNewest ? data.meeting_link : null)
      }

      threadProgress[threadId] = messages.length
      scanned++
    } catch (e) {
      console.error(`Thread ${threadId} (${myEmail}) failed: ${e.message}`)
      // leave threadProgress untouched for this thread — retried next scan
    }
  }

  return { threadProgress, scanned }
}
