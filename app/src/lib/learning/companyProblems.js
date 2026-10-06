// Company-tagged LeetCode problems → company-specific prep. LeetCode's own company tags are
// Premium-only, so this reads the public liquidslr/leetcode-company-wise-problems dataset
// (one folder per company, CSVs of the problems tagged for it, with an interview-frequency
// score and topics). It covers ~470 companies and is refreshed every few months.
//
// What it feeds:
//   - a per-company panel: how much of what that company asks you've already done, the
//     most-asked problems you haven't, and which of your topics it leans on hardest
//   - rankGaps' demand term: a topic a company you're interviewing with asks a lot gets
//     pushed up, instead of every topic getting the same generic "interview soon" boost
//
// Pure (no I/O) so derive.js / attention.js can use it; fetching + caching lives in
// useCompanyPrep.js.
import { splitCsvLine } from '../csv.js'

export const COMPANY_REPO = 'liquidslr/leetcode-company-wise-problems'
const DIFF = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' }

// "Heap (Priority Queue)" → "heap-priority-queue" — LeetCode's own tag slug convention.
export function topicSlug(name) {
  return String(name).toLowerCase().replace(/[()]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Dataset CSV → [{ slug, title, difficulty, frequency, tags[] }], most-asked first.
// Header: Difficulty,Title,Frequency,Acceptance Rate,Link,Topics
export function parseCompanyCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const head = splitCsvLine(lines[0]).map(h => h.toLowerCase())
  const col = name => head.indexOf(name)
  const iDiff = col('difficulty'); const iTitle = col('title'); const iFreq = col('frequency')
  const iLink = col('link'); const iTopics = col('topics')
  if (iLink < 0 || iTitle < 0) return []
  const out = []
  for (const line of lines.slice(1)) {
    const c = splitCsvLine(line)
    const slug = (c[iLink] || '').match(/leetcode\.com\/problems\/([a-z0-9-]+)/)?.[1]
    if (!slug) continue
    out.push({
      slug,
      title: c[iTitle] || slug,
      difficulty: DIFF[(c[iDiff] || '').toUpperCase()] || null,
      frequency: Number(c[iFreq]) || 0,
      tags: iTopics >= 0 && c[iTopics] ? c[iTopics].split(',').map(t => topicSlug(t.trim())).filter(Boolean) : [],
    })
  }
  return out.sort((a, b) => b.frequency - a.frequency)
}

// Loose company key: case, punctuation and corporate suffixes don't matter.
export function companyKey(name) {
  return String(name || '').toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company|plc|group|holdings|technologies|technology|labs)\b/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

// Former names / parent brands people write on applications.
const ALIASES = { facebook: 'meta', alphabet: 'google', aws: 'amazon', 'amazon web services': 'amazon', 'jane street capital': 'jane street' }
const compact = k => k.replace(/ /g, '')

// Pipeline company name → dataset folder, or null. Tries, in order: exact key, exact key
// ignoring spaces ("JPMorgan" ↔ "J.P. Morgan", "D. E. Shaw" ↔ "DE Shaw"), a whole-word
// prefix either way ("Amazon Web Services" ↔ "Amazon"), then a space-insensitive prefix for
// longer names ("JPMorgan Chase" ↔ "J.P. Morgan").
export function matchCompanyFolder(name, folders) {
  let k = companyKey(name)
  k = ALIASES[k] || k
  if (!k || !folders?.length) return null
  const keyed = folders.map(f => [f, companyKey(f)]).filter(([, fk]) => fk)
  const longest = rows => rows.sort((a, b) => b[1].length - a[1].length)[0]?.[0] || null
  return keyed.find(([, fk]) => fk === k)?.[0]
    || keyed.find(([, fk]) => compact(fk) === compact(k))?.[0]
    || longest(keyed.filter(([, fk]) => k.startsWith(fk + ' ') || fk.startsWith(k + ' ')))
    || longest(keyed.filter(([, fk]) => compact(fk).length >= 6 && compact(k).startsWith(compact(fk))))
}

// ── Coverage + demand (pure) ──

// Tags on a large share of all problems ("array" is on most of them). They only count toward a
// topic when a problem has no more specific tag that matches one — otherwise every company
// would look like it mostly asks "Arrays & hashing".
const GENERIC_TAGS = new Set(['array', 'string', 'math', 'sorting', 'simulation', 'matrix', 'enumeration', 'counting'])

// Topic ↔ problem: a problem counts toward a topic when one of its specific tags is in
// topic.lcTags, falling back to generic tags only when no specific tag matched anything.
export function topicsForProblem(problem, topics) {
  const specific = problem.tags.filter(t => !GENERIC_TAGS.has(t))
  const hits = topics.filter(t => t.lcTags?.some(tag => specific.includes(tag)))
  return hits.length ? hits : topics.filter(t => t.lcTags?.some(tag => problem.tags.includes(tag)))
}

// One company's problem list vs. what you've done.
//   solvedSlugs   — Set of slugs with an accepted attempt
//   attemptedSlugs — Set of slugs attempted but never accepted
// → { total, solved, attempted, solvedFrequencyPct, next[], topicShares[] }
//   solvedFrequencyPct — share of the company's frequency mass you've solved (top problems weigh more)
//   topicShares — [{ topic, share }] share of frequency mass per topic, desc
export function companyCoverage(problems, { solvedSlugs = new Set(), attemptedSlugs = new Set(), topics = [], limit = 5 } = {}) {
  const totalFreq = problems.reduce((s, p) => s + (p.frequency || 0), 0) || 1
  let solved = 0; let attempted = 0; let solvedFreq = 0
  const topicFreq = new Map()
  for (const p of problems) {
    if (solvedSlugs.has(p.slug)) { solved++; solvedFreq += p.frequency || 0 } else if (attemptedSlugs.has(p.slug)) attempted++
    for (const t of topicsForProblem(p, topics)) topicFreq.set(t.id, (topicFreq.get(t.id) || 0) + (p.frequency || 0))
  }
  const byId = new Map(topics.map(t => [t.id, t]))
  const topicShares = [...topicFreq].map(([id, f]) => ({ topic: byId.get(id), share: f / totalFreq })).sort((a, b) => b.share - a.share)
  const next = problems.filter(p => !solvedSlugs.has(p.slug)).slice(0, limit)
  return { total: problems.length, solved, attempted, solvedFrequencyPct: solvedFreq / totalFreq, next, topicShares }
}

// Company sets for companies you're interviewing / OA-ing with → Map(topicId → { share, company }).
// Keeps the strongest company signal per topic.
export function companyTopicDemand(sets, topics) {
  const out = new Map()
  for (const set of sets || []) {
    if (!set?.problems?.length) continue
    const { topicShares } = companyCoverage(set.problems, { topics })
    for (const { topic, share } of topicShares) {
      const cur = out.get(topic.id)
      if (!cur || share > cur.share) out.set(topic.id, { share, company: set.company })
    }
  }
  return out
}

// Slugs you've accepted / only attempted, from learning items + logs.
export function practicedSlugs(items, logs) {
  const slugById = new Map(items.filter(i => i.source === 'leetcode').map(i => [i.id, i.externalRef]))
  const solved = new Set(); const attempted = new Set()
  for (const l of logs) {
    const slug = slugById.get(l.itemId)
    if (!slug) continue
    if (l.outcome === 'solved' || l.outcome === 'hinted') solved.add(slug)
    else attempted.add(slug)
  }
  for (const s of solved) attempted.delete(s)
  return { solved, attempted }
}
