// Multi-tenant port of scripts/email-pipeline.js (Google Apps Script) — same discovery
// queries, same networking-aware classification prompt, same upsert/dedup logic, just a
// different transport: Gmail REST API instead of GmailApp, @supabase/supabase-js instead of
// raw PostgREST UrlFetchApp calls, and each user's own BYOK key (Anthropic or OpenAI, via
// ./llm.js) instead of one hardcoded ANTHROPIC_API_KEY.
//
// Invite parsing is v1.3 spec 12 (./ics.js). The scan also returns the update pushes it
// built (./pushes.js statusPush); api/gmail.js sends them, with the digests and daily recap,
// after the connection loop. An interview with a date but no invite gets a calendar event
// (./interviewEvent.js) when the user has a Calendar connected.
import { supabaseAdmin } from './supabaseAdmin.js'
import { decrypt } from './crypto.js'
import { llmForUser, completeJSON } from './llm.js'
import { parseInvite, findCalendarPart, zonedToUtc } from './ics.js'
import { statusPush, isFreshEnoughToPush } from './pushes.js'
import { shouldCreateInterviewEvent, createInterviewEvent, calendarRefreshToken } from './interviewEvent.js'
import { tracksLabel, isTechOnly } from '../../src/lib/tracks.js'
import { shouldDraftReply, replyIntent, replySubject, draftReply, slotsFor, calendarRefreshTokens, saveReplyDraft, settleThreadDrafts } from './replyDraft.js'
import { AUTO_DRAFT_SETTING_KEY } from '../../src/lib/replyDrafts.js'
import { AVAILABILITY_SETTING_KEY } from '../../src/lib/availability.js'

// ── Discovery queries + recall-hint constants (ported verbatim) ─────────────────────────
const SENT_SCAN_QUERY = 'in:sent newer_than:30d'
const INBOX_SCAN_QUERY = 'in:inbox newer_than:45d'
const SEARCH_CAP = 150

// ── Scan budget (v1.3 spec 10) ──────────────────────────────────────────────────────────
// Once a mailbox has had one complete pass, searches only ask for mail since that pass
// (minus an hour of overlap for clock skew and late-indexed messages), instead of
// re-fetching every thread in the 45-day window every 10 minutes.
const CURSOR_OVERLAP_MS = 60 * 60 * 1000
// Per connection per run, so one big first scan can't starve every other mailbox.
export const MAX_CLASSIFIED_PER_RUN = 40

export function scanQueries(cursor) {
  if (!cursor) return { inbox: INBOX_SCAN_QUERY, sent: SENT_SCAN_QUERY }
  const after = ` after:${Math.floor((new Date(cursor).getTime() - CURSOR_OVERLAP_MS) / 1000)}`
  return { inbox: INBOX_SCAN_QUERY + after, sent: SENT_SCAN_QUERY + after }
}

// The cursor only moves when a pass saw everything: a budget cut or a failed thread leaves
// it where it was, so the next run searches the same window again (thread_progress makes
// that idempotent).
export function nextCursor({ prevCursor, scanStartedAt, partial, failed }) {
  return partial || failed > 0 ? (prevCursor || null) : scanStartedAt
}

// Longest-waiting mailbox first; never-scanned ones before everything.
export function orderConnections(connections) {
  const t = c => (c.last_scanned_at ? new Date(c.last_scanned_at).getTime() : -Infinity)
  return [...connections].sort((a, b) => t(a) - t(b))
}

// Runs processThread over threadIds (newest first, Gmail's search order) until the deadline
// or the classification cap. processThread resolves to 'unchanged' | 'classified' | 'failed';
// only 'classified' counts against the cap, since unchanged threads are a cheap fetch.
export async function runThreadBudget(threadIds, processThread, { deadline, maxClassified = MAX_CLASSIFIED_PER_RUN, now = Date.now }) {
  let classified = 0, failed = 0
  for (let i = 0; i < threadIds.length; i++) {
    if (classified >= maxClassified || (deadline && now() >= deadline)) {
      return { classified, failed, partial: true }
    }
    const outcome = await processThread(threadIds[i])
    if (outcome === 'classified') classified++
    else if (outcome === 'failed') failed++
  }
  return { classified, failed, partial: false }
}

