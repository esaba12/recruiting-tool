// Inbox — pure derivation over `interactions`. The email pipelines only log threads Claude
// classified as recruiting/networking (UNRELATED threads are never written), so grouping the
// type='Email' rows by Gmail thread id (channel_ref) IS the filtered inbox (a hand-logged email
// with no thread is a thread of one); nothing here re-classifies. See
// supabase/migrations/20261007000000_inbox.sql for the per-message fields.

import { normalizeCompanyName } from './networkGraph.js'
import { draftsByThread } from './replyDrafts.js'

export const CATEGORY = {
  APPLICATION_CONFIRMATION: { label: 'Applied',            group: 'recruiting', tone: 'ink' },
  OA_INVITE:                { label: 'Coding test',        group: 'recruiting', tone: 'warning' },
  OA_COMPLETED:             { label: 'Test submitted',     group: 'recruiting', tone: 'ink' },
  INTERVIEW_INVITE:         { label: 'Interview',          group: 'recruiting', tone: 'accent' },
  OFFER:                    { label: 'Offer',              group: 'recruiting', tone: 'success' },
  REJECTION:                { label: 'Not moving forward', group: 'recruiting', tone: 'danger' },
  REPLY:                    { label: 'Reply',              group: 'networking', tone: 'accent' },
  NEW_CONTACT:              { label: 'New contact',        group: 'networking', tone: 'ink' },
  FOLLOW_UP_NEEDED:         { label: 'Follow up',          group: 'networking', tone: 'warning' },
}

export const FILTERS = [
  { key: 'all',        label: 'All' },
  { key: 'needsReply', label: 'Needs a reply' },
  { key: 'recruiting', label: 'Applications' },
  { key: 'networking', label: 'People' },
  { key: 'sent',       label: 'Sent' },
]

