// Column model for the Pipeline → Sheet view. One list drives the on-screen grid,
// inline editing (`edit` = how the cell is edited + which updateApplication field it
// writes) and the .xlsx / .csv exports, so the file always matches the screen.
import { STAGE_ORDER, TERMINAL_STAGES, INTERVIEW_STAGES, isUntriaged } from '../shared.jsx'
import { buildXlsx } from './xlsx.js'
import { todayLocal } from './dates.js'
import { recentStageChange } from './stageHistory.js'

export const TRIAGE_OPTIONS = ['Needs Review', 'Applying', 'Maybe', 'Applied', 'Pass']

// Where an application came from — no column stores this, so it's derived: an explicit
// referral wins, then a Job Boards import, else it was added directly / by the pipeline.
export function appSource(app) {
  if (app.referredById) return 'Referral'
  if (app.sourceRepo) return 'Job board'
  return 'Direct'
}

export const SHEET_COLUMNS = [
  { id: 'company',      header: 'Company',        type: 'string',  width: 22, sticky: true, edit: { kind: 'text', field: 'company' } },
  { id: 'role',         header: 'Role',           type: 'string',  width: 30, edit: { kind: 'text', field: 'role' } },
  { id: 'stage',        header: 'Stage',          type: 'string',  width: 14, edit: { kind: 'select', field: 'stage', options: () => STAGE_ORDER } },
  { id: 'appliedDate',  header: 'Applied',        type: 'date',    width: 12, edit: { kind: 'date', field: 'appliedDate' } },
  { id: 'daysInStage',  header: 'Days in stage',  type: 'number',  width: 8 },
  { id: 'stageChangedAt', header: 'Stage updated', type: 'date',   width: 12, get: a => a.stageChangedAt },
  { id: 'oaDueDate',    header: 'OA due',         type: 'date',    width: 12, edit: { kind: 'date', field: 'oaDueDate' } },
  { id: 'oaCompleted',  header: 'OA done',        type: 'boolean', width: 8,  edit: { kind: 'toggle', field: 'oaCompleted' } },
  { id: 'referredBy',   header: 'Referred by',    type: 'string',  width: 18,
    get: (a, ctx) => (a.referredById && ctx.contactsById.get(a.referredById)?.name) || '',
    edit: { kind: 'contact', field: 'referredById' } },
  { id: 'source',       header: 'Source',         type: 'string',  width: 11, get: appSource },
  { id: 'location',     header: 'Location',       type: 'string',  width: 18, edit: { kind: 'text', field: 'location' } },
  { id: 'triage',       header: 'Triage',         type: 'string',  width: 13, edit: { kind: 'select', field: 'triage', options: () => TRIAGE_OPTIONS } },
  { id: 'closedDate',   header: 'Closed',         type: 'date',    width: 12, edit: { kind: 'date', field: 'closedDate' } },
  { id: 'lastActivity', header: 'Last activity',  type: 'date',    width: 12 },
  { id: 'jdLink',       header: 'JD link',        type: 'link',    width: 36, edit: { kind: 'text', field: 'jdLink' } },
  { id: 'notes',        header: 'Notes',          type: 'string',  width: 40, edit: { kind: 'text', field: 'notes', long: true } },
  { id: 'createdTime',  header: 'Added',          type: 'date',    width: 12 },
]

export const DEFAULT_HIDDEN = ['stageChangedAt', 'triage', 'closedDate', 'lastActivity', 'createdTime']

export function cellValue(col, app, ctx) {
  return col.get ? col.get(app, ctx) : app[col.id]
}

export function makeContext(contacts = []) {
  return { contactsById: new Map(contacts.map(c => [c.id, c])) }
}

function exportName(ext) {
  return `applications-${todayLocal()}.${ext}`
}

export function applicationsToXlsx(apps, columns, ctx, now) {
  return {
    filename: exportName('xlsx'),
    bytes: buildXlsx({
      sheetName: 'Applications',
      columns: columns.map(c => ({ header: c.header, type: c.type, width: c.width })),
      rows: apps.map(a => columns.map(c => cellValue(c, a, ctx))),
      now,
    }),
  }
}

const csvCell = v => {
  const s = v === null || v === undefined ? '' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function applicationsToCsv(apps, columns, ctx) {
  const lines = [columns.map(c => csvCell(c.header)).join(',')]
  for (const a of apps) lines.push(columns.map(c => {
    const v = cellValue(c, a, ctx)
    return csvCell(c.type === 'date' && v ? String(v).slice(0, 10) : v)
  }).join(','))
  return { filename: exportName('csv'), text: lines.join('\r\n') }
}

// Fields that follow from a stage edit, mirroring what the email pipeline and Job Boards
// already do: leaving Wishlist means you applied (stamp the date once, mark triage
// Applied); Rejected/Accepted close it; reopening a closed one clears the close date.
export function stageSideEffects(app, stage, today = todayLocal()) {
  const out = {}
  if (stage !== 'Wishlist') {
    if (!app.appliedDate) out.appliedDate = today
    if (app.triage !== 'Applied') out.triage = 'Applied'
  }
  if (TERMINAL_STAGES.includes(stage)) { if (!app.closedDate) out.closedDate = today }
  else if (app.closedDate) out.closedDate = null
  return out
}

export const SHEET_FILTERS = [
  { key: 'applied',      label: 'Applied',      test: a => a.stage !== 'Wishlist' },
  { key: 'open',         label: 'In process',   test: a => a.stage !== 'Wishlist' && !TERMINAL_STAGES.includes(a.stage) },
  { key: 'interviewing', label: 'Interviewing', test: a => INTERVIEW_STAGES.includes(a.stage) || a.stage === 'Offer' },
  { key: 'closed',       label: 'Closed',       test: a => TERMINAL_STAGES.includes(a.stage) },
  { key: 'planning',     label: 'Planning',     test: a => a.stage === 'Wishlist' && !isUntriaged(a) },
  { key: 'recent',       label: 'Moved · 48h',  test: a => !!recentStageChange(a) },
  { key: 'all',          label: 'Everything',   test: () => true },
]

// Sort comparator for a column; empty values always sink to the bottom.
export function compareBy(col, ctx, desc) {
  const rank = col.id === 'stage' ? v => STAGE_ORDER.indexOf(v) : null
  return (a, b) => {
    let va = cellValue(col, a, ctx), vb = cellValue(col, b, ctx)
    const ea = va === null || va === undefined || va === '', eb = vb === null || vb === undefined || vb === ''
    if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1
    if (rank) { va = rank(va); vb = rank(vb) }
    else if (col.type === 'boolean') { va = va ? 1 : 0; vb = vb ? 1 : 0 }
    else if (col.type !== 'number') { va = String(va).toLowerCase(); vb = String(vb).toLowerCase() }
    const r = va < vb ? -1 : va > vb ? 1 : 0
    return desc ? -r : r
  }
}
