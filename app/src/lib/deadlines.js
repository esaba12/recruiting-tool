import { aiJSON, AI_MODELS } from './ai.js'
import { authHeader } from './supabaseClient.js'

// Real application-deadline extraction. The GitHub board repos this app pulls from
// (SimplifyJobs, speedyapply, vanshb03, ...) never carry a real deadline — only "days
// since posted" — so the only way to get an actual close-date is to visit the real
// apply page and read one off, if the company even states one (many don't; postings
// are commonly rolling). This is opt-in-by-default ("all_auto" per user choice): every
// open job with an apply link gets checked automatically, batched and cached so it's a
// one-time cost per job rather than a per-render one.
//
// Two steps per batch: (1) Exa's /contents endpoint fetches the real page text for a
// batch of apply URLs directly (no search needed — we already know the URL), then
// (2) one AI call reads every page in the batch and reports a deadline, or explicitly
// "no stated deadline" rather than guessing one.

const CONTENTS_CHUNK = 6  // apply URLs per Exa /contents + GPT extraction pass
const CONCURRENCY    = 3  // parallel chunk pipelines

async function fetchContents(urls) {
  const res = await fetch('/exa/contents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({
      urls,
      text: { maxCharacters: 2500 },
      livecrawlTimeout: 12000,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(res.status === 401 || res.status === 403
      ? (err.error?.message || 'Add your Exa API key in Settings to enable deadline lookups')
      : err.error || err.message || `Exa error ${res.status}`)
  }
  const data = await res.json()
  return data.results || []
}

// Two subjects share the fetch→read pipeline: job apply pages (the original use)
// and recruiting-event registration pages (Recruiting Events). Both obey the same
// rule — report a date only if the page STATES one, never guess.
const SUBJECTS = {
  application: {
    intro: 'Below are real internship/job application pages. For EACH one, determine whether the page states an explicit application deadline or closing date.',
    example: '"Apply by August 15", "Applications close 8/20/2026"',
    fallback: 'If the page failed to load or has no real job content',
  },
  registration: {
    intro: 'Below are pages for campus recruiting events (career fairs, info sessions, coffee chats). For EACH one, determine whether the page states an explicit registration / RSVP deadline or a "registration closes" date for attendees.',
    example: '"Register by September 20", "RSVP closes 9/22 at 5pm", "Sign-up deadline: Oct 1"',
    fallback: 'If the page failed to load, has no event content, or only shows the event date itself (not a registration cutoff)',
  },
}

function promptHeader(subject) {
  const s = SUBJECTS[subject] || SUBJECTS.application
  return `${s.intro}

Rules:
- Only report a deadline if the page actually states one (e.g. ${s.example}). Many are rolling/open until the event — do NOT invent or estimate a date for those.
- "id" in your output must be the exact bracketed ID from the page's label.
- Resolve relative dates using today's date: ${new Date().toISOString().slice(0, 10)}.
- ${s.fallback}, set rolling:false, deadline:null, confidence:"none".

Return ONLY valid JSON, no markdown, no explanation:
{"results": [{"id": "...", "deadline": "YYYY-MM-DD or null", "rolling": true or false, "confidence": "stated" | "none", "note": "short quote or reason, <15 words"}]}

Pages:
`
}

function normalizeUrl(u) { return (u || '').trim().replace(/\/+$/, '') }

// items: [{ key, url, label }]
async function extractChunk(items, subject) {
  const urls = items.map(j => j.url)
  let pages
  try {
    pages = await fetchContents(urls)
  } catch (e) {
    return Object.fromEntries(items.map(j => [j.key, { error: e.message }]))
  }

  // Exa's /contents preserves input order; fall back to positional matching if a
  // result's own url/id doesn't line up (redirects sometimes rewrite it).
  const byUrl = new Map(pages.map(p => [normalizeUrl(p.url || p.id), p]))

  const digest = items.map((j, i) => {
    const page = byUrl.get(normalizeUrl(j.url)) || pages[i]
    const text = (page?.text || '').trim()
    return `[${j.key}] ${j.label}\n${text ? text.slice(0, 2200) : '(page had no readable text — likely JS-only or blocked)'}`
  }).join('\n---\n')

  try {
    const parsed = await aiJSON({ model: AI_MODELS.MINI, content: promptHeader(subject) + digest, maxTokens: 1100 })
    const byKey = new Map((parsed.results || []).map(r => [r.id, r]))
    const out = {}
    for (const j of items) {
      const r = byKey.get(j.key)
      out[j.key] = r
        ? { deadline: r.deadline || null, rolling: !!r.rolling, confidence: r.confidence || 'none', note: r.note || '' }
        : { deadline: null, rolling: false, confidence: 'none', note: '' }
    }
    return out
  } catch (e) {
    return Object.fromEntries(items.map(j => [j.key, { error: e.message }]))
  }
}

// Generic form: items [{ key, url, label }] → { [key]: { deadline, rolling, confidence, note } | { error } }.
// Items without a url resolve immediately with no network call.
export async function extractStatedDeadlines(items, { subject = 'application', noUrlNote = 'No link' } = {}) {
  const checkable = items.filter(j => j.url)
  const results = {}
  for (const j of items) if (!j.url) results[j.key] = { deadline: null, rolling: false, confidence: 'none', note: noUrlNote }

  const chunks = []
  for (let i = 0; i < checkable.length; i += CONTENTS_CHUNK) chunks.push(checkable.slice(i, i + CONTENTS_CHUNK))

  let idx = 0
  async function worker() {
    while (idx < chunks.length) {
      const chunk = chunks[idx++]
      Object.assign(results, await extractChunk(chunk, subject))
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker))
  return results
}

// jobs: [{key, company, role, applyUrl}] — key is caller-defined (jobId(job) in
// practice) and is what the returned map is keyed by. Only jobs with an applyUrl are
// checked; everything else resolves to {deadline:null, rolling:false, confidence:'none'}
// with no network call spent.
export function extractDeadlines(jobs) {
  return extractStatedDeadlines(
    jobs.map(j => ({ key: j.key, url: j.applyUrl, label: `${j.company} — ${j.role || 'Internship'}` })),
    { subject: 'application', noUrlNote: 'No apply link on this listing' },
  )
}

// Urgency ordering: a confirmed deadline sorts soonest-first; everything else falls
// back to "freshest posting first" (the practical proxy when no real date exists —
// SWE internship postings get flooded within days, so acting on new listings fast beats
// waiting on old ones that are likely deep in their applicant pool already).
export function daysUntil(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T23:59:59')
  return Math.ceil((d.getTime() - Date.now()) / 86400000)
}
