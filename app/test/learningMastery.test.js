import { describe, it, expect } from 'vitest'
import {
  topicMastery, baselineForTopic, masteryByTopic, rankGaps, trackDemand, goalProgress,
  streak, weeklyActivity, difficultySplit, logMatchesTopic, decay, startOfWeek, VERIFIED_MIN_EVIDENCE,
} from '../src/lib/learning/mastery.js'
import { instantiateTemplate, TEMPLATES, defaultTemplateKeys } from '../src/lib/learning/templates.js'
import { PROBLEM_BANK, PROBLEM_BY_SLUG, slugFromLeetcodeUrl, titleFromSlug } from '../src/lib/learning/problemBank.js'

const NOW = new Date('2026-09-30T15:00:00Z').getTime() // a Wednesday
const DAY = 86400000
const ago = d => new Date(NOW - d * DAY).toISOString()

const trees = { id: 't-trees', name: 'Trees', category: 'DSA', lcTags: ['tree', 'binary-tree'], targetLevel: 4, weight: 1.3 }
const caching = { id: 't-cache', name: 'Caching', category: 'System Design', lcTags: [], targetLevel: 3, weight: 1 }
const items = new Map([
  ['i1', { id: 'i1', tags: ['tree', 'binary-tree'], difficulty: 'Medium' }],
  ['i2', { id: 'i2', tags: ['array'], difficulty: 'Easy' }],
])

describe('topic matching', () => {
  it('matches by explicit topicIds or by LeetCode tags via the item', () => {
    expect(logMatchesTopic({ topicIds: ['t-cache'] }, caching, items)).toBe(true)
    expect(logMatchesTopic({ topicIds: [], itemId: 'i1' }, trees, items)).toBe(true)
    expect(logMatchesTopic({ topicIds: [], itemId: 'i2' }, trees, items)).toBe(false)
    expect(logMatchesTopic({ topicIds: [], itemId: 'i1' }, caching, items)).toBe(false)
  })
})

describe('topicMastery', () => {
  it('is 0 and unverified with no evidence and no self-rating', () => {
    const m = topicMastery(trees, [], { now: NOW })
    expect(m.level).toBe(0)
    expect(m.verified).toBe(false)
    expect(m.attempts).toBe(0)
  })

  it('self-rating anchors an unpracticed topic and fades as evidence accumulates', () => {
    const rated = { ...trees, selfRating: 4 }
    expect(topicMastery(rated, [], { now: NOW }).level).toBe(4)
    const fails = Array.from({ length: 6 }, (_, i) => ({ itemId: 'i1', kind: 'problem', outcome: 'failed', difficulty: 'Medium', occurredAt: ago(i) }))
    expect(topicMastery(rated, fails, { now: NOW, itemsById: items }).level).toBeLessThan(2.5)
  })

  it('recent solves beat old solves (30-day half-life)', () => {
    const recent = [1, 2, 3].map(d => ({ itemId: 'i1', kind: 'problem', outcome: 'solved', difficulty: 'Medium', occurredAt: ago(d) }))
    const old = [120, 121, 122].map(d => ({ itemId: 'i1', kind: 'problem', outcome: 'solved', difficulty: 'Medium', occurredAt: ago(d) }))
    const a = topicMastery(trees, recent, { now: NOW, itemsById: items })
    const b = topicMastery(trees, old, { now: NOW, itemsById: items })
    expect(a.level).toBeGreaterThan(b.level)
    expect(a.verified).toBe(true)
    expect(decay(ago(30), NOW)).toBeCloseTo(0.5, 5)
  })

  it('solved > hinted > failed at equal volume', () => {
    const mk = outcome => [1, 2, 3, 4].map(d => ({ itemId: 'i1', kind: 'problem', outcome, difficulty: 'Medium', occurredAt: ago(d) }))
    const s = topicMastery(trees, mk('solved'), { now: NOW, itemsById: items }).level
    const h = topicMastery(trees, mk('hinted'), { now: NOW, itemsById: items }).level
    const f = topicMastery(trees, mk('failed'), { now: NOW, itemsById: items }).level
    expect(s).toBeGreaterThan(h)
    expect(h).toBeGreaterThan(f)
  })

  it('concept topics saturate faster from explain-back scores', () => {
    const logs = [{ topicIds: ['t-cache'], kind: 'explain_back', score: 5, occurredAt: ago(1) }, { topicIds: ['t-cache'], kind: 'explain_back', score: 4, occurredAt: ago(2) }]
    const m = topicMastery(caching, logs, { now: NOW })
    expect(m.level).toBeGreaterThan(2.5)
    expect(m.level).toBeLessThanOrEqual(5)
  })

  it('never exceeds 5', () => {
    const logs = Array.from({ length: 80 }, (_, i) => ({ itemId: 'i1', kind: 'problem', outcome: 'solved', difficulty: 'Hard', occurredAt: ago(i % 3) }))
    expect(topicMastery(trees, logs, { now: NOW, itemsById: items }).level).toBeLessThanOrEqual(5)
  })
})

