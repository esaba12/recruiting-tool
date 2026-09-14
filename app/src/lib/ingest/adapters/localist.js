// Localist adapter — one adapter per PLATFORM, parameterized by school via
// schools.feed_config.sources[]: { kind: 'localist', base, groupId, label }.
//
// Two payload shapes are understood, detected by content not by config:
//   • events.umich.edu's `/group/<id>/json?v=2` — a flat array of occurrences
//     (`event_title`, `datetime_start` as local wall-clock + `time_zone`, `guid`,
//     `permalink`, `links[]`, `sponsors[]`) — UMich's own build on top of Localist.
//   • the standard Localist API v2 `/api/2/events?group_id=<id>` —
//     `{ events: [{ event: { …, event_instances: [{ event_instance }] } }] }`
//     with ISO+offset instance times.
// Pure: no fetching here (Cloudflare challenges non-browser TLS on at least the
// UMich instance, so the fetch may happen in the browser and be relayed — see
// api/_lib/eventsIngest.js). Output is EventDraft[] in events-table shape.
import { localToIso, parseCompactLocal, isValidTimeZone } from '../tz.js'
import { dedupKey } from '../dedup.js'

export const KIND = 'localist'

export function feedUrl(source) {
  const base = (source.base || '').replace(/\/$/, '')
  if (!base || source.groupId == null) return null
  return source.format === 'api2'
    ? `${base}/api/2/events?group_id=${encodeURIComponent(source.groupId)}&days=120&pp=100`
    : `${base}/group/${encodeURIComponent(source.groupId)}/json?v=2`
}

export function feedHost(source) {
  try { return new URL(source.base).host } catch { return null }
}

// ── classification helpers (title/type heuristics; AI attribute extraction in
// Phase 10 refines these, this is the cheap deterministic first pass) ────────
export function classifyKind(title = '', type = '') {
  const t = `${title} ${type}`.toLowerCase()
  if (/career fair|career day|career expo|job fair|\bfair\b|expo\b/.test(t)) return 'career_fair'
  if (/coffee chat|office hours/.test(t)) return 'coffee_chat'
  if (/mixer|networking|meet ?(and|&) ?greet|reception|social/.test(t)) return 'networking'
  if (/career cafe|info(rmation)? session|featuring|tech talk|employer spotlight|company presentation|lunch and learn/.test(t)) return 'info_session'
  if (/workshop|essentials|prep\b|headshot|resume|résumé|interview|job search|panel|webinar|bootcamp|how to/.test(t)) return 'workshop'
  return 'other'
}

