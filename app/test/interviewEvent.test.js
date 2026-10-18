import { describe, it, expect, vi } from 'vitest'
import { interviewEventFor, shouldCreateInterviewEvent, createInterviewEvent } from '../api/_lib/interviewEvent.js'

const data = {
  type: 'INTERVIEW_INVITE', company: 'Stripe', role: 'SWE Intern', interview_date: '2026-10-21',
  summary: 'Recruiter screen with Kelly.', interview_format: 'Video', next_action: 'Prep projects',
  meeting_link: 'https://stripe.zoom.us/j/1', follow_up_draft: 'Thanks Kelly!',
}
const TODAY = '2026-10-18'

describe('shouldCreateInterviewEvent', () => {
  it('only for an interview with a date, no invite, today or later', () => {
    expect(shouldCreateInterviewEvent(data, { invite: null, today: TODAY })).toBe(true)
    expect(shouldCreateInterviewEvent(data, { invite: { start: new Date() }, today: TODAY })).toBe(false) // the invite is the event
    expect(shouldCreateInterviewEvent({ ...data, type: 'REPLY' }, { invite: null, today: TODAY })).toBe(false)
    expect(shouldCreateInterviewEvent({ ...data, interview_date: null }, { invite: null, today: TODAY })).toBe(false)
    expect(shouldCreateInterviewEvent({ ...data, interview_date: '2026-10-01' }, { invite: null, today: TODAY })).toBe(false) // backfill
    expect(shouldCreateInterviewEvent({ ...data, interview_date: '2026-10-18' }, { invite: null, today: TODAY })).toBe(true)
    expect(shouldCreateInterviewEvent({ ...data, interview_date: 'next Tuesday' }, { invite: null, today: TODAY })).toBe(false)
  })
})

describe('interviewEventFor', () => {
  it('builds a 2–3pm placeholder in the user zone, same title as the Apps Script', () => {
    const ev = interviewEventFor(data, { timeZone: 'America/New_York' })
    expect(ev.summary).toBe('Interview — Stripe · SWE Intern')
    expect(ev.start).toEqual({ dateTime: '2026-10-21T14:00:00', timeZone: 'America/New_York' })
    expect(ev.end).toEqual({ dateTime: '2026-10-21T15:00:00', timeZone: 'America/New_York' })
    expect(ev.location).toBe('https://stripe.zoom.us/j/1')
    expect(ev.description).toBe([
      'Recruiter screen with Kelly.',
      'Time is a placeholder: the email gave a date but no time.',
      'Format: Video',
      'Meeting link: https://stripe.zoom.us/j/1',
      'Next action: Prep projects',
      '\nDraft reply:\nThanks Kelly!',
    ].join('\n'))
  })
  it('leaves out what it does not have', () => {
    const ev = interviewEventFor({ type: 'INTERVIEW_INVITE', company: 'Figma', interview_date: '2026-10-22' }, { timeZone: 'UTC' })
    expect(ev.summary).toBe('Interview — Figma')
    expect(ev.location).toBeUndefined()
    expect(ev.description).toContain('Format: TBD')
  })
})

describe('createInterviewEvent', () => {
  const json = body => ({ ok: true, status: 200, json: async () => body })

  it('skips when the same title is already on that day', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({ items: [{ summary: 'Interview — Stripe · SWE Intern' }] }))
    const r = await createInterviewEvent('tok', data, { timeZone: 'America/New_York', fetch })
    expect(r).toEqual({ skipped: 'exists' })
    expect(fetch).toHaveBeenCalledTimes(1)
    const listUrl = new URL(fetch.mock.calls[0][0])
    expect(listUrl.pathname).toBe('/calendar/v3/calendars/primary/events')
    expect(listUrl.searchParams.get('timeMin')).toBe('2026-10-21T04:00:00.000Z')
    expect(listUrl.searchParams.get('timeMax')).toBe('2026-10-22T04:00:00.000Z')
  })

  it('creates it on the primary calendar otherwise', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(json({ items: [{ summary: 'Lunch' }] }))
      .mockResolvedValueOnce(json({ id: 'ev1' }))
    expect(await createInterviewEvent('tok', data, { timeZone: 'America/New_York', fetch })).toEqual({ created: 'ev1' })
    const [url, init] = fetch.mock.calls[1]
    expect(url).toBe('https://www.googleapis.com/calendar/v3/calendars/primary/events')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body).summary).toBe('Interview — Stripe · SWE Intern')
  })

  it('throws on a Google error so the caller can log it', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) })
    await expect(createInterviewEvent('tok', data, { timeZone: 'UTC', fetch })).rejects.toThrow('403')
  })
})
