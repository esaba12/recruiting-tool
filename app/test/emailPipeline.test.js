import { describe, it, expect } from 'vitest'
import {
  parseAddress, parseAddressList, findCounterpartAddress, guessCompanyHint,
  recruitingShapeHint, networkingShapeHint, extractMeetingLink, extractPlainBody,
  parseGmailMessage, findHeader, candidateFraming, trackGuidance, interviewStage,
  isAutomatedSender, isBulkMail, isGenericNetworking, shouldCreateContact, contactFollowUpDate, keepActionItem,
  isAlreadyLogged, logThreadMessages,
  scanQueries, nextCursor, orderConnections, runThreadBudget, MAX_CLASSIFIED_PER_RUN, scanStageChange,
  roleKey, pickApplication, oaInviteFields, scheduleFields,
} from '../api/_lib/emailPipeline.js'

describe('parseAddress', () => {
  it('parses "Name <email>" form, lowercasing the email', () => {
    expect(parseAddress('Jane Doe <Jane@Acme.com>')).toEqual({ displayName: 'Jane Doe', email: 'jane@acme.com' })
  })
  it('strips quotes from a quoted display name', () => {
    expect(parseAddress('"Jane Doe" <jane@acme.com>')).toEqual({ displayName: 'Jane Doe', email: 'jane@acme.com' })
  })
  it('handles a bare email with no display name', () => {
    expect(parseAddress('jane@acme.com')).toEqual({ displayName: '', email: 'jane@acme.com' })
  })
  it('returns null for empty input', () => {
    expect(parseAddress('')).toBeNull()
    expect(parseAddress(null)).toBeNull()
  })
})

describe('parseAddressList', () => {
  it('splits a comma-separated header into parsed addresses', () => {
    const list = parseAddressList('Jane Doe <jane@acme.com>, john@acme.com')
    expect(list).toEqual([
      { displayName: 'Jane Doe', email: 'jane@acme.com' },
      { displayName: '', email: 'john@acme.com' },
    ])
  })
  it('returns an empty array for an empty header', () => {
    expect(parseAddressList('')).toEqual([])
  })
})

describe('findCounterpartAddress', () => {
  const me = 'me@gmail.com'
  it('picks the From address when it is not me (inbound case)', () => {
    const messages = [{ from: 'Jane Doe <jane@acme.com>', to: me, cc: '' }]
    expect(findCounterpartAddress(messages, me)).toEqual({ displayName: 'Jane Doe', email: 'jane@acme.com' })
  })
  it('falls back to To/Cc when From is me (outbound case)', () => {
    const messages = [{ from: me, to: 'Jane Doe <jane@acme.com>', cc: '' }]
    expect(findCounterpartAddress(messages, me)).toEqual({ displayName: 'Jane Doe', email: 'jane@acme.com' })
  })
  it('checks the LAST message in the thread, not the first', () => {
    const messages = [
      { from: 'jane@acme.com', to: me, cc: '' },
      { from: me, to: 'jane@acme.com', cc: '' },
    ]
    expect(findCounterpartAddress(messages, me).email).toBe('jane@acme.com')
  })
  it('returns a null email when no counterpart can be found', () => {
    const messages = [{ from: me, to: me, cc: '' }]
    expect(findCounterpartAddress(messages, me)).toEqual({ displayName: '', email: null })
  })
})

describe('guessCompanyHint', () => {
  it('returns empty for a known ATS domain', () => {
    expect(guessCompanyHint('no-reply@greenhouse.io')).toBe('')
  })
  it('returns empty for a generic webmail domain', () => {
    expect(guessCompanyHint('someone@gmail.com')).toBe('')
  })
  it('guesses a capitalized company name from an unknown domain, stripping subdomains', () => {
    const hint = guessCompanyHint('recruiter@careers.acme.com')
    expect(hint).toContain('"Acme"')
    expect(hint).toContain('careers.acme.com')
  })
  it('returns empty when there is no parseable address at all', () => {
    expect(guessCompanyHint('')).toBe('')
  })
})

