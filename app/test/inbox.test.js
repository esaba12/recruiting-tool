import { describe, it, expect } from 'vitest'
import { buildThreads, filterThreads, filterCounts, gmailThreadUrl, isAutomated, messageLead, snippet } from '../src/lib/inbox.js'
import { interactionRow, interviewLine } from '../api/_lib/emailPipeline.js'

const NOW = new Date('2026-10-07T12:00:00Z').getTime()
const at = daysAgo => new Date(NOW - daysAgo * 86400000).toISOString()

const email = (over) => ({
  id: Math.random().toString(36).slice(2), type: 'Email', direction: 'Inbound', channelRef: 't1',
  summary: '', body: '', subject: 'Hello', fromAddress: 'priya@stripe.com', fromName: 'Priya',
  sentAt: at(1), date: at(1).slice(0, 10), readAt: null, emailCategory: null, contactId: 'c1', ...over,
})
const contacts = [{ id: 'c1', name: 'Priya Shah', company: 'Stripe' }]
const apps = [{ id: 'a1', company: ' stripe ', role: 'SWE Intern', stage: 'Phone Screen' }]

describe('buildThreads', () => {
  it('groups by thread, ignores non-email rows, newest thread first', () => {
    const threads = buildThreads({ now: NOW, contacts, interactions: [
      email({ channelRef: 'old', sentAt: at(5) }),
      email({ channelRef: 'new', sentAt: at(1) }),
      email({ channelRef: 'new', sentAt: at(2), direction: 'Outbound', fromAddress: 'me@x.com' }),
      { id: 'x', type: 'Call', channelRef: 'new' },
    ] })
    expect(threads.map(t => t.id)).toEqual(['new', 'old'])
    expect(threads[0].messages.map(m => m.direction)).toEqual(['Outbound', 'Inbound'])
  })

  // v1.4 spec 05 A: Outbox is gone, so hand-logged emails (no Gmail thread) live in Inbox.
  it('turns each hand-logged email into its own manual thread: no Gmail link, never unread', () => {
    const threads = buildThreads({ now: NOW, contacts, interactions: [
      email({ channelRef: 't1', sentAt: at(1) }),
      email({ id: 'm1', channelRef: '', direction: 'Outbound', sentAt: at(3), summary: 'Sent my resume to Priya' }),
      email({ id: 'm2', channelRef: null, direction: 'Inbound', sentAt: at(4) }),
    ] })
    expect(threads.map(t => t.id)).toEqual(['t1', 'manual:m1', 'manual:m2'])
    const [, sent, received] = threads
    expect(sent.manual).toBe(true)
    expect(sent.hasSent).toBe(true)
    expect(sent.subject).toBe('Hello')
    expect(received.unread).toBe(false)
    expect(gmailThreadUrl(sent)).toBeNull()
    expect(filterThreads(threads, 'sent').map(t => t.id)).toEqual(['manual:m1'])
  })

  it('uses the newest classification and strips Re:/Fwd: from the subject', () => {
    const [t] = buildThreads({ now: NOW, contacts, interactions: [
      email({ sentAt: at(3), emailCategory: 'REPLY', subject: 'Coffee chat?' }),
      email({ sentAt: at(1), emailCategory: 'INTERVIEW_INVITE', subject: 'Re: Fwd: Coffee chat?' }),
    ] })
    expect(t.category).toBe('INTERVIEW_INVITE')
    expect(t.group).toBe('recruiting')
    expect(t.subject).toBe('Coffee chat?')
  })

  it('infers the group for unclassified (pre-inbox) threads from the sender', () => {
    const threads = buildThreads({ now: NOW, interactions: [
      email({ channelRef: 'ats', fromAddress: 'no-reply@greenhouse.io', contactId: null }),
      email({ channelRef: 'human', fromAddress: 'sam@figma.com', contactId: null }),
    ] })
    const byId = Object.fromEntries(threads.map(t => [t.id, t]))
    expect(byId.ats.group).toBe('recruiting')
    expect(byId.human.group).toBe('networking')
  })

  it('falls back to the summary when no subject was stored', () => {
    const [t] = buildThreads({ now: NOW, interactions: [
      email({ subject: null, summary: '📅 Meeting link: https://zoom.us/j/1\n\nThanks for reaching out!\nMore' }),
    ] })
    expect(t.subject).toBe('Thanks for reaching out!')
  })

  it('unread only counts inbound messages', () => {
    const [t] = buildThreads({ now: NOW, interactions: [
      email({ direction: 'Outbound', readAt: null, fromAddress: 'me@x.com' }),
      email({ readAt: at(0) }),
    ] })
    expect(t.unread).toBe(false)
  })

  it('needs a reply: recent human inbound, not automated, not rejections, or any open action item', () => {
    const threads = buildThreads({ now: NOW, actionItems: [{ threadId: 'ats-todo', summary: 'Pick a slot' }], interactions: [
      email({ channelRef: 'human' }),
      email({ channelRef: 'stale', sentAt: at(30) }),
      email({ channelRef: 'bot', fromAddress: 'no-reply@myworkday.com' }),
      email({ channelRef: 'rejected', emailCategory: 'REJECTION' }),
      email({ channelRef: 'answered', sentAt: at(2) }),
      email({ channelRef: 'answered', sentAt: at(1), direction: 'Outbound', fromAddress: 'me@x.com' }),
      email({ channelRef: 'ats-todo', fromAddress: 'no-reply@greenhouse.io' }),
    ] })
    const needs = Object.fromEntries(threads.map(t => [t.id, t.needsReply]))
    expect(needs).toEqual({ human: true, stale: false, bot: false, rejected: false, answered: false, 'ats-todo': true })
  })

  it('shows an automated sender as itself, a person as their contact name', () => {
    const threads = buildThreads({ now: NOW, contacts, interactions: [
      email({ channelRef: 'bot', fromAddress: 'recruiting@stripe.com', fromName: 'Stripe Recruiting' }),
      email({ channelRef: 'human', fromName: 'P. Shah' }),
    ] })
    const byId = Object.fromEntries(threads.map(t => [t.id, t.counterpart]))
    expect(byId).toEqual({ bot: 'Stripe Recruiting', human: 'Priya Shah' })
  })

  it('links a recruiting thread to its application by company', () => {
    const [t] = buildThreads({ now: NOW, contacts, apps, interactions: [email({ emailCategory: 'OA_INVITE' })] })
    expect(t.application?.id).toBe('a1')
  })
})