const ATS_DOMAINS = [
  'greenhouse.io', 'lever.co', 'myworkday.com', 'icims.com', 'smartrecruiters.com',
  'ashbyhq.com', 'jobvite.com', 'taleo.net', 'workable.com', 'breezy.hr', 'jazz.co',
  'bamboohr.com', 'successfactors.com', 'ultipro.com', 'wellfound.com', 'ripplematch.com',
  'paradox.ai', 'gem.com', 'hire.withgoogle.com',
  // Common in finance/consulting recruiting (video interviews, games-based assessments,
  // enterprise ATSes). Recall hints only — the classifier is still the real filter.
  'hirevue.com', 'avature.net', 'brassring.com', 'pymetrics.ai',
]
const RECRUITING_SUBJECT_KEYWORDS = [
  'application', 'applying', 'applied', 'interview', 'recruiter', 'recruiting',
  'internship', 'offer', '"next steps"', 'assessment', '"phone screen"', 'onsite',
  'candidacy', '"thank you for your interest"', '"hiring team"', 'oa', '"coding challenge"',
  'superday', 'hirevue', '"first round"', '"final round"', '"assessment centre"', '"assessment center"',
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
const OA_INVITE_RE = /\b(online assessment|coding assessment|coding challenge|skills assessment|hackerrank|codesignal|codility|hackerearth|pymetrics|numerical reasoning|complete (?:your|the) assessment|assessment invit)/i
// Role mailboxes and platform senders — never a person, so never a contact. Matched on the
// address alone (the display name is no help: "Google Careers" reads like a name). Shared with
// scripts/email-pipeline.js — keep the two in sync.
const AUTOMATED_LOCAL_RE = /^(no-?reply|do-?not-?reply|notifications?|mailer(-daemon)?|automated|system|recruit(ing|ment|er)?|careers?|jobs|ats|talent(acquisition)?|hello|team|info|news(letter)?s?|events?|marketing|updates?|support|admin|hr|campus|university|students?|hiring|apply|applications?|alerts?|digest)([._+-][^@]*)?@/i
const AUTOMATED_DOMAINS = [
  ...ATS_DOMAINS, 'greenhouse-mail.io', 'hackerrank.com', 'codesignal.com', 'codility.com', 'hackerearth.com',
  'joinhandshake.com', 'linkedin.com', 'indeed.com', 'goodtime.io', 'modernloop.io', 'calendly.com',
]
const NETWORKING_TYPES = ['NEW_CONTACT', 'FOLLOW_UP_NEEDED', 'REPLY']
// Receipts and closed doors — nothing for the candidate to do, whatever the classifier says.
const NO_ACTION_TYPES = ['APPLICATION_CONFIRMATION', 'OA_COMPLETED', 'REJECTION']
const MEETING_LINK_RE = /https?:\/\/[^\s<>"')\]]*(?:zoom\.us\/j\/|meet\.google\.com\/|teams\.microsoft\.com\/l\/meetup-join|teams\.live\.com\/meet|webex\.com\/(?:meet|join))[^\s<>"')\]]*/i
const STAGE_RANK = { Wishlist: 0, Applied: 1, 'Phone Screen': 2, Technical: 3, Onsite: 4, Offer: 5, Rejected: 6 }

// A missing address counts as automated: there's nobody to make a contact for.
export function isAutomatedSender(email) {
  if (!email) return true
  const domain = email.split('@')[1] || ''
  return AUTOMATED_LOCAL_RE.test(email) || AUTOMATED_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))
}

// Mailing-list / bulk-send headers: newsletters, event blasts, career-center mailings and
// ATS templates carry these; one-to-one mail almost never does.
export function isBulkMail(headers) {
  if (findHeader(headers, 'List-Unsubscribe') || findHeader(headers, 'List-Id')) return true
  if (/^(bulk|list|junk)$/i.test(findHeader(headers, 'Precedence') || '')) return true
  const auto = findHeader(headers, 'Auto-Submitted')
  return !!auto && auto.toLowerCase() !== 'no'
}

// Networking-typed mail that isn't really someone reaching out: a template sent to a list, or
// a role mailbox. Dropped like UNRELATED, so it never reaches the Inbox or Network tab.
// A REPLY from a shared mailbox can still be a human, so only `personal` decides that one.
export function isGenericNetworking(data, senderEmail) {
  if (!NETWORKING_TYPES.includes(data.type)) return false
  if (data.personal === false) return true
  return data.type !== 'REPLY' && isAutomatedSender(senderEmail)
}

export function shouldCreateContact(data, senderEmail) {
  return data.personal !== false && !isAutomatedSender(senderEmail)
}

// Only an email that actually calls for a follow-up schedules one (3 days out), and never over
// a follow-up already planned for later. Everything else leaves follow_up_date alone: Keep in
// Touch and Awaiting Reply already cover relationships going quiet.
export function contactFollowUpDate(data, existingFollowUp, today) {
  if (data.type !== 'FOLLOW_UP_NEEDED') return undefined
  if (existingFollowUp && existingFollowUp > today) return undefined
  const d = new Date(today + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 3)
  return d.toISOString().slice(0, 10)
}

export function keepActionItem(data, senderEmail) {
  if (!data.action_item || NO_ACTION_TYPES.includes(data.type)) return false
  return !isGenericNetworking(data, senderEmail)
}

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
  return '\n\nThis email has networking-shaped language (relationship-building, an event/introduction, a coffee chat/informational interview) — NEW_CONTACT or FOLLOW_UP_NEEDED if a specific person wrote it to the candidate, even with no job mentioned. An event announcement or promo sent to a list is UNRELATED, however networking-flavored its wording.'
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