describe('recruitingShapeHint', () => {
  it('fires for a known ATS domain even with a plain subject', () => {
    expect(recruitingShapeHint('no-reply@greenhouse.io', 'Update', 'hello')).not.toBe('')
  })
  it('fires for recruiting-shaped subject keywords', () => {
    expect(recruitingShapeHint('someone@example.com', 'Your interview is scheduled', 'body')).not.toBe('')
  })
  it('is empty for unrelated mail', () => {
    expect(recruitingShapeHint('friend@gmail.com', 'Dinner tonight?', 'want to grab food?')).toBe('')
  })
})

describe('networkingShapeHint', () => {
  it('fires for career-fair/coffee-chat language', () => {
    expect(networkingShapeHint('Great meeting you!', 'let\'s grab coffee sometime')).not.toBe('')
  })
  it('is empty for unrelated mail', () => {
    expect(networkingShapeHint('Your receipt', 'thanks for your order')).toBe('')
  })
})

describe('extractMeetingLink', () => {
  it('finds a Zoom link and trims trailing punctuation', () => {
    expect(extractMeetingLink('Join here: https://zoom.us/j/1234567890.')).toBe('https://zoom.us/j/1234567890')
  })
  it('finds a Google Meet link', () => {
    expect(extractMeetingLink('https://meet.google.com/abc-defg-hij')).toBe('https://meet.google.com/abc-defg-hij')
  })
  it('returns null when no meeting link is present', () => {
    expect(extractMeetingLink('no links here')).toBeNull()
    expect(extractMeetingLink('')).toBeNull()
  })
})

function b64url(str) { return Buffer.from(str, 'utf8').toString('base64url') }

describe('extractPlainBody', () => {
  it('reads a direct text/plain payload', () => {
    const payload = { mimeType: 'text/plain', body: { data: b64url('hello world') } }
    expect(extractPlainBody(payload)).toBe('hello world')
  })
  it('finds the first text/plain part in a multipart/alternative payload', () => {
    const payload = {
      mimeType: 'multipart/alternative',
      parts: [
        { mimeType: 'text/plain', body: { data: b64url('plain version') } },
        { mimeType: 'text/html', body: { data: b64url('<p>html version</p>') } },
      ],
    }
    expect(extractPlainBody(payload)).toBe('plain version')
  })
  it('recurses into nested multipart/mixed → multipart/alternative structures', () => {
    const payload = {
      mimeType: 'multipart/mixed',
      parts: [{
        mimeType: 'multipart/alternative',
        parts: [{ mimeType: 'text/plain', body: { data: b64url('nested plain text') } }],
      }],
    }
    expect(extractPlainBody(payload)).toBe('nested plain text')
  })
  it('falls back to stripped text/html when no text/plain part exists', () => {
    const payload = { mimeType: 'text/html', body: { data: b64url('<p>Hello <b>world</b></p>') } }
    expect(extractPlainBody(payload)).toBe('Hello world')
  })
  it('returns an empty string for a payload with no usable body', () => {
    expect(extractPlainBody(null)).toBe('')
    expect(extractPlainBody({ mimeType: 'application/octet-stream' })).toBe('')
  })
})

describe('findHeader', () => {
  it('is case-insensitive on the header name', () => {
    const headers = [{ name: 'Subject', value: 'Hello' }]
    expect(findHeader(headers, 'subject')).toBe('Hello')
  })
  it('returns null when the header is absent', () => {
    expect(findHeader([], 'Subject')).toBeNull()
  })
})

