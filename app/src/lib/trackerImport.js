// Bring your existing data in (v1.4 spec 01): a spreadsheet application tracker → Pipeline, and
// LinkedIn's Connections.csv → Network. Pure parsing, no AI and no key: headers are matched by
// synonym, statuses by keyword, and anything that can't be read is counted as skipped, never
// guessed. The caller previews the result, then writes it through db.js's batch inserts.

import { parseCsvRows } from './csv.js'
import { parseLooseDate, todayLocal } from './dates.js'
import { normalizeCompanyName } from './networkGraph.js'
import { roleToOption } from './discovery.js'

export const MAX_IMPORT_ROWS = 3000
export { IMPORTED_CONNECTION_SOURCE, isUntouchedImport } from './keepInTouch.js'

const norm = s => String(s ?? '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
const clip = (v, max) => String(v ?? '').trim().slice(0, max)

// Exact header names first, then whole-word containment, each column claimed once — so a
// "Date Applied" column isn't taken by a shorter alias meant for another field.
function mapHeaders(headers, fields) {
  const hs = headers.map(norm)
  const idx = {}
  const taken = new Set()
  for (const [field, aliases] of Object.entries(fields)) {
    const i = hs.findIndex((h, j) => !taken.has(j) && aliases.includes(h))
    if (i >= 0) { idx[field] = i; taken.add(i) }
  }
  for (const [field, aliases] of Object.entries(fields)) {
    if (idx[field] != null) continue
    const i = hs.findIndex((h, j) => !taken.has(j) && aliases.some(a => ` ${h} `.includes(` ${a} `)))
    if (i >= 0) { idx[field] = i; taken.add(i) }
  }
  return idx
}

// ── Application tracker ──────────────────────────────────────────────────────────────

const TRACKER_FIELDS = {
  company: ['company', 'firm', 'employer', 'organization', 'company name', 'bank', 'fund'],
  role: ['role', 'position', 'title', 'job', 'job title', 'program', 'role title'],
  stage: ['status', 'stage', 'application status', 'result', 'progress', 'outcome'],
  appliedDate: ['date applied', 'applied date', 'applied', 'applied on', 'date', 'submitted', 'date submitted'],
  jdLink: ['link', 'url', 'job link', 'posting', 'posting link', 'application link', 'job posting', 'jd'],
  location: ['location', 'city', 'office'],
  notes: ['notes', 'note', 'comments', 'next steps'],
}

// Ordered: the first pattern that matches wins, so "no offer" is a rejection, not an offer.
const STAGE_RULES = [
  ['Rejected', /\b(reject|declined by|no offer|not (selected|moving)|unsuccessful|ding|denied|closed|withdr[ae]w)/],
  ['Accepted', /\b(accept|signed|committed)/],
  ['Offer', /\boffer/],
  ['Onsite', /\b(onsite|on site|superday|super day|final|last round|third round|3rd round)/],
  ['Technical', /\b(technical|tech screen|coding|case interview|second round|2nd round|hirevue|modeling test)/],
  ['Phone Screen', /\b(phone|screen|first round|1st round|interview|recruiter call|hr call)/],
  ['Applied', /\b(applied|submitted|pending|waiting|in review|under review|oa|assessment|online test)/],
  ['Wishlist', /\b(wishlist|want|to apply|planning|interested|not applied|haven t applied|saved|todo|to do)/],
]

// Free-text status → a STAGE_ORDER value. Blank or unrecognized: Applied if the row has an
// applied date, else Wishlist.
export function normalizeStage(text, { applied = false } = {}) {
  const s = norm(text)
  if (s) for (const [stage, re] of STAGE_RULES) if (re.test(s)) return stage
  return applied ? 'Applied' : 'Wishlist'
}

const appKey = (company, role) => `${normalizeCompanyName(company || '')}|${norm(role)}`

// CSV/TSV text → { rows, skipped, duplicates, mapping, headers, error? }. rows are
// { company, role, stage, appliedDate, jdLink, location, notes }. A row needs a company;
// rows matching an existing app (or an earlier row) on company + role are counted as duplicates.
export function parseTrackerCsv(text, { existingApps = [], today = todayLocal() } = {}) {
  const all = parseCsvRows(text)
  if (all.length < 2) return { rows: [], skipped: 0, duplicates: 0, mapping: {}, error: 'Nothing to import: paste a header row and at least one application.' }
  const headers = all[0]
  const mapping = mapHeaders(headers, TRACKER_FIELDS)
  if (mapping.company == null) return { rows: [], skipped: all.length - 1, duplicates: 0, mapping, headers, error: 'Need a company column (Company, Firm, Employer…).' }
  const cell = (cells, f) => (mapping[f] != null ? cells[mapping[f]] ?? '' : '')
  const seen = new Set(existingApps.map(a => appKey(a.company, a.role)))
  const rows = []
  let skipped = 0, duplicates = 0
  for (const cells of all.slice(1, MAX_IMPORT_ROWS + 1)) {
    const company = clip(cell(cells, 'company'), 120)
    if (!company) { skipped++; continue }
    const role = clip(cell(cells, 'role'), 160)
    const key = appKey(company, role)
    if (seen.has(key)) { duplicates++; continue }
    seen.add(key)
    const appliedDate = parseLooseDate(cell(cells, 'appliedDate'), today)
    const link = clip(cell(cells, 'jdLink'), 500)
    rows.push({
      company,
      role,
      stage: normalizeStage(cell(cells, 'stage'), { applied: !!appliedDate }),
      appliedDate,
      jdLink: /^https?:\/\//i.test(link) ? link : '',
      location: clip(cell(cells, 'location'), 120),
      notes: clip(cell(cells, 'notes'), 2000),
    })
  }
  skipped += Math.max(0, all.length - 1 - MAX_IMPORT_ROWS)
  return { rows, skipped, duplicates, mapping, headers }
}

// ── LinkedIn connections ─────────────────────────────────────────────────────────────

const LINKEDIN_FIELDS = {
  first: ['first name'],
  last: ['last name'],
  linkedin: ['url', 'profile url'],
  email: ['email address', 'email'],
  company: ['company'],
  title: ['position', 'title'],
  connectedOn: ['connected on'],
}

const profileKey = url => String(url || '').trim().toLowerCase()
  .replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '')
