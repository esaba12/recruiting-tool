// Contributed events → the shared pool. The poisoning boundary for user-supplied
// events (paste / CSV / ICS / manual): every draft is re-validated here, deduped
// against the school's pool (a twin MERGES and corroborates instead of landing
// twice), and gated — only confidence ≥ SHARE_CONFIDENCE may be shared; the rest
// stays visibility='private' to the contributor until promoted. Everything
// records contributed_by. Also handles promote / remove of a user's own private rows.
import { supabaseAdmin } from './supabaseAdmin.js'
import { loadCallerSchool, httpError } from './eventsIngest.js'
import { validateContribution, gateVisibility } from '../../src/lib/ingest/contribute.js'
import { findNearDuplicate } from '../../src/lib/ingest/dedup.js'
import { normalizeCompanyName } from '../../src/lib/networkGraph.js'
import { localToUtcMs, parseCompactLocal } from '../../src/lib/ingest/tz.js'
import { REQUIREMENT_KINDS } from '../../src/lib/eventRequirements.js'

const MAX_ITEMS = 50
const KINDS = new Set(REQUIREMENT_KINDS)
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '') || null
const httpUrl = v => (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) ? v.trim().slice(0, 500) : null

async function upsertEmployer(name) {
  if (!name) return null
  const db = supabaseAdmin()
  const normalized = normalizeCompanyName(name)
  await db.from('employers').upsert({ name, normalized_name: normalized }, { onConflict: 'normalized_name', ignoreDuplicates: true })
  const { data } = await db.from('employers').select('id').eq('normalized_name', normalized).maybeSingle()
  return data?.id || null
}