describe('parseGmailMessage', () => {
  it('extracts headers, converts internalDate, and decodes the body', () => {
    const msg = {
      id: 'msg1',
      threadId: 'thread1',
      internalDate: String(Date.UTC(2026, 8, 20, 12, 0, 0)),
      payload: {
        headers: [
          { name: 'Subject', value: 'Great meeting you' },
          { name: 'From', value: 'Jane Doe <jane@acme.com>' },
          { name: 'To', value: 'me@gmail.com' },
        ],
        mimeType: 'text/plain',
        body: { data: b64url('It was great meeting you at the career fair!') },
      },
    }
    const parsed = parseGmailMessage(msg)
    expect(parsed.id).toBe('msg1')
    expect(parsed.threadId).toBe('thread1')
    expect(parsed.subject).toBe('Great meeting you')
    expect(parsed.from).toBe('Jane Doe <jane@acme.com>')
    expect(parsed.cc).toBe('')
    expect(parsed.date.toISOString()).toBe('2026-09-20T12:00:00.000Z')
    expect(parsed.plainBody).toBe('It was great meeting you at the career fair!')
  })
})

describe('track-aware classification', () => {
  it('frames the candidate by their tracks, not as a CS student', () => {
    expect(candidateFraming({ tracks: ['ib'] })).toBe('a student recruiting for IB / Finance roles')
    expect(candidateFraming({ tracks: ['swe', 'pm'] })).toBe('a student recruiting for SWE + PM roles')
  })
  it('adds finance stage guidance only for users with a non-tech track', () => {
    expect(trackGuidance({ tracks: ['swe'] })).toBe('')
    expect(trackGuidance({ tracks: ['swe', 'ib'] })).toMatch(/Superday/)
    expect(trackGuidance({ tracks: ['consulting'] })).toMatch(/insight days/i)
  })
  it('maps an interview round to a pipeline stage', () => {
    expect(interviewStage('final')).toBe('Onsite')
    expect(interviewStage('second')).toBe('Technical')
    expect(interviewStage('first')).toBe('Phone Screen')
    expect(interviewStage(null)).toBe('Phone Screen')
  })
  it('treats finance recruiting vendors and superday subjects as recruiting-shaped', () => {
    expect(recruitingShapeHint('HireVue <noreply@hirevue.com>', 'Your video interview', '')).not.toBe('')
    expect(recruitingShapeHint('Jane <jane@bigbank.com>', 'Superday invitation', '')).not.toBe('')
    expect(guessCompanyHint('Talent <talent@avature.net>')).toBe('')
  })
})

describe('isAutomatedSender', () => {
  it('flags role mailboxes and ATS/assessment domains', () => {
    for (const a of ['no-reply@google.com', 'careers@ramp.com', 'university@janestreet.com', 'events@citadel.com',
      'newsletter@a16z.com', 'hello@company.io', 'jane@us.greenhouse-mail.io', 'x@hire.lever.co', 'support@hackerrank.com',
      'notifications@joinhandshake.com']) {
      expect(isAutomatedSender(a), a).toBe(true)
    }
  })
  it('passes real people, including at big companies', () => {
    for (const a of ['priya.shah@stripe.com', 'jdoe@gmail.com', 'bob@umich.edu']) expect(isAutomatedSender(a), a).toBe(false)
  })
  it('treats a missing address as not a person', () => {
    expect(isAutomatedSender(null)).toBe(true)
  })
})

describe('isBulkMail', () => {
  const h = (name, value) => [{ name, value }]
  it('detects list/bulk headers', () => {
    expect(isBulkMail(h('List-Unsubscribe', '<mailto:x@y.com>'))).toBe(true)
    expect(isBulkMail(h('Precedence', 'bulk'))).toBe(true)
    expect(isBulkMail(h('Auto-Submitted', 'auto-generated'))).toBe(true)
  })
  it('is false for an ordinary personal message', () => {
    expect(isBulkMail([{ name: 'Auto-Submitted', value: 'no' }, { name: 'Subject', value: 'hi' }])).toBe(false)
  })
})

