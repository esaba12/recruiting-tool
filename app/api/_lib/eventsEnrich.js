// Validates client-extracted attributes / requirements / registration deadlines
// and writes them to the SHARED tables with the service role. Trust boundary:
// the caller's session is real (requireUser) but the payload is model output
// relayed by a browser, so every field is whitelisted, enum-checked, length-
// capped, and every event id must belong to the caller's own school.
import { supabaseAdmin } from './supabaseAdmin.js'
import { loadCallerSchool, httpError } from './eventsIngest.js'
import { normalizeCompanyName } from '../../src/lib/networkGraph.js'
import { localToUtcMs, parseCompactLocal } from '../../src/lib/ingest/tz.js'
import { REQUIREMENT_KINDS } from '../../src/lib/eventRequirements.js'

const FORMATS = new Set(['in_person', 'virtual', 'hybrid'])
const SPONSORSHIP = new Set(['yes', 'no', 'unknown'])
const KINDS = new Set(REQUIREMENT_KINDS)
const MAX_ITEMS = 200

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '') || null
const strList = (v, max = 12, each = 40) => Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string').map(x => x.trim().slice(0, each)).filter(Boolean))].slice(0, max) : []
const httpUrl = v => (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) ? v.trim().slice(0, 500) : null

// "YYYY-MM-DD" / "YYYY-MM-DDTHH:MM" in the school's zone → ISO, else null.
function dueToIso(due, tz) {
  const parts = parseCompactLocal(due)
  if (!parts) return null
  if (!/T\d{2}:?\d{2}/.test(due)) { parts.hh = 23; parts.mm = 59 }   // date-only ⇒ end of that day
  const ms = localToUtcMs(parts, tz)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

async function upsertEmployer(name) {
  if (!name) return null
  const db = supabaseAdmin()
  const normalized = normalizeCompanyName(name)
  await db.from('employers').upsert({ name, normalized_name: normalized }, { onConflict: 'normalized_name', ignoreDuplicates: true })
  const { data } = await db.from('employers').select('id').eq('normalized_name', normalized).maybeSingle()
  return data?.id || null
}

export async function commitEnrichment({ user, items = [], deadlines = {} }) {
  if (!Array.isArray(items) || items.length > MAX_ITEMS) throw httpError(400, 'items must be an array of at most 200')
  const school = await loadCallerSchool(user.id)
  if (!school) throw httpError(400, 'Pick your campus in Settings to enable recruiting events.')
  const db = supabaseAdmin()
  const now = new Date().toISOString()

  const ids = [...new Set([...items.map(i => i?.eventId), ...Object.keys(deadlines || {})].filter(Boolean))]
  if (!ids.length) return { attributes: 0, requirements: 0, deadlines: 0 }
  const { data: owned, error } = await db.from('events').select('id, employer_id').eq('school_id', school.id).in('id', ids)
  if (error) throw new Error(`events read: ${error.message}`)
  const ownedById = new Map((owned || []).map(e => [e.id, e]))
  const foreign = ids.filter(id => !ownedById.has(id))
  if (foreign.length) throw httpError(403, 'One or more events do not belong to your school')

  const summary = { attributes: 0, requirements: 0, deadlines: 0 }

  for (const raw of items) {
    const ev = ownedById.get(raw.eventId)
    const employerName = str(raw.employer, 80)
    const employerId = ev.employer_id || (employerName ? await upsertEmployer(employerName) : null)
    const attrs = {
      event_id: ev.id,
      roles: strList(raw.roles, 8, 20),
      majors: strList(raw.majors, 12, 40),
      term: str(raw.term, 40),
      format: FORMATS.has(raw.format) ? raw.format : null,
      sponsorship: SPONSORSHIP.has(raw.sponsorship) ? raw.sponsorship : 'unknown',
      employer_ids: employerId ? [employerId] : [],
      content_hash: str(raw.contentHash, 32),
      model: str(raw.model, 60) || 'client',
      extracted_at: now,
    }
    // Preserve raw.deadlineCheckedAt across re-extractions.
    const { data: prev } = await db.from('event_attributes').select('raw').eq('event_id', ev.id).maybeSingle()
    attrs.raw = { ...(prev?.raw || {}), employer: employerName || undefined }
    const { error: aErr } = await db.from('event_attributes').upsert(attrs, { onConflict: 'event_id' })
    if (aErr) throw new Error(`event_attributes upsert: ${aErr.message}`)
    summary.attributes++
    if (!ev.employer_id && employerId) await db.from('events').update({ employer_id: employerId }).eq('id', ev.id)

    // Requirements: upsert by (event_id, step_order) — never delete, so a user's
    // completion rows (FK → requirement) survive a re-extraction.
    const reqs = (Array.isArray(raw.requirements) ? raw.requirements : [])
      .filter(r => r && KINDS.has(r.kind)).slice(0, 8)
      .map((r, i) => ({
        event_id: ev.id, step_order: i + 1, kind: r.kind, label: str(r.label, 120), url: httpUrl(r.url),
        due_at: r.due ? dueToIso(String(r.due), school.timezone) : null, required: r.required !== false,
      }))
    if (reqs.length) {
      const { error: rErr } = await db.from('event_requirements').upsert(reqs, { onConflict: 'event_id,step_order' })
      if (rErr) throw new Error(`event_requirements upsert: ${rErr.message}`)
      summary.requirements += reqs.length
    }
  }

  for (const [eventId, r] of Object.entries(deadlines || {})) {
    if (!r || r.error) continue
    const patch = {}
    if (r.confidence === 'stated' && r.deadline) {
      const iso = dueToIso(String(r.deadline), school.timezone)
      if (iso) patch.registration_deadline = iso
    }
    if (Object.keys(patch).length) {
      const { error: dErr } = await db.from('events').update(patch).eq('id', eventId)
      if (dErr) throw new Error(`events deadline update: ${dErr.message}`)
      summary.deadlines++
    }
    // Record the check either way so the page isn't re-read for a week.
    const { data: prev } = await db.from('event_attributes').select('raw').eq('event_id', eventId).maybeSingle()
    const rawPrev = prev?.raw || {}
    await db.from('event_attributes').upsert({
      event_id: eventId, raw: { ...rawPrev, deadlineCheckedAt: now, deadlineNote: str(r.note, 160) || undefined },
    }, { onConflict: 'event_id' })
  }
  return summary
}
