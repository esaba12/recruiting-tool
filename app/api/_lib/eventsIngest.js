// Recruiting Events ingestion — the ONLY write path into the shared event pool
// (events / employers / ingest_sources have no client-facing write policies; see
// the TENANCY NOTE in supabase/migrations/20260913000000_recruiting_events.sql).
//
// Flow per source (from the caller's school's feed_config):
//   1. server-side fetch of the adapter's feed URL — authoritative when it works
//   2. if the host answers with a bot challenge (Cloudflare fronts events.umich.edu
//      and rejects non-browser TLS), report `needsRelay`; the browser — a real
//      browser session that passes the challenge, and the JSON endpoint is
//      CORS-open — fetches it and POSTs the payload back (mode: 'relay')
//   3. either way the payload is UNTRUSTED input: normalize → every item's
//      permalink host must match the configured feed host → freshness gate
//      (degraded source ⇒ record + skip, nothing written) → within-batch dedup →
//      employer upsert → per-item upsert by (source_kind, source_ref), or merge
//      into a near-duplicate already in the pool, else insert.
import { supabaseAdmin } from './supabaseAdmin.js'
import { sourcesFor, adapterFor } from '../../src/lib/ingest/adapters/index.js'
import { dedupWithin, findNearDuplicate } from '../../src/lib/ingest/dedup.js'
import { assessFreshness } from '../../src/lib/ingest/freshness.js'
import { normalizeCompanyName } from '../../src/lib/networkGraph.js'

const COOLDOWN_MS = 12 * 3600000       // a source is re-pulled at most twice a day, school-wide
const FETCH_TIMEOUT_MS = 12000
const MAX_PAYLOAD_ITEMS = 1000

function looksLikeChallenge(text, contentType = '') {
  return /text\/html/i.test(contentType) || /just a moment|cf-chl|challenge-platform|enable javascript/i.test(text.slice(0, 4000))
}

// → { payload } | { challenged: true } | { error }
export async function fetchFeed(url) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const r = await fetch(url, {
      signal: ctrl.signal, redirect: 'follow',
      headers: { accept: 'application/json, text/plain, */*', 'user-agent': 'RecruitingOS/1.1 (+events ingestion)' },
    })
    const text = await r.text()
    if (r.status === 403 || r.status === 503 || looksLikeChallenge(text, r.headers.get('content-type') || '')) return { challenged: true, status: r.status }
    if (!r.ok) return { error: `HTTP ${r.status}` }
    try { return { payload: JSON.parse(text) } } catch { return { error: 'Feed did not return JSON' } }
  } catch (e) {
    return { error: e.name === 'AbortError' ? 'Feed fetch timed out' : e.message }
  } finally { clearTimeout(timer) }
}

function mapSchool(r) {
  return { id: r.id, slug: r.slug, name: r.name, timezone: r.timezone, feedConfig: r.feed_config || {}, termWindows: r.term_windows || [] }
}

export async function loadCallerSchool(userId) {
  const db = supabaseAdmin()
  const { data: profile, error } = await db.from('profiles').select('school_id').eq('id', userId).maybeSingle()
  if (error) throw new Error(`profile lookup: ${error.message}`)
  if (!profile?.school_id) return null
  const { data: school, error: sErr } = await db.from('schools').select('*').eq('id', profile.school_id).single()
  if (sErr) throw new Error(`school lookup: ${sErr.message}`)
  return mapSchool(school)
}

// Ensure one ingest_sources row per configured source and return them keyed by ref.
async function ensureSourceRows(school, sources) {
  const db = supabaseAdmin()
  if (sources.length) {
    const rows = sources.map(s => ({ school_id: school.id, kind: s.kind, ref: s.ref, label: s.label }))
    const { error } = await db.from('ingest_sources').upsert(rows, { onConflict: 'school_id,kind,ref', ignoreDuplicates: true })
    if (error) throw new Error(`ingest_sources upsert: ${error.message}`)
  }
  const { data, error } = await db.from('ingest_sources').select('*').eq('school_id', school.id)
  if (error) throw new Error(`ingest_sources read: ${error.message}`)
  return new Map((data || []).map(r => [`${r.kind}:${r.ref}`, r]))
}

