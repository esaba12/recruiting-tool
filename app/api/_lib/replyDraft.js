// Auto-drafted replies (v1.4 spec 10). The Gmail scan (emailPipeline.js) classifies each
// thread's newest message; when it's a person who expects an answer, this drafts one on the
// user's own key and stores it in email_drafts for Inbox and Today. When they asked to find
// a time, the draft offers free slots from the user's stated hours (user_settings
// 'availability'), minus anything on their connected Google calendars. Nothing is ever sent:
// drafts stay in the app until a later spec writes them to Gmail (gmail_draft_id).
import { decrypt } from './crypto.js'
import { completeJSON } from './llm.js'
import { suggestSlots, formatSlot, normalizeAvailability } from '../../src/lib/availability.js'
import { resumePromptBlock } from '../../src/lib/resume.js'

export const MAX_DRAFTS_PER_RUN = 8
export const DRAFT_FRESH_MS = 7 * 24 * 3600 * 1000
// Nothing to answer: receipts, assessments (you take them, you don't reply) and closed doors.
const NO_DRAFT_TYPES = ['APPLICATION_CONFIRMATION', 'OA_INVITE', 'OA_COMPLETED', 'REJECTION']
const INTENTS = ['schedule_call', 'answer', 'confirm', 'thank', 'other']

// Whether the newest message of a thread gets a drafted reply. Pure: the scan works out the
// sender facts (it owns isAutomatedSender) and passes them in.
export function shouldDraftReply(data, { fromMe, automatedSender, bulk, sentAt, now = Date.now(), enabled = true, draftsThisRun = 0 }) {
  if (!enabled || draftsThisRun >= MAX_DRAFTS_PER_RUN) return false
  if (!data || data.type === 'UNRELATED' || data.needs_reply !== true || data.personal === false) return false
  if (NO_DRAFT_TYPES.includes(data.type)) return false
  if (fromMe || automatedSender || bulk) return false
  // The 45-day first pass shouldn't spray drafts for mail nobody's waiting on anymore.
  return now - new Date(sentAt).getTime() <= DRAFT_FRESH_MS
}

export function replyIntent(data) {
  return INTENTS.includes(data?.reply_intent) ? data.reply_intent : 'other'
}

export function replySubject(subject) {
  const s = String(subject || '').trim()
  return /^re:/i.test(s) ? s : `Re: ${s}`.trim()
}

// Reply bodies quote the whole thread below them; only the new text matters to the drafter.
export function stripQuoted(body) {
  const lines = String(body || '').split('\n')
  const cut = lines.findIndex(l => /^On .+wrote:\s*$/.test(l.trim()) || /^-{2,}\s*Original Message/i.test(l.trim()))
  return (cut === -1 ? lines : lines.slice(0, cut)).filter(l => !l.trimStart().startsWith('>')).join('\n').trim()
}

// ── Free slots ─────────────────────────────────────────────────────────────────────────

// Every connected calendar (personal and school slots), decrypted.
export async function calendarRefreshTokens(db, userId) {
  const { data: rows } = await db.from('google_calendar_tokens').select('refresh_token_ciphertext').eq('user_id', userId)
  return (rows || []).map(r => { try { return decrypt(r.refresh_token_ciphertext) } catch { return null } }).filter(Boolean)
}

// Busy blocks across every calendar that answers. checked: how many calendars were read, so
// the UI can say whether the slots were checked against a calendar at all.
export async function fetchBusy({ refreshTokens, mintToken, timeMin, timeMax, fetch = globalThis.fetch }) {
  const busy = []
  let checked = 0
  for (const rt of refreshTokens) {
    try {
      const token = await mintToken(rt)
      const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeMin, timeMax, items: [{ id: 'primary' }] }),
      })
      if (!res.ok) throw new Error(`freeBusy ${res.status}`)
      const json = await res.json()
      busy.push(...(json.calendars?.primary?.busy || []))
      checked++
    } catch (e) {
      console.error(`freeBusy failed: ${e.message}`)
    }
  }
  return { busy, checked }
}