// "Engineering Career Cafe featuring AbbVie" → "AbbVie"; departmental "Career Day
// featuring CSE, ECE …" lists departments, not employers, so career_fair is skipped.
export function extractEmployer(title = '', kind) {
  if (kind === 'career_fair') return null
  const m = /(?:featuring|with|hosted by|presented by)\s+(.+?)(?:\s+[-–—:(]|\s*$)/i.exec(title)
    || /^(.+?)\s+(?:info(?:rmation)? session|tech talk|coffee chats?|office hours|employer spotlight)/i.exec(title)
  if (!m) return null
  let name = m[1].trim().replace(/[.,;:]+$/, '')
  if (/,| and |&/.test(name)) return null          // multiple names → not one employer
  if (name.length < 2 || name.length > 60) return null
  if (/^(the )?(engineering|career|students?|alumni)/i.test(name)) return null
  return name
}

const REG_RE = /register|registration|rsvp|sign ?up|careerfairplus|joinhandshake|careerforge|eventbrite|zoom\.us|forms?\.|qualtrics|apply/i
// Prefer an explicit "Register/RSVP" link, then a known event portal, then a
// generic login page (Career Forge's `/login` is real but the weakest signal).
function registrationScore(title = '', url = '') {
  if (/accommodation|accessibility|prep|website$/i.test(title)) return 0
  if (/register|registration|rsvp|sign ?up/i.test(title)) return 4
  if (/careerfairplus|joinhandshake|eventbrite|lu\.ma|zoom\.us|qualtrics|forms\./i.test(url)) return 3
  if (/\/login\b/i.test(url)) return 1
  if (REG_RE.test(`${title} ${url}`)) return 2
  return 0
}
export function pickRegistrationUrl(links = [], website) {
  let best = null, bestScore = 0
  for (const l of links) {
    const sc = registrationScore(l.title, l.url)
    if (sc > bestScore) { best = l.url; bestScore = sc }
  }
  if (best) return best
  if (website && registrationScore('', website) >= 2) return website
  return null
}

function isVirtualFrom(locationName = '', hasLivestream = 0, description = '') {
  if (hasLivestream) return true
  return /\b(virtual|zoom|online|remote|webinar|teams meeting|google meet)\b/i.test(`${locationName} ${description.slice(0, 200)}`)
}

function cleanText(s) { return (s || '').replace(/\r\n/g, '\n').trim() }

// ── UMich `?v=2` flat array ──────────────────────────────────────────────────
function normalizeUmichItem(it, ctx) {
  const tz = isValidTimeZone(it.time_zone) ? it.time_zone : ctx.timezone
  const startParts = parseCompactLocal(it.datetime_start || `${it.date_start}T${it.time_start || '00:00:00'}`)
  if (!startParts) return null
  const hasTime = !!(it.time_start && it.time_start !== '00:00:00') || /T\d{6}$/.test(it.datetime_start || '')
  const allDay = !hasTime
  const startsAt = localToIso(startParts, tz)
  const endParts = it.has_end_time ? parseCompactLocal(it.datetime_end || '') : null
  const endsAt = endParts ? localToIso(endParts, tz) : null
  const title = cleanText(it.combined_title || it.event_title)
  const kind = classifyKind(title, it.event_type)
  const employerName = extractEmployer(title, kind)
  const location = [it.building_name || it.location_name, it.room].filter(Boolean).join(' ').trim() || cleanText(it.location_name)
  const permalink = (it.permalink || '').replace(/^http:/, 'https:')
  return {
    kind, title, description: cleanText(it.description), location,
    isVirtual: isVirtualFrom(it.location_name, it.has_livestream, it.description),
    startsAt, endsAt, allDay, timezone: tz,
    url: permalink || null,
    registrationUrl: pickRegistrationUrl(it.links, it.website),
    registrationDeadline: null,
    employerName,
    sourceKind: KIND,
    sourceRef: String(it.id || it.guid || permalink),
    sourceHost: hostOf(permalink) || hostOf(it.guid?.split('@')[1] ? `https://${it.guid.split('@')[1]}` : ''),
    dedupKey: dedupKey({ title, employerName, startsAt }),
    confidence: 1,
    tags: it.tags || [],
    modifiedAt: it.datetime_modified || null,
  }
}

// ── Standard Localist API v2 ─────────────────────────────────────────────────
function normalizeApi2Event(wrapper, ctx) {
  const ev = wrapper?.event || wrapper
  if (!ev?.title) return []
  const instances = (ev.event_instances || []).map(w => w.event_instance || w).filter(Boolean)
  const type = (ev.filters?.event_types || []).map(t => t.name).join(' ')
  const title = cleanText(ev.title)
  const kind = classifyKind(title, type)
  const employerName = extractEmployer(title, kind)
  const links = [ev.url && { title: 'website', url: ev.url }, ev.ticket_url && { title: 'register', url: ev.ticket_url }].filter(Boolean)
  return instances.map(inst => {
    const startsAt = inst.start ? new Date(inst.start).toISOString() : null
    if (!startsAt || Number.isNaN(Date.parse(startsAt))) return null
    return {
      kind, title, description: cleanText(ev.description_text || ev.description),
      location: [ev.location_name, ev.room_number].filter(Boolean).join(' ').trim(),
      isVirtual: !!ev.experience && /virtual|hybrid/i.test(ev.experience) || isVirtualFrom(ev.location_name, 0, ev.description_text),
      startsAt, endsAt: inst.end ? new Date(inst.end).toISOString() : null, allDay: !!inst.all_day,
      timezone: ctx.timezone,
      url: ev.localist_url || null,
      registrationUrl: pickRegistrationUrl(links, ev.url),
      registrationDeadline: null,
      employerName,
      sourceKind: KIND,
      sourceRef: `${ev.id}-${inst.id}`,
      sourceHost: hostOf(ev.localist_url),
      dedupKey: dedupKey({ title, employerName, startsAt }),
      confidence: 1,
      tags: [...(ev.keywords || []), ...(ev.tags || [])],
      modifiedAt: ev.updated_at || null,
    }
  }).filter(Boolean)
}

function hostOf(u) { try { return new URL(u).host } catch { return null } }

export function detectShape(payload) {
  if (Array.isArray(payload) && (payload.length === 0 || 'event_title' in payload[0] || 'datetime_start' in payload[0])) return 'umich'
  if (payload && Array.isArray(payload.events)) return 'api2'
  return null
}

// payload: parsed JSON from feedUrl() · ctx: { timezone } (school default)
// → { drafts: EventDraft[], shape, rejected: number }
export function normalize(payload, ctx = { timezone: 'UTC' }) {
  const shape = detectShape(payload)
  if (!shape) return { drafts: [], shape: null, rejected: 0 }
  let drafts = []
  let rejected = 0
  if (shape === 'umich') {
    for (const it of payload) { const d = normalizeUmichItem(it, ctx); d ? drafts.push(d) : rejected++ }
  } else {
    for (const w of payload.events) drafts.push(...normalizeApi2Event(w, ctx))
  }
  return { drafts, shape, rejected }
}

export default { kind: KIND, feedUrl, feedHost, normalize, detectShape }
