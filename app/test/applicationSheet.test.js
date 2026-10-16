import { describe, it, expect } from 'vitest'
import { crc32, columnName, excelDate, buildXlsx } from '../src/lib/xlsx.js'
import { SHEET_COLUMNS, appSource, makeContext, applicationsToCsv, applicationsToXlsx, cellValue, stageSideEffects, compareBy } from '../src/lib/applicationSheet.js'

// Reads a stored (uncompressed) zip back into { name: text } via its central directory.
function unzipStored(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const dec = new TextDecoder()
  let end = bytes.length - 22
  expect(dv.getUint32(end, true)).toBe(0x06054b50)
  const count = dv.getUint16(end + 10, true)
  let p = dv.getUint32(end + 16, true)
  const out = {}
  for (let i = 0; i < count; i++) {
    expect(dv.getUint32(p, true)).toBe(0x02014b50)
    const crc = dv.getUint32(p + 16, true)
    const size = dv.getUint32(p + 24, true)
    const nameLen = dv.getUint16(p + 28, true)
    const local = dv.getUint32(p + 42, true)
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen))
    const dataStart = local + 30 + dv.getUint16(local + 26, true)
    const data = bytes.subarray(dataStart, dataStart + size)
    expect(crc32(data)).toBe(crc)
    out[name] = dec.decode(data)
    p += 46 + nameLen
  }
  return out
}

