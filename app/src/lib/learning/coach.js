// AI features for the Learn tab — all through lib/ai.js (provider switch, BYOK), all
// fail-soft at the call site. Design rule from the tutoring research that shaped this
// feature: the AI coaches, it doesn't hand over answers.
//   • suggestTopics   — topic tree for a custom track / missing topics for an existing one (MINI)
//   • buildStudyPlan  — weekly prioritized actions; problem picks are restricted to the
//                       curated bank and validated after the call, so it can't invent links (MINI)
//   • gradeExplainBack — grades a typed explanation against the topic rubric and returns what
//                       was covered/missed + ONE Socratic hint, never a model answer (STANDARD)
// The validators are exported and unit-tested (test/learningCoach.test.js).
import { aiJSON, AI_MODELS } from '../ai.js'
import { PROBLEM_BANK, PROBLEM_BY_SLUG } from './problemBank.js'

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const strList = (v, maxItems, maxLen) => (Array.isArray(v) ? v.map(x => str(x, maxLen)).filter(Boolean).slice(0, maxItems) : [])

// ── Topic suggestions ──

export function suggestTopicsPrompt({ trackName, description, existing }) {
  return `You are helping a university student prepare for "${trackName}" recruiting interviews.
${description ? `What they're preparing for: ${description}\n` : ''}${existing.length ? `Topics they already track (do NOT repeat these): ${existing.join('; ')}\n` : ''}
Suggest the interview-prep topics they should track — the skills interviewers actually test for this kind of role.
Return 6-14 topics grouped into 2-5 short categories. For each, give 3-5 rubric points: the specific things a strong verbal answer covers.
Weight is relative interview frequency (0.5 rare … 1.5 very common).

Return ONLY JSON: {"topics":[{"name":"...","category":"...","weight":1.0,"rubric":["...","..."]}]}`
}

export function validateSuggestedTopics(parsed, existingNames = []) {
  const seen = new Set(existingNames.map(n => n.toLowerCase()))
  const out = []
  for (const t of parsed?.topics || []) {
    const name = str(t?.name, 80)
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    const weight = Number(t.weight)
    out.push({
      name,
      category: str(t.category, 40) || 'General',
      weight: Number.isFinite(weight) ? Math.min(1.5, Math.max(0.5, weight)) : 1,
      rubric: strList(t.rubric, 6, 140),
      lcTags: [],
      targetLevel: 3,
      source: 'ai',
    })
    if (out.length >= 16) break
  }
  return out
}

export async function suggestTopics({ trackName, description, existing = [] }) {
  const parsed = await aiJSON({ model: AI_MODELS.MINI, content: suggestTopicsPrompt({ trackName, description, existing }), maxTokens: 2000 })
  return validateSuggestedTopics(parsed, existing)
}

// ── Weekly study plan ──

// Candidate problems for the top gap topics: bank problems whose tags overlap the topic,
// not solved recently, easiest-appropriate first. Deterministic so the prompt stays small.
export function candidateProblems(gaps, { solvedSlugs = new Set(), perTopic = 4 } = {}) {
  const out = []
  const used = new Set()
  for (const g of gaps) {
    const tags = g.topic.lcTags || []
    if (!tags.length) continue
    const level = g.mastery.level
    const order = level < 1.5 ? ['Easy', 'Medium', 'Hard'] : level < 3 ? ['Medium', 'Easy', 'Hard'] : ['Medium', 'Hard', 'Easy']
    const pool = PROBLEM_BANK
      .filter(p => p.tags.some(t => tags.includes(t)) && !solvedSlugs.has(p.slug) && !used.has(p.slug))
      .sort((a, b) => order.indexOf(a.difficulty) - order.indexOf(b.difficulty))
      .slice(0, perTopic)
    pool.forEach(p => { used.add(p.slug); out.push({ ...p, topicId: g.topic.id }) })
  }
  return out
}

export function studyPlanPrompt({ trackName, gaps, candidates, demand, reviewDue, goals }) {
  const gapLines = gaps.map(g => `- [${g.topic.id}] ${g.topic.name} (${g.topic.category}) — level ${g.mastery.level}/5, target ${g.topic.targetLevel}; ${g.reason}`).join('\n')
  const candLines = candidates.map(p => `- ${p.slug} (${p.difficulty}) for topic ${p.topicId}`).join('\n')
  const upcoming = [
    ...demand.interviews.map(a => `${a.company} ${a.role} — interview stage ${a.stage}`),
    ...demand.oas.map(a => `${a.company} ${a.role} — online assessment due ${a.oaDueDate}`),
  ]
  return `You are an interview-prep coach for a university student recruiting for ${trackName} roles.
Build this week's study plan: 5-8 concrete actions, most important first.

Weakest topics (id in brackets):
${gapLines || '- none flagged'}

${upcoming.length ? `Upcoming in their pipeline:\n${upcoming.map(u => `- ${u}`).join('\n')}\n` : ''}${reviewDue ? `They have ${reviewDue} problem(s) due for re-solve in their review queue.\n` : ''}${goals.length ? `Their goals: ${goals.join('; ')}\n` : ''}
Candidate practice problems (you may ONLY recommend problems from this list, by slug):
${candLines || '- none'}

Action kinds: "problem" (one listed slug), "concept" (study/explain a topic — use for non-coding topics), "mock" (a mock interview), "review" (clear the re-solve queue).
Each action: a short imperative title, one sentence "why" tied to their data, minutes estimate, and topicId from the list above when relevant.
Do not include solutions or hints for the problems.

Return ONLY JSON: {"summary":"one sentence on this week's focus","actions":[{"kind":"problem","slug":"...","topicId":"...","title":"...","why":"...","minutes":30}]}`
}

export function validateStudyPlan(parsed, { candidates, gapTopicIds }) {
  const allowedSlugs = new Set(candidates.map(c => c.slug))
  const topics = new Set(gapTopicIds)
  const actions = []
  for (const a of parsed?.actions || []) {
    const kind = ['problem', 'concept', 'mock', 'review'].includes(a?.kind) ? a.kind : null
    if (!kind) continue
    const slug = kind === 'problem' ? str(a.slug, 120) : null
    if (kind === 'problem' && !allowedSlugs.has(slug)) continue // never an invented problem
    const p = slug ? PROBLEM_BY_SLUG.get(slug) : null
    const minutes = Math.round(Number(a.minutes))
    actions.push({
      kind,
      slug,
      url: p?.url || null,
      difficulty: p?.difficulty || null,
      topicId: topics.has(a.topicId) ? a.topicId : null,
      title: str(a.title, 120) || (p ? p.title : ''),
      why: str(a.why, 240),
      minutes: Number.isFinite(minutes) ? Math.min(180, Math.max(5, minutes)) : 30,
    })
    if (actions.length >= 10) break
  }
  return { summary: str(parsed?.summary, 240), actions: actions.filter(a => a.title) }
}

export async function buildStudyPlan(input) {
  const parsed = await aiJSON({ model: AI_MODELS.MINI, content: studyPlanPrompt(input), maxTokens: 1800 })
  return validateStudyPlan(parsed, { candidates: input.candidates, gapTopicIds: input.gaps.map(g => g.topic.id) })
}

// ── Explain-back ──

const QUESTION_STEMS = {
  'System Design': n => `Explain ${n} as you would to an interviewer, including the tradeoffs you'd weigh.`,
  SQL: n => `Explain ${n} in SQL — what it does, when you'd use it, and a pitfall to watch for.`,
  Networking: n => `Explain ${n} as you would in a technical interview.`,
  Accounting: n => `Walk me through: ${n}.`,
  Valuation: n => `Walk me through ${n} as you would in a banking technical interview.`,
  Deals: n => `Walk me through ${n}.`,
}

