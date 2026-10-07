import { describe, it, expect } from 'vitest'
import { buildThreads, filterThreads, filterCounts, gmailThreadUrl, isAutomated } from '../src/lib/inbox.js'

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
  it('groups by thread, ignores non-email and threadless rows, newest thread first', () => {
    const threads = buildThreads({ now: NOW, contacts, interactions: [
      email({ channelRef: 'old', sentAt: at(5) }),
      email({ channelRef: 'new', sentAt: at(1) }),
      email({ channelRef: 'new', sentAt: at(2), direction: 'Outbound', fromAddress: 'me@x.com' }),
      { id: 'x', type: 'Call', channelRef: 'new' },
      email({ channelRef: '' }),
    ] })
    expect(threads.map(t => t.id)).toEqual(['new', 'old'])
    expect(threads[0].messages.map(m => m.direction)).toEqual(['Outbound', 'Inbound'])
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