describe('isGenericNetworking', () => {
  it('drops networking-typed mail that was not written personally', () => {
    expect(isGenericNetworking({ type: 'NEW_CONTACT', personal: false }, 'jane@acme.com')).toBe(true)
    expect(isGenericNetworking({ type: 'FOLLOW_UP_NEEDED', personal: true }, 'events@acme.com')).toBe(true)
  })
  it('keeps personal networking mail and every recruiting-process type', () => {
    expect(isGenericNetworking({ type: 'NEW_CONTACT', personal: true }, 'jane@acme.com')).toBe(false)
    expect(isGenericNetworking({ type: 'APPLICATION_CONFIRMATION', personal: false }, 'no-reply@acme.com')).toBe(false)
  })
})

describe('shouldCreateContact', () => {
  it('never makes a contact for an automated sender, even when it has a display name', () => {
    expect(shouldCreateContact({ type: 'INTERVIEW_INVITE', personal: true, contact_name: 'Google Careers' }, 'careers@google.com')).toBe(false)
  })
  it('never makes a contact from a non-personal (template/list) email', () => {
    expect(shouldCreateContact({ type: 'REJECTION', personal: false, contact_name: 'Jane Doe' }, 'jane@acme.com')).toBe(false)
  })
  it('makes one for a real person writing personally', () => {
    expect(shouldCreateContact({ type: 'REPLY', personal: true }, 'jane@acme.com')).toBe(true)
  })
})

describe('contactFollowUpDate', () => {
  const today = '2026-10-17'
  it('only schedules a follow-up when the email says one is needed', () => {
    expect(contactFollowUpDate({ type: 'FOLLOW_UP_NEEDED' }, null, today)).toBe('2026-10-20')
    for (const type of ['NEW_CONTACT', 'REPLY', 'APPLICATION_CONFIRMATION', 'INTERVIEW_INVITE', 'REJECTION']) {
      expect(contactFollowUpDate({ type }, null, today), type).toBeUndefined()
    }
  })
  it('never moves a follow-up that is already planned for the future', () => {
    expect(contactFollowUpDate({ type: 'FOLLOW_UP_NEEDED' }, '2026-11-01', today)).toBeUndefined()
    expect(contactFollowUpDate({ type: 'FOLLOW_UP_NEEDED' }, '2026-10-01', today)).toBe('2026-10-20')
  })
})

describe('keepActionItem', () => {
  it('drops to-dos from receipts and rejections', () => {
    for (const type of ['APPLICATION_CONFIRMATION', 'OA_COMPLETED', 'REJECTION']) {
      expect(keepActionItem({ type, action_item: 'Wait to hear back', personal: true }, 'jane@acme.com'), type).toBe(false)
    }
  })
  it('keeps real to-dos from automated senders (OA, interview scheduling)', () => {
    expect(keepActionItem({ type: 'OA_INVITE', action_item: 'Do the OA', personal: false }, 'no-reply@hackerrank.com')).toBe(true)
  })
  it('is false when there is no action item', () => {
    expect(keepActionItem({ type: 'REPLY', action_item: null, personal: true }, 'jane@acme.com')).toBe(false)
  })
})

// v1.3 spec 11: per-message dedup for logged emails.
describe('isAlreadyLogged', () => {
  const msg = { date: new Date('2026-10-10T14:00:00.000Z') }
  it('matches an exact sent_at', () => {
    expect(isAlreadyLogged(['2026-10-10T14:00:00.000Z'], msg)).toBe(true)
  })
  it('matches within 5 s (GmailApp date vs REST internalDate)', () => {
    expect(isAlreadyLogged(['2026-10-10T14:00:04.000Z'], msg)).toBe(true)
  })
  it('keeps a message 10 s away', () => {
    expect(isAlreadyLogged(['2026-10-10T14:00:10.000Z'], msg)).toBe(false)
  })
  it('keeps everything when nothing is logged (or sent_at is null)', () => {
    expect(isAlreadyLogged([], msg)).toBe(false)
    expect(isAlreadyLogged([null], msg)).toBe(false)
  })
})