function dueToIso(due, tz) {
  const parts = parseCompactLocal(String(due || ''))
  if (!parts) return null
  if (!/T\d{2}:?\d{2}/.test(String(due))) { parts.hh = 23; parts.mm = 59 }
  const ms = localToUtcMs(parts, tz)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

async function loadPool(db, school, drafts, userId) {
  const times = drafts.map(d => Date.parse(d.startsAt))
  const lo = new Date(Math.min(...times) - 86400000).toISOString()
  const hi = new Date(Math.max(...times) + 86400000).toISOString()
  const { data, error } = await db.from('events')
    .select('id, title, starts_at, visibility, contributed_by, registration_url, url, employers(name)')
    .eq('school_id', school.id).eq('archived', false).gte('starts_at', lo).lte('starts_at', hi)
    .or(`visibility.eq.shared,contributed_by.eq.${userId}`)
  if (error) throw new Error(`events read: ${error.message}`)
  return (data || []).map(e => ({ ...e, startsAt: e.starts_at, employerName: e.employers?.name || null }))
}

export async function contributeEvents({ user, items = [], share = true }) {
  if (!Array.isArray(items) || !items.length || items.length > MAX_ITEMS) throw httpError(400, `items must be 1–${MAX_ITEMS} drafts`)
  const school = await loadCallerSchool(user.id)
  if (!school) throw httpError(400, 'Pick your campus in Settings to enable recruiting events.')
  const db = supabaseAdmin()
  const now = new Date().toISOString()

  // Results are returned in INPUT order so the UI can line them up with its drafts.
  const entries = items.map(raw => ({ raw, v: validateContribution(raw) }))
  const valid = entries.filter(e => e.v.ok).map(e => e.v.draft)
  if (!valid.length) return { results: entries.map(e => ({ status: 'rejected', reason: e.v.reason, title: e.raw?.title || null })), school: school.slug }

  const pool = await loadPool(db, school, valid, user.id)
  const results = []
  for (const { raw, v } of entries) {
    if (!v.ok) { results.push({ status: 'rejected', reason: v.reason, title: raw?.title || null }); continue }
    const d = v.draft
    const twin = findNearDuplicate(d, pool)
    if (twin) {
      // Corroborates an existing row: re-verify it and fill gaps. Never a second row.
      const patch = { source_last_verified_at: now }
      if (!twin.registration_url && d.registrationUrl) patch.registration_url = d.registrationUrl
      if (!twin.url && d.url) patch.url = d.url
      const { error } = await db.from('events').update(patch).eq('id', twin.id)
      if (error) throw new Error(`events merge: ${error.message}`)
      results.push({ status: 'merged', eventId: twin.id, title: d.title, visibility: twin.visibility })
      continue
    }
    const gate = gateVisibility(d, { share })
    const employerId = await upsertEmployer(d.employerName)
    const row = {
      school_id: school.id, visibility: gate.visibility, contributed_by: user.id, kind: d.kind, title: d.title,
      description: d.description, location: d.location, is_virtual: d.isVirtual, starts_at: d.startsAt, ends_at: d.endsAt,
      all_day: d.allDay, timezone: d.timezone || school.timezone, url: d.url, registration_url: d.registrationUrl,
      employer_id: employerId, source_kind: d.sourceKind, source_ref: d.sourceRef, source_last_verified_at: now,
      dedup_key: d.dedupKey, confidence: d.confidence,
    }
    let inserted
    { const { data, error } = await db.from('events').insert(row).select('id').single()
      if (error && error.code === '23505') {
        // Hard backstop hit (same source_ref or shared dedup_key landed concurrently) — treat as merged.
        const { data: ex } = await db.from('events').select('id').eq('school_id', school.id).eq('dedup_key', d.dedupKey).eq('visibility', 'shared').maybeSingle()
        results.push({ status: 'merged', eventId: ex?.id || null, title: d.title, visibility: 'shared' }); continue
      }
      if (error) throw new Error(`events insert: ${error.message}`)
      inserted = data }
    // Requirements stated in the paste (validated like events-enrich does).
    const reqs = (d.requirements || []).filter(r => r && KINDS.has(r.kind)).slice(0, 8).map((r, i) => ({
      event_id: inserted.id, step_order: i + 1, kind: r.kind, label: str(r.label, 120), url: httpUrl(r.url),
      due_at: r.due ? dueToIso(r.due, school.timezone) : null, required: r.required !== false,
    }))
    if (reqs.length) { const { error } = await db.from('event_requirements').insert(reqs); if (error) throw new Error(`event_requirements insert: ${error.message}`) }
    pool.push({ id: inserted.id, title: d.title, startsAt: d.startsAt, employerName: d.employerName, visibility: gate.visibility })
    results.push({ status: gate.visibility === 'shared' ? 'shared' : 'private', eventId: inserted.id, title: d.title, visibility: gate.visibility, reason: gate.reason })
  }
  return { results, school: school.slug }
}

// Promote a caller's own private event to the school pool (dedup + confidence gate apply).
export async function promoteEvent({ user, eventId }) {
  const school = await loadCallerSchool(user.id)
  if (!school) throw httpError(400, 'Pick your campus in Settings first.')
  const db = supabaseAdmin()
  const { data: ev, error } = await db.from('events').select('*, employers(name)').eq('id', eventId).eq('school_id', school.id).eq('contributed_by', user.id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!ev) throw httpError(404, 'Not your event, or not found')
  if (ev.visibility === 'shared') return { status: 'shared', eventId }
  const draft = { title: ev.title, employerName: ev.employers?.name || null, startsAt: ev.starts_at, confidence: Number(ev.confidence) }
  const pool = (await loadPool(db, school, [draft], user.id)).filter(p => p.id !== eventId && p.visibility === 'shared')
  const twin = findNearDuplicate(draft, pool)
  if (twin) {
    await db.from('events').update({ archived: true }).eq('id', eventId)
    await db.from('events').update({ source_last_verified_at: new Date().toISOString() }).eq('id', twin.id)
    return { status: 'merged', eventId: twin.id }
  }
  const gate = gateVisibility(draft, { share: true })
  if (gate.visibility !== 'shared') throw httpError(400, gate.reason)
  const { error: uErr } = await db.from('events').update({ visibility: 'shared', source_last_verified_at: new Date().toISOString() }).eq('id', eventId)
  if (uErr) throw new Error(uErr.message)
  return { status: 'shared', eventId }
}

// Remove a caller's own PRIVATE event. Shared rows are never deleted by a user
// (archive is a moderation action, out of scope here).
export async function removeOwnEvent({ user, eventId }) {
  const db = supabaseAdmin()
  const { data, error } = await db.from('events').delete().eq('id', eventId).eq('contributed_by', user.id).eq('visibility', 'private').select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw httpError(404, 'Only your own private events can be removed')
  return { status: 'removed', eventId }
}
