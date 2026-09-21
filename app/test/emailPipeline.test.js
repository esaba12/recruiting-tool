import { describe, it, expect } from 'vitest'
import {
  parseAddress, parseAddressList, findCounterpartAddress, guessCompanyHint,
  recruitingShapeHint, networkingShapeHint, extractMeetingLink, extractPlainBody,
  parseGmailMessage, findHeader,
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
