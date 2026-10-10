// Built-in track templates for the Learn tab. A template is only a *seed*: picking one
// copies its topics into learning_topics (source='template') and its widgets/goals into
// learning_tracks.config, after which everything is user-editable in the Customize panel.
//
// Topic fields: name, category, lcTags (LeetCode tagSlugs that count toward the topic —
// only meaningful for DSA/SQL; note LeetCode's profile tag counts use 'heap'/'sweep-line'
// where problem tags use 'heap-priority-queue'/'line-sweep', so both spellings are listed), weight (relative interview importance, 0.5–1.5), and
// rubric (explain-back checklist — the points a strong verbal answer covers; the AI
// grader checks against these and never reveals them as a model answer).

export const WIDGET_TYPES = [
  { type: 'summary',    label: 'Summary strip',      desc: 'This week, streak, readiness vs. target, next interview' },
  { type: 'goals',      label: 'Goals',              desc: 'Progress toward your weekly and deadline goals' },
  { type: 'gaps',       label: 'Gaps',               desc: 'Topics furthest below target, weighted by upcoming interviews' },
  // lcOnly: added (visible) to existing tracks that practice on LeetCode the first time this
  // widget type ships, instead of arriving hidden like other new widget types.
  { type: 'company',    label: 'Company prep', lcOnly: true, after: 'gaps',       desc: 'What each company you\'re interviewing with asks on LeetCode, and how much you\'ve covered' },
  { type: 'plan',       label: 'Study plan',         desc: 'AI-prioritized actions for this week' },
  { type: 'mastery',    label: 'Mastery grid',       desc: 'Every topic, current level vs. target' },
  { type: 'review',     label: 'Re-solve queue',     desc: 'Problems you struggled on, scheduled by spaced repetition' },
  { type: 'activity',   label: 'Activity',           desc: 'Practice volume over the last 10 weeks' },
  { type: 'difficulty', label: 'Difficulty split',   desc: 'Solved problems by difficulty' },
  { type: 'languages',  label: 'Languages', lcOnly: true, after: 'difficulty', desc: 'LeetCode solves per language, and first-try accept rate in each' },
  { type: 'recent',     label: 'Recent log',         desc: 'Your latest attempts and sessions' },
]

export const GOAL_METRICS = [
  { key: 'problems',      label: 'Problems solved',        unit: 'problems', supportsDifficulty: true },
  { key: 'sessions',      label: 'Study sessions',         unit: 'sessions' },
  { key: 'minutes',       label: 'Minutes practiced',      unit: 'min' },
  { key: 'mocks',         label: 'Mock interviews',        unit: 'mocks' },
  { key: 'explain_backs', label: 'Explain-back checks',    unit: 'checks' },
  { key: 'topics_at_target', label: 'Topics at target level', unit: 'topics' },
]

const w = (...types) => types.map(type => ({ type, visible: true }))
const hiddenRest = (visible) => [
  ...w(...visible),
  ...WIDGET_TYPES.filter(t => !visible.includes(t.type)).map(t => ({ type: t.type, visible: false })),
]