export function explainBackQuestion(topic) {
  const stem = QUESTION_STEMS[topic.category]
  return stem ? stem(topic.name) : `Explain ${topic.name} as you would in an interview — be specific and structured.`
}

export function explainBackPrompt({ topic, question, answer }) {
  const rubric = topic.rubric?.length ? topic.rubric : null
  return `You are grading a student's spoken-style interview answer. You are a tutor, not an answer key.

Question: ${question}
${rubric ? `Rubric — points a strong answer covers:\n${rubric.map(r => `- ${r}`).join('\n')}` : 'No rubric provided: judge against what a strong interview answer for this topic would cover.'}

Student's answer:
"""
${answer.slice(0, 6000)}
"""

Grade 1-5 (1 = mostly missing or wrong, 3 = acceptable but gaps, 5 = interview-ready).
List which rubric points they covered and which they missed (name the point, don't explain it).
Flag anything factually wrong in one short phrase each.
Give exactly ONE Socratic hint: a question that nudges them toward their biggest gap WITHOUT stating the answer.
Never write a model answer or fill in the missing content yourself.

Return ONLY JSON: {"score":3,"covered":["..."],"missed":["..."],"incorrect":["..."],"hint":"..."}`
}

export function validateGrade(parsed) {
  const score = Math.round(Number(parsed?.score))
  return {
    score: Number.isFinite(score) ? Math.min(5, Math.max(1, score)) : null,
    covered: strList(parsed?.covered, 8, 140),
    missed: strList(parsed?.missed, 8, 140),
    incorrect: strList(parsed?.incorrect, 5, 200),
    hint: str(parsed?.hint, 300),
  }
}

export async function gradeExplainBack({ topic, question, answer }) {
  const parsed = await aiJSON({ model: AI_MODELS.STANDARD, content: explainBackPrompt({ topic, question, answer }), maxTokens: 900 })
  const g = validateGrade(parsed)
  if (g.score == null) throw new Error('Could not grade that answer — try again.')
  return g
}