describe('logThreadMessages', () => {
  const message = (id, iso, from = 'Jane <jane@acme.com>') => ({
    id, threadId: 't1', subject: 'Hi', from, to: 'me@gmail.com', cc: '',
    date: new Date(iso), plainBody: `body ${id}`, bulk: false,
  })
  function fakeDb(legacy = []) {
    const calls = { upserts: [], filters: [] }
    const db = {
      from: () => ({
        select: () => {
          const q = {
            eq: (col, val) => { calls.filters.push([col, val]); return q },
            is: (col, val) => { calls.filters.push([col, val]); return Promise.resolve({ data: legacy, error: null }) },
          }
          return q
        },
        upsert: (rows, opts) => { calls.upserts.push({ rows, opts }); return Promise.resolve({ error: null }) },
      }),
    }
    return { db, calls }
  }
  const opts = { contactId: 'c1', threadId: 't1', myEmail: 'me@gmail.com', meetingLink: 'https://zoom.us/j/1', category: 'FOLLOW_UP_NEEDED' }

  it('upserts with gmail_message_id and ignore-duplicates on (user_id, gmail_message_id)', async () => {
    const { db, calls } = fakeDb()
    const n = await logThreadMessages(db, 'u1', [message('m1', '2026-10-10T14:00:00Z'), message('m2', '2026-10-11T09:00:00Z', 'me@gmail.com')], opts)
    expect(n).toBe(2)
    expect(calls.upserts).toHaveLength(1)
    const { rows, opts: upsertOpts } = calls.upserts[0]
    expect(upsertOpts).toEqual({ onConflict: 'user_id,gmail_message_id', ignoreDuplicates: true })
    expect(rows.map(r => r.gmail_message_id)).toEqual(['m1', 'm2'])
    expect(rows[1].direction).toBe('Outbound')
    // meeting link only on the newest message
    expect(rows[0].summary.startsWith('📅')).toBe(false)
    expect(rows[1].summary.startsWith('📅 Meeting link: https://zoom.us/j/1')).toBe(true)
  })

  it('only looks at legacy rows (no gmail_message_id) in this thread', async () => {
    const { db, calls } = fakeDb()
    await logThreadMessages(db, 'u1', [message('m1', '2026-10-10T14:00:00Z')], opts)
    expect(calls.filters).toEqual([['user_id', 'u1'], ['type', 'Email'], ['channel_ref', 't1'], ['gmail_message_id', null]])
  })

  it('skips messages the Apps Script already logged without an id', async () => {
    const { db, calls } = fakeDb([{ sent_at: '2026-10-10T14:00:01.000Z' }])
    const n = await logThreadMessages(db, 'u1', [message('m1', '2026-10-10T14:00:00Z'), message('m2', '2026-10-11T09:00:00Z')], opts)
    expect(n).toBe(1)
    expect(calls.upserts[0].rows.map(r => r.gmail_message_id)).toEqual(['m2'])
  })

  it('writes nothing when every message is already logged', async () => {
    const { db, calls } = fakeDb([{ sent_at: '2026-10-10T14:00:00.000Z' }])
    expect(await logThreadMessages(db, 'u1', [message('m1', '2026-10-10T14:00:00Z')], opts)).toBe(0)
    expect(calls.upserts).toHaveLength(0)
  })

  it('throws on a write error so the thread is retried next scan', async () => {
    const { db } = fakeDb()
    const failing = { from: () => ({ ...db.from(), upsert: () => Promise.resolve({ error: { message: 'boom' } }) }) }
    await expect(logThreadMessages(failing, 'u1', [message('m1', '2026-10-10T14:00:00Z')], opts)).rejects.toThrow('boom')
  })
})

// v1.3 spec 10: scan budget and incremental discovery.
describe('scanQueries', () => {
  it('searches the full window when there is no cursor', () => {
    expect(scanQueries(null)).toEqual({ inbox: 'in:inbox newer_than:45d', sent: 'in:sent newer_than:30d' })
  })
  it('adds after:<cursor − 1h> in unix seconds once a pass has completed', () => {
    const cursor = '2026-10-18T12:00:00.000Z'
    const after = Math.floor(Date.parse('2026-10-18T11:00:00.000Z') / 1000)
    expect(scanQueries(cursor)).toEqual({
      inbox: `in:inbox newer_than:45d after:${after}`,
      sent: `in:sent newer_than:30d after:${after}`,
    })
  })
})

