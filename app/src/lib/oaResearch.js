import { aiJSON, AI_MODELS } from './ai.js'
import { authHeader } from './supabaseClient.js'
import { updateApplication } from '../db.js'

// Cloud-agent research fallback for Online Assessment due dates. The email pipeline
// (scripts/email-pipeline.js) extracts oa_due_date straight from the invite email when it's
// stated there — but plenty of OA invites don't state a deadline in the email itself, only on
// the assessment platform's own page once you land on it (oa_link). This mirrors deadlines.js's
// pattern exactly: Exa's /contents endpoint fetches the real page text for a batch of oa_link
// URLs, then one AI call reads them and reports a due date only if the page actually states one.
//
// Unlike deadlines.js (a pure localStorage cache — job listings aren't a "to-do" the user needs
// reminded of across devices), a found OA due date is persisted straight to Supabase via
// updateApplication() so it shows up in Today on any device. When research comes up empty,
// oa_research_checked_at is stamped so the app doesn't re-fetch the same page every load — see
// RECHECK_COOLDOWN_DAYS below — and that stamp is what the Today tab uses to distinguish "haven't
// checked yet" (say nothing, resolves itself shortly) from "checked, no stated deadline" (surface
// as a to-do: go find it yourself).

const CONTENTS_CHUNK = 6
const CONCURRENCY = 3
const RECHECK_COOLDOWN_DAYS = 3

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
  if (!res.ok) throw new Error(`Exa error ${res.status}`)
  const data = await res.json()
  return data.results || []
}

const PROMPT_HEADER = `Below are real Online Assessment (OA) pages — coding/skills tests candidates were invited to complete (HackerRank, CodeSignal, Codility, etc.). For EACH one, determine whether the page states an explicit completion deadline.

Rules:
- Only report a deadline if the page actually states one (e.g. "Complete by August 20", "This assessment expires in 7 days" — resolve relative windows using today's date below). Many assessment pages state no deadline at all — do NOT invent or estimate one for those.
- "id" in your output must be the exact bracketed ID from the page's label.
- Resolve relative dates using today's date: ${new Date().toISOString().slice(0, 10)}.
- If the page failed to load, requires login, or has no real assessment content, set deadline:null, confidence:"none".

Return ONLY valid JSON, no markdown, no explanation:
{"results": [{"id": "...", "deadline": "YYYY-MM-DD or null", "confidence": "stated" | "none", "note": "short quote or reason, <15 words"}]}

Pages:
`

function normalizeUrl(u) { return (u || '').trim().replace(/\/+$/, '') }

async function researchChunk(apps) {
  const urls = apps.map(a => a.oaLink)
  let pages
  try {
    pages = await fetchContents(urls)
  } catch {
    return [] // fail-soft — this chunk just doesn't get a checked-at stamp, retried next load
  }

  const byUrl = new Map(pages.map(p => [normalizeUrl(p.url || p.id), p]))
  const digest = apps.map((a, i) => {
    const page = byUrl.get(normalizeUrl(a.oaLink)) || pages[i]
    const text = (page?.text || '').trim()
    return `[${a.id}] ${a.company} — ${a.role || 'Assessment'}\n${text ? text.slice(0, 2200) : '(page had no readable text — likely JS-only, login-gated, or blocked)'}`
  }).join('\n---\n')

  try {
    const parsed = await aiJSON({ model: AI_MODELS.MINI, content: PROMPT_HEADER + digest, maxTokens: 1100 })
    const byId = new Map((parsed.results || []).map(r => [r.id, r]))
    return apps.map(a => {
      const r = byId.get(a.id)
      return { id: a.id, deadline: r?.deadline || null, confidence: r?.confidence || 'none' }
    })
  } catch {
    return []
  }
}

function needsResearch(app) {
  if (!app.oaLink || app.oaCompleted || app.oaDueDate) return false
  if (!app.oaResearchCheckedAt) return true
  const daysSinceCheck = (Date.now() - new Date(app.oaResearchCheckedAt).getTime()) / 86400000
  return daysSinceCheck >= RECHECK_COOLDOWN_DAYS
}

// Runs the research pass and writes results straight to Supabase. Returns the count of
// applications updated (either a deadline was found, or a checked-at stamp was set), so the
// caller knows whether to re-fetch application state.
export async function researchOaDeadlines(apps) {
  const candidates = apps.filter(needsResearch)
  if (candidates.length === 0) return 0

  const chunks = []
  for (let i = 0; i < candidates.length; i += CONTENTS_CHUNK) chunks.push(candidates.slice(i, i + CONTENTS_CHUNK))

  const allResults = []
  let idx = 0
  async function worker() {
    while (idx < chunks.length) {
      const chunk = chunks[idx++]
      allResults.push(...await researchChunk(chunk))
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker))

  const now = new Date().toISOString()
  await Promise.all(allResults.map(r =>
    r.deadline && r.confidence === 'stated'
      ? updateApplication(r.id, { oaDueDate: r.deadline })
      : updateApplication(r.id, { oaResearchCheckedAt: now })
  ))

  return allResults.length
}
