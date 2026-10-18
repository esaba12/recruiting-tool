import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { parseInvite, parseIcsDate, icsField, unfoldIcs, ianaZone, findCalendarPart } from '../api/_lib/ics.js'
import { inviteMeetingLink, inviteHint, applyInviteTiming, interviewLine, parseGmailMessage } from '../api/_lib/emailPipeline.js'

const fixture = name => readFileSync(new URL(`./fixtures/ics/${name}`, import.meta.url), 'utf8')
const b64 = s => Buffer.from(s).toString('base64url')

describe('parseInvite (v1.3 spec 12)', () => {
  it('reads DTSTART from the VEVENT, not the VTIMEZONE (the 1970 regression)', () => {
    const inv = parseInvite(fixture('google-vtimezone.ics'))
    // 2:00 PM EDT on Oct 21 = 18:00 UTC
    expect(inv.start.toISOString()).toBe('2026-10-21T18:00:00.000Z')
    expect(inv.end.toISOString()).toBe('2026-10-21T19:00:00.000Z')
    expect(inv.timeZone).toBe('America/New_York')
    expect(inv.summary).toBe('Example Co Technical Interview')
    expect(inv.description).toContain('\nJoin with Google Meet')
  })

  it('maps Outlook Windows zone names (EST after the DST change: UTC−5)', () => {
    const inv = parseInvite(fixture('outlook-windows-zone.ics'))
    expect(inv.start.toISOString()).toBe('2026-11-04T14:30:00.000Z')
    expect(inv.timeZone).toBe('America/New_York')
    expect(inv.summary).toBe('Example Bank Superday - Virtual')
    expect(inv.description).toContain('/0, then wait') // \, unescaped
  })

  it('reads UTC (Z) times as-is', () => {
    const inv = parseInvite(fixture('utc-goodtime.ics'))
    expect(inv.start.toISOString()).toBe('2026-10-23T18:00:00.000Z')
    expect(inv.floating).toBe(false)
  })

  it('handles all-day VALUE=DATE events', () => {
    const inv = parseInvite(fixture('all-day.ics'))
    expect(inv.allDay).toBe(true)
    expect(inv.start.toISOString()).toBe('2026-10-30T00:00:00.000Z')
  })

  it('unfolds 75-octet continuation lines', () => {
    const inv = parseInvite(fixture('folded-zoom.ics'))
    expect(inv.description).toContain('https://example.zoom.us/j/9876543210 and feel free')
  })

  it('returns null without a VEVENT or for garbage', () => {
    expect(parseInvite(fixture('no-vevent.ics'))).toBeNull()
    expect(parseInvite('not a calendar')).toBeNull()
    expect(parseInvite('')).toBeNull()
  })
})

describe('parseIcsDate', () => {
  it('converts TZID wall-clock times on both sides of a DST change', () => {
    expect(parseIcsDate('20261031T100000', { TZID: 'America/New_York' }).date.toISOString()).toBe('2026-10-31T14:00:00.000Z') // EDT
    expect(parseIcsDate('20261102T100000', { TZID: 'America/New_York' }).date.toISOString()).toBe('2026-11-02T15:00:00.000Z') // EST
    expect(parseIcsDate('20260715T090000', { TZID: 'America/Los_Angeles' }).date.toISOString()).toBe('2026-07-15T16:00:00.000Z')
  })
  it('treats an unknown zone or no TZID as floating UTC', () => {
    const r = parseIcsDate('20261021T140000', { TZID: 'Mars Standard Time' })
    expect(r).toEqual({ date: new Date('2026-10-21T14:00:00Z'), allDay: false, floating: true })
    expect(parseIcsDate('20261021T140000').floating).toBe(true)
  })
  it('rejects malformed values', () => {
    expect(parseIcsDate('2026-10-21')).toBeNull()
    expect(parseIcsDate(null)).toBeNull()
  })
})

describe('icsField / unfoldIcs / ianaZone', () => {
  it('parses params, including quoted ones', () => {
    expect(icsField('DTSTART;TZID="America/Chicago";VALUE=DATE-TIME:20261021T140000', 'DTSTART'))
      .toEqual({ value: '20261021T140000', params: { TZID: 'America/Chicago', VALUE: 'DATE-TIME' } })
  })
  it('unfolds CRLF + space continuations', () => {
    expect(unfoldIcs('SUMMARY:Hel\r\n lo')).toBe('SUMMARY:Hello')
  })
  it('accepts IANA names, maps Windows names, rejects unknowns', () => {
    expect(ianaZone('Europe/Berlin')).toBe('Europe/Berlin')
    expect(ianaZone('Pacific Standard Time')).toBe('America/Los_Angeles')
    expect(ianaZone('Nowhere/Land')).toBeNull()
  })
})