const personKey = (name, company) => `${norm(name)}|${normalizeCompanyName(company || '')}`

// Connections.csv text → { rows, skipped, duplicates, error? }. rows are
// { name, company, title, email, linkedin, connectedOn, role }. LinkedIn puts a few "Notes:"
// lines above the real header, so everything before "First Name,…" is ignored.
export function parseLinkedInCsv(text, { existingContacts = [], today = todayLocal() } = {}) {
  const all = parseCsvRows(text)
  const h = all.findIndex(r => norm(r[0]) === 'first name')
  if (h < 0) return { rows: [], skipped: 0, duplicates: 0, error: 'This doesn\'t look like LinkedIn\'s Connections.csv (it needs a "First Name, Last Name, URL…" header).' }
  const mapping = mapHeaders(all[h], LINKEDIN_FIELDS)
  const cell = (cells, f) => (mapping[f] != null ? cells[mapping[f]] ?? '' : '')
  const seenUrls = new Set(existingContacts.map(c => profileKey(c.linkedin)).filter(Boolean))
  const seenPeople = new Set(existingContacts.map(c => personKey(c.name, c.company)))
  const rows = []
  let skipped = 0, duplicates = 0
  for (const cells of all.slice(h + 1, h + 1 + MAX_IMPORT_ROWS)) {
    const name = clip(`${cell(cells, 'first')} ${cell(cells, 'last')}`, 120)
    if (!name) { skipped++; continue }
    const company = clip(cell(cells, 'company'), 120)
    const url = clip(cell(cells, 'linkedin'), 300)
    const uk = profileKey(url)
    const pk = personKey(name, company)
    if ((uk && seenUrls.has(uk)) || seenPeople.has(pk)) { duplicates++; continue }
    if (uk) seenUrls.add(uk)
    seenPeople.add(pk)
    const title = clip(cell(cells, 'title'), 160)
    rows.push({
      name, company, title,
      email: clip(cell(cells, 'email'), 200),
      linkedin: /^https?:\/\//i.test(url) ? url : '',
      connectedOn: parseLooseDate(cell(cells, 'connectedOn'), today),
      role: roleToOption(title),
    })
  }
  return { rows, skipped, duplicates }
}
