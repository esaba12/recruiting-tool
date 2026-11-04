// v1.3 spec 03, first live run: ensureRecruitingCalendar listed users/me/calendarList, which
// Google refuses under calendar.events + calendar.app.created ("Request had insufficient
// authentication scopes"). It now only touches the one calendar it made: calendarList.get on
// the cached id (allowed under app.created), else calendars.insert.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({ settings: {}, calls: [], getStatus: 200 }))
vi.mock('../src/lib/supabaseClient.js', () => ({ authHeader: async () => ({ Authorization: 'Bearer t' }) }))
vi.mock('../src/db.js', () => ({
  getUserSetting: async k => state.settings[k] ?? null,
  setUserSetting: async (k, v) => { state.settings[k] = v },
}))

const { ensureRecruitingCalendar } = await import('../src/googleCalendar.js')

beforeEach(() => {
  state.settings = {}; state.calls = []; state.getStatus = 200
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const path = new URL(url, 'http://x').pathname.replace('/google-calendar/', '')
    const method = init.method || 'GET'
    state.calls.push(`${method} ${path}`)
    if (method === 'POST' && path === 'calendar/v3/calendars') return { ok: true, status: 200, json: async () => ({ id: 'new@group.calendar.google.com', summary: 'Recruiting' }) }
    if (method === 'GET' && path.startsWith('calendar/v3/users/me/calendarList/')) {
      return state.getStatus === 200
        ? { ok: true, status: 200, json: async () => ({ id: decodeURIComponent(path.split('/').pop()), summary: 'Recruiting' }) }
        : { ok: false, status: state.getStatus, json: async () => ({ error: { message: 'Not Found' } }) }
    }
    return { ok: false, status: 403, json: async () => ({ error: { message: 'Request had insufficient authentication scopes.' } }) }
  })
})

describe('ensureRecruitingCalendar', () => {
  it('never lists the calendar list (needs a scope this app does not ask for)', async () => {
    await ensureRecruitingCalendar('personal')
    state.settings['recruiting_calendar_id:personal'] = 'old@group.calendar.google.com'
    await ensureRecruitingCalendar('personal')
    expect(state.calls.some(c => c === 'GET calendar/v3/users/me/calendarList')).toBe(false)
  })

  it('creates the calendar and caches its id when none is saved', async () => {
    const id = await ensureRecruitingCalendar('personal')
    expect(id).toBe('new@group.calendar.google.com')
    expect(state.calls).toEqual(['POST calendar/v3/calendars'])
    expect(state.settings['recruiting_calendar_id:personal']).toBe(id)
  })

  it('reuses the saved calendar when it still exists', async () => {
    state.settings['recruiting_calendar_id:school'] = 'old@group.calendar.google.com'
    const id = await ensureRecruitingCalendar('school')
    expect(id).toBe('old@group.calendar.google.com')
    expect(state.calls).toEqual(['GET calendar/v3/users/me/calendarList/old%40group.calendar.google.com'])
  })

  it('makes a new one when the saved calendar was deleted in Google', async () => {
    state.settings['recruiting_calendar_id:personal'] = 'gone@group.calendar.google.com'
    state.getStatus = 404
    const id = await ensureRecruitingCalendar('personal')
    expect(id).toBe('new@group.calendar.google.com')
    expect(state.settings['recruiting_calendar_id:personal']).toBe(id)
  })

  it('does not create a duplicate on other errors (e.g. a lapsed grant)', async () => {
    state.settings['recruiting_calendar_id:personal'] = 'old@group.calendar.google.com'
    state.getStatus = 401
    await expect(ensureRecruitingCalendar('personal')).rejects.toThrow()
    expect(state.calls.some(c => c.startsWith('POST'))).toBe(false)
  })
})