async function markSource(row, patch) {
  const { error } = await supabaseAdmin().from('ingest_sources').update(patch).eq('id', row.id)
  if (error) throw new Error(`ingest_sources update: ${error.message}`)
}

async function upsertEmployers(names) {
  const db = supabaseAdmin()
  const unique = [...new Map(names.filter(Boolean).map(n => [normalizeCompanyName(n), n])).entries()]
  if (!unique.length) return new Map()
  const rows = unique.map(([normalized_name, name]) => ({ name, normalized_name }))
  const { error } = await db.from('employers').upsert(rows, { onConflict: 'normalized_name', ignoreDuplicates: true })
  if (error) throw new Error(`employers upsert: ${error.message}`)
  const { data, error: rErr } = await db.from('employers').select('id, normalized_name').in('normalized_name', unique.map(u => u[0]))
  if (rErr) throw new Error(`employers read: ${rErr.message}`)
  return new Map((data || []).map(e => [e.normalized_name, e.id]))
}

function draftToRow(d, school, employerIds, now) {
  return {
    school_id: school.id, visibility: 'shared', kind: d.kind, title: d.title, description: d.description || null,
    location: d.location || null, is_virtual: !!d.isVirtual, starts_at: d.startsAt, ends_at: d.endsAt, all_day: !!d.allDay,
    timezone: d.timezone || school.timezone, url: d.url, registration_url: d.registrationUrl, registration_deadline: d.registrationDeadline,
    employer_id: d.employerName ? employerIds.get(normalizeCompanyName(d.employerName)) || null : null,
    source_kind: d.sourceKind, source_ref: d.sourceRef, source_last_verified_at: now, dedup_key: d.dedupKey,
    confidence: d.confidence ?? 1,
  }
}

// Validate + write one source's payload. Returns a per-source summary.
export async function processPayload({ school, source, sourceRow, payload, userId, now = new Date().toISOString() }) {
  const db = supabaseAdmin()
  const adapter = adapterFor(source.kind)
  const summary = { ref: source.ref, label: source.label, inserted: 0, updated: 0, merged: 0, rejected: 0, degraded: null }

  if (Array.isArray(payload) && payload.length > MAX_PAYLOAD_ITEMS) throw httpError(413, 'Payload too large')

  const { drafts: raw, shape, rejected } = adapter.normalize(payload, { timezone: school.timezone })
  summary.rejected = rejected
  if (!shape) {
    await markSource(sourceRow, { last_run_at: now, degraded_at: now, degraded_reason: 'Unrecognized feed payload' })
    summary.degraded = 'Unrecognized feed payload'
    return summary
  }

  // Trust boundary: a relayed payload must carry permalinks on the configured host.
  if (source.host) {
    const foreign = raw.filter(d => d.sourceHost && d.sourceHost !== source.host)
    if (foreign.length) throw httpError(400, `Payload items reference ${foreign[0].sourceHost}, not the configured feed host ${source.host}`)
  }

  const fresh = assessFreshness(raw, school.termWindows, { now: Date.parse(now) })
  if (!fresh.ok) {
    await markSource(sourceRow, { last_run_at: now, last_count: 0, degraded_at: now, degraded_reason: fresh.reason })
    summary.degraded = fresh.reason
    return summary
  }

  const drafts = dedupWithin(raw)
  const employerIds = await upsertEmployers(drafts.map(d => d.employerName))

  // Existing pool rows in the drafts' time range (any source) for near-dup merging.
  let existing = []
  if (drafts.length) {
    const times = drafts.map(d => Date.parse(d.startsAt)).filter(n => !Number.isNaN(n))
    const lo = new Date(Math.min(...times) - 86400000).toISOString()
    const hi = new Date(Math.max(...times) + 86400000).toISOString()
    const { data, error } = await db.from('events')
      .select('id, title, starts_at, source_kind, source_ref, registration_url, employers(name)')
      .eq('school_id', school.id).eq('visibility', 'shared').eq('archived', false)
      .gte('starts_at', lo).lte('starts_at', hi)
    if (error) throw new Error(`events read: ${error.message}`)
    existing = (data || []).map(e => ({ ...e, startsAt: e.starts_at, employerName: e.employers?.name || null }))
  }
  const byRef = new Map(existing.filter(e => e.source_ref).map(e => [`${e.source_kind}:${e.source_ref}`, e]))

  const inserts = []
  for (const d of drafts) {
    const row = draftToRow(d, school, employerIds, now)
    const same = byRef.get(`${d.sourceKind}:${d.sourceRef}`)
    if (same) {
      const { error } = await db.from('events').update(row).eq('id', same.id)
      if (error) throw new Error(`events update: ${error.message}`)
      summary.updated++
      continue
    }
    const twin = findNearDuplicate(d, existing)
    if (twin) {
      // Another source already carries this event — re-verify it and fill gaps, don't duplicate.
      const patch = { source_last_verified_at: now }
      if (!twin.registration_url && row.registration_url) patch.registration_url = row.registration_url
      const { error } = await db.from('events').update(patch).eq('id', twin.id)
      if (error) throw new Error(`events merge: ${error.message}`)
      summary.merged++
      continue
    }
    inserts.push(row)
    existing.push({ ...row, startsAt: row.starts_at, employerName: d.employerName })   // so a later draft in this batch can merge into it
  }
  if (inserts.length) {
    // Batch insert; the partial unique index (school_id, dedup_key) is the hard
    // backstop for a concurrent relay of the same feed. It can't be named in an
    // ON CONFLICT clause through PostgREST, so on a collision fall back to
    // row-by-row and count the collisions as merges rather than failing the pull.
    const { error } = await db.from('events').insert(inserts)
    if (!error) summary.inserted = inserts.length
    else if (error.code === '23505') {
      for (const row of inserts) {
        const { error: one } = await db.from('events').insert(row)
        if (!one) summary.inserted++
        else if (one.code === '23505') summary.merged++
        else throw new Error(`events insert: ${one.message}`)
      }
    } else throw new Error(`events insert: ${error.message}`)
  }

  await markSource(sourceRow, {
    last_run_at: now, last_success_at: now, last_count: drafts.length, degraded_at: null, degraded_reason: null,
  })
  return summary
}