// ── Calendar invites (v1.3 spec 12; parsing lives in ./ics.js) ───────────────────────────
// An attached invite proves a meeting is scheduled, not that it's an interview: a coffee chat
// arrives as the same Google Calendar invite. So it never sets the type. It supplies the
// meeting link, a prompt hint, and the timing once Claude has said INTERVIEW_INVITE.
const DEFAULT_TIME_ZONE = 'America/New_York' // same default as the events code

export function inviteMeetingLink(invite) {
  return invite ? (extractMeetingLink(invite.location) || extractMeetingLink(invite.description)) : null
}

// Wording kept identical to scripts/email-pipeline.js (both copies go away together in 08).
export function inviteHint(invite, subject) {
  if (!invite) return ''
  const when = invite.start.toISOString().slice(0, 16).replace('T', ' ')
  return `\n\nThis email has a calendar invite attached: "${invite.summary || subject}", scheduled for ${when} UTC${invite.location ? ` at/via ${invite.location}` : ''}. This proves a meeting is scheduled, NOT that it is an interview — decide INTERVIEW_INVITE vs networking from who sent it and what it says (see INTERVIEW_INVITE above).`
}

function localDate(date, timeZone) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

// Mutates the classifier's output: only interviews keep an interview_date, and an invite's
// start beats Claude's guess from the body text.
export function applyInviteTiming(data, invite) {
  if (data.type !== 'INTERVIEW_INVITE') {
    data.interview_date = null
    return data
  }
  if (invite) {
    data.interview_date = invite.allDay
      ? invite.start.toISOString().slice(0, 10)
      : localDate(invite.start, invite.timeZone || DEFAULT_TIME_ZONE)
    if (!data.interview_format && data.meeting_link) data.interview_format = 'video'
    data.invite = invite // for the calendar-event step (08 item 3)
  }
  return data
}

// "📅 Interview: Wed, Oct 21, 2:00 PM EDT", shown first in the Inbox/timeline summary.
export function interviewLine(invite) {
  if (!invite) return null
  const timeZone = invite.allDay ? 'UTC' : (invite.timeZone || DEFAULT_TIME_ZONE)
  const opts = invite.allDay
    ? { timeZone, weekday: 'short', month: 'short', day: 'numeric' }
    : { timeZone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }
  return `📅 Interview: ${new Intl.DateTimeFormat('en-US', opts).format(invite.start)}`
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
    bulk: isBulkMail(headers),
    calendarPart: findCalendarPart(msg.payload),
  }
}

// The newest message's invite, if it has one. Inline parts need no extra call; an attachment
// costs one. A broken invite never fails the thread: it's treated as no invite.
async function loadInvite(accessToken, msg) {
  const part = msg.calendarPart
  if (!part) return null
  try {
    const data = part.data || (await gmailFetch(accessToken, `messages/${msg.id}/attachments/${part.attachmentId}`)).data
    return data ? parseInvite(Buffer.from(data, 'base64url').toString('utf8')) : null
  } catch (e) {
    console.error(`Invite on ${msg.id} unreadable: ${e.message}`)
    return null
  }
}

async function getThreadMessages(accessToken, threadId) {
  const thread = await gmailFetch(accessToken, `threads/${threadId}?format=full`)
  return (thread.messages || []).map(parseGmailMessage)
}

// Shared with scripts/email-pipeline.js's prompt — keep the two in sync.
export const PERSONAL_VS_BULK = `Only one-to-one mail counts as networking. A person reaching out means a specific human wrote
this message to the candidate (or the candidate wrote to them): it reads as individual
correspondence, not a template. These are NOT outreach, however friendly or personalized-looking
("Hi Ethan,"): newsletters, event/info-session/career-fair announcements, webinar invites,
"join our talent community", university career-center or club mailings, recruiting-marketing
campaigns, LinkedIn/Handshake notifications, and anything with an unsubscribe footer. Classify
those UNRELATED unless they carry a formal recruiting signal about the candidate's own
application (a receipt, assessment, interview, offer or rejection). When unsure whether a human
wrote it personally, choose UNRELATED: a false NEW_CONTACT puts a stranger in the candidate's
network and a follow-up on their to-do list.`

// ── Claude classification (same prompt as the Apps Script version, minus the calendar-
// invite hint — .ics parsing isn't ported yet, see module comment) ─────────────────────
// Who the candidate is, from their profile's recruiting tracks (src/lib/tracks.js) —
// replaces the old hardcoded "a CS student".
export function candidateFraming(profile) {
  return `a student recruiting for ${tracksLabel(profile)} roles`
}

