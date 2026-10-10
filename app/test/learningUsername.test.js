import { describe, it, expect, vi } from 'vitest'
vi.mock('../src/lib/supabaseClient.js', () => ({ authHeader: async () => ({}) }))
vi.mock('../src/db.js', () => ({ upsertLearningItems: vi.fn(), importLearningLogs: vi.fn(), setUserSetting: vi.fn(), updateLearningItem: vi.fn() }))
import { parseLeetcodeUsername, planUsernameCommit } from '../src/lib/learning/leetcodeImport.js'

// Regression: the username field only saved on blur, so typing it and pressing Escape or
// Enter (or closing the panel) dropped it — the track kept leetcodeUsername "" and the daily
// sync never had anything to fetch. The panel now commits on Enter/close/unmount through
// planUsernameCommit, so this decision has to be right for every exit path.
describe('parseLeetcodeUsername', () => {
  it('accepts a bare username, trimmed', () => {
    expect(parseLeetcodeUsername('  neal_wu ')).toBe('neal_wu')
  })
  it('pulls the username out of a pasted profile URL', () => {
    expect(parseLeetcodeUsername('https://leetcode.com/u/neal_wu/')).toBe('neal_wu')
    expect(parseLeetcodeUsername('leetcode.com/neal_wu')).toBe('neal_wu')
    expect(parseLeetcodeUsername('https://leetcode.com/u/Some-User')).toBe('Some-User')
  })
  it('strips a leading @', () => {
    expect(parseLeetcodeUsername('@neal_wu')).toBe('neal_wu')
  })
  it('returns null for anything that is not a username', () => {
    expect(parseLeetcodeUsername('not a name')).toBeNull()
    expect(parseLeetcodeUsername('https://leetcode.com/problems/two-sum/')).toBeNull()
  })
  it('returns empty string for blank input (clearing the field)', () => {
    expect(parseLeetcodeUsername('   ')).toBe('')
  })
})

describe('planUsernameCommit', () => {
  it('saves a new username typed into an empty track (the lost-on-Escape case)', () => {
    expect(planUsernameCommit('neal_wu', '')).toEqual({ action: 'save', username: 'neal_wu' })
    expect(planUsernameCommit('neal_wu', undefined)).toEqual({ action: 'save', username: 'neal_wu' })
  })
  it('is a no-op when nothing changed, so blur + Sync now do not double-write', () => {
    expect(planUsernameCommit(' neal_wu ', 'neal_wu')).toEqual({ action: 'none' })
    expect(planUsernameCommit('https://leetcode.com/u/neal_wu/', 'neal_wu')).toEqual({ action: 'none' })
  })
  it('clears the username when the field is emptied', () => {
    expect(planUsernameCommit('', 'neal_wu')).toEqual({ action: 'save', username: '' })
  })
  it('refuses an invalid value without saving', () => {
    expect(planUsernameCommit('two words', '')).toEqual({ action: 'invalid' })
  })
})
