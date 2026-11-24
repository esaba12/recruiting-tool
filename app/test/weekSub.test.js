import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/lib/supabaseClient.js', () => ({ authHeader: async () => ({}) }))
const { weekSub } = await import('../src/components/learning/widgets.jsx')

describe('weekSub (Learn summary "This week" line)', () => {
  it('shows minutes when any were logged', () => {
    expect(weekSub([{ minutes: 30, outcome: 'solved' }, { outcome: 'solved' }], 30)).toBe('30 min logged')
  })
  it('falls back to solves when only synced (minute-less) entries exist', () => {
    const logs = [{ outcome: 'solved' }, { outcome: 'hinted' }, { outcome: 'failed' }]
    expect(weekSub(logs, 0)).toBe('2 solved')
  })
  it('handles entries with no solves and an empty week', () => {
    expect(weekSub([{ outcome: 'failed' }], 0)).toBe('entry, no time logged')
    expect(weekSub([], 0)).toBe('nothing logged yet')
  })
})