describe('findCalendarPart', () => {
  it('finds an inline text/calendar part nested in multipart/alternative', () => {
    const payload = { mimeType: 'multipart/mixed', parts: [
      { mimeType: 'multipart/alternative', parts: [
        { mimeType: 'text/plain', body: { data: b64('hi') } },
        { mimeType: 'text/calendar', body: { data: b64('BEGIN:VCALENDAR') } },
      ] },
      { mimeType: 'application/ics', filename: 'invite.ics', body: { attachmentId: 'att1' } },
    ] }
    expect(findCalendarPart(payload)).toEqual({ data: b64('BEGIN:VCALENDAR'), attachmentId: null })
  })
  it('falls back to an .ics attachment id', () => {
    const payload = { mimeType: 'multipart/mixed', parts: [
      { mimeType: 'text/plain', body: { data: b64('hi') } },
      { mimeType: 'application/octet-stream', filename: 'Invite.ICS', body: { attachmentId: 'att9' } },
    ] }
    expect(findCalendarPart(payload)).toEqual({ data: null, attachmentId: 'att9' })
  })
  it('returns null when there is no invite', () => {
    expect(findCalendarPart({ mimeType: 'text/plain', body: { data: b64('hi') } })).toBeNull()
  })
  it('parseGmailMessage carries it', () => {
    const msg = parseGmailMessage({ id: 'm1', threadId: 't1', internalDate: '0', payload: { mimeType: 'text/calendar', headers: [], body: { data: b64('X') } } })
    expect(msg.calendarPart).toEqual({ data: b64('X'), attachmentId: null })
  })
})

describe('invite → classification', () => {
  const google = () => parseInvite(fixture('google-vtimezone.ics'))

  it('takes the meeting link from LOCATION before DESCRIPTION', () => {
    expect(inviteMeetingLink(parseInvite(fixture('utc-goodtime.ics')))).toMatch(/^https:\/\/zoom\.us\/j\/1234567890/)
    expect(inviteMeetingLink(google())).toBe('https://meet.google.com/abc-defg-hij')
    expect(inviteMeetingLink(null)).toBeNull()
  })

  it('hint says scheduled ≠ interview, with the UTC time', () => {
    const hint = inviteHint(google(), 'subj')
    expect(hint).toContain('"Example Co Technical Interview", scheduled for 2026-10-21 18:00 UTC')
    expect(hint).toContain('NOT that it is an interview')
    expect(inviteHint(null, 'subj')).toBe('')
  })

  it('a networking message with an invite ends with interview_date null', () => {
    const data = applyInviteTiming({ type: 'NEW_CONTACT', interview_date: '2026-10-21' }, google())
    expect(data.interview_date).toBeNull()
    expect(data.invite).toBeUndefined()
  })

  it('an interview takes its date from the invite in the invite\'s zone', () => {
    // 11 PM Pacific on Oct 21 is already Oct 22 in UTC; the local date must win.
    const late = { ...google(), start: new Date('2026-10-22T06:00:00Z'), timeZone: 'America/Los_Angeles' }
    const data = applyInviteTiming({ type: 'INTERVIEW_INVITE', interview_date: '2026-10-25', meeting_link: 'https://meet.google.com/x' }, late)
    expect(data.interview_date).toBe('2026-10-21')
    expect(data.interview_format).toBe('video')
    expect(data.invite).toBe(late)
  })

  it('an interview without an invite keeps Claude\'s date', () => {
    expect(applyInviteTiming({ type: 'INTERVIEW_INVITE', interview_date: '2026-10-25' }, null).interview_date).toBe('2026-10-25')
  })

  it('formats the 📅 line in local time', () => {
    expect(interviewLine(google())).toBe('📅 Interview: Wed, Oct 21, 2:00 PM EDT')
    expect(interviewLine(parseInvite(fixture('all-day.ics')))).toBe('📅 Interview: Fri, Oct 30')
    expect(interviewLine(null)).toBeNull()
  })
})
