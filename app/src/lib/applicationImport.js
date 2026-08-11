import { aiJSON, AI_MODELS } from './ai.js'
import { authHeader } from './supabaseClient.js'

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
