import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Google client so the sync logic is testable without a token.
const calls = []
vi.mock('../src/googleCalendar.js', () => ({
  createEvent: vi.fn(async ({ title }) => { calls.push(['create', title]); return { id: `g-${calls.length}` } }),
  updateEvent: vi.fn(async (id, body) => { calls.push(['patch', id]); if (id === 'gone') { const e = new Error('Not found'); e.status = 404; throw e } return { id } }),
  deleteEvent: vi.fn(async (id) => { calls.push(['delete', id]); if (id === 'gone') { const e = new Error('Gone'); e.status = 410; throw e } }),
  listEvents: vi.fn(async () => [{ id: 'g-main', status: 'confirmed' }, { id: 'g-r1', status: 'cancelled' }]),
}))
vi.mock('../src/lib/supabaseClient.js', () => ({ authHeader: async () => ({}) }))
vi.mock('../src/db.js', () => ({ getUserSetting: async () => null, setUserSetting: async () => {} }))

const { pushEvent, unpushEvent, reconcile, desiredReminders, buildEventBody, shouldAutoPush, needsPush, syncHash } = await import('../src/lib/eventCalendarSync.js')

const DAY = 86400000
const now = Date.parse('2026-09-14T12:00:00Z')
const iso = d => new Date(now + d * DAY).toISOString()
const event = {
  id: 'ev1', title: 'Anthropic Info Session', description: 'Meet the team', location: 'BBB 1670', isVirtual: false,
  startsAt: iso(5), endsAt: new Date(now + 5 * DAY + 3600000).toISOString(), allDay: false, registrationUrl: 'https://x/reg', url: 'https://events.umich.edu/event/1',
  requirements: [
    { id: 'r1', stepOrder: 1, kind: 'register', label: 'RSVP', dueAt: iso(2), required: true },
    { id: 'r2', stepOrder: 2, kind: 'upload_resume', label: 'Résumé', dueAt: iso(3), required: true },
    { id: 'r3', stepOrder: 3, kind: 'rsvp_external', label: 'Optional mixer', dueAt: iso(3), required: false },
    { id: 'r4', stepOrder: 4, kind: 'email_recruiter_to_confirm', label: 'Past', dueAt: iso(-1), required: true },
  ],
}

beforeEach(() => { calls.length = 0 })

describe('bodies + desired reminders', () => {
  it('buildEventBody tags the event, lists the ladder with completion marks, never lands on primary by itself', () => {
    const b = buildEventBody(event, { requirements: event.requirements, completions: [{ requirementId: 'r1' }] })
    expect(b.extendedProperties.private).toEqual({ recruitingOs: 'event', eventId: 'ev1' })
    expect(b.description).toMatch(/☑ RSVP/)
    expect(b.description).toMatch(/☐ Résumé/)
    expect(b.start).toBe(event.startsAt)
  })
  it('desiredReminders: required, incomplete, future steps + open follow-up', () => {
    const keys = desiredReminders(event, { userEvent: { followupDueAt: iso(9) }, completions: [{ requirementId: 'r1' }], now }).map(w => w.key)
    expect(keys).toEqual(['req:r2', 'followup'])
  })
})

describe('pushEvent', () => {
  it('creates main + reminders on first push and returns the ids to persist', async () => {
    const out = await pushEvent({ event, userEvent: null, completions: [], slot: 'personal', calendarId: 'cal-1', now })
    expect(calls.filter(c => c[0] === 'create').length).toBe(3)   // main + r1 + r2
    expect(out.calendarEventId).toBe('g-1')
    expect(Object.keys(out.calendarReminderIds).sort()).toEqual(['req:r1', 'req:r2'])
    expect(out.calendarSlot).toBe('personal')
    expect(out.calendarSyncHash).toBe(syncHash(event, { userEvent: null, completions: [], now }))
  })
  it('patches an existing main event, deletes a reminder whose step got completed, recreates one Google deleted', async () => {
    const userEvent = { calendarEventId: 'g-main', calendarReminderIds: { 'req:r1': 'g-r1', 'req:r2': 'gone' } }
    const out = await pushEvent({ event, userEvent, completions: [{ requirementId: 'r1' }], slot: 'personal', calendarId: 'cal-1', now })
    expect(calls).toContainEqual(['patch', 'g-main'])
    expect(calls).toContainEqual(['delete', 'g-r1'])          // r1 done → reminder removed
    expect(calls).toContainEqual(['patch', 'gone'])           // r2 → 404 → recreated
    expect(out.calendarReminderIds['req:r2']).toMatch(/^g-/)
    expect(out.calendarReminderIds).not.toHaveProperty('req:r1')
  })
  it('recreates the main event when Google says it is gone', async () => {
    const out = await pushEvent({ event, userEvent: { calendarEventId: 'gone', calendarReminderIds: {} }, completions: [], slot: 'school', calendarId: 'cal-2', now })
    expect(out.calendarEventId).not.toBe('gone')
    expect(out.calendarSlot).toBe('school')
  })
  it('needsPush is false when nothing Google-visible changed', () => {
    const ue = { calendarEventId: 'g-main', calendarSyncHash: syncHash(event, { userEvent: null, completions: [], now }) }
    expect(needsPush(event, { userEvent: ue, completions: [], now })).toBe(false)
    expect(needsPush({ ...event, title: 'Renamed' }, { userEvent: ue, completions: [], now })).toBe(true)
    expect(needsPush(event, { userEvent: ue, completions: [{ requirementId: 'r1' }], now })).toBe(true)
  })
})

describe('unpush + reconcile', () => {
  it('unpushEvent deletes everything and tolerates already-gone ids', async () => {
    const out = await unpushEvent({ userEvent: { calendarEventId: 'g-main', calendarReminderIds: { 'req:r1': 'gone' } }, slot: 'personal', calendarId: 'cal-1' })
    expect(calls.map(c => c[1])).toEqual(['g-main', 'gone'])
    expect(out).toEqual({ calendarEventId: null, calendarReminderIds: {}, calendarSyncedAt: null, calendarSyncHash: null })
  })
  it('reconcile nulls ids missing or cancelled in Google but never touches the row otherwise', async () => {
    const patches = await reconcile({ userEvents: [
      { eventId: 'a', calendarSlot: 'personal', calendarEventId: 'g-main', calendarReminderIds: { 'req:r1': 'g-r1', 'req:r2': 'g-r2' } },
      { eventId: 'b', calendarSlot: 'personal', calendarEventId: 'g-deleted', calendarReminderIds: {} },
      { eventId: 'c', calendarSlot: 'school', calendarEventId: 'other-slot', calendarReminderIds: {} },
      { eventId: 'd', calendarSlot: 'personal', calendarEventId: null, calendarReminderIds: {} },
    ], slot: 'personal', calendarId: 'cal-1', now })
    expect(patches).toEqual([
      { eventId: 'a', patch: { calendarReminderIds: {} } },            // r1 cancelled, r2 missing → both dropped, main kept
      { eventId: 'b', patch: { calendarEventId: null } },
    ])
  })
  it('shouldAutoPush: high tier, future, not skipped', () => {
    expect(shouldAutoPush(event, { tier: 'high', userEvent: null, now })).toBe(true)
    expect(shouldAutoPush(event, { tier: 'medium', now })).toBe(false)
    expect(shouldAutoPush({ ...event, startsAt: iso(-1) }, { tier: 'high', now })).toBe(false)
    expect(shouldAutoPush(event, { tier: 'high', userEvent: { status: 'skipped' }, now })).toBe(false)
  })
})
