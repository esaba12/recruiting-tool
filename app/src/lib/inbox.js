// Inbox — pure derivation over `interactions`. The email pipelines only log threads Claude
// classified as recruiting/networking (UNRELATED threads are never written), so grouping the
// type='Email' rows by Gmail thread id (channel_ref) IS the filtered inbox; nothing here
// re-classifies. See supabase/migrations/20261007000000_inbox.sql for the per-message fields.

import { normalizeCompanyName } from './networkGraph.js'

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
const AUTOMATED_RE = /^(no-?reply|do-?not-?reply|notifications?|mailer|automated|system|recruiting|careers|jobs|ats|talent|hello|team|info)@|greenhouse|lever\.co|myworkday|workday|ashbyhq|smartrecruiters|icims|jobvite|hackerrank|codesignal|codility|hackerearth/i
const NEEDS_REPLY_WINDOW_DAYS = 21

export const isAutomated = address => !!address && AUTOMATED_RE.test(address)

export function messageTime(m) {
  return new Date(m.sentAt || m.date || 0).getTime()
}

// Rows logged before the inbox columns existed have no subject — fall back to the first
// line of the summary so the list still reads.
function subjectFor(messages) {
  const withSubject = messages.find(m => m.subject)
  if (withSubject) return withSubject.subject.replace(/^((re|fwd?):\s*)+/i, '')
  const first = (messages[0]?.summary || '').replace(/^📅 Meeting link: \S+\s*/, '').split('\n')[0]
  return first.slice(0, 90) || '(no subject)'
}

export function snippet(m) {
  return (m.body || m.summary || '').replace(/^📅 Meeting link: \S+\s*/, '').replace(/\s+/g, ' ').trim().slice(0, 160)
}

export function buildThreads({ interactions = [], contacts = [], apps = [], actionItems = [], now = Date.now() }) {
  const contactById = new Map(contacts.map(c => [c.id, c]))
  const appById = new Map(apps.map(a => [a.id, a]))
  const byThread = new Map()
  for (const i of interactions) {
    if (i.type !== 'Email' || !i.channelRef) continue
    if (!byThread.has(i.channelRef)) byThread.set(i.channelRef, [])
    byThread.get(i.channelRef).push(i)
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
    const linkedApp = actionItems.map(a => appById.get(a.applicationId)).find(Boolean)
      || (group === 'recruiting' && contact?.company
        ? apps.find(a => !a.archived && a.company && normalizeCompanyName(a.company) === normalizeCompanyName(contact.company))
        : null)
      || null

    const lastIsHumanInbound = last.direction === 'Inbound' && !isAutomated(last.fromAddress)
    const recent = now - messageTime(last) <= NEEDS_REPLY_WINDOW_DAYS * 86400000
    const needsReply = actionItems.length > 0 || (lastIsHumanInbound && recent && category !== 'REJECTION')

    const lastInbound = inbound[inbound.length - 1]
    threads.push({
      id,
      subject: subjectFor(messages),
      messages,
      last,
      contact,
      application: linkedApp,
      category,
      group,
      actionItems,
      needsReply,
      unread: inbound.some(m => !m.readAt),
      hasSent: messages.some(m => m.direction === 'Outbound'),
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
export function gmailThreadUrl(thread) {
  const account = thread.mailbox ? `?authuser=${encodeURIComponent(thread.mailbox)}` : ''
  return `https://mail.google.com/mail/${account}#all/${thread.id}`
}