describe('application receipts', () => {
  it('hides "we got your application" threads, classified or not', () => {
    const threads = buildThreads({ now: NOW, interactions: [
      email({ channelRef: 'receipt', emailCategory: 'APPLICATION_CONFIRMATION', fromAddress: 'no-reply@greenhouse.io' }),
      email({ channelRef: 'legacy', subject: 'Thank you for applying to Ramp', fromAddress: 'no-reply@ramp.com' }),
      email({ channelRef: 'oa', emailCategory: 'OA_INVITE', fromAddress: 'no-reply@hackerrank.com' }),
      email({ channelRef: 'human' }),
    ] })
    expect(threads.map(t => t.id).sort()).toEqual(['human', 'oa'])
  })
  it('keeps a receipt thread you replied to or that carries an open to-do', () => {
    const threads = buildThreads({ now: NOW, actionItems: [{ threadId: 'todo', summary: 'Upload transcript' }], interactions: [
      email({ channelRef: 'todo', emailCategory: 'APPLICATION_CONFIRMATION', fromAddress: 'no-reply@greenhouse.io' }),
      email({ channelRef: 'replied', emailCategory: 'APPLICATION_CONFIRMATION', sentAt: at(2) }),
      email({ channelRef: 'replied', direction: 'Outbound', fromAddress: 'me@x.com' }),
    ] })
    expect(threads.map(t => t.id).sort()).toEqual(['replied', 'todo'])
  })
})

describe('generic networking mail', () => {
  it('hides networking-labelled threads where every message came from a role mailbox and you never wrote', () => {
    const threads = buildThreads({ now: NOW, interactions: [
      email({ channelRef: 'blast', emailCategory: 'NEW_CONTACT', fromAddress: 'events@citadel.com' }),
      email({ channelRef: 'person', emailCategory: 'NEW_CONTACT' }),
      email({ channelRef: 'answered', emailCategory: 'FOLLOW_UP_NEEDED', fromAddress: 'university@janestreet.com', sentAt: at(2) }),
      email({ channelRef: 'answered', direction: 'Outbound', fromAddress: 'me@x.com' }),
    ] })
    expect(threads.map(t => t.id).sort()).toEqual(['answered', 'person'])
  })
})

