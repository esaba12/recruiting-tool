// Contributed events (paste / CSV / ICS / manual) — the shared pure parts of the
// import pipeline, used by the browser (staging UI) and by api/_lib/eventsContribute.js
// (the service-role commit). Because a contributed event is SHARED with everyone at
// the school, this is where the poisoning risk lives; the rules:
//   • confidence gate — only drafts at or above SHARE_CONFIDENCE may become shared;
//     everything else stays private to the contributor (promotable later)
//   • dedup — a contribution that near-duplicates an existing pool event MERGES into
//     it (re-verifies it, fills gaps) instead of creating a second row
//   • whitelist — every field is validated/capped server-side; the client's copy of
//     these helpers only exists so the staging UI can preview the same decisions
import { dedupKey, findNearDuplicate } from './dedup.js'

export const SHARE_CONFIDENCE = 0.8
export const CONTRIBUTION_SOURCE_KINDS = ['paste', 'csv', 'ics', 'manual']
export const EVENT_KINDS = ['career_fair', 'info_session', 'coffee_chat', 'workshop', 'networking', 'other']

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '') || null
const httpUrl = v => (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) ? v.trim().slice(0, 500) : null

// Normalize + validate one draft. Returns { ok: true, draft } or { ok: false, reason }.
export function validateContribution(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'not an object' }
  const title = str(raw.title, 200)
  if (!title) return { ok: false, reason: 'title required' }
  const startsMs = Date.parse(raw.startsAt)
  if (Number.isNaN(startsMs)) return { ok: false, reason: 'startsAt must be an ISO datetime' }
  const endsMs = raw.endsAt ? Date.parse(raw.endsAt) : NaN
  const endsAt = !Number.isNaN(endsMs) && endsMs > startsMs ? new Date(endsMs).toISOString() : null
  const sourceKind = CONTRIBUTION_SOURCE_KINDS.includes(raw.sourceKind) ? raw.sourceKind : 'manual'
  const kind = EVENT_KINDS.includes(raw.kind) ? raw.kind : 'other'
  let confidence = Number(raw.confidence)
  if (Number.isNaN(confidence)) confidence = sourceKind === 'manual' ? 1 : 0.5
  confidence = Math.max(0, Math.min(1, confidence))
  const employerName = str(raw.employerName, 80)
  const startsAt = new Date(startsMs).toISOString()
  const draft = {
    title, kind, description: str(raw.description, 4000), location: str(raw.location, 200),
    isVirtual: !!raw.isVirtual, startsAt, endsAt, allDay: !!raw.allDay,
    timezone: str(raw.timezone, 64), url: httpUrl(raw.url), registrationUrl: httpUrl(raw.registrationUrl),
    employerName, sourceKind, sourceRef: str(raw.sourceRef, 200), confidence,
    dedupKey: dedupKey({ title, employerName, startsAt }),
    requirements: Array.isArray(raw.requirements) ? raw.requirements.slice(0, 8) : [],
  }
  return { ok: true, draft }
}

// Where a validated draft lands, given the contributor's wish to share.
export function gateVisibility(draft, { share = true } = {}) {
  if (!share) return { visibility: 'private', reason: 'kept private by contributor' }
  if (draft.confidence < SHARE_CONFIDENCE) {
    return { visibility: 'private', reason: `confidence ${draft.confidence.toFixed(2)} below ${SHARE_CONFIDENCE} — kept private until reviewed` }
  }
  return { visibility: 'shared', reason: null }
}

// Annotate drafts with the pool event they'd merge into (if any).
export function annotateDuplicates(drafts, poolEvents = []) {
  const existing = poolEvents.map(e => ({ ...e, employerName: e.employerName || e.attributes?.employer || null }))
  return drafts.map(d => ({ ...d, duplicateOf: findNearDuplicate(d, existing) || null }))
}
