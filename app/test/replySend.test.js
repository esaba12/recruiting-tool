import { describe, it, expect, vi } from 'vitest'
import { copyAndOpen, draftGmailUrl } from '../src/lib/replySend.js'

// v1.5 spec 05 A.
describe('draftGmailUrl', () => {
  it("opens the draft's thread in the right mailbox", () => {
    expect(draftGmailUrl({ threadId: 't1', mailbox: 'me@umich.edu' })).toBe('https://mail.google.com/mail/?authuser=me%40umich.edu#all/t1')
    expect(draftGmailUrl({ threadId: 't1' })).toBe('https://mail.google.com/mail/#all/t1')
    expect(draftGmailUrl({})).toBeNull()
  })
})

describe('copyAndOpen', () => {
  it('copies the body, then opens the thread', async () => {
    const clipboard = { writeText: vi.fn().mockResolvedValue() }
    const open = vi.fn()
    expect(await copyAndOpen('https://x', 'Hi Jane', { clipboard, open })).toEqual({ ok: true, opened: true })
    expect(clipboard.writeText).toHaveBeenCalledWith('Hi Jane')
    expect(open).toHaveBeenCalledWith('https://x')
  })

  it("doesn't open anything when copying fails, and says what to do", async () => {
    const open = vi.fn()
    const r = await copyAndOpen('https://x', 'Hi', { clipboard: { writeText: () => Promise.reject(new Error('denied')) }, open })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/copy it yourself/)
    expect(open).not.toHaveBeenCalled()
  })

  it('copies without navigating on /demo or without a thread', async () => {
    const clipboard = { writeText: vi.fn().mockResolvedValue() }
    const open = vi.fn()
    expect(await copyAndOpen('https://x', 'b', { clipboard, open, demo: true })).toEqual({ ok: true, opened: false })
    expect(await copyAndOpen(null, 'b', { clipboard, open })).toEqual({ ok: true, opened: false })
    expect(open).not.toHaveBeenCalled()
  })
})