const SWE_TOPICS = [
  // ── Data structures & algorithms (NeetCode-style patterns → LeetCode tags) ──
  { name: 'Arrays & hashing',     category: 'DSA', lcTags: ['array', 'hash-table', 'prefix-sum'], weight: 1.3 },
  { name: 'Two pointers',         category: 'DSA', lcTags: ['two-pointers'], weight: 1.2 },
  { name: 'Sliding window',       category: 'DSA', lcTags: ['sliding-window'], weight: 1.2 },
  { name: 'Stack & monotonic stack', category: 'DSA', lcTags: ['stack', 'monotonic-stack'], weight: 1.0 },
  { name: 'Binary search',        category: 'DSA', lcTags: ['binary-search'], weight: 1.1 },
  { name: 'Linked lists',         category: 'DSA', lcTags: ['linked-list'], weight: 0.9 },
  { name: 'Trees',                category: 'DSA', lcTags: ['tree', 'binary-tree', 'binary-search-tree'], weight: 1.3 },
  { name: 'Tries',                category: 'DSA', lcTags: ['trie'], weight: 0.6 },
  { name: 'Heaps / priority queue', category: 'DSA', lcTags: ['heap-priority-queue', 'heap'], weight: 1.0 },
  { name: 'Backtracking',         category: 'DSA', lcTags: ['backtracking'], weight: 0.9 },
  { name: 'Graphs (BFS/DFS)',     category: 'DSA', lcTags: ['graph', 'breadth-first-search', 'depth-first-search', 'union-find', 'topological-sort'], weight: 1.3 },
  { name: 'Advanced graphs',      category: 'DSA', lcTags: ['shortest-path', 'minimum-spanning-tree'], weight: 0.6 },
  { name: 'Dynamic programming',  category: 'DSA', lcTags: ['dynamic-programming', 'memoization'], weight: 1.2 },
  { name: 'Greedy',               category: 'DSA', lcTags: ['greedy'], weight: 0.9 },
  { name: 'Intervals & sorting',  category: 'DSA', lcTags: ['sorting', 'line-sweep', 'sweep-line'], weight: 0.8 },
  { name: 'Bit manipulation & math', category: 'DSA', lcTags: ['bit-manipulation', 'math'], weight: 0.5 },

  // ── System design ──
  { name: 'Scaling fundamentals', category: 'System Design', weight: 1.0,
    rubric: ['vertical vs horizontal scaling', 'stateless services', 'load balancer role', 'single points of failure', 'back-of-envelope estimates'] },
  { name: 'Caching',              category: 'System Design', weight: 1.0,
    rubric: ['where caches sit (client, CDN, app, DB)', 'cache-aside vs write-through', 'eviction (LRU/TTL)', 'invalidation and staleness', 'hot keys / thundering herd'] },
  { name: 'Databases: SQL vs NoSQL', category: 'System Design', weight: 1.0,
    rubric: ['relational vs document/key-value tradeoffs', 'indexes and access patterns', 'replication (leader/follower)', 'sharding and shard keys', 'transactions / ACID'] },
  { name: 'Consistency & CAP',    category: 'System Design', weight: 0.8,
    rubric: ['CAP under a partition', 'strong vs eventual consistency', 'read-your-writes', 'quorum reads/writes', 'a concrete example of choosing'] },
  { name: 'Queues & async processing', category: 'System Design', weight: 0.8,
    rubric: ['why decouple with a queue', 'at-least-once delivery and idempotency', 'backpressure', 'pub/sub vs work queue', 'dead-letter handling'] },
  { name: 'API design & rate limiting', category: 'System Design', weight: 0.8,
    rubric: ['REST resource modeling', 'pagination', 'idempotency keys', 'rate-limit algorithms (token bucket/sliding window)', 'versioning'] },
  { name: 'Design case studies',  category: 'System Design', weight: 1.0,
    rubric: ['clarify requirements and scale', 'high-level components', 'data model', 'deep-dive on the bottleneck', 'tradeoffs stated explicitly'] },

  // ── SQL ──
  { name: 'Joins',                category: 'SQL', lcTags: ['database'], weight: 1.0,
    rubric: ['inner vs left/right/full outer', 'join keys and duplicates', 'self-join use case', 'anti-join (LEFT JOIN … IS NULL / NOT EXISTS)'] },
  { name: 'Aggregation & GROUP BY', category: 'SQL', weight: 1.0,
    rubric: ['GROUP BY semantics', 'WHERE vs HAVING', 'COUNT(*) vs COUNT(col)', 'NULL handling in aggregates'] },
  { name: 'Window functions',     category: 'SQL', weight: 1.0,
    rubric: ['PARTITION BY vs GROUP BY', 'ROW_NUMBER vs RANK vs DENSE_RANK', 'running totals with frames', 'LAG/LEAD'] },
  { name: 'CTEs & subqueries',    category: 'SQL', weight: 0.7,
    rubric: ['when to use a CTE', 'correlated vs uncorrelated subqueries', 'recursive CTE idea', 'readability vs performance'] },
  { name: 'Indexes & query performance', category: 'SQL', weight: 0.6,
    rubric: ['what a B-tree index speeds up', 'composite index column order', 'cost of indexes on writes', 'reading an EXPLAIN plan'] },

  // ── HTTP & networking ──
  { name: 'HTTP methods & status codes', category: 'Networking', weight: 0.8,
    rubric: ['GET/POST/PUT/PATCH/DELETE semantics', 'idempotency and safety', '2xx/3xx/4xx/5xx classes', '401 vs 403, 400 vs 422'] },
  { name: 'HTTPS & TLS',          category: 'Networking', weight: 0.7,
    rubric: ['what TLS guarantees', 'certificates and CAs', 'handshake at a high level', 'symmetric vs asymmetric keys'] },
  { name: 'DNS',                  category: 'Networking', weight: 0.6,
    rubric: ['resolution path (resolver → root → TLD → authoritative)', 'record types (A, AAAA, CNAME, MX)', 'TTL and caching'] },
  { name: 'TCP vs UDP',           category: 'Networking', weight: 0.6,
    rubric: ['connection setup (3-way handshake)', 'reliability and ordering', 'congestion control idea', 'when UDP is preferred'] },
  { name: 'HTTP caching & cookies', category: 'Networking', weight: 0.6,
    rubric: ['Cache-Control / ETag / 304', 'CDN caching', 'cookies vs tokens for auth', 'SameSite / CSRF basics'] },
  { name: 'What happens when you type a URL', category: 'Networking', weight: 0.8,
    rubric: ['DNS lookup', 'TCP + TLS connection', 'HTTP request/response', 'server side (LB, app, DB)', 'browser render'] },
]