// Finance/consulting recruiting uses different words for the same stages. Only added to the
// prompt for users with a non-tech track, so SWE-only prompts stay short.
export function trackGuidance(profile) {
  if (isTechOnly(profile)) return ''
  return `

This candidate recruits in finance/consulting-style processes too. Map their vocabulary:
- HireVue / pre-recorded video interview / "first round" → INTERVIEW_INVITE, interview_round "first"
- "second round" / technical interview → INTERVIEW_INVITE, interview_round "second"
- Superday / final round / assessment centre → INTERVIEW_INVITE, interview_round "final"
- Pymetrics / numerical-reasoning / games-based or online test → OA_INVITE
- Insight days, spring weeks, diversity programs, and info sessions are networking events, not
  applications: NEW_CONTACT or FOLLOW_UP_NEEDED, never APPLICATION_CONFIRMATION.`
}

// INTERVIEW_INVITE's pipeline stage from the reported round (defaults to the first round).
export function interviewStage(round) {
  return { second: 'Technical', final: 'Onsite' }[round] || 'Phone Screen'
}

// Shared with scripts/email-pipeline.js's prompt — keep the two in sync.
export const INTERVIEW_VS_NETWORKING = `INTERVIEW_INVITE is ONLY a formal evaluation step in a hiring process for a role: scheduled by a
recruiter, recruiting coordinator, ATS or interview-scheduling tool (GoodTime, ModernLoop, Calendly
from a recruiting team, etc.), or explicitly called an interview, phone screen, technical, onsite,
superday or final round. A call or meeting with an individual employee — a coffee chat, intro call,
informational interview, "catch up", or a calendar invite titled just with two names ("Ethan and
Jane") — is networking: use NEW_CONTACT or FOLLOW_UP_NEEDED with interview_date null, even when
it has a Google Meet/Zoom link or a calendar invite. Calendar notifications ("Invitation:",
"Updated invitation", "This event has been updated") are scheduling updates for the same meeting,
classified the same way as the original. An invite to an event — info session, career fair, club
or org meeting, workshop, webinar, hackathon, open house, recruiting dinner, any session many people
attend — is never INTERVIEW_INVITE, even when a company hosts it or it arrives as a Google Calendar
invite: use NEW_CONTACT or FOLLOW_UP_NEEDED if someone personal sent it, else UNRELATED. When
unsure, choose networking: a false interview moves the application to Phone Screen and puts an
interview on the calendar.`

async function classifyEmail(llm, { subject, from, body, date, meetingLink, invite, bulk, extraHints, profile }) {
  const inviteHintText = inviteHint(invite, subject)
  const linkHint = meetingLink ? `\n\nA video meeting link was found in this email: ${meetingLink}` : ''
  const bulkHint = bulk ? '\n\nThis email has mailing-list headers (List-Unsubscribe / bulk precedence): it was sent to a list, so it is almost certainly not personal outreach — "personal" should be false.' : ''

  const prompt = `You are processing the email of ${candidateFraming(profile)}, for two equally-in-scope purposes: (1)
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
  "personal": "true if a specific human wrote this message individually to the candidate (or the candidate to them); false for templates, automated notices and anything sent to a list",
  "contact_name": "the recruiter/contact's full name if mentioned in the body or signature, else null — their email address is resolved separately from message headers, not from this field",
  "company": "company name",
  "role": "role title or null",
  "summary": "2-sentence summary of what this email means for the candidate",
  "urgency": "HIGH|MED|LOW",
  "next_action": "one concrete action the candidate should take",
  "follow_up_draft": "3-sentence reply the candidate could send, or null",
  "needs_reply": "true only if a specific person wrote this and is waiting on the candidate to write back (asked a question, asked for availability, offered times, made an intro the candidate should answer); false for notices, receipts, assessments, rejections and anything the candidate sent last",
  "reply_intent": "if needs_reply: schedule_call (they want to find a time to talk or interview) | answer (they asked something) | confirm (they proposed a time or plan to accept) | thank (they helped and a thank-you is the reply) | other; else null",
  "interview_date": "YYYY-MM-DD if an interview is scheduled, or null",
  "interview_format": "phone|video|onsite|null",
  "interview_round": "first|second|final|null — for INTERVIEW_INVITE only: which round this invite is for (a final-round/onsite/superday invite is 'final'); null if not stated",
  "meeting_link": "the Zoom/Google Meet/Teams/etc. video call URL if one is mentioned in the body, else null",
  "referrer_name": "the full name of the person who referred/recommended the candidate for this specific role, ONLY if the email explicitly says so (e.g. 'referred by Jane Doe', 'submitted your referral', 'thanks to an employee referral from...'). Otherwise null — never guess.",
  "oa_due_date": "YYYY-MM-DD if this is an Online Assessment invite AND the email states a completion deadline, else null — never guess or estimate a date that isn't actually stated",
  "oa_link": "the URL the candidate clicks to start/complete the Online Assessment, if this is an OA_INVITE, else null",
  "offer_deadline": "YYYY-MM-DD if this is an OFFER AND the email states a date to accept or respond by, else null — never guess or estimate a date that isn't actually stated",
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
The same goes for offer_deadline: only a stated respond-by date ("please let us know by
November 14", "this offer expires in two weeks"), else null.

NEW_CONTACT means this introduces or continues a relationship with someone potentially useful to
the candidate's professional network — met at a career fair/event, an alum, a friendly employee at
a company of interest, someone offering to help or make an introduction — even if no specific
job/application is mentioned at all. It requires a specific person writing to the candidate
personally (see below).

FOLLOW_UP_NEEDED means a networking thread (not tied to a specific application stage) whose
natural next step is for the candidate to follow up — say thanks, schedule a call, check in again
later. Prefer this over REPLY when the email is relationship-building rather than a reply within a
formal application process.

${PERSONAL_VS_BULK}

${INTERVIEW_VS_NETWORKING}${trackGuidance(profile)}${inviteHintText}${linkHint}${bulkHint}${extraHints || ''}

Subject: ${subject}
From: ${from}
Date: ${date}
Body:
${body}`

  return completeJSON(llm, { tier: 'mini', prompt, maxTokens: 800 })
}

