import { describe, it, expect } from 'vitest'
import { netFlowPath, buildNetworkingFlow, networkingSummary } from '../src/lib/networkingFlow.js'

const NOW = new Date('2026-10-16T12:00:00').getTime()
const ix = (contactId, direction, date, type = 'Email') => ({ contactId, direction, date, type })

describe('netFlowPath', () => {
  it('leaves out contacts with no touchpoint', () => {
    expect(netFlowPath({ id: 'a', source: 'Email' }, [], [], NOW)).toBe(null)
  })
  it('cold outreach with no answer goes straight to No reply', () => {
    const c = { id: 'a', source: 'LinkedIn DM', status: '🟡 Cooling', referralStatus: 'Not Asked' }
    expect(netFlowPath(c, [ix('a', 'Outbound', '2026-10-01')], [], NOW)).toEqual(['Cold outreach', 'No reply'])
  })
  it('inbound-first reads as They reached out, regardless of source', () => {
    const c = { id: 'a', source: 'Email', status: '🟢 Warm', referralStatus: 'Not Asked' }
    const ints = [ix('a', 'Inbound', '2026-10-01'), ix('a', 'Outbound', '2026-10-02')]
    expect(netFlowPath(c, ints, [], NOW)).toEqual(['They reached out', 'Conversation', 'Active'])
  })
  it('walks conversation → met → referral asked → Referral', () => {
    const c = { id: 'a', source: 'Coffee chat', status: '⭐ Champion', referralStatus: 'Confirmed' }
    const ints = [ix('a', 'Outbound', '2026-09-01'), ix('a', 'N/A', '2026-09-10', 'Meeting')]
    expect(netFlowPath(c, ints, [], NOW)).toEqual(['Event or chat', 'Conversation', 'Met', 'Referral asked', 'Referral'])
  })
  it('a call transcript counts as met; long silence is Gone cold', () => {
    const c = { id: 'a', source: 'Referral', status: '🟡 Cooling', referralStatus: 'Not Asked' }
    expect(netFlowPath(c, [], [{ contactId: 'a', date: '2026-06-01' }], NOW)).toEqual(['Intro', 'Conversation', 'Met', 'Gone cold'])
  })
})

describe('buildNetworkingFlow', () => {
  it('counts paths, untouched contacts, and summary rates', () => {
    const contacts = [
      { id: 'a', source: 'Email', status: '🟡 Cooling', referralStatus: 'Not Asked' },
      { id: 'b', source: 'Email', status: '🟢 Warm', referralStatus: 'Asked' },
      { id: 'c', source: 'Event', status: '🟡 Cooling', referralStatus: 'Not Asked' },
    ]
    const ints = [ix('a', 'Outbound', '2026-10-01'), ix('b', 'Outbound', '2026-10-01'), ix('b', 'Inbound', '2026-10-03')]
    const flow = buildNetworkingFlow(contacts, ints, [], NOW)
    expect(flow.total).toBe(2)
    expect(flow.untouched).toBe(1)
    expect(flow.links.find(l => flow.nodes[l.target].name === 'No reply').appIds).toEqual(['a'])
    const s = networkingSummary(flow)
    expect(s).toMatchObject({ contacted: 2, replyRate: 50, asked: 1, noReply: 1, referrals: 0 })
  })
})
