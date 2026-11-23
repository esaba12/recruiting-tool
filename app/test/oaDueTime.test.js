import { describe, it, expect } from 'vitest'
import { oaDueFields, oaInviteFields, oaZone } from '../api/_lib/emailPipeline.js'
import { buildActionQueue } from '../src/lib/actionQueue.js'
import { oaDueMs, oaOverdue, oaDueLabel } from '../src/lib/dates.js'

const NY = 'America/New_York'

describe('oaZone', () => {
  it('reads IANA names and the common US abbreviations', () => {
    expect(oaZone('America/Los_Angeles')).toBe('America/Los_Angeles')
    expect(oaZone('PT')).toBe('America/Los_Angeles')
    expect(oaZone('PST')).toBe('America/Los_Angeles')
    expect(oaZone('EDT')).toBe('America/New_York')
    expect(oaZone('Central')).toBe('America/Chicago')
    expect(oaZone('UTC')).toBe('UTC')
    expect(oaZone('nonsense')).toBeNull()
    expect(oaZone(null)).toBeNull()
  })
})

describe('oaDueFields', () => {
  it('a stated date and time in a stated zone becomes the exact instant', () => {
    const f = oaDueFields({ oa_due_date: '2026-11-21', oa_due_time: '23:59', oa_due_timezone: 'PT' }, NY)
    expect(f.oa_due_at).toBe('2026-11-22T07:59:00.000Z')
    // The day is the user's campus day: 11:59 PM Pacific is already Nov 22 in Michigan.
    expect(f.oa_due_date).toBe('2026-11-22')
  })
  it('a time with no zone is read in the campus zone', () => {
    expect(oaDueFields({ oa_due_date: '2026-11-21', oa_due_time: '17:00' }, NY))
      .toEqual({ oa_due_date: '2026-11-21', oa_due_at: '2026-11-21T22:00:00.000Z' })
  })
  it('a date alone keeps the day and no time', () => {
    expect(oaDueFields({ oa_due_date: '2026-11-21', oa_due_time: null }, NY)).toEqual({ oa_due_date: '2026-11-21', oa_due_at: null })
    expect(oaDueFields({ oa_due_date: '2026-11-21', oa_due_time: '25:99' }, NY)).toEqual({ oa_due_date: '2026-11-21', oa_due_at: null })
  })
  it('no date means nothing, even with a time', () => {
    expect(oaDueFields({ oa_due_date: null, oa_due_time: '23:59' }, NY)).toEqual({ oa_due_date: null, oa_due_at: null })
  })
})

describe('oaInviteFields with times', () => {
  const invite = { type: 'OA_INVITE', oa_link: 'https://hackerrank.com/a', oa_due_date: '2026-11-21', oa_due_time: '23:59', oa_due_timezone: 'America/New_York' }
  it('writes the due time with the date', () => {
    expect(oaInviteFields(invite, null, { timeZone: NY })).toMatchObject({ oa_due_date: '2026-11-21', oa_due_at: '2026-11-22T04:59:00.000Z' })
  })
  it('a reminder for the same assessment with no deadline keeps the stored one', () => {
    const existing = { oa_link: 'https://hackerrank.com/a', oa_due_date: '2026-11-21', oa_due_at: '2026-11-22T04:59:00.000Z', oa_completed: false }
    const f = oaInviteFields({ type: 'OA_INVITE', oa_link: 'https://hackerrank.com/a', oa_due_date: null }, existing, { timeZone: NY })
    expect(f).not.toHaveProperty('oa_due_date')
    expect(f).not.toHaveProperty('oa_due_at')
  })
  it('a new assessment with no deadline clears the old one', () => {
    const existing = { oa_link: 'https://hackerrank.com/a', oa_due_date: '2026-11-21', oa_due_at: '2026-11-22T04:59:00.000Z', oa_completed: false }
    expect(oaInviteFields({ type: 'OA_INVITE', oa_link: 'https://hackerrank.com/b', oa_due_date: null }, existing, { timeZone: NY }))
      .toMatchObject({ oa_due_date: null, oa_due_at: null, oa_link: 'https://hackerrank.com/b' })
  })
})

