import { describe, it, expect } from 'vitest'
import { draftsByThread, draftPreview } from '../src/lib/replyDrafts.js'

describe('draftsByThread', () => {
  it('keeps the newest pending draft per thread', () => {
    const map = draftsByThread([
      { id: 'a', threadId: 't', status: 'pending', createdAt: '2026-10-01' },
      { id: 'b', threadId: 't', status: 'pending', createdAt: '2026-10-02' },
      { id: 'c', threadId: 'u', status: 'done', createdAt: '2026-10-03' },
    ])
    expect(map.get('t').id).toBe('b')
    expect(map.has('u')).toBe(false)
  })
})

describe('draftPreview', () => {
  it('skips the greeting', () => {
    expect(draftPreview('Hi Deepak,\n\nThat\'s great news, thank you!')).toBe('That\'s great news, thank you!')
  })
  it('truncates long lines and handles empty bodies', () => {
    expect(draftPreview('x'.repeat(200))).toHaveLength(118)
    expect(draftPreview('')).toBe('')
  })
})