describe('xlsx primitives', () => {
  it('crc32 matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })
  it('column names roll over like Excel', () => {
    expect([0, 25, 26, 27, 51, 52, 701, 702].map(columnName)).toEqual(['A', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA'])
  })
  it('dates become 1900-system serials by calendar day', () => {
    expect(excelDate('1900-03-01')).toBe(61)
    expect(excelDate('2026-10-16')).toBe(46311)
    expect(excelDate(null)).toBe(null)
  })
})

describe('buildXlsx', () => {
  const bytes = buildXlsx({
    sheetName: 'Apps',
    columns: [{ header: 'Company', type: 'string' }, { header: 'Applied', type: 'date' }, { header: 'Days', type: 'number' }, { header: 'JD', type: 'link' }, { header: 'OA', type: 'boolean' }],
    rows: [['Ben & Jerry\'s <Intern>', '2026-10-16', 3, 'https://x.com/a?b="c"', true], ['Bad\u0001Char', null, null, 'not a url', false]],
    now: new Date(2026, 9, 16, 9, 30),
  })
  const files = unzipStored(bytes)

  it('has every part Excel needs', () => {
    expect(Object.keys(files).sort()).toEqual(['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml'])
  })
  it('escapes text, types cells, and freezes + filters the header', () => {
    const sheet = files['xl/worksheets/sheet1.xml']
    expect(sheet).toContain('Ben &amp; Jerry&apos;s'.replace('&apos;', "'") + ' &lt;Intern&gt;')
    expect(sheet).toContain('<c r="B2" s="2"><v>46311</v></c>')
    expect(sheet).toContain('<c r="C2"><v>3</v></c>')
    expect(sheet).toContain('HYPERLINK(&quot;https://x.com/a?b=&quot;&quot;c&quot;&quot;')
    expect(sheet).toContain('<c r="E2" t="inlineStr"><is><t>Yes</t></is></c>')
    expect(sheet).toContain('BadChar')
    expect(sheet).not.toMatch(/<c r="B3"/)
    expect(sheet).toContain('<t xml:space="preserve">not a url</t>')
    expect(sheet).toContain('state="frozen"')
    expect(sheet).toContain('<autoFilter ref="A1:E3"/>')
    expect(files['xl/workbook.xml']).toContain('<sheet name="Apps"')
  })
})

describe('application sheet model', () => {
  const contacts = [{ id: 'c1', name: 'Priya Shah' }]
  const ctx = makeContext(contacts)
  const apps = [
    { id: 'a1', company: 'Stripe', role: 'SWE, "Infra"', stage: 'Phone Screen', appliedDate: '2026-09-01', referredById: 'c1', sourceRepo: 'x/y', oaCompleted: true, stageChangedAt: '2026-10-11T13:00:00Z', notes: 'line1\nline2' },
    { id: 'a2', company: 'Ramp', role: 'SWE', stage: 'Applied', sourceRepo: 'SimplifyJobs/Summer2027', oaCompleted: false },
    { id: 'a3', company: 'Figma', stage: 'Wishlist' },
  ]

  it('derives source with referral taking precedence', () => {
    expect(apps.map(appSource)).toEqual(['Referral', 'Job board', 'Direct'])
  })
  it('resolves the referrer name', () => {
    expect(cellValue(SHEET_COLUMNS.find(c => c.id === 'referredBy'), apps[0], ctx)).toBe('Priya Shah')
  })
  it('every editable column names a real updateApplication field', () => {
    const allowed = ['company', 'role', 'location', 'jdLink', 'notes', 'stage', 'appliedDate', 'closedDate', 'referredById', 'oaDueDate', 'oaLink', 'oaCompleted', 'triage']
    for (const c of SHEET_COLUMNS.filter(c => c.edit)) expect(allowed, c.id).toContain(c.edit.field)
  })
  it('csv quotes commas, quotes and newlines and trims timestamps to days', () => {
    const cols = SHEET_COLUMNS.filter(c => ['company', 'role', 'stageChangedAt', 'oaCompleted', 'notes'].includes(c.id))
    const { text } = applicationsToCsv(apps.slice(0, 1), cols, ctx)
    expect(text).toBe('Company,Role,Stage updated,OA done,Notes\r\nStripe,"SWE, ""Infra""",2026-10-11,Yes,"line1\nline2"')
  })
  it('xlsx export carries the visible columns', () => {
    const cols = SHEET_COLUMNS.filter(c => ['company', 'stage'].includes(c.id))
    const { filename, bytes } = applicationsToXlsx(apps, cols, ctx)
    expect(filename).toMatch(/^applications-\d{4}-\d{2}-\d{2}\.xlsx$/)
    const sheet = unzipStored(bytes)['xl/worksheets/sheet1.xml']
    expect(sheet).toContain('<autoFilter ref="A1:B4"/>')
    expect(sheet).toContain('Phone Screen')
  })
})

describe('stageSideEffects', () => {
  const T = '2026-10-16'
  it('leaving Wishlist stamps applied date + triage once', () => {
    expect(stageSideEffects({ stage: 'Wishlist', triage: 'Maybe' }, 'Applied', T)).toEqual({ appliedDate: T, triage: 'Applied' })
    expect(stageSideEffects({ stage: 'Applied', triage: 'Applied', appliedDate: '2026-09-01' }, 'Phone Screen', T)).toEqual({})
  })
  it('closing stamps closed date; reopening clears it', () => {
    expect(stageSideEffects({ triage: 'Applied', appliedDate: '2026-09-01' }, 'Rejected', T)).toEqual({ closedDate: T })
    expect(stageSideEffects({ triage: 'Applied', appliedDate: '2026-09-01', closedDate: '2026-10-01' }, 'Onsite', T)).toEqual({ closedDate: null })
  })
  it('moving back to Wishlist leaves dates alone', () => {
    expect(stageSideEffects({ triage: 'Applied', appliedDate: '2026-09-01' }, 'Wishlist', T)).toEqual({})
  })
})

describe('compareBy', () => {
  const ctx = makeContext()
  const col = id => SHEET_COLUMNS.find(c => c.id === id)
  it('sorts stages by pipeline order and sinks blanks', () => {
    const rows = [{ stage: 'Offer' }, { stage: '' }, { stage: 'Applied' }, { stage: 'Onsite' }]
    expect(rows.slice().sort(compareBy(col('stage'), ctx, false)).map(r => r.stage)).toEqual(['Applied', 'Onsite', 'Offer', ''])
    expect(rows.slice().sort(compareBy(col('stage'), ctx, true)).map(r => r.stage)).toEqual(['Offer', 'Onsite', 'Applied', ''])
  })
  it('sorts numbers numerically and text case-insensitively', () => {
    expect([{ daysInStage: 10 }, { daysInStage: 9 }, { daysInStage: null }].sort(compareBy(col('daysInStage'), ctx, false)).map(r => r.daysInStage)).toEqual([9, 10, null])
    expect([{ company: 'stripe' }, { company: 'Anthropic' }].sort(compareBy(col('company'), ctx, false)).map(r => r.company)).toEqual(['Anthropic', 'stripe'])
  })
})