// Slots for one draft: [] when availability is unset (the draft then asks for their times).
export async function slotsFor({ availability, refreshTokens, mintToken, now = Date.now(), fetch }) {
  const a = normalizeAvailability(availability)
  if (!a) return { slots: [], checked: false }
  const timeMin = new Date(now).toISOString()
  const timeMax = new Date(now + 21 * 24 * 3600 * 1000).toISOString()
  const { busy, checked } = refreshTokens.length
    ? await fetchBusy({ refreshTokens, mintToken, timeMin, timeMax, fetch })
    : { busy: [], checked: 0 }
  return { slots: suggestSlots({ busy, availability: a, now }), checked: checked > 0 }
}

// ── The draft ──────────────────────────────────────────────────────────────────────────

const MESSAGE_CHARS = 1500

export function buildReplyPrompt({ messages, myEmail, data, framing, profile, resumeText, slots = [], timeZone }) {
  const name = profile?.full_name?.trim()
  const thread = messages.slice(-3).map(m => {
    const mine = String(m.from || '').toLowerCase().includes(myEmail)
    return `--- ${mine ? 'Candidate (you)' : m.from} · ${new Date(m.date).toISOString().slice(0, 10)}\n${stripQuoted(m.plainBody).slice(0, MESSAGE_CHARS)}`
  }).join('\n\n')
  const intent = replyIntent(data)
  const scheduling = intent === 'schedule_call'
    ? slots.length
      ? `\n\nThey want to find a time. Offer exactly these times (already checked as free), as a short bulleted list, written exactly as given:\n${slots.map(s => `• ${formatSlot(s, timeZone)}`).join('\n')}\nAdd that you're happy to adjust if none work.`
      : '\n\nThey want to find a time, but the candidate\'s availability isn\'t known: ask them to suggest two or three times that work, and say you\'ll make one of them work. Do not invent specific times.'
    : ''

  return `You are drafting an email reply for ${framing}${name ? ` named ${name}` : ''}. The candidate will review and edit it before sending. Return ONLY valid JSON, no explanation, no markdown:
{"body": "the reply text, starting with a greeting and ending with the sign-off${name ? ` (${name.split(/\s+/)[0]})` : ''}"}

What this email is: ${data.summary || 'a message that needs a reply'}
What the candidate should do: ${data.next_action || 'reply'}
Reply intent: ${intent}${scheduling}${resumePromptBlock(resumeText)}

Rules:
- Match the sender's register: brief and warm with a peer, polished with a recruiter.
- Under 120 words. Plain text, no subject line.
- Answer what they actually asked. Never invent facts about the candidate beyond the résumé or thread.
- Never accept an offer, commit to a deadline, or agree to anything beyond proposing or confirming a time.
- No placeholders like [Name] or [time]: if something isn't known, leave it out.
- No "I hope this email finds you well".

Thread, oldest first (the last message is the one being answered):
${thread}`
}

export async function draftReply(llm, args) {
  const out = await completeJSON(llm, { tier: 'standard', prompt: buildReplyPrompt(args), maxTokens: 600 })
  const body = typeof out?.body === 'string' ? out.body.trim() : ''
  if (!body) throw new Error('Empty draft')
  return body
}

// One draft per answered message. A newer message in the thread supersedes an older draft;
// a draft the user already finished or dismissed is never brought back (ignoreDuplicates).
export async function saveReplyDraft(db, userId, row) {
  await db.from('email_drafts').update({ status: 'dismissed', updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('thread_id', row.thread_id).eq('status', 'pending').neq('reply_to_message_id', row.reply_to_message_id)
  const { error } = await db.from('email_drafts').upsert({ user_id: userId, ...row },
    { onConflict: 'user_id,reply_to_message_id', ignoreDuplicates: true })
  if (error) throw new Error(error.message)
}

// The user wrote back themselves (the thread's newest message is theirs): its drafts are done.
export async function settleThreadDrafts(db, userId, threadId) {
  await db.from('email_drafts').update({ status: 'done', updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('thread_id', threadId).eq('status', 'pending')
}