describe('nextCursor', () => {
  const base = { prevCursor: '2026-10-17T00:00:00.000Z', scanStartedAt: '2026-10-18T00:00:00.000Z' }
  it('advances to the scan start after a clean, complete pass', () => {
    expect(nextCursor({ ...base, partial: false, failed: 0 })).toBe(base.scanStartedAt)
  })
  it('stays put when a thread failed', () => {
    expect(nextCursor({ ...base, partial: false, failed: 1 })).toBe(base.prevCursor)
  })
  it('stays put (or null) when the budget cut the pass short', () => {
    expect(nextCursor({ ...base, partial: true, failed: 0 })).toBe(base.prevCursor)
    expect(nextCursor({ ...base, prevCursor: undefined, partial: true, failed: 0 })).toBeNull()
  })
})

describe('orderConnections', () => {
  it('puts never-scanned mailboxes first, then the longest-waiting', () => {
    const conns = [
      { connected_email: 'b', last_scanned_at: '2026-10-18T10:00:00Z' },
      { connected_email: 'c', last_scanned_at: null },
      { connected_email: 'a', last_scanned_at: '2026-10-18T09:00:00Z' },
    ]
    expect(orderConnections(conns).map(c => c.connected_email)).toEqual(['c', 'a', 'b'])
  })
})

describe('runThreadBudget', () => {
  const ids = n => Array.from({ length: n }, (_, i) => `t${i}`)
  it('does nothing once the deadline has passed', async () => {
    let calls = 0
    const res = await runThreadBudget(ids(5), async () => { calls++; return 'classified' }, { deadline: 1000, now: () => 2000 })
    expect(res).toEqual({ classified: 0, failed: 0, partial: true })
    expect(calls).toBe(0)
  })
  it('stops at the classification cap', async () => {
    const res = await runThreadBudget(ids(60), async () => 'classified', { deadline: null })
    expect(res).toEqual({ classified: MAX_CLASSIFIED_PER_RUN, failed: 0, partial: true })
  })
  it('does not count unchanged threads against the cap', async () => {
    const res = await runThreadBudget(ids(100), async id => (id === 't99' ? 'classified' : 'unchanged'), { deadline: null })
    expect(res).toEqual({ classified: 1, failed: 0, partial: false })
  })
  it('counts failures and finishes the pass', async () => {
    const res = await runThreadBudget(ids(3), async id => (id === 't1' ? 'failed' : 'classified'), { deadline: null })
    expect(res).toEqual({ classified: 2, failed: 1, partial: false })
  })
})

describe('logThreadMessages interview line (v1.3 spec 12)', () => {
  it('puts the 📅 interview time above the meeting link on the newest message only', async () => {
    const upserts = []
    const db = { from: () => ({
      select: () => { const q = { eq: () => q, is: () => Promise.resolve({ data: [], error: null }) }; return q },
      upsert: rows => { upserts.push(rows); return Promise.resolve({ error: null }) },
    }) }
    const msg = (id, iso) => ({ id, threadId: 't', subject: 's', from: 'R <r@acme.com>', to: '', cc: '', date: new Date(iso), plainBody: 'body', bulk: false })
    await logThreadMessages(db, 'u', [msg('a', '2026-10-10T00:00:00Z'), msg('b', '2026-10-11T00:00:00Z')], {
      threadId: 't', myEmail: 'me@x.com', meetingLink: 'https://meet.google.com/x', interviewAt: '📅 Interview: Wed, Oct 21, 2:00 PM EDT', category: 'INTERVIEW_INVITE',
    })
    expect(upserts[0][0].summary).toBe('body')
    expect(upserts[0][1].summary).toBe('📅 Interview: Wed, Oct 21, 2:00 PM EDT\n📅 Meeting link: https://meet.google.com/x\n\nbody')
  })
})

