// Day plan for a multi-employer event (career fair): which booths to hit, in what order,
// inside the free windows conflictsForEvent() found. Pure — the panel renders it.
//
// Priority mirrors eventRelevance.js's employer signals, most actionable first: an
// application already at interview stage, any other live application, a target company,
// a company where you know someone, then everyone else.
import { normalizeCompanyName } from './networkGraph.js'

const INTERVIEW = new Set(['Phone Screen', 'Technical', 'Onsite', 'Offer'])
const RANK = { interviewing: 0, applied: 1, target: 2, contact: 3, other: 4 }

export function boothRoute(event, { employers = [], targets = [], apps = [], contacts = [] } = {}) {
  const byId = new Map(employers.map(e => [e.id, e]))
  const ids = [...new Set([...(event?.attributes?.employerIds || []), ...(event?.employerId ? [event.employerId] : [])])]
  const targetSet = new Set(targets.map(normalizeCompanyName))
  const liveApps = new Map()
  for (const a of apps) {
    if (!a.company || ['Rejected', 'Accepted', 'Wishlist'].includes(a.stage)) continue
    const n = normalizeCompanyName(a.company)
    if (!liveApps.has(n) || INTERVIEW.has(a.stage)) liveApps.set(n, a)
  }
  const people = new Map()
  for (const c of contacts) {
    if (!c.company) continue
    const n = normalizeCompanyName(c.company)
    people.set(n, [...(people.get(n) || []), c.name])
  }

  const stops = ids.filter(id => byId.has(id)).map(id => {
    const name = byId.get(id).name
    const n = normalizeCompanyName(name)
    const app = liveApps.get(n)
    const known = people.get(n) || []
    const reasons = []
    if (app) reasons.push(`${app.stage} stage`)
    if (targetSet.has(n)) reasons.push('target company')
    if (known.length) reasons.push(`you know ${known.length === 1 ? known[0] : `${known.length} people`}`)
    const priority = app ? (INTERVIEW.has(app.stage) ? 'interviewing' : 'applied')
      : targetSet.has(n) ? 'target' : known.length ? 'contact' : 'other'
    return { employerId: id, name, priority, reasons, contacts: known }
  })
  return stops.sort((a, b) => RANK[a.priority] - RANK[b.priority] || a.name.localeCompare(b.name))
}

// Packs the route into free fragments ({ start, end, minutes }) in time order,
// `minutesPerBooth` each. Booths that don't fit go to `overflow` (lowest priority last).
export function planDay(route, fragments, { minutesPerBooth = 10 } = {}) {
  const queue = [...route]
  const blocks = []
  const ordered = [...(fragments || [])].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  for (const f of ordered) {
    const slots = Math.floor(f.minutes / minutesPerBooth)
    if (!slots || !queue.length) continue
    const booths = queue.splice(0, slots).map((b, i) => ({
      ...b, at: new Date(Date.parse(f.start) + i * minutesPerBooth * 60000).toISOString(),
    }))
    blocks.push({ fragment: f, booths })
  }
  return { blocks, overflow: queue }
}

// Prefill for "met someone here": the meeting is dated on the event's local day, and
// the follow-up lands three days later.
export function captureDefaults(event, { followUpDays = 3 } = {}) {
  const tz = event.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(event.startsAt))
  const [y, m, d] = day.split('-').map(Number)
  const follow = new Date(Date.UTC(y, m - 1, d + followUpDays)).toISOString().slice(0, 10)
  return { date: day, followUpDate: follow, notes: `Met at ${event.title}.` }
}
