import { describe, it, expect } from 'vitest'
import {
  parseAddress, parseAddressList, findCounterpartAddress, guessCompanyHint,
  recruitingShapeHint, networkingShapeHint, extractMeetingLink, extractPlainBody,
  parseGmailMessage, findHeader, candidateFraming, trackGuidance, interviewStage,
  isAutomatedSender, isBulkMail, isGenericNetworking, shouldCreateContact, contactFollowUpDate, keepActionItem,
  isAlreadyLogged, logThreadMessages,
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