const IB_TOPICS = [
  { name: 'Three financial statements', category: 'Accounting', weight: 1.4,
    rubric: ['what each statement shows', 'how net income links IS → CFS → BS', 'balance sheet must balance', 'cash vs accrual'] },
  { name: 'Walk a change through the statements', category: 'Accounting', weight: 1.4,
    rubric: ['e.g. depreciation +$10: IS, CFS, BS effects', 'tax effect', 'cash impact', 'balance check at the end'] },
  { name: 'Working capital & cash flow', category: 'Accounting', weight: 0.9,
    rubric: ['definition of NWC', 'why an increase uses cash', 'FCF vs net income'] },
  { name: 'Enterprise value vs equity value', category: 'Valuation', weight: 1.3,
    rubric: ['definitions', 'EV bridge (debt, cash, preferred, NCI)', 'which multiples pair with which value', 'why cash is subtracted'] },
  { name: 'Comparable companies', category: 'Valuation', weight: 1.0,
    rubric: ['selecting comps', 'common multiples (EV/EBITDA, P/E)', 'strengths and weaknesses'] },
  { name: 'Precedent transactions', category: 'Valuation', weight: 0.8,
    rubric: ['control premium', 'why usually higher than comps', 'data limitations'] },
  { name: 'DCF', category: 'Valuation', weight: 1.4,
    rubric: ['project unlevered FCF', 'WACC components', 'terminal value (Gordon vs exit multiple)', 'discount back and bridge to equity', 'key sensitivities'] },
  { name: 'LBO', category: 'Deals', weight: 1.1,
    rubric: ['why a sponsor uses leverage', 'sources and uses', 'debt paydown and exit', 'IRR / MOIC drivers', 'good LBO candidate traits'] },
  { name: 'M&A: accretion / dilution', category: 'Deals', weight: 1.0,
    rubric: ['pro forma EPS', 'cost of cash/debt/stock financing vs target yield', 'synergies', 'rule-of-thumb P/E comparison'] },
  { name: 'Markets & deal awareness', category: 'Fit & markets', weight: 0.9,
    rubric: ['one recent deal and its rationale', 'rates environment effect on valuation', 'a stock pitch with thesis + risks'] },
  { name: 'Behavioral / why banking', category: 'Fit & markets', weight: 1.0,
    rubric: ['concise story', 'why this bank/group', 'evidence of work ethic and teamwork'] },
]