// Event invites mislabeled INTERVIEW_INVITE used to create apps at Phone Screen or bump
// job-board Wishlist rows there (17 fake interviews on the owner's account, 2026-10-21).
describe('scanStageChange', () => {
  it('never creates an application from an interview or offer', () => {
    expect(scanStageChange('Phone Screen', undefined)).toEqual({ skip: true })
    expect(scanStageChange('Onsite', undefined)).toEqual({ skip: true })
    expect(scanStageChange('Offer', undefined)).toEqual({ skip: true })
  })
  it('still creates one from a confirmation or rejection', () => {
    expect(scanStageChange('Applied', undefined)).toEqual({ stage: 'Applied' })
    expect(scanStageChange('Rejected', undefined)).toEqual({ stage: 'Rejected' })
  })
  it('leaves a Wishlist row alone on an interview', () => {
    expect(scanStageChange('Phone Screen', { stage: 'Wishlist' })).toEqual({ skip: true })
    expect(scanStageChange('Offer', { stage: 'Wishlist' })).toEqual({ skip: true })
  })
  it('moves a sent application forward, never back', () => {
    expect(scanStageChange('Phone Screen', { stage: 'Applied' })).toEqual({ stage: 'Phone Screen' })
    expect(scanStageChange('Onsite', { stage: 'Phone Screen' })).toEqual({ stage: 'Onsite' })
    expect(scanStageChange('Phone Screen', { stage: 'Technical' })).toEqual({ stage: null })
    expect(scanStageChange('Applied', { stage: 'Onsite' })).toEqual({ stage: null })
  })
  it('an OA or confirmation moves a Wishlist row to Applied', () => {
    expect(scanStageChange('Applied', { stage: 'Wishlist' })).toEqual({ stage: 'Applied' })
  })
  it('keeps closed applications closed, except a rejection', () => {
    expect(scanStageChange('Phone Screen', { stage: 'Rejected' })).toEqual({ skip: true })
    expect(scanStageChange('Applied', { stage: 'Accepted' })).toEqual({ stage: null })
    expect(scanStageChange('Rejected', { stage: 'Onsite' })).toEqual({ stage: 'Rejected' })
  })
})

// Three IBM applications used to collapse into one row; its completed OA then swallowed the
// next two OA invites (2026-10-23).
describe('pickApplication', () => {
  const ibm = [
    { id: 'zos', role: 'z/OS Core Technologies Back End Developer Intern 2027' },
    { id: 'ai', role: 'AI Software Engineer Intern - 137214' },
    { id: 'swe', role: 'Software Engineering Intern 2027' },
  ]
  it('lands an email on the application for its role', () => {
    expect(pickApplication(ibm, 'AI Software Engineer Intern 2027').id).toBe('ai')
    expect(pickApplication(ibm, 'Software Engineer Intern, Summer 2027').id).toBe('swe')
    expect(pickApplication(ibm, 'z/OS Core Technologies Back End Developer Intern').id).toBe('zos')
  })
  it('a new role at the same company is a new application', () => {
    expect(pickApplication(ibm, 'Data Scientist Intern')).toBeUndefined()
  })
  it('claims a row with no role before creating one', () => {
    expect(pickApplication([{ id: 'x', role: 'Quant Researcher' }, { id: 'blank', role: null }], 'Trader').id).toBe('blank')
  })
  it('no role in the email falls back to the newest row', () => {
    expect(pickApplication(ibm, null).id).toBe('zos')
    expect(pickApplication([], 'SWE')).toBeUndefined()
  })
  it('roleKey ignores case, punctuation, years, req ids and filler', () => {
    expect(roleKey('Software Engineering Intern, Summer 2027 (131545)')).toBe(roleKey('software engineer'))
    expect(roleKey('AI Software Engineer Intern')).not.toBe(roleKey('Software Engineer Intern'))
  })
})

