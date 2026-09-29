import { describe, it, expect, vi } from 'vitest'
vi.mock('../src/lib/ai.js', () => ({ aiJSON: vi.fn(), AI_MODELS: { MINI: 'mini', STANDARD: 'std' } }))
import {
  validateSuggestedTopics, candidateProblems, validateStudyPlan, validateGrade, explainBackQuestion, studyPlanPrompt, explainBackPrompt,
} from '../src/lib/learning/coach.js'

const trees = { id: 't1', name: 'Trees', category: 'DSA', lcTags: ['tree', 'binary-tree'], targetLevel: 4 }
const cache = { id: 't2', name: 'Caching', category: 'System Design', lcTags: [], targetLevel: 3, rubric: ['eviction', 'invalidation'] }
const gaps = [
  { topic: trees, mastery: { level: 1 }, reason: 'never practiced' },
  { topic: cache, mastery: { level: 2 }, reason: 'little evidence yet' },
]

describe('suggested topics', () => {
  it('dedupes against existing names, clamps weight, caps strings', () => {
    const out = validateSuggestedTopics({ topics: [
      { name: 'Caching', category: 'x' }, { name: 'Case interviews', category: 'Cases', weight: 9, rubric: ['a', 'b', 42] },
      { name: '' }, { name: 'case interviews' }, { name: 'x'.repeat(200) },
    ] }, ['caching'])
    expect(out.map(t => t.name)).toEqual(['Case interviews', 'x'.repeat(80)])
    expect(out[0].weight).toBe(1.5)
    expect(out[0].rubric).toEqual(['a', 'b'])
    expect(out[0].source).toBe('ai')
  })
})

describe('study plan', () => {
  it('candidates come only from the bank, tagged to gap topics, skipping solved', () => {
    const c = candidateProblems(gaps, { solvedSlugs: new Set(['invert-binary-tree']) })
    expect(c.length).toBeGreaterThan(0)
    expect(c.every(p => p.topicId === 't1' && p.tags.some(t => trees.lcTags.includes(t)))).toBe(true)
    expect(c.some(p => p.slug === 'invert-binary-tree')).toBe(false)
    expect(c[0].difficulty).toBe('Easy') // level 1 → easy first
  })

  it('drops invented problems and unknown topics, keeps concept/mock/review actions', () => {
    const candidates = candidateProblems(gaps)
    const plan = validateStudyPlan({ summary: 'Trees week', actions: [
      { kind: 'problem', slug: candidates[0].slug, topicId: 't1', title: 'Do it', why: 'weak', minutes: 25 },
      { kind: 'problem', slug: 'made-up-problem', topicId: 't1', title: 'Fake', why: '', minutes: 20 },
      { kind: 'concept', topicId: 't2', title: 'Explain caching', why: 'gap', minutes: 1000 },
      { kind: 'concept', topicId: 'evil', title: 'Other', why: '' },
      { kind: 'hack', title: 'nope' },
    ] }, { candidates, gapTopicIds: ['t1', 't2'] })
    expect(plan.actions.map(a => a.title)).toEqual(['Do it', 'Explain caching', 'Other'])
    expect(plan.actions[0].url).toMatch(/^https:\/\/leetcode\.com\/problems\//)
    expect(plan.actions[1].minutes).toBe(180)
    expect(plan.actions[2].topicId).toBe(null)
  })

  it('prompt lists only candidate slugs and forbids solutions', () => {
    const candidates = candidateProblems(gaps)
    const p = studyPlanPrompt({ trackName: 'SWE', gaps, candidates, demand: { interviews: [], oas: [] }, reviewDue: 2, goals: [] })
    expect(p).toMatch(/ONLY recommend problems from this list/)
    expect(p).toMatch(/Do not include solutions/)
  })
})

describe('explain-back', () => {
  it('question stems by category', () => {
    expect(explainBackQuestion(cache)).toMatch(/tradeoffs/)
    expect(explainBackQuestion({ name: 'DCF', category: 'Valuation' })).toMatch(/banking technical/)
    expect(explainBackQuestion({ name: 'Foo', category: 'Other' })).toMatch(/Explain Foo/)
  })

  it('prompt includes rubric and forbids model answers', () => {
    const p = explainBackPrompt({ topic: cache, question: 'q', answer: 'a' })
    expect(p).toMatch(/- eviction/)
    expect(p).toMatch(/Never write a model answer/)
  })

  it('grade validation clamps score and caps lists', () => {
    const g = validateGrade({ score: 7.4, covered: ['a'], missed: Array(20).fill('m'), hint: 'What happens when…?' })
    expect(g.score).toBe(5)
    expect(g.missed).toHaveLength(8)
    expect(validateGrade({}).score).toBe(null)
  })
})
