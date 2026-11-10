// Location normalization for jobs and applications. Raw `location` strings are free text
// (typed by hand, imported from trackers, or scraped from GitHub boards where one cell can
// hold "San Francisco, CA, New York, NY, 3 locations"), so filtering and grouping key off
// regions instead: one stable label per metro ("Bay Area", "New York", "Remote"), with
// unknown cities kept as themselves. A listing can belong to several regions.

export const UNSPECIFIED = 'No location'

// Region → patterns matched against one comma/semicolon-separated token (lowercased).
const REGIONS = [
  ['Remote',        /\bremote\b|\banywhere\b|\bwfh\b|work from home/],
  ['Bay Area',      /^(sf|sfo|bay area|sf bay area|san francisco( bay area)?|south san francisco|palo alto|mountain view|menlo park|sunnyvale|san jose|santa clara|cupertino|redwood city|redwood shores|san mateo|foster city|fremont|oakland|berkeley|emeryville|burlingame|san bruno|milpitas|los gatos|silicon valley)$/],
  ['New York',      /^(ny|nyc|new york( city)?|manhattan|brooklyn|jersey city|hoboken)$/],
  ['Seattle',       /^(seattle|bellevue|redmond|kirkland)$/],
  ['Los Angeles',   /^(la|los angeles|santa monica|culver city|playa vista|venice|pasadena|irvine|el segundo|hawthorne)$/],
  ['Boston',        /^(boston|cambridge|somerville|waltham)$/],
  ['Washington DC', /^(washington dc|dc|arlington|mclean|reston|herndon|tysons)$/],
  ['Chicago',       /^chicago$/],
  ['Austin',        /^austin$/],
  ['Denver',        /^(denver|boulder)$/],
  ['Atlanta',       /^atlanta$/],
  ['San Diego',     /^san diego$/],
]

const US_STATES = 'al ak az ar ca co ct de fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy'.split(' ')
const STATE_NAMES = ['alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware', 'florida', 'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire', 'new jersey', 'new mexico', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming']
const PROVINCES = ['on', 'bc', 'qc', 'ab', 'mb', 'ns', 'ontario', 'british columbia', 'quebec', 'alberta']
const COUNTRIES = ['us', 'usa', 'u.s.', 'u.s.a.', 'united states', 'united states of america', 'canada', 'uk', 'united kingdom', 'england', 'india', 'germany', 'ireland', 'france', 'netherlands', 'israel', 'singapore', 'japan', 'australia', 'mexico', 'switzerland', 'spain', 'poland']
// Tokens that say nothing about place. "NY" and "LA" are aliases first, so they never reach this.
const NOISE = new Set([...US_STATES, ...STATE_NAMES, ...PROVINCES, ...COUNTRIES, 'hybrid', 'onsite', 'on-site', 'in-office', 'in office', 'multiple locations', 'various', 'tbd', 'n/a', 'na'])

const titleCase = s => s.replace(/\b([a-z])/g, c => c.toUpperCase())

function tokenRegion(raw) {
  // "(Hybrid)", "Remote in USA", "USA (Remote)" — parens become plain words first.
  const t = raw.toLowerCase().replace(/[()[\]]/g, ' ').replace(/\s+/g, ' ').trim().replace(/\.$/, '')
  if (!t) return null
  for (const [region, re] of REGIONS) if (re.test(t)) return region
  // "Boston Hybrid" / "Austin onsite": drop a trailing work-style word, then retry.
  const stripped = t.replace(/\s+(hybrid|onsite|on-site|in office)$/, '').trim()
  if (stripped !== t) return tokenRegion(stripped)
  if (NOISE.has(t) || /^\d+\s*(more\s+)?locations?$/.test(t) || /^\+?\d+$/.test(t)) return null
  return titleCase(t)
}

const cache = new Map()

// Every region a free-text location belongs to, in the order they first appear.
export function locationRegions(location) {
  const key = (location || '').trim()
  if (cache.has(key)) return cache.get(key)
  const text = key
    .replace(/washington,?\s*d\.?\s*c\.?/gi, 'Washington DC')
    .replace(/\b(\w+)\s+or\s+(\w+)/gi, '$1, $2')
  const out = []
  for (const token of text.split(/[,;|\n•·/]+/)) {
    const region = tokenRegion(token)
    if (region && !out.includes(region)) out.push(region)
  }
  const result = out.length ? out : [UNSPECIFIED]
  if (cache.size > 5000) cache.clear()
  cache.set(key, result)
  return result
}

export const primaryRegion = location => locationRegions(location)[0]

// True when nothing is selected, or the location falls in any selected region.
export function matchesRegions(location, selected) {
  if (!selected?.length) return true
  return locationRegions(location).some(r => selected.includes(r))
}

const byCount = ([a, n], [b, m]) =>
  (a === UNSPECIFIED) - (b === UNSPECIFIED) || m - n || a.localeCompare(b)

// [[region, count]] over items with a `location` field, most common first, Unspecified last.
export function regionCounts(items, getLocation = i => i.location) {
  const counts = new Map()
  for (const item of items) for (const r of locationRegions(getLocation(item))) counts.set(r, (counts.get(r) || 0) + 1)
  return [...counts].sort(byCount)
}

// [{ region, items }] in regionCounts order. Multi-location items appear in each of their
// regions; `only` keeps just those regions (so a filtered view doesn't show stray groups).
export function groupByRegion(items, only = [], getLocation = i => i.location) {
  const groups = new Map()
  for (const item of items) {
    for (const r of locationRegions(getLocation(item))) {
      if (only.length && !only.includes(r)) continue
      if (!groups.has(r)) groups.set(r, [])
      groups.get(r).push(item)
    }
  }
  return [...groups].map(([region, list]) => [region, list.length, list]).sort(byCount)
    .map(([region, , list]) => ({ region, items: list }))
}
