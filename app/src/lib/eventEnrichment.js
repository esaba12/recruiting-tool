// Once-per-event attribute + requirement extraction for the shared pool.
//
// Extraction runs CLIENT-side through lib/ai.js (the caller's own BYOK key, the
// existing rate-limited proxies) and the result is committed through
// api/events-enrich.js, which validates it and writes the SHARED rows with the
// service role — the same split as feed ingestion (browser does the fetch/AI,
// server owns the write). Because event_attributes.content_hash records what
// text the extraction ran on, the first user at a campus to open the app after
// new events land does the work and everyone else just reads: once per event,
// never per user, and never again unless the event's text changes.
//
// Registration deadlines reuse lib/deadlines.js's fetch-the-real-page path (Exa
// /contents → AI reads a STATED date only) with the 'registration' subject.
import { aiJSON, AI_MODELS } from './ai.js'
import { authHeader } from './supabaseClient.js'
import { hashText, runChunked, partialErrorMessage } from './ingest/hashGate.js'
import { extractStatedDeadlines } from './deadlines.js'
import { REQUIREMENT_KINDS } from './eventRequirements.js'

const CHUNK_SIZE = 6
const DEADLINE_RECHECK_DAYS = 7

export function enrichmentHash(event) {
  return hashText([event.kind, event.title, event.description || '', event.location || '', event.registrationUrl || ''].join('\n'))
}

export function needsAttributes(event) {
  return !event.attributes?.extractedAt || event.attributes.contentHash !== enrichmentHash(event)
}

export function needsDeadlineCheck(event, { now = Date.now() } = {}) {
  if (!event.registrationUrl || event.registrationDeadline) return false
  if (Date.parse(event.startsAt) < now) return false
  const checked = event.attributes?.deadlineCheckedAt ? Date.parse(event.attributes.deadlineCheckedAt) : 0
  return !checked || now - checked > DEADLINE_RECHECK_DAYS * 86400000
}

export const ATTRIBUTES_PROMPT_HEADER = `You are tagging campus recruiting events for a student job-search tool. Each event below is labeled with a bracketed ID. For EACH event return:
- "roles": job families it targets, from ["SWE","PM","Data","Hardware","Design","Quant","Consulting","Research","Other"]; empty list if it's general/for everyone
- "majors": majors or departments explicitly named (short strings); empty list if none
- "term": the recruiting term if stated (e.g. "Fall 2026"), else null
- "format": "in_person" | "virtual" | "hybrid"
- "sponsorship": "yes" | "no" | "unknown" — visa sponsorship ONLY if the text states it
- "employer": the single company hosting or featured, else null (university-run fairs, departmental career days, multi-company events → null)
- "requirements": the signup steps the text actually states, in order, each {"kind": one of ${JSON.stringify(REQUIREMENT_KINDS)}, "label": short, "url": string or null, "due": "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM" (local time) or null, "required": true|false}. If the text says pre-registration is not needed, return no "register" step. Never invent a step or a date that isn't stated.

Return ONLY valid JSON, no markdown: {"items":[{"id":"...","roles":[],"majors":[],"term":null,"format":"in_person","sponsorship":"unknown","employer":null,"requirements":[]}]}

Events:
`

export function formatEventsForPrompt(chunk) {
  return chunk.map(e =>
    `[${e.id}] ${e.title}\nkind guess: ${e.kind} · when: ${e.startsAt}${e.location ? ' · where: ' + e.location : ''}${e.registrationUrl ? ' · registration link: ' + e.registrationUrl : ''}\n${(e.description || '').slice(0, 1500)}`
  ).join('\n---\n')
}

async function extractChunk(chunk) {
  const parsed = await aiJSON({ model: AI_MODELS.MINI, content: ATTRIBUTES_PROMPT_HEADER + formatEventsForPrompt(chunk), maxTokens: 2500 })
  const byId = new Map(chunk.map(e => [e.id, e]))
  return (parsed.items || [])
    .filter(it => byId.has(it.id))
    .map(it => ({ eventId: it.id, contentHash: byId.get(it.id).hash, ...it, id: undefined }))
}

// events: db.js fetchSchoolEvents() rows → { items, error }
export async function extractEventAttributes(events) {
  const candidates = events.filter(needsAttributes).map(e => ({ ...e, key: e.id, hash: enrichmentHash(e) }))
  if (!candidates.length) return { items: [], error: null }
  const { results, errors, chunkCount } = await runChunked(candidates, CHUNK_SIZE, extractChunk)
  return { items: results, error: partialErrorMessage(errors, chunkCount, 'extraction batch') }
}

// → { deadlines: { [eventId]: { deadline, rolling, confidence, note } }, error }
export async function checkRegistrationDeadlines(events, opts) {
  const candidates = events.filter(e => needsDeadlineCheck(e, opts))
  if (!candidates.length) return { deadlines: {}, error: null }
  const results = await extractStatedDeadlines(
    candidates.map(e => ({ key: e.id, url: e.registrationUrl, label: `${e.title} (${e.startsAt.slice(0, 10)})` })),
    { subject: 'registration' },
  )
  const firstError = Object.values(results).find(r => r.error)?.error || null
  return { deadlines: results, error: firstError }
}

export async function commitEnrichment({ items = [], deadlines = {} }) {
  if (!items.length && !Object.keys(deadlines).length) return { attributes: 0, requirements: 0, deadlines: 0 }
  const res = await fetch('/api/events-enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ items, deadlines }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error?.message || `Enrichment commit failed (${res.status})`)
  return data
}

// Orchestrator: attributes first (cheap, one MINI call per 6 events), then
// registration-deadline reads (Exa + AI, fail-soft if the user has no Exa key).
export async function runEventEnrichment(events, { withDeadlines = true } = {}) {
  const { items, error: attrError } = await extractEventAttributes(events)
  let deadlines = {}, deadlineError = null
  if (withDeadlines) ({ deadlines, error: deadlineError } = await checkRegistrationDeadlines(events))
  const committed = await commitEnrichment({ items, deadlines })
  return { ...committed, attempted: { attributes: items.length, deadlines: Object.keys(deadlines).length }, error: attrError || deadlineError }
}