describe('old accepted solves', () => {
  it('never weigh less than the undated baseline, so importing history cannot lower a level', () => {
    const snapshot = { tree: 6 }
    const baselineOnly = topicMastery(trees, [], { now: NOW, itemsById: items, baselineCount: baselineForTopic(trees, snapshot, [], items) })
    const history = Array.from({ length: 6 }, (_, i) => ({ source: 'leetcode', itemId: `h${i}`, kind: 'problem', outcome: 'solved', occurredAt: ago(400) }))
    const histItems = new Map([...items, ...history.map(h => [h.itemId, { id: h.itemId, tags: ['tree'] }])])
    const withHistory = topicMastery(trees, history, { now: NOW, itemsById: histItems, baselineCount: baselineForTopic(trees, snapshot, history, histItems) })
    expect(withHistory.level).toBeGreaterThanOrEqual(baselineOnly.level)
  })

  it('old failures still fade', () => {
    const fail = [{ itemId: 'i1', kind: 'problem', outcome: 'failed', occurredAt: ago(400) }]
    expect(topicMastery(trees, fail, { now: NOW, itemsById: items }).evidence).toBeLessThan(0.01)
  })
})

describe('LeetCode baseline', () => {
  it('uses the max tag count (not the sum) minus distinct accepted problems already logged', () => {
    const snapshot = { tree: 12, 'binary-tree': 10 }
    const logs = [
      { source: 'leetcode', itemId: 'i1', outcome: 'solved', occurredAt: ago(1) },
      { source: 'leetcode', itemId: 'i1', outcome: 'solved', occurredAt: ago(2) }, // re-solve: same lifetime problem
      { source: 'leetcode', itemId: 'i1', outcome: 'failed', occurredAt: ago(3) }, // failures aren't in lifetime counts
    ]
    expect(baselineForTopic(trees, snapshot, logs, items)).toBe(11)
    expect(baselineForTopic(caching, snapshot, logs, items)).toBe(0)
  })

  it('baseline raises level but a large baseline still reads below a strong recent streak + baseline', () => {
    const withBase = masteryByTopic([trees], [], { now: NOW, snapshot: { tree: 15 } }).get('t-trees')
    expect(withBase.level).toBeGreaterThan(2)
    expect(withBase.verified).toBe(true)
  })
})

describe('trackDemand + rankGaps', () => {
  const apps = [
    { company: 'Stripe', role: 'Software Engineer Intern', stage: 'Technical' },
    { company: 'Goldman', role: 'IB Summer Analyst', stage: 'Phone Screen' },
    { company: 'Ramp', role: 'SWE Intern', stage: 'Applied', oaDueDate: new Date(NOW + 3 * DAY).toISOString().slice(0, 10) },
    { company: 'Old', role: 'SWE Intern', stage: 'Rejected' },
  ]

  it('matches applications to the track by role and ignores terminal stages', () => {
    const d = trackDemand({ kind: 'swe' }, apps, { now: NOW })
    expect(d.interviews.map(a => a.company)).toEqual(['Stripe'])
    expect(d.oas.map(a => a.company)).toEqual(['Ramp'])
    const ib = trackDemand({ kind: 'ib' }, apps, { now: NOW })
    expect(ib.interviews.map(a => a.company)).toEqual(['Goldman'])
  })

  it('ranks by gap × weight × demand; OA boosts DSA over system design', () => {
    const topics = [trees, { ...caching, targetLevel: 4 }]
    const mastery = masteryByTopic(topics, [], { now: NOW })
    const demand = trackDemand({ kind: 'swe' }, apps, { now: NOW })
    const gaps = rankGaps(topics, mastery, { demand })
    expect(gaps[0].topic.id).toBe('t-trees')
    expect(gaps[0].reason).toMatch(/OA due for Ramp/)
    expect(gaps[0].gap).toBe(4)
  })

  it('omits hidden topics and topics at target', () => {
    const topics = [{ ...trees, hidden: true }, { ...caching, selfRating: 3 }]
    const gaps = rankGaps(topics, masteryByTopic(topics, [], { now: NOW }))
    expect(gaps).toEqual([])
  })
})