// ── Supabase writes (ported from the raw-PostgREST version to real supabase-js calls) ───
async function upsertContact(db, userId, data) {
  if (!shouldCreateContact(data, data.contact_email)) return null
  const today = new Date().toISOString().slice(0, 10)

  const { data: rows } = await db.from('contacts').select('id,phone,follow_up_date')
    .eq('user_id', userId).eq('email', data.contact_email).limit(1)
  const existingId = rows?.[0]?.id
  const existingPhone = rows?.[0]?.phone
  const followUp = contactFollowUpDate(data, rows?.[0]?.follow_up_date, today)

  const updateProps = {
    ...(data.company ? { company: data.company } : existingId ? {} : { company: '' }),
    last_interaction: today,
    ...(followUp ? { follow_up_date: followUp } : {}),
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

// What one classified email may do to the matching application. An interview or offer
// (anything past Applied that isn't a rejection) only counts against an application already
// sent and still open. Event invites get mislabeled INTERVIEW_INVITE, and the fuzzy company
// match lands them on job-board Wishlist rows or creates a fresh row: 17 fake Phone Screens
// on the owner's account before this guard (2026-10-21). { skip } means touch nothing.
// scripts/email-pipeline.js has the same rule — keep the two in sync.
export function scanStageChange(stage, existing) {
  const progress = stage !== 'Applied' && stage !== 'Rejected'
  if (!existing) return progress ? { skip: true } : { stage }
  if (stage === 'Rejected') return { stage }
  const rank = s => STAGE_RANK[s] ?? 0
  const closed = existing.stage === 'Rejected' || existing.stage === 'Accepted'
  if (progress && (closed || rank(existing.stage) < STAGE_RANK.Applied)) return { skip: true }
  return { stage: !closed && rank(stage) >= rank(existing.stage) ? stage : null }
}

// Role titles compared loosely: case, punctuation, years/req ids ("2027", "137214") and
// filler words ("Summer", "Intern") don't make two roles different.
const ROLE_FILLER = new Set(['summer', 'fall', 'spring', 'winter', 'intern', 'internship', 'co', 'op', 'the', 'a', 'an', 'of', 'and', 'for', 'in'])
export function roleKey(role) {
  return (role || '').toLowerCase().replace(/engineering/g, 'engineer').split(/[^a-z0-9]+/)
    .filter(w => w && !/^\d+$/.test(w) && !ROLE_FILLER.has(w)).sort().join(' ')
}

// Which of a company's applications (newest first) an email belongs to. Companies get
// several applications per season, so a stated role only lands on that role (or on a row
// with no role yet); otherwise it's a new application. Matching on company alone collapsed
// three IBM applications into one row whose completed OA then swallowed two new OA invites
// (2026-10-23). No role in the email → newest row, as before.
// scripts/email-pipeline.js has the same rule — keep the two in sync.
export function pickApplication(rows, role) {
  if (!rows?.length) return undefined
  const key = roleKey(role)
  if (!key) return rows[0]
  return rows.find(r => roleKey(r.role) === key) || rows.find(r => !roleKey(r.role))
}

// OA fields an OA_INVITE writes. A finished OA stays finished against a re-sent invite (same
// link), but an invite with a new link is a new assessment (a second round, a retake) and
// reopens it: a missed OA costs more than one wrongly reopened.
// scripts/email-pipeline.js has the same rule — keep the two in sync.
export function oaInviteFields(data, existing) {
  if (data.type !== 'OA_INVITE') return {}
  const fields = { oa_due_date: data.oa_due_date || null, oa_link: data.oa_link || null, oa_research_checked_at: null }
  if (!existing?.oa_completed) return fields
  return data.oa_link && data.oa_link !== existing.oa_link ? { ...fields, oa_completed: false } : {}
}

// Interview and offer dates an email writes (v1.4 spec 02). An invite's start is the real
// time. A date from the body is stored at noon campus time with interview_time_known false,
// and the UI shows only the day. Threads aren't scanned in date order, so the later interview
// wins (an old first-round email scanned late can't roll back a final round); the exception
// is the same day, where a real time replaces a guess (a reschedule within the day too) and
// a guess never replaces a real time. A stated offer deadline is written; a missing one never
// clears a value the user may have typed.
// scripts/email-pipeline.js has the same rule — keep the two in sync.
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
export function scheduleFields(data, existing, { timeZone }) {
  if (data.type === 'OFFER') return DATE_ONLY_RE.test(data.offer_deadline || '') ? { offer_deadline: data.offer_deadline } : {}
  if (data.type !== 'INTERVIEW_INVITE') return {}
  let next
  if (data.invite && !data.invite.allDay) {
    next = { interview_at: data.invite.start.toISOString(), interview_time_known: true }
  } else if (DATE_ONLY_RE.test(data.interview_date || '')) {
    const [y, m, d] = data.interview_date.split('-').map(Number)
    next = { interview_at: zonedToUtc(y, m, d, 12, 0, 0, timeZone).toISOString(), interview_time_known: false }
  } else {
    return {}
  }
  if (!existing?.interview_at) return next
  const was = new Date(existing.interview_at)
  if (localDate(was, timeZone) === localDate(new Date(next.interview_at), timeZone)) {
    return next.interview_time_known || !existing.interview_time_known ? next : {}
  }
  return new Date(next.interview_at) > was ? next : {}
}

async function upsertApplication(db, userId, data, { timeZone }) {
  const today = new Date().toISOString().slice(0, 10)
  const stageMap = {
    APPLICATION_CONFIRMATION: 'Applied',
    OA_INVITE: 'Applied',
    INTERVIEW_INVITE: interviewStage(data.interview_round),
    OFFER: 'Offer',
    REJECTION: 'Rejected',
  }
  const stage = stageMap[data.type] || 'Applied'
  const referrerId = data.referrer_name ? await findContactByName(db, userId, data.referrer_name) : null

  const { data: rows } = await db.from('applications')
    .select('id,role,stage,referred_by_id,oa_completed,oa_link,interview_at,interview_time_known')
    .eq('user_id', userId).ilike('company', `%${data.company || ''}%`).eq('archived', false)
    .order('created_at', { ascending: false }).limit(50)
  const existing = pickApplication(rows, data.role)
  const change = scanStageChange(stage, existing)
  if (change.skip) return null

  const props = {
    last_activity: today,
    ...(stage === 'Rejected' ? { closed_date: today } : {}),
    ...(data.role ? { role: data.role } : {}),
    ...(referrerId && !existing?.referred_by_id ? { referred_by_id: referrerId } : {}),
    ...oaInviteFields(data, existing),
    ...scheduleFields(data, existing, { timeZone }),
  }

  if (existing) {
    if (change.stage) props.stage = change.stage
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

// Same Gmail message logged by both pipelines, or re-logged after thread_progress was lost:
// rows written before interactions.gmail_message_id existed have no id to conflict on, so
// they're matched by thread + timestamp instead (v1.3 spec 11). 5 s absorbs the gap between
// GmailApp's message date and the REST API's internalDate.
const SAME_MESSAGE_MS = 5000

export function isAlreadyLogged(existingSentAts, message) {
  const t = message.date.getTime()
  return existingSentAts.some(s => s && Math.abs(new Date(s).getTime() - t) <= SAME_MESSAGE_MS)
}

export function interactionRow(userId, message, { contactId, threadId, myEmail, meetingLink, interviewAt, category }) {
  const from = parseAddress(message.from)
  const direction = (from && from.email === myEmail) ? 'Outbound' : 'Inbound'
  const lead = [interviewAt, meetingLink && `📅 Meeting link: ${meetingLink}`].filter(Boolean).join('\n')
  const summary = lead ? `${lead}\n\n${message.plainBody}` : message.plainBody

  return {
    user_id: userId,
    contact_id: contactId || null,
    type: 'Email',
    direction,
    date: message.date.toISOString().slice(0, 10),
    channel_ref: threadId,
    gmail_message_id: message.id,
    summary: summary.slice(0, 300),
    body: message.plainBody.slice(0, 2000),
    // Inbox fields (supabase/migrations/20261007000000_inbox.sql) — own sent mail is born read.
    subject: (message.subject || '').slice(0, 300),
    from_address: from ? from.email : null,
    from_name: from ? from.displayName || null : null,
    sent_at: message.date.toISOString(),
    mailbox: myEmail,
    email_category: category || null,
    read_at: direction === 'Outbound' ? new Date().toISOString() : null,
  }
}

// Logs a thread's not-yet-seen messages in one write. The meeting link and interview time go
// on the newest message only (the one that was classified). Duplicates by gmail_message_id are dropped by
// the unique index; legacy rows by isAlreadyLogged().
export async function logThreadMessages(db, userId, newMessages, { contactId, threadId, myEmail, meetingLink, interviewAt, category }) {
  if (!newMessages.length) return 0
  const { data: legacy } = await db.from('interactions')
    .select('sent_at')
    .eq('user_id', userId).eq('type', 'Email').eq('channel_ref', threadId).is('gmail_message_id', null)
  const legacySentAts = (legacy || []).map(r => r.sent_at)

  const rows = newMessages
    .map((m, i) => ({ m, isNewest: i === newMessages.length - 1 }))
    .filter(({ m }) => !isAlreadyLogged(legacySentAts, m))
    .map(({ m, isNewest }) => interactionRow(userId, m, {
      contactId, threadId, myEmail, category,
      meetingLink: isNewest ? meetingLink : null, interviewAt: isNewest ? interviewAt : null,
    }))
  if (!rows.length) return 0

  const { error } = await db.from('interactions')
    .upsert(rows, { onConflict: 'user_id,gmail_message_id', ignoreDuplicates: true })
  if (error) throw new Error(`Logging thread ${threadId}: ${error.message}`)
  return rows.length
}

// ── Entry point — scans one connected Gmail mailbox, returns updated thread_progress ────
// user_settings the drafter needs: whether it's on (unset = on) and the call-time window.
async function draftSettings(db, userId) {
  const { data } = await db.from('user_settings').select('key, value').eq('user_id', userId)
    .in('key', [AUTO_DRAFT_SETTING_KEY, AVAILABILITY_SETTING_KEY])
  const byKey = Object.fromEntries((data || []).map(r => [r.key, r.value]))
  return { enabled: byKey[AUTO_DRAFT_SETTING_KEY] !== false, availability: byKey[AVAILABILITY_SETTING_KEY] || null }
}

export async function scanGmailConnection(connection, { deadline } = {}) {
  const scanStartedAt = new Date().toISOString()
  const db = supabaseAdmin()
  const userId = connection.user_id
  const myEmail = connection.connected_email.toLowerCase()

  // Recruiting tracks shape the classifier prompt (candidateFraming / trackGuidance);
  // ai_provider picks which of the user's keys classifies (either works, see llm.js).
  const { data: profile } = await db.from('profiles').select('tracks, focus, school_id, ai_provider, full_name, resume_text').eq('id', userId).maybeSingle()
  const llm = await llmForUser(userId, profile?.ai_provider)
  if (!llm) {
    return { threadProgress: connection.thread_progress || {}, cursor: connection.scan_cursor || null, scanned: 0, skipped: 'no_ai_key' }
  }
  // Interview events land in the campus zone when there is one (schools.timezone).
  const { data: school } = profile?.school_id
    ? await db.from('schools').select('timezone').eq('id', profile.school_id).maybeSingle()
    : { data: null }
  const timeZone = school?.timezone || DEFAULT_TIME_ZONE
  // Minted on first use: most scans never need the Calendar.
  let calendarToken
  const getCalendarToken = async () => {
    if (calendarToken === undefined) {
      const rt = await calendarRefreshToken(db, userId)
      calendarToken = rt ? await mintAccessToken(rt) : null
    }
    return calendarToken
  }

  // Reply drafts (v1.4 spec 10): settings read once per mailbox, free slots fetched at most
  // once per scan and only when some email asks to find a time.
  const settings = await draftSettings(db, userId)
  let draftsThisRun = 0
  let slotsPromise
  const getSlots = () => (slotsPromise ??= calendarRefreshTokens(db, userId)
    .then(refreshTokens => slotsFor({ availability: settings.availability, refreshTokens, mintToken: mintAccessToken }))
    .catch(e => { console.error(`Free slots for ${myEmail} failed: ${e.message}`); return { slots: [], checked: false } }))

  const refreshToken = decrypt(connection.refresh_token_ciphertext)
  const accessToken = await mintAccessToken(refreshToken)

  const queries = scanQueries(connection.scan_cursor)
  const [inboxIds, sentIds] = await Promise.all([
    searchMessageIds(accessToken, queries.inbox, SEARCH_CAP),
    searchMessageIds(accessToken, queries.sent, SEARCH_CAP),
  ])
  const threadIds = [...new Set([...inboxIds, ...sentIds].map(m => m.threadId))]

  const threadProgress = { ...(connection.thread_progress || {}) }
  const pushes = []

  const processThread = async threadId => {
    try {
      const messages = await getThreadMessages(accessToken, threadId)
      const seen = threadProgress[threadId] || 0
      if (messages.length <= seen) return 'unchanged'

      const msg = messages[messages.length - 1]
      const invite = await loadInvite(accessToken, msg)
      const meetingLink = inviteMeetingLink(invite) || extractMeetingLink(msg.plainBody)

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

      const data = await classifyEmail(llm, {
        subject: msg.subject, from: msg.from, body: msg.plainBody,
        date: msg.date.toISOString().slice(0, 10), meetingLink, invite, bulk: msg.bulk,
        extraHints: applicationHint + referralHint + oaHint + companyHint + shapeHint + networkingHint,
        profile,
      })

      const counterpart = findCounterpartAddress(messages, myEmail)
      const fromMe = parseAddress(msg.from)?.email === myEmail
      // You wrote back yourself, so any draft waiting on this thread is done.
      if (fromMe) await settleThreadDrafts(db, userId, threadId)
      if (!data || data.type === 'UNRELATED' || isGenericNetworking(data, counterpart.email)) {
        threadProgress[threadId] = messages.length
        return 'classified'
      }

      data.meeting_link = meetingLink || data.meeting_link || null
      applyInviteTiming(data, invite)
      data.contact_email = counterpart.email || null
      if (!data.contact_name && counterpart.displayName) data.contact_name = counterpart.displayName

      const contactId = await upsertContact(db, userId, data)

      let applicationId = null
      if (['APPLICATION_CONFIRMATION', 'OA_INVITE', 'INTERVIEW_INVITE', 'OFFER', 'REJECTION'].includes(data.type)) {
        applicationId = await upsertApplication(db, userId, data, { timeZone })
      }

      // Best effort: a Calendar problem (revoked grant, quota) is logged, never retried, so it
      // can't hold the thread back. The same-day title check keeps a re-classified thread
      // from adding a second event.
      // No application took the interview (scanStageChange skipped it), so no event either.
      if (applicationId && shouldCreateInterviewEvent(data, { invite, today: localDate(new Date(), timeZone) })) {
        try {
          const token = await getCalendarToken()
          if (token) await createInterviewEvent(token, data, { timeZone })
        } catch (e) {
          console.error(`Interview event for ${threadId} (${myEmail}) failed: ${e.message}`)
        }
      }

      if (keepActionItem(data, data.contact_email)) {
        await upsertActionItem(db, userId, {
          gmailMessageId: msg.id, threadId, contactId, applicationId,
          summary: data.action_item, priority: data.action_priority || 'medium', dueDate: data.action_due_date || null,
        })
      }

      await logThreadMessages(db, userId, messages.slice(seen), {
        contactId, threadId, myEmail, meetingLink: data.meeting_link, category: data.type,
        interviewAt: data.type === 'INTERVIEW_INVITE' && applicationId ? interviewLine(invite) : null,
      })

      // Best effort, like the calendar event: a failed draft never holds the thread back.
      const draftable = shouldDraftReply(data, {
        fromMe, automatedSender: isAutomatedSender(counterpart.email), bulk: msg.bulk, sentAt: msg.date,
        enabled: settings.enabled, draftsThisRun,
      })
      if (draftable) {
        draftsThisRun++
        try {
          const intent = replyIntent(data)
          const { slots, checked } = intent === 'schedule_call' ? await getSlots() : { slots: [], checked: false }
          const slotZone = settings.availability?.timeZone || timeZone
          const body = await draftReply(llm, {
            messages, myEmail, data, framing: candidateFraming(profile), profile,
            resumeText: profile?.resume_text, slots, timeZone: slotZone,
          })
          await saveReplyDraft(db, userId, {
            mailbox: myEmail, thread_id: threadId, reply_to_message_id: msg.id, to_address: counterpart.email,
            subject: replySubject(msg.subject), body, intent,
            proposed_slots: slots.length ? slots : null, slots_checked: checked,
          })
        } catch (e) {
          console.error(`Reply draft for ${threadId} (${myEmail}) failed: ${e.message}`)
        }
      }

      threadProgress[threadId] = messages.length
      // Last, so a thread that fails above (and is retried next tick) never pushes twice.
      const unmatchedProgress = !applicationId && (data.type === 'INTERVIEW_INVITE' || data.type === 'OFFER')
      const push = isFreshEnoughToPush(msg.date) && !unmatchedProgress ? statusPush(data) : null
      if (push) pushes.push(push)
      return 'classified'
    } catch (e) {
      console.error(`Thread ${threadId} (${myEmail}) failed: ${e.message}`)
      // leave threadProgress untouched for this thread — retried next scan
      return 'failed'
    }
  }

  const { classified, failed, partial } = await runThreadBudget(threadIds, processThread, { deadline })
  const cursor = nextCursor({ prevCursor: connection.scan_cursor, scanStartedAt, partial, failed })
  return { threadProgress, scanned: classified, failed, partial, cursor, pushes }
}
