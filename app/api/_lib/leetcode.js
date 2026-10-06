// LeetCode public GraphQL — fixed, server-owned queries only. The client picks an `op` and
// supplies a validated username or slug list; it can never send its own GraphQL, so this
// proxy can't be turned into a general leetcode.com passthrough.
//
// One op is authenticated: `history` carries the user's LEETCODE_SESSION cookie for a one-off
// import of their full solved/attempted list (the public API only exposes the last 20
// submissions). The cookie is validated, sent to leetcode.com for that request, and never
// stored or logged anywhere — the client has to paste it again for another import. Used by api/gh-api.js's
// `?upstream=leetcode` branch (folded there to stay under Vercel Hobby's 12-function cap).

export const LEETCODE_GRAPHQL = 'https://leetcode.com/graphql'
const USERNAME_RE = /^[A-Za-z0-9_-]{1,40}$/
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const MAX_SLUGS = 10
// LEETCODE_SESSION is a signed token (JWT-shaped) — no cookie separators allowed through.
const SESSION_RE = /^[A-Za-z0-9._-]{20,4096}$/
export const HISTORY_PAGE = 100
const MAX_SKIP = 20000

const PROFILE_QUERY = `query userProfile($username: String!) {
  matchedUser(username: $username) {
    username
    submitStatsGlobal { acSubmissionNum { difficulty count } }
    languageProblemCount { languageName problemsSolved }
    tagProblemCounts {
      advanced { tagSlug problemsSolved }
      intermediate { tagSlug problemsSolved }
      fundamental { tagSlug problemsSolved }
    }
  }
  recentAcSubmissionList(username: $username, limit: 20) { id title titleSlug timestamp lang }
  recentSubmissionList(username: $username, limit: 20) { id title titleSlug timestamp statusDisplay lang }
}`

// The signed-in user's every solved/attempted problem, one page at a time. userStatus says
// whose session it is, so the client can refuse a session for a different account.
const HISTORY_QUERY = `query history($filters: UserProgressQuestionListInput) {
  userStatus { username isSignedIn }
  userProgressQuestionList(filters: $filters) {
    totalNum
    questions { title titleSlug difficulty lastSubmittedAt numSubmitted questionStatus lastResult topicTags { slug } }
  }
}`

// Aliased per-slug lookups — the shape is generated server-side from validated slugs.
function questionsQuery(n) {
  const vars = Array.from({ length: n }, (_, i) => `$s${i}: String!`).join(', ')
  const fields = Array.from({ length: n }, (_, i) => `q${i}: question(titleSlug: $s${i}) { titleSlug title difficulty topicTags { slug } }`).join('\n  ')
  return `query questions(${vars}) {\n  ${fields}\n}`
}

// body { op: 'profile', username } | { op: 'questions', slugs: [] } | { op: 'history', session, skip }
// → { query, variables, session? }. Throws Error with .status = 400 on anything else.
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
  if (body.op === 'history') {
    if (typeof body.session !== 'string' || !SESSION_RE.test(body.session)) fail('That doesn\'t look like a LEETCODE_SESSION cookie value')
    const skip = Number(body.skip ?? 0)
    if (!Number.isInteger(skip) || skip < 0 || skip > MAX_SKIP) fail('Invalid skip')
    return { query: HISTORY_QUERY, variables: { filters: { skip, limit: HISTORY_PAGE } }, session: body.session }
  }
  fail('Unknown op')
}

// leetcode.com wants a csrftoken cookie + matching x-csrftoken header on authenticated
// GraphQL POSTs; an anonymous GET hands one out.
async function fetchCsrf(fetchImpl) {
  const res = await fetchImpl('https://leetcode.com/graphql/', { headers: { 'User-Agent': 'recruiting-os-dashboard' } })
  const raw = res.headers.get('set-cookie') || ''
  return raw.match(/csrftoken=([^;,\s]+)/)?.[1] || ''
}

// Headers for one request built by buildLeetcodeRequest.
export async function leetcodeHeaders(gql, fetchImpl = fetch) {
  const headers = { 'Content-Type': 'application/json', 'Referer': 'https://leetcode.com', 'User-Agent': 'recruiting-os-dashboard' }
  if (!gql.session) return headers
  const csrf = await fetchCsrf(fetchImpl)
  return { ...headers, Origin: 'https://leetcode.com', Cookie: `csrftoken=${csrf}; LEETCODE_SESSION=${gql.session}`, 'x-csrftoken': csrf }
}