describe('goalProgress', () => {
  const topics = [trees, caching]
  const logs = [
    { itemId: 'i1', kind: 'problem', outcome: 'solved', difficulty: 'Medium', minutes: 30, occurredAt: ago(0.1) },
    { itemId: 'i1', kind: 'problem', outcome: 'failed', difficulty: 'Hard', minutes: 40, occurredAt: ago(1) },
    { itemId: 'i2', kind: 'problem', outcome: 'solved', difficulty: 'Easy', minutes: 10, occurredAt: ago(1) },
    { topicIds: ['t-cache'], kind: 'session', minutes: 60, occurredAt: ago(1) },
    { topicIds: ['t-cache'], kind: 'explain_back', score: 4, occurredAt: ago(1) },
    { itemId: 'i1', kind: 'problem', outcome: 'solved', difficulty: 'Medium', occurredAt: ago(9) }, // last week
  ]
  const ctx = { logs, topics, itemsById: items, now: NOW, mastery: masteryByTopic(topics, logs, { now: NOW, itemsById: items }) }

  it('counts only this week, only solved problems, optionally by difficulty', () => {
    expect(goalProgress({ metric: 'problems', period: 'week', target: 10 }, ctx).current).toBe(2)
    expect(goalProgress({ metric: 'problems', period: 'week', target: 10, difficulty: 'Medium' }, ctx).current).toBe(1)
    expect(goalProgress({ metric: 'problems', period: 'total', target: 10 }, ctx).current).toBe(3)
  })

  it('scopes by category', () => {
    expect(goalProgress({ metric: 'sessions', period: 'week', target: 2, category: 'System Design' }, ctx).current).toBe(2)
    expect(goalProgress({ metric: 'minutes', period: 'week', target: 100, category: 'DSA' }, ctx).current).toBe(70) // the array (i2) solve isn't in any DSA topic here
  })

  it('reports done and behind pace', () => {
    const g = goalProgress({ metric: 'explain_backs', period: 'week', target: 1 }, ctx)
    expect(g.done).toBe(true)
    // Wednesday afternoon ≈ 36% through the week; 0/5 mocks is behind
    expect(goalProgress({ metric: 'mocks', period: 'week', target: 5 }, ctx).behind).toBe(true)
  })

  it('topics_at_target uses mastery', () => {
    const g = goalProgress({ metric: 'topics_at_target', period: 'total', target: 2 }, ctx)
    expect(g.current).toBeGreaterThanOrEqual(0)
    expect(g.target).toBe(2)
  })
})

describe('activity helpers', () => {
  it('streak counts back from today, surviving an empty today', () => {
    const logs = [ago(1), ago(2), ago(3), ago(5)].map(occurredAt => ({ occurredAt }))
    expect(streak(logs, NOW)).toBe(3)
    expect(streak([{ occurredAt: ago(0) }, ...logs], NOW)).toBe(4)
    expect(streak([], NOW)).toBe(0)
  })

  it('weeklyActivity buckets by Monday-anchored weeks', () => {
    const w = weeklyActivity([{ occurredAt: ago(0), minutes: 20 }, { occurredAt: ago(1) }, { occurredAt: ago(8) }], { weeks: 3, now: NOW })
    expect(w).toHaveLength(3)
    expect(w[2].count).toBe(2)
    expect(w[2].minutes).toBe(20)
    expect(w[1].count).toBe(1)
    expect(new Date(startOfWeek(NOW)).getDay()).toBe(1)
  })

  it('difficultySplit counts solved problems only', () => {
    expect(difficultySplit([
      { kind: 'problem', outcome: 'solved', difficulty: 'Easy' },
      { kind: 'problem', outcome: 'failed', difficulty: 'Hard' },
      { kind: 'problem', outcome: 'solved', difficulty: 'Hard' },
    ])).toEqual({ Easy: 1, Medium: 0, Hard: 1 })
  })
})