const PM_TOPICS = [
  { name: 'Product sense / design', category: 'Product', weight: 1.4,
    rubric: ['clarify goal and user', 'segment users and pick one', 'pain points prioritized', 'solutions + a chosen one', 'success metrics'] },
  { name: 'Metrics & execution', category: 'Execution', weight: 1.3,
    rubric: ['north-star metric', 'input vs output metrics', 'diagnosing a metric drop', 'tradeoff decisions'] },
  { name: 'Estimation', category: 'Execution', weight: 0.9,
    rubric: ['state assumptions', 'structured breakdown', 'sanity check the result'] },
  { name: 'Strategy', category: 'Product', weight: 0.9,
    rubric: ['market and competition', 'company advantages', 'build/buy/partner', 'risks'] },
  { name: 'Technical fluency', category: 'Execution', weight: 0.7,
    rubric: ['explain a system at a high level', 'APIs and data flow', 'engineering tradeoffs'] },
  { name: 'Behavioral / leadership', category: 'Behavioral', weight: 1.0,
    rubric: ['STAR structure', 'conflict or influence without authority', 'measurable impact'] },
]

const QUANT_TOPICS = [
  { name: 'Probability', category: 'Math', weight: 1.4 },
  { name: 'Expected value & games', category: 'Math', weight: 1.2 },
  { name: 'Combinatorics', category: 'Math', weight: 1.0 },
  { name: 'Statistics', category: 'Math', weight: 0.9 },
  { name: 'Brainteasers', category: 'Puzzles', weight: 1.0 },
  { name: 'Mental math', category: 'Speed', weight: 1.0 },
  { name: 'Market making', category: 'Trading', weight: 0.9 },
  { name: 'Coding (DSA)', category: 'Coding', lcTags: ['array', 'hash-table', 'dynamic-programming'], weight: 0.8 },
]

const CONSULTING_TOPICS = [
  { name: 'Case structuring', category: 'Case', weight: 1.4,
    rubric: ['restate the objective', 'MECE issue tree', 'hypothesis-driven', 'prioritize branches'] },
  { name: 'Market sizing', category: 'Case', weight: 1.1,
    rubric: ['state assumptions', 'top-down or bottom-up breakdown', 'clean arithmetic', 'sanity check the result'] },
  { name: 'Profitability', category: 'Case', weight: 1.2,
    rubric: ['revenue vs cost split', 'price × volume', 'fixed vs variable costs', 'isolate the driver'] },
  { name: 'Market entry & growth', category: 'Case', weight: 1.0,
    rubric: ['market attractiveness', 'competition', 'capabilities and fit', 'entry mode (build/buy/partner)', 'risks'] },
  { name: 'Charts & exhibits', category: 'Analysis', weight: 0.9,
    rubric: ['read the axes and units first', 'call out the "so what"', 'link it back to the hypothesis'] },
  { name: 'Case math', category: 'Analysis', weight: 1.0,
    rubric: ['percentages and growth rates', 'break-even', 'round sensibly and narrate'] },
  { name: 'Synthesis & recommendation', category: 'Case', weight: 1.0,
    rubric: ['answer first', 'two or three supporting reasons', 'risks and next steps'] },
  { name: 'Fit / PEI stories', category: 'Fit', weight: 1.1,
    rubric: ['leadership, impact, and teamwork stories', 'STAR structure', 'why consulting / why this firm'] },
]

