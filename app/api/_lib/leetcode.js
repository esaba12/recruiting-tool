// LeetCode public GraphQL — fixed, server-owned queries only. The client picks an `op` and
// supplies a validated username or slug list; it can never send its own GraphQL, so this
// proxy can't be turned into a general leetcode.com passthrough. Used by api/gh-api.js's
// `?upstream=leetcode` branch (folded there to stay under Vercel Hobby's 12-function cap).

export const LEETCODE_GRAPHQL = 'https://leetcode.com/graphql'
const USERNAME_RE = /^[A-Za-z0-9_-]{1,40}$/
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const MAX_SLUGS = 10

const PROFILE_QUERY = `query userProfile($username: String!) {
  matchedUser(username: $username) {
    username
    submitStatsGlobal { acSubmissionNum { difficulty count } }
    tagProblemCounts {
      advanced { tagSlug problemsSolved }
      intermediate { tagSlug problemsSolved }
      fundamental { tagSlug problemsSolved }
    }
  }
  recentAcSubmissionList(username: $username, limit: 20) { id title titleSlug timestamp }
}`

// Aliased per-slug lookups — the shape is generated server-side from validated slugs.
function questionsQuery(n) {
  const vars = Array.from({ length: n }, (_, i) => `$s${i}: String!`).join(', ')
  const fields = Array.from({ length: n }, (_, i) => `q${i}: question(titleSlug: $s${i}) { titleSlug title difficulty topicTags { slug } }`).join('\n  ')
  return `query questions(${vars}) {\n  ${fields}\n}`
}

// body { op: 'profile', username } | { op: 'questions', slugs: [] } → { query, variables }
// Throws Error with .status = 400 on anything else.
export function buildLeetcodeRequest(body) {
  const fail = msg => { const e = new Error(msg); e.status = 400; throw e }
  if (!body || typeof body !== 'object') fail('Missing body')
  if (body.op === 'profile') {
    if (typeof body.username !== 'string' || !USERNAME_RE.test(body.username)) fail('Invalid LeetCode username')
    return { query: PROFILE_QUERY, variables: { username: body.username } }
  }
  if (body.op === 'questions') {
    const slugs = body.slugs
    if (!Array.isArray(slugs) || !slugs.length || slugs.length > MAX_SLUGS) fail(`slugs must be 1–${MAX_SLUGS} items`)
    if (!slugs.every(s => typeof s === 'string' && s.length <= 120 && SLUG_RE.test(s))) fail('Invalid slug')
    return { query: questionsQuery(slugs.length), variables: Object.fromEntries(slugs.map((s, i) => [`s${i}`, s])) }
  }
  fail('Unknown op')
}
