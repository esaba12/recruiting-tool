import { describe, it, expect } from 'vitest'
import {
  TODAY_CARDS, defaultLayout, reconcileLayout, layoutBands, enabledGroups, cardAvailable,
  moveCard, moveBy, addCard, removeCard, setSize, setCap, toggleGroup, setSetting,
} from '../src/lib/todayCards.js'
import { todayPeople, staleApplications } from '../src/lib/attention.js'

const SWE = { profile: { tracks: ['swe'] }, hasEvents: true }
const IB = { profile: { tracks: ['ib'] }, hasEvents: false }
const ids = layout => layout.cards.map(c => c.id)

describe('defaultLayout', () => {
  it('reproduces the current dashboard order for SWE', () => {
    expect(ids(defaultLayout(SWE))).toEqual(['pipeline', 'network', 'outreach', 'rates', 'replies', 'email', 'people', 'apps', 'events'])
    const sizes = Object.fromEntries(defaultLayout(SWE).cards.map(c => [c.id, c.size]))
    expect(sizes).toMatchObject({ pipeline: 'third', rates: 'full', people: 'half' })
  })

  it('has no events card without a campus feed', () => {
    expect(ids(defaultLayout(IB))).not.toContain('events')
  })

  it("turns off IB users' job-board group", () => {
    const apps = defaultLayout(IB).cards.find(c => c.id === 'apps')
    expect(enabledGroups(apps, IB)).not.toContain('review')
    expect(enabledGroups(apps, SWE)).toContain('review')
  })

  it('marks every registry card as seen', () => {
    expect(defaultLayout(SWE).seen).toEqual(TODAY_CARDS.map(c => c.id))
  })
})

describe('reconcileLayout', () => {
  const saved = (cards, seen = TODAY_CARDS.map(c => c.id)) => ({ v: 1, cards, seen })

  it('falls back to the default when nothing is saved or the version is unknown', () => {
    expect(reconcileLayout(null, SWE)).toEqual(defaultLayout(SWE))
    expect(reconcileLayout({ v: 99, cards: [] }, SWE)).toEqual(defaultLayout(SWE))
  })

  it('drops unknown and duplicate ids', () => {
    const out = reconcileLayout(saved([{ id: 'timelineFinds', size: 'half' }, { id: 'people', size: 'half' }, { id: 'people', size: 'full' }]), SWE)
    expect(ids(out)).toEqual(['people'])
  })

  it('drops cards that are no longer available', () => {
    expect(ids(reconcileLayout(saved([{ id: 'events', size: 'half' }, { id: 'people', size: 'half' }]), IB))).toEqual(['people'])
  })

  it('inserts a new default card after its registry neighbour', () => {
    const seenBefore = TODAY_CARDS.map(c => c.id).filter(id => id !== 'email')
    const out = reconcileLayout(saved([{ id: 'people', size: 'half' }, { id: 'replies', size: 'half' }], seenBefore), SWE)
    expect(ids(out)).toEqual(['people', 'replies', 'email'])
    expect(out.seen).toContain('email')
  })

  it('puts a new card first when none of its registry predecessors are placed', () => {
    const seenBefore = TODAY_CARDS.map(c => c.id).filter(id => id !== 'pipeline')
    expect(ids(reconcileLayout(saved([{ id: 'people', size: 'half' }], seenBefore), SWE))).toEqual(['pipeline', 'people'])
  })

  it('does not re-add a card the user removed', () => {
    expect(ids(reconcileLayout(saved([{ id: 'people', size: 'half' }]), SWE))).toEqual(['people'])
  })

  it('clamps bad sizes, caps, groups and settings', () => {
    const [c] = reconcileLayout(saved([{ id: 'people', size: 'huge', cap: 7, off: ['awaiting', 'nope'], settings: { awaitingDays: 99, junk: 1 } }]), SWE).cards
    expect(c).toEqual({ id: 'people', size: 'half', cap: 3, off: ['awaiting'], settings: { awaitingDays: 5 } })
  })
})