export const TEMPLATES = {
  swe: {
    kind: 'swe', name: 'SWE', blurb: 'LeetCode patterns, system design, SQL, HTTP & networking',
    topics: SWE_TOPICS,
    widgets: hiddenRest(['summary', 'goals', 'gaps', 'company', 'plan', 'mastery', 'review', 'activity', 'difficulty', 'languages', 'recent']),
    goals: [
      { id: 'g-problems', metric: 'problems', period: 'week', target: 10 },
      { id: 'g-sd', metric: 'sessions', period: 'week', target: 2, category: 'System Design' },
    ],
  },
  ib: {
    kind: 'ib', name: 'Investment Banking', blurb: 'Accounting, valuation, LBO/M&A technicals, fit',
    topics: IB_TOPICS,
    widgets: hiddenRest(['summary', 'goals', 'gaps', 'plan', 'mastery', 'activity', 'recent']),
    goals: [
      { id: 'g-eb', metric: 'explain_backs', period: 'week', target: 5 },
      { id: 'g-mocks', metric: 'mocks', period: 'week', target: 1 },
    ],
  },
  pm: {
    kind: 'pm', name: 'Product Management', blurb: 'Product sense, metrics, estimation, strategy',
    topics: PM_TOPICS,
    widgets: hiddenRest(['summary', 'goals', 'gaps', 'plan', 'mastery', 'activity', 'recent']),
    goals: [
      { id: 'g-eb', metric: 'explain_backs', period: 'week', target: 3 },
      { id: 'g-mocks', metric: 'mocks', period: 'week', target: 1 },
    ],
  },
  quant: {
    kind: 'quant', name: 'Quant / Trading', blurb: 'Probability, brainteasers, mental math, market making',
    topics: QUANT_TOPICS,
    widgets: hiddenRest(['summary', 'goals', 'gaps', 'plan', 'mastery', 'activity', 'recent']),
    goals: [{ id: 'g-min', metric: 'minutes', period: 'week', target: 240 }],
  },
  consulting: {
    kind: 'consulting', name: 'Consulting', blurb: 'Case structuring, market sizing, case math, fit',
    topics: CONSULTING_TOPICS,
    widgets: hiddenRest(['summary', 'goals', 'gaps', 'plan', 'mastery', 'activity', 'recent']),
    goals: [
      { id: 'g-mocks', metric: 'mocks', period: 'week', target: 2 },
      { id: 'g-eb', metric: 'explain_backs', period: 'week', target: 3 },
    ],
  },
  custom: {
    kind: 'custom', name: 'Custom track', blurb: 'Start blank — add topics yourself or let AI suggest them',
    topics: [],
    widgets: hiddenRest(['summary', 'goals', 'gaps', 'mastery', 'activity', 'recent']),
    goals: [],
  },
}

// Which template(s) to seed on first open, from the profile's recruiting tracks
// (lib/tracks.js ids — every track id is also a template key).
export function defaultTemplateKeys(tracks) {
  const keys = (tracks || []).filter(t => TEMPLATES[t])
  return keys.length ? keys : ['swe']
}

// Template → { track, topics } row shapes ready for db.js's createTrackWithTopics().
export function instantiateTemplate(key, { name } = {}) {
  const t = TEMPLATES[key] || TEMPLATES.custom
  return {
    track: {
      kind: t.kind,
      name: name || t.name,
      config: { widgets: t.widgets.map(x => ({ ...x })), goals: t.goals.map(g => ({ ...g })), leetcodeUsername: '' },
    },
    topics: t.topics.map((tp, i) => ({
      name: tp.name,
      category: tp.category,
      lcTags: tp.lcTags || [],
      weight: tp.weight ?? 1,
      targetLevel: 3,
      rubric: tp.rubric || null,
      sort: i,
      source: 'template',
    })),
  }
}