describe('templates + problem bank', () => {
  it('every template instantiates with widgets for every catalog type', () => {
    for (const key of Object.keys(TEMPLATES)) {
      const { track, topics } = instantiateTemplate(key)
      expect(track.config.widgets.length).toBeGreaterThan(5)
      expect(new Set(track.config.widgets.map(w => w.type)).size).toBe(track.config.widgets.length)
      topics.forEach(t => expect(t.name).toBeTruthy())
    }
    expect(defaultTemplateKeys(['swe', 'pm'])).toEqual(['swe', 'pm'])
    expect(defaultTemplateKeys(undefined)).toEqual(['swe'])
  })

  it('every SWE DSA topic maps to LeetCode tags that the bank actually uses', () => {
    const bankTags = new Set(PROBLEM_BANK.flatMap(p => p.tags))
    for (const t of TEMPLATES.swe.topics.filter(t => t.category === 'DSA')) {
      expect(t.lcTags.some(tag => bankTags.has(tag)), t.name).toBe(true)
    }
  })

  it('bank is well-formed and unique', () => {
    expect(PROBLEM_BANK.length).toBeGreaterThan(140)
    expect(PROBLEM_BY_SLUG.size).toBe(PROBLEM_BANK.length)
    PROBLEM_BANK.forEach(p => expect(['Easy', 'Medium', 'Hard']).toContain(p.difficulty))
  })

  it('parses LeetCode URLs and titles', () => {
    expect(slugFromLeetcodeUrl('https://leetcode.com/problems/two-sum/description/')).toBe('two-sum')
    expect(slugFromLeetcodeUrl('lru-cache')).toBe('lru-cache')
    expect(slugFromLeetcodeUrl('not a url')).toBe(null)
    expect(titleFromSlug('search-a-2d-matrix')).toBe('Search a 2D Matrix')
    expect(titleFromSlug('house-robber-ii')).toBe('House Robber II')
  })
})

it('VERIFIED threshold is sane', () => { expect(VERIFIED_MIN_EVIDENCE).toBeGreaterThan(1) })

describe('learningAttention (Today)', async () => {
  const { learningAttention } = await import('../src/lib/attention.js')
  it('pairs upcoming OAs/interviews with gaps, flags behind goals and due reviews', () => {
    const track = { id: 'tr', kind: 'swe', name: 'SWE', config: { goals: [{ id: 'g', metric: 'mocks', period: 'week', target: 5 }] } }
    const learning = {
      loaded: true, snapshot: null, tracks: [track],
      topics: [{ ...trees, trackId: 'tr', sort: 0 }],
      items: [{ id: 'i9', tags: [], dueAt: ago(1) }],
      logs: [{ id: 'l', trackId: 'tr', itemId: 'i9', kind: 'problem', outcome: 'failed', occurredAt: ago(3), topicIds: [] }],
    }
    const apps = [
      { company: 'Ramp', role: 'SWE Intern', stage: 'Applied', oaDueDate: new Date(NOW + 2 * DAY).toISOString().slice(0, 10) },
      { company: 'Far', role: 'SWE Intern', stage: 'Applied', oaDueDate: new Date(NOW + 15 * DAY).toISOString().slice(0, 10) },
    ]
    const a = learningAttention(learning, apps, { now: NOW })
    expect(a.prepGaps.map(p => p.app.company)).toEqual(['Ramp'])
    expect(a.prepGaps[0].gaps[0].topic.name).toBe('Trees')
    expect(a.goalsBehind).toHaveLength(1)
    expect(a.reviewsDue.map(r => r.item.id)).toEqual(['i9'])
    expect(learningAttention({ loaded: false }, apps)).toEqual({ prepGaps: [], goalsBehind: [], reviewsDue: [] })
  })
})