describe('filters', () => {
  const threads = buildThreads({ now: NOW, contacts, interactions: [
    email({ channelRef: 'r', emailCategory: 'OFFER', subject: 'Your offer' }),
    email({ channelRef: 'n', emailCategory: 'REPLY', subject: 'Re: intro' }),
    email({ channelRef: 's', direction: 'Outbound', emailCategory: 'NEW_CONTACT', fromAddress: 'me@x.com', subject: 'Quick question' }),
  ] })

  it('filters by tab and search', () => {
    expect(filterThreads(threads, 'recruiting').map(t => t.id)).toEqual(['r'])
    expect(filterThreads(threads, 'sent').map(t => t.id)).toEqual(['s'])
    expect(filterThreads(threads, 'all', 'intro').map(t => t.id)).toEqual(['n'])
    expect(filterThreads(threads, 'all', 'priya')).toHaveLength(3)
  })

  it('counts each tab', () => {
    expect(filterCounts(threads)).toMatchObject({ all: 3, recruiting: 1, networking: 2, sent: 1 })
  })
})

describe('helpers', () => {
  it('builds an account-specific Gmail link', () => {
    expect(gmailThreadUrl({ id: '18f2a', mailbox: 'me@umich.edu' }))
      .toBe('https://mail.google.com/mail/?authuser=me%40umich.edu#all/18f2a')
  })
  it('recognises automated senders', () => {
    expect(isAutomated('no-reply@hackerrank.com')).toBe(true)
    expect(isAutomated('priya@stripe.com')).toBe(false)
  })
})

// The 📅 lead lines are written by api/_lib/emailPipeline.js interactionRow (and the Apps
// Script's meeting-link-only variant); build the summary with the real writer so a format
// change on either side breaks here.
describe('messageLead', () => {
  const message = { id: 'm1', from: 'Kelly <kelly@stripe.com>', subject: 'Interview', date: new Date('2026-10-07T12:00:00Z'), plainBody: 'Hi Alex,\nLooking forward to it.' }
  const invite = { start: new Date('2026-10-21T18:00:00Z'), allDay: false, timeZone: 'America/New_York' }
  const row = (opts) => {
    const r = interactionRow('u1', message, { threadId: 't1', myEmail: 'me@x.com', ...opts })
    return { summary: r.summary, body: r.body }
  }

  it('splits the interview time and meeting link off the serverless summary', () => {
    const lead = messageLead(row({ interviewAt: interviewLine(invite), meetingLink: 'https://zoom.us/j/123' }))
    expect(lead.interview).toBe('Wed, Oct 21, 2:00 PM EDT')
    expect(lead.meetingLink).toBe('https://zoom.us/j/123')
    expect(lead.text).toBe('Hi Alex,\nLooking forward to it.')
  })

  it('reads a meeting link alone (the Apps Script shape)', () => {
    const lead = messageLead({ summary: '📅 Meeting link: https://meet.google.com/abc-defg-hij\n\nSee you then', body: '' })
    expect(lead).toEqual({ interview: null, meetingLink: 'https://meet.google.com/abc-defg-hij', text: 'See you then' })
  })

  it('leaves an ordinary message alone', () => {
    expect(messageLead(row({}))).toEqual({ interview: null, meetingLink: null, text: 'Hi Alex,\nLooking forward to it.' })
  })

  it('keeps the lead lines out of the list snippet', () => {
    expect(snippet({ summary: row({ interviewAt: interviewLine(invite), meetingLink: 'https://zoom.us/j/123' }).summary, body: '' }))
      .toBe('Hi Alex, Looking forward to it.')
  })
})

describe('reply drafts (v1.4 spec 10)', () => {
  const draft = (over) => ({ id: 'd1', threadId: 't1', status: 'pending', body: 'Hi Priya,\nTuesday at 2 works great.', createdAt: at(0), ...over })

  it('attaches the newest pending draft to its thread and counts it as needing a reply', () => {
    const [t] = buildThreads({ now: NOW, contacts, drafts: [draft({ id: 'old', createdAt: at(2) }), draft(), draft({ id: 'gone', status: 'dismissed' })], interactions: [
      // old enough that it wouldn't need a reply on its own
      email({ date: at(20).slice(0, 10), sentAt: at(20) }),
    ] })
    expect(t.draft.id).toBe('d1')
    expect(t.needsReply).toBe(true)
  })

  it('threads without a draft have none', () => {
    const [t] = buildThreads({ now: NOW, contacts, drafts: [draft({ threadId: 'other' })], interactions: [email({})] })
    expect(t.draft).toBeNull()
  })
})
