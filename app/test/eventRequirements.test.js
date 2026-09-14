import { describe, it, expect } from 'vitest'
import {
  allRequiredComplete, canSetStatus, nextRequirement, requirementLadder, requirementsDue,
} from '../src/lib/eventRequirements.js'

const DAY = 86400000
const now = Date.UTC(2026, 8, 13, 12)

const ladder = [
  { id: 'r1', stepOrder: 1, kind: 'register', required: true, dueAt: new Date(now + 2 * DAY).toISOString() },
  { id: 'r2', stepOrder: 2, kind: 'upload_resume', required: true, dueAt: new Date(now - 1 * DAY).toISOString() },
  { id: 'r3', stepOrder: 3, kind: 'email_recruiter_to_confirm', required: true, dueAt: null },
  { id: 'r4', stepOrder: 4, kind: 'rsvp_external', required: false, dueAt: new Date(now + 20 * DAY).toISOString() },
]
const done = ids => ids.map(id => ({ requirementId: id, completedAt: '2026-09-01T00:00:00Z' }))

describe('allRequiredComplete', () => {
  it('is false with no completions', () => {
    expect(allRequiredComplete(ladder, [])).toBe(false)
  })
  it('is false when only step one is done — the "completed step one and stopped" case', () => {
    expect(allRequiredComplete(ladder, done(['r1']))).toBe(false)
  })
  it('ignores optional steps', () => {
    expect(allRequiredComplete(ladder, done(['r1', 'r2', 'r3']))).toBe(true)
  })
  it('ignores completion rows without completedAt', () => {
    expect(allRequiredComplete(ladder, [{ requirementId: 'r1' }, ...done(['r2', 'r3'])])).toBe(false)
  })
  it('accepts a Set of ids', () => {
    expect(allRequiredComplete(ladder, new Set(['r1', 'r2', 'r3']))).toBe(true)
  })
  it('is vacuously true for an event with no requirements', () => {
    expect(allRequiredComplete([], [])).toBe(true)
  })
})

describe('canSetStatus', () => {
  it('never allows confirmed until every required step is complete', () => {
    expect(canSetStatus('confirmed', ladder, done(['r1', 'r2']))).toBe(false)
    expect(canSetStatus('attended', ladder, done(['r1', 'r2']))).toBe(false)
    expect(canSetStatus('confirmed', ladder, done(['r1', 'r2', 'r3']))).toBe(true)
  })
  it('allows pre-confirmation statuses regardless', () => {
    for (const s of ['interested', 'registering', 'skipped']) expect(canSetStatus(s, ladder, [])).toBe(true)
  })
})

describe('ladder + next step', () => {
  it('orders by stepOrder and flags completion', () => {
    const l = requirementLadder([ladder[2], ladder[0], ladder[1]], done(['r1']))
    expect(l.map(r => r.id)).toEqual(['r1', 'r2', 'r3'])
    expect(l.map(r => r.completed)).toEqual([true, false, false])
  })
  it('nextRequirement returns the first incomplete step, null when done', () => {
    expect(nextRequirement(ladder, done(['r1'])).id).toBe('r2')
    expect(nextRequirement(ladder, done(['r1', 'r2', 'r3', 'r4']))).toBeNull()
  })
})

describe('requirementsDue', () => {
  it('returns overdue + due-within-horizon required steps, soonest first', () => {
    const due = requirementsDue(ladder, [], { now, withinDays: 7 })
    expect(due.map(r => r.id)).toEqual(['r2', 'r1'])
    expect(due[0].overdue).toBe(true)
    expect(due[1].overdue).toBe(false)
    expect(due[1].daysUntil).toBe(2)
  })
  it('excludes completed, undated, optional, and far-future steps', () => {
    expect(requirementsDue(ladder, done(['r2']), { now, withinDays: 7 }).map(r => r.id)).toEqual(['r1'])
    expect(requirementsDue(ladder, [], { now, withinDays: 30 }).map(r => r.id)).toEqual(['r2', 'r1'])
  })
})