describe('client OA due helpers', () => {
  const now = new Date(2026, 10, 21, 12, 0).getTime() // Nov 21, noon local
  it('uses the exact time when known, else the end of the day', () => {
    const at = new Date(2026, 10, 21, 17, 0).toISOString()
    expect(oaDueMs({ oaDueDate: '2026-11-21', oaDueAt: at })).toBe(new Date(at).getTime())
    expect(oaDueMs({ oaDueDate: '2026-11-21', oaDueAt: null })).toBe(new Date(2026, 10, 21, 23, 59, 59, 999).getTime())
    expect(oaDueMs({})).toBeNull()
  })
  it('is overdue once the time passes, not at the start of the day', () => {
    expect(oaOverdue({ oaDueDate: '2026-11-21', oaDueAt: new Date(2026, 10, 21, 17, 0).toISOString() }, now)).toBe(false)
    expect(oaOverdue({ oaDueDate: '2026-11-21', oaDueAt: new Date(2026, 10, 21, 9, 0).toISOString() }, now)).toBe(true)
    expect(oaOverdue({ oaDueDate: '2026-11-21', oaDueAt: null }, now)).toBe(false)
    expect(oaOverdue({ oaDueDate: '2026-11-20', oaDueAt: null }, now)).toBe(true)
  })
  it('labels today, tomorrow and later days, with the time when known', () => {
    const t = h => new Date(2026, 10, 21, h, 0).toISOString()
    expect(oaDueLabel({ oaDueDate: '2026-11-21', oaDueAt: t(17) }, now)).toMatch(/^Due today, 5:00\sPM$/)
    expect(oaDueLabel({ oaDueDate: '2026-11-21' }, now)).toBe('Due today')
    expect(oaDueLabel({ oaDueDate: '2026-11-22', oaDueAt: new Date(2026, 10, 22, 23, 59).toISOString() }, now)).toMatch(/^Due tomorrow, 11:59\sPM$/)
    expect(oaDueLabel({ oaDueDate: '2026-11-25', oaDueAt: new Date(2026, 10, 25, 9, 0).toISOString() }, now)).toMatch(/^Due Wed, Nov 25, 9:00\sAM \(4d\)$/)
    expect(oaDueLabel({ oaDueDate: '2026-11-25' }, now)).toBe('Due Wed, Nov 25 (4d)')
    expect(oaDueLabel({ oaDueDate: '2026-11-21', oaDueAt: t(9) }, now)).toMatch(/^Was due today, 9:00\sAM$/)
    expect(oaDueLabel({ oaDueDate: '2026-11-19' }, now)).toBe('Was due Thu, Nov 19 (2d ago)')
  })
})

describe('Up next ranks OAs by their due time', () => {
  it('two OAs due the same day: the earlier time first', () => {
    const now = new Date(2026, 10, 21, 8, 0).getTime()
    const late = { id: 'late', oaDueDate: '2026-11-21', oaDueAt: new Date(2026, 10, 21, 23, 59).toISOString() }
    const early = { id: 'early', oaDueDate: '2026-11-21', oaDueAt: new Date(2026, 10, 21, 12, 0).toISOString() }
    const q = buildActionQueue({ appGroups: { oa: [late, early] } }, { now })
    const oas = q.now.filter(i => i.kind === 'oa')
    expect(oas.map(i => i.row.id)).toEqual(['early', 'late'])
  })
})

describe('pushes carry the due time', async () => {
  const { statusPush, oaDigest } = await import('../api/_lib/pushes.js')
  it('the invite push says the stated time', () => {
    expect(statusPush({ type: 'OA_INVITE', company: 'Ramp', oa_due_date: '2026-11-21', oa_due_time: '23:59', oa_due_timezone: 'PT' }).message)
      .toBe('Online Assessment\nDue 2026-11-21 11:59 PM PT')
    expect(statusPush({ type: 'OA_INVITE', company: 'Ramp', oa_due_date: '2026-11-21', oa_due_time: null }).message)
      .toBe('Online Assessment\nDue 2026-11-21')
  })
  it('the digest adds the time in the user zone', () => {
    const d = oaDigest([{ company: 'Ramp', oa_due_date: '2026-11-21', oa_due_at: '2026-11-22T04:59:00.000Z' }], '2026-11-21', { timeZone: 'America/New_York' })
    expect(d.lines[0]).toMatch(/^Ramp — due today 11:59\sPM$/)
  })
})
