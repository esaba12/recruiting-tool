import { aiJSON, AI_MODELS } from './ai.js'
import { authHeader } from './supabaseClient.js'
import { exaSearch } from './exa.js'

// Paste-a-link application import: fetch the real posting page (same Exa /contents
// endpoint deadlines.js already uses) and have the AI structure it into company/role/
// location. Single-URL and uncached, unlike deadlines.js's batched daily scan — this is
// a one-off action the user triggers by pasting one link at a time, not a recurring
// background job, so the token-minimization machinery there doesn't apply here.

async function fetchPageText(url) {
  const res = await fetch('/exa/contents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({
      urls: [url],
      text: { maxCharacters: 4000 },
      livecrawlTimeout: 15000,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const message = (typeof err.error === 'string' ? err.error : err.error?.message) || err.message
    throw new Error(res.status === 401 || res.status === 403
      ? (message || 'Add your Exa API key in Settings to auto-fill from a link')
      : message || `Exa error ${res.status}`)
  }
  const data = await res.json()
  const page = (data.results || [])[0]
  if (!page?.text?.trim()) throw new Error('Could not read that page — fill in the details below instead.')
  return page.text
}

const PROMPT = (text) => `Below is the text of a job/internship application page. Extract the posting details. Return ONLY valid JSON, no markdown:

{"company":"","role":"","location":"or null"}

Rules:
- company: the hiring company's name (not a job board or ATS platform like Greenhouse/Lever/Workday)
- role: the job title as posted
- location: city/region if stated, else null

Page text:
${text.slice(0, 3500)}`

// Deliberately drops deadline extraction (unlike deadlines.js) — Applications rows have
// no deadline column, and Job Boards' deadline system is keyed on board-sourced job
// objects, a different data model from manually-added Pipeline rows.
export async function importApplicationFromUrl(url) {
  const text = await fetchPageText(url)
  const parsed = await aiJSON({ model: AI_MODELS.MINI, content: PROMPT(text), maxTokens: 200 })
  return {
    company: parsed?.company?.trim() || '',
    role: parsed?.role?.trim() || '',
    location: parsed?.location?.trim() || '',
  }
}

// Real ATS/job-board hosts get a scoring bump when picking which Exa result is actually
// the posting, vs. a company blog post, news article, or LinkedIn mention that happens to
// rank nearby.
const JOB_BOARD_HOSTS = ['greenhouse.io', 'lever.co', 'myworkdayjobs.com', 'ashbyhq.com', 'jobvite.com', 'smartrecruiters.com', 'icims.com', 'workable.com', 'breezy.hr']

function pickBestPosting(results, company) {
  if (!results?.length) return null
  const companyKey = company.trim().toLowerCase()
  const scored = results.map(r => {
    let score = 0
    try {
      const host = new URL(r.url).hostname
      if (JOB_BOARD_HOSTS.some(h => host === h || host.endsWith(`.${h}`))) score += 3
      if (/\b(job|jobs|career|careers|intern)\b/i.test(r.url)) score += 1
      if ((r.title || '').toLowerCase().includes(companyKey)) score += 1
    } catch { /* malformed url — leave score at 0, still eligible as a fallback */ }
    return { r, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0].r
}

// Quick Capture's "find these N companies and add them" path: given just a company name
// (no link in hand), search the public web for a real posting and, if one turns up, read
// it the same way importApplicationFromUrl does. Best-effort — searches and AI extraction
// both fail soft to a bare {company, role: roleHint} row rather than blocking the add, same
// posture as every other Exa-backed feature in this app when a key is missing or a company
// has no visible posting right now.
export async function findApplicationForCompany(company, roleHint) {
  const bare = { company, role: roleHint || '', location: '', jdLink: '', found: false }
  try {
    const results = await exaSearch({ query: `${company} ${roleHint || 'software engineer intern'} apply`, numResults: 5, category: null })
    const best = pickBestPosting(results, company)
    if (!best?.url) return bare

    const text = (best.text || best.summary || '').trim()
    if (!text) return { ...bare, jdLink: best.url }

    const parsed = await aiJSON({ model: AI_MODELS.MINI, content: PROMPT(text), maxTokens: 200 })
    return {
      company: parsed?.company?.trim() || company,
      role: parsed?.role?.trim() || roleHint || '',
      location: parsed?.location?.trim() || '',
      jdLink: best.url,
      found: true,
    }
  } catch (e) {
    return { ...bare, error: e.message }
  }
}