describe('layout reducers', () => {
  const base = { v: 1, cards: [{ id: 'a' }, { id: 'b' }, { id: 'c' }].map(c => ({ ...c, size: 'half' })), seen: [] }

  it('moves up and down, and does nothing past the ends', () => {
    expect(ids(moveBy(base, 'b', -1))).toEqual(['b', 'a', 'c'])
    expect(ids(moveBy(base, 'b', 1))).toEqual(['a', 'c', 'b'])
    expect(moveBy(base, 'a', -1)).toBe(base)
    expect(moveBy(base, 'c', 1)).toBe(base)
  })

  it('moves to an index', () => {
    expect(ids(moveCard(base, 2, 0))).toEqual(['c', 'a', 'b'])
  })

  it('adds at the end with registry defaults, and removes', () => {
    const added = addCard({ ...base, cards: [] }, 'rates')
    expect(added.cards).toEqual([{ id: 'rates', size: 'full', cap: 3, off: [], settings: {} }])
    expect(ids(removeCard(base, 'b'))).toEqual(['a', 'c'])
  })

  it('resizes, caps, toggles a group and changes a setting', () => {
    const l = { ...base, cards: [{ id: 'people', size: 'half', cap: 3, off: [], settings: {} }] }
    expect(setSize(l, 'people', 'full').cards[0].size).toBe('full')
    expect(setCap(l, 'people', 10).cards[0].cap).toBe(10)
    const off = toggleGroup(l, 'people', 'keepInTouch')
    expect(off.cards[0].off).toEqual(['keepInTouch'])
    expect(toggleGroup(off, 'people', 'keepInTouch').cards[0].off).toEqual([])
    expect(setSetting(l, 'people', 'awaitingDays', 10).cards[0].settings).toEqual({ awaitingDays: 10 })
  })
})

describe('layoutBands', () => {
  it('groups consecutive cards of the same size', () => {
    const bands = layoutBands(['third', 'third', 'full', 'half', 'half', 'third'].map((size, i) => ({ id: String(i), size })))
    expect(bands.map(b => [b.size, b.cards.map(c => c.id)])).toEqual([
      ['third', ['0', '1']], ['full', ['2']], ['half', ['3', '4']], ['third', ['5']],
    ])
  })
})

describe('cardAvailable', () => {
  it('says why a card is unavailable', () => {
    expect(cardAvailable('events', IB)).toMatch(/campus/)
    expect(cardAvailable('events', SWE)).toBe(true)
  })
})

describe('todayPeople', () => {
  const days = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
  const ana = { id: 'c1', name: 'Ana', status: '🟡 Lukewarm', urgency: 'HIGH', wantsToSchedule: true }

  it('shows a person in the first enabled group only', () => {
    const out = todayPeople([ana], [], {})
    expect(out.schedule.map(c => c.id)).toEqual(['c1'])
    expect(out.urgent).toEqual([])
  })

  it('lets them appear in the next group when the first is turned off', () => {
    const out = todayPeople([ana], [], { off: ['schedule'] })
    expect(out.schedule).toEqual([])
    expect(out.urgent.map(c => c.id)).toEqual(['c1'])
  })

  it('uses the awaiting-reply threshold', () => {
    const bo = { id: 'c2', name: 'Bo', status: '🟡 Lukewarm' }
    const sent = [{ contactId: 'c2', type: 'Email', direction: 'Outbound', date: days(4) }]
    expect(todayPeople([bo], sent, { awaitingDays: 5 }).awaiting).toEqual([])
    expect(todayPeople([bo], sent, { awaitingDays: 3 }).awaiting.map(x => x.contact.id)).toEqual(['c2'])
  })
})

describe('staleApplications threshold', () => {
  it('takes a day threshold', () => {
    const app = { id: 'a1', stage: 'Applied', triage: 'applied', daysInStage: 10 }
    expect(staleApplications([app])).toEqual([])
    expect(staleApplications([app], { days: 7 }).map(a => a.id)).toEqual(['a1'])
  })
})
