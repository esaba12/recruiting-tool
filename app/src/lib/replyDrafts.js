// Reply drafts (v1.4 spec 10): what the Gmail scan writes to email_drafts, and the bits of
// it the client needs. The scan reads the same setting key (api/_lib/emailPipeline.js).

// user_settings 'auto_draft_replies': false turns drafting off; unset means on.
export const AUTO_DRAFT_SETTING_KEY = 'auto_draft_replies'

export const DRAFT_INTENT_LABEL = {
  schedule_call: 'Proposes times',
  answer: 'Answers their question',
  confirm: 'Confirms',
  thank: 'Thank-you',
  other: 'Reply',
}

// Pending drafts keyed by Gmail thread id (interactions.channel_ref), newest first wins.
export function draftsByThread(drafts = []) {
  const map = new Map()
  for (const d of [...drafts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))) {
    if (d.status === 'pending' && d.threadId && !map.has(d.threadId)) map.set(d.threadId, d)
  }
  return map
}

// First non-greeting line of a draft, for Today and the thread list.
export function draftPreview(body = '') {
  const lines = String(body).split('\n').map(l => l.trim()).filter(Boolean)
  const line = lines.find(l => !/^(hi|hey|hello|dear|good (morning|afternoon|evening))\b.*,?$/i.test(l) || l.length > 40) || lines[0] || ''
  return line.length > 120 ? `${line.slice(0, 117)}…` : line
}