export function httpError(status, message) {
  const e = new Error(message); e.status = status; return e
}

// mode 'run'  : pull every due source server-side; report the ones needing a browser relay
// mode 'relay': accept one source's browser-fetched payload
export async function runIngest({ user, mode = 'run', ref = null, payload = null, force = false }) {
  const school = await loadCallerSchool(user.id)
  if (!school) throw httpError(400, 'Pick your campus in Settings to enable recruiting events.')
  const sources = sourcesFor(school)
  const rows = await ensureSourceRows(school, sources)
  const now = new Date()
  const result = { school: { id: school.id, slug: school.slug }, ran: [], needsRelay: [], skipped: [], unsupported: sources.filter(s => !s.supported).map(s => ({ ref: s.ref, label: s.label, why: s.unsupported })) }

  if (mode === 'relay') {
    const source = sources.find(s => s.supported && s.ref === String(ref))
    if (!source) throw httpError(400, 'Unknown or unsupported source for this school')
    const sourceRow = rows.get(`${source.kind}:${source.ref}`)
    result.ran.push(await processPayload({ school, source, sourceRow, payload, userId: user.id, now: now.toISOString() }))
    return result
  }

  for (const source of sources.filter(s => s.supported)) {
    const sourceRow = rows.get(`${source.kind}:${source.ref}`)
    const last = sourceRow?.last_run_at ? Date.parse(sourceRow.last_run_at) : 0
    if (!force && last && now.getTime() - last < COOLDOWN_MS) { result.skipped.push({ ref: source.ref, label: source.label, why: 'cooldown' }); continue }
    const fetched = await fetchFeed(source.url)
    if (fetched.challenged) { result.needsRelay.push({ ref: source.ref, label: source.label, url: source.url }); continue }
    if (fetched.error) {
      await markSource(sourceRow, { last_run_at: now.toISOString(), degraded_at: now.toISOString(), degraded_reason: `Fetch failed: ${fetched.error}` })
      result.ran.push({ ref: source.ref, label: source.label, degraded: `Fetch failed: ${fetched.error}`, inserted: 0, updated: 0, merged: 0 })
      continue
    }
    result.ran.push(await processPayload({ school, source, sourceRow, payload: fetched.payload, userId: user.id, now: now.toISOString() }))
  }
  return result
}