// Same shape the pipelines' AUTOMATED_SENDER_RE / ATS_DOMAINS use: a no-reply/ATS sender
// can't be replied to, so it never counts toward "Needs a reply".
const AUTOMATED_RE = /^(no-?reply|do-?not-?reply|notifications?|mailer(-daemon)?|automated|system|recruit(ing|ment|er)?|careers?|jobs|ats|talent(acquisition)?|hello|team|info|news(letter)?s?|events?|marketing|updates?|support|admin|hr|campus|university|students?|hiring|apply|applications?|alerts?|digest)([._+-][^@]*)?@|joinhandshake|linkedin\.com|greenhouse|lever\.co|myworkday|workday|ashbyhq|smartrecruiters|icims|jobvite|hackerrank|codesignal|codility|hackerearth/i
const NEEDS_REPLY_WINDOW_DAYS = 21
// Same phrasing as the pipelines' APPLICATION_CONFIRMATION_RE, for pre-inbox rows with no category.
const GENERIC_NETWORKING = ['NEW_CONTACT', 'FOLLOW_UP_NEEDED']
const RECEIPT_SUBJECT_RE = /\b(thank(?:s| you) for (?:your interest|applying)|application (?:received|submitted|confirmation)|we(?:'| ha)ve received your application|successfully applied)\b/i

export const isAutomated = address => !!address && AUTOMATED_RE.test(address)

export function messageTime(m) {
  return new Date(m.sentAt || m.date || 0).getTime()
}

// Both pipelines lead the classified message's summary with 📅 lines: "📅 Interview: Wed,
// Oct 21, 2:00 PM EDT" (from a calendar invite, serverless path only, v1.3 spec 12) and/or
// "📅 Meeting link: <url>". Split them off so the reader can show them as their own lines.
const INTERVIEW_LEAD = /^📅 Interview: (.+)$/
const MEETING_LEAD = /^📅 Meeting link: (\S+)$/
function stripLead(text) {
  const lines = (text || '').split('\n')
  let interview = null, meetingLink = null, i = 0
  for (; i < lines.length; i++) {
    const iv = lines[i].match(INTERVIEW_LEAD)
    const ml = lines[i].match(MEETING_LEAD)
    if (iv && !interview) interview = iv[1].trim()
    else if (ml && !meetingLink) meetingLink = ml[1]
    else break
  }
  return { interview, meetingLink, text: lines.slice(i).join('\n').replace(/^\s+/, '') }
}

// → { interview, meetingLink, text }. The lead lines live only in `summary`; the text is
// the full body when there is one.
export function messageLead(m) {
  const lead = stripLead(m.summary)
  return { interview: lead.interview, meetingLink: lead.meetingLink, text: m.body ? stripLead(m.body).text : lead.text }
}

// Rows logged before the inbox columns existed have no subject — fall back to the first
// line of the summary so the list still reads.
function subjectFor(messages) {
  const withSubject = messages.find(m => m.subject)
  if (withSubject) return withSubject.subject.replace(/^((re|fwd?):\s*)+/i, '')
  const first = stripLead(messages[0]?.summary).text.split('\n')[0]
  return first.slice(0, 90) || '(no subject)'
}

export function snippet(m) {
  return messageLead(m).text.replace(/\s+/g, ' ').trim().slice(0, 160)
}

export function buildThreads({ interactions = [], contacts = [], apps = [], actionItems = [], drafts = [], now = Date.now() }) {
  const draftByThread = draftsByThread(drafts)
  const contactById = new Map(contacts.map(c => [c.id, c]))
  const appById = new Map(apps.map(a => [a.id, a]))
  const byThread = new Map()
  for (const i of interactions) {
    if (i.type !== 'Email') continue
    // A hand-logged email has no Gmail thread: it's a thread of one (`manual:<id>`).
    const key = i.channelRef || `manual:${i.id}`
    if (!byThread.has(key)) byThread.set(key, [])
    byThread.get(key).push(i)
  }
  const openItemsByThread = new Map()
  for (const item of actionItems) {
    if (!item.threadId || item.completedAt || item.dismissedAt) continue
    if (!openItemsByThread.has(item.threadId)) openItemsByThread.set(item.threadId, [])
    openItemsByThread.get(item.threadId).push(item)
  }

  const threads = []
  for (const [id, rows] of byThread) {
    const messages = [...rows].sort((a, b) => messageTime(a) - messageTime(b))
    const last = messages[messages.length - 1]
    const contactId = [...messages].reverse().find(m => m.contactId)?.contactId
    const contact = contactId ? contactById.get(contactId) || null : null

    // Newest classification wins (the pipeline classifies the newest message each run).
    // Pre-inbox rows have none: an automated sender reads as an application email, a
    // person as networking — both already passed the pipeline's relevance filter.
    const classified = [...messages].reverse().find(m => m.emailCategory && CATEGORY[m.emailCategory])
    const inbound = messages.filter(m => m.direction === 'Inbound')
    const anyAutomated = inbound.some(m => isAutomated(m.fromAddress))
    const category = classified?.emailCategory || null
    const group = category ? CATEGORY[category].group : anyAutomated ? 'recruiting' : 'networking'

    const actionItems = openItemsByThread.get(id) || []
    const hasSent = messages.some(m => m.direction === 'Outbound')

    // "We got your application" receipts already became a Pipeline row; in the Inbox they're
    // just noise. Kept if you wrote back or the pipeline flagged something to do.
    const isReceipt = category === 'APPLICATION_CONFIRMATION'
      || (!category && anyAutomated && RECEIPT_SUBJECT_RE.test(subjectFor(messages)))
    if (isReceipt && !hasSent && !actionItems.length) continue
    // Pre-gate rows: a mass mail the classifier called NEW_CONTACT/FOLLOW_UP_NEEDED. Nobody
    // to network with if every message came from a role mailbox and you never wrote back.
    const allAutomated = inbound.length > 0 && inbound.every(m => isAutomated(m.fromAddress))
    if (GENERIC_NETWORKING.includes(category) && allAutomated && !hasSent && !actionItems.length) continue
    const linkedApp = actionItems.map(a => appById.get(a.applicationId)).find(Boolean)
      || (group === 'recruiting' && contact?.company
        ? apps.find(a => !a.archived && a.company && normalizeCompanyName(a.company) === normalizeCompanyName(contact.company))
        : null)
      || null

    const lastIsHumanInbound = last.direction === 'Inbound' && !isAutomated(last.fromAddress)
    const recent = now - messageTime(last) <= NEEDS_REPLY_WINDOW_DAYS * 86400000
    // A drafted reply (v1.4 spec 10) only exists while the newest message is theirs and unanswered.
    const draft = draftByThread.get(id) || null
    const needsReply = !!draft || actionItems.length > 0 || (lastIsHumanInbound && recent && category !== 'REJECTION')

    const lastInbound = inbound[inbound.length - 1]
    const manual = id.startsWith('manual:')
    threads.push({
      id,
      manual,
      subject: subjectFor(messages),
      messages,
      last,
      contact,
      application: linkedApp,
      category,
      group,
      actionItems,
      needsReply,
      draft,
      unread: !manual && inbound.some(m => !m.readAt), // you typed a manual one in, so you've read it
      hasSent,
      mailbox: messages.find(m => m.mailbox)?.mailbox || null,
      // Who to show in the list: an automated sender as itself ("Ramp Recruiting", not the
      // recruiter contact the thread got linked to), else the contact, else whoever last
      // wrote in, else "You".
      counterpart: (isAutomated(lastInbound?.fromAddress) && lastInbound.fromName)
        || contact?.name || lastInbound?.fromName || lastInbound?.fromAddress
        || (inbound.length ? 'Unknown sender' : 'You'),
      company: contact?.company || null,
      lastAt: messageTime(last),
    })
  }
  return threads.sort((a, b) => b.lastAt - a.lastAt)
}

export function filterThreads(threads, filter, query = '') {
  const q = query.trim().toLowerCase()
  return threads.filter(t => {
    if (filter === 'needsReply' && !t.needsReply) return false
    if (filter === 'recruiting' && t.group !== 'recruiting') return false
    if (filter === 'networking' && t.group !== 'networking') return false
    if (filter === 'sent' && !t.hasSent) return false
    if (!q) return true
    return [t.subject, t.counterpart, t.company, ...t.messages.map(m => m.body || m.summary)]
      .some(f => f && f.toLowerCase().includes(q))
  })
}

export function filterCounts(threads) {
  return {
    all: threads.length,
    needsReply: threads.filter(t => t.needsReply).length,
    recruiting: threads.filter(t => t.group === 'recruiting').length,
    networking: threads.filter(t => t.group === 'networking').length,
    sent: threads.filter(t => t.hasSent).length,
  }
}

// Deep link to the thread in Gmail, in the right account when several are connected.
// Null for a hand-logged email, which has no Gmail thread.
export function gmailThreadUrl(thread) {
  if (thread.manual) return null
  const account = thread.mailbox ? `?authuser=${encodeURIComponent(thread.mailbox)}` : ''
  return `https://mail.google.com/mail/${account}#all/${thread.id}`
}