describe('oaInviteFields', () => {
  const invite = { type: 'OA_INVITE', oa_due_date: '2026-10-24', oa_link: 'https://hr.test/new' }
  it('writes the OA onto an open or new application', () => {
    expect(oaInviteFields(invite, undefined)).toEqual({ oa_due_date: '2026-10-24', oa_link: 'https://hr.test/new', oa_research_checked_at: null })
    expect(oaInviteFields(invite, { oa_completed: false }).oa_link).toBe('https://hr.test/new')
  })
  it('a re-sent invite leaves a finished OA finished', () => {
    expect(oaInviteFields(invite, { oa_completed: true, oa_link: 'https://hr.test/new' })).toEqual({})
    expect(oaInviteFields({ ...invite, oa_link: null }, { oa_completed: true, oa_link: 'https://hr.test/old' })).toEqual({})
  })
  it('a new assessment link reopens a finished OA', () => {
    expect(oaInviteFields(invite, { oa_completed: true, oa_link: 'https://hr.test/old' }))
      .toEqual({ oa_due_date: '2026-10-24', oa_link: 'https://hr.test/new', oa_research_checked_at: null, oa_completed: false })
  })
  it('other types touch no OA fields', () => {
    expect(oaInviteFields({ type: 'REJECTION' }, { oa_completed: false })).toEqual({})
  })
})

describe('scheduleFields (v1.4 spec 02)', () => {
  const TZ = 'America/Detroit'
  const interview = { type: 'INTERVIEW_INVITE', interview_date: '2026-11-03' }
  it("an invite's start is the interview time", () => {
    const invite = { start: new Date('2026-11-03T19:30:00Z'), allDay: false }
    expect(scheduleFields({ ...interview, invite }, undefined, { timeZone: TZ }))
      .toEqual({ interview_at: '2026-11-03T19:30:00.000Z', interview_time_known: true })
  })
  it('a date with no invite is stored at noon campus time, time unknown', () => {
    expect(scheduleFields(interview, undefined, { timeZone: TZ }))
      .toEqual({ interview_at: '2026-11-03T17:00:00.000Z', interview_time_known: false }) // noon EST
    const allDay = { start: new Date('2026-11-03T00:00:00Z'), allDay: true }
    expect(scheduleFields({ ...interview, invite: allDay }, undefined, { timeZone: TZ }).interview_time_known).toBe(false)
  })
  it('no date, no write', () => {
    expect(scheduleFields({ type: 'INTERVIEW_INVITE', interview_date: null }, undefined, { timeZone: TZ })).toEqual({})
    expect(scheduleFields({ type: 'REPLY', interview_date: '2026-11-03' }, undefined, { timeZone: TZ })).toEqual({})
  })
  it('a date-only guess never replaces a known time on the same day', () => {
    const existing = { interview_at: '2026-11-03T19:30:00Z', interview_time_known: true }
    expect(scheduleFields(interview, existing, { timeZone: TZ })).toEqual({})
  })
  it('the later interview wins, so an old thread scanned late can\'t roll it back', () => {
    const existing = { interview_at: '2026-11-10T17:00:00Z', interview_time_known: false }
    expect(scheduleFields(interview, existing, { timeZone: TZ })).toEqual({})
    expect(scheduleFields({ ...interview, interview_date: '2026-11-17' }, existing, { timeZone: TZ }).interview_at)
      .toBe('2026-11-17T17:00:00.000Z')
  })
  it('an offer writes its stated deadline and never clears one with null', () => {
    expect(scheduleFields({ type: 'OFFER', offer_deadline: '2026-11-14' }, undefined, { timeZone: TZ })).toEqual({ offer_deadline: '2026-11-14' })
    expect(scheduleFields({ type: 'OFFER', offer_deadline: null }, { offer_deadline: '2026-11-14' }, { timeZone: TZ })).toEqual({})
    expect(scheduleFields({ type: 'OFFER', offer_deadline: 'next Friday' }, undefined, { timeZone: TZ })).toEqual({})
  })
})
