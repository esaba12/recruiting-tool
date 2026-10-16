// Minimal .xlsx writer — one sheet, typed cells, bold frozen header, autofilter,
// column widths, dates as real Excel dates, links as HYPERLINK formulas.
//
// An .xlsx is a zip of a few XML parts. Entries are STORED (uncompressed), so the
// whole writer is CRC-32 + zip headers + XML templates: no dependency, nothing to
// lazy-load, and it runs under the app's strict CSP. A few hundred applications
// export to well under 1 MB uncompressed.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// Stored zip. files: [{ name, data: Uint8Array }]
export function zipStore(files, now = new Date()) {
  const enc = new TextEncoder()
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  const locals = [], centrals = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.name)
    const crc = crc32(f.data)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)          // version needed
    local.setUint16(6, 0x0800, true)      // UTF-8 names
    local.setUint16(8, 0, true)           // stored
    local.setUint16(10, dosTime, true)
    local.setUint16(12, dosDate, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, f.data.length, true)
    local.setUint32(22, f.data.length, true)
    local.setUint16(26, name.length, true)
    local.setUint16(28, 0, true)
    locals.push(new Uint8Array(local.buffer), name, f.data)

    const central = new DataView(new ArrayBuffer(46))
    central.setUint32(0, 0x02014b50, true)
    central.setUint16(4, 20, true)        // version made by
    central.setUint16(6, 20, true)
    central.setUint16(8, 0x0800, true)
    central.setUint16(10, 0, true)
    central.setUint16(12, dosTime, true)
    central.setUint16(14, dosDate, true)
    central.setUint32(16, crc, true)
    central.setUint32(20, f.data.length, true)
    central.setUint32(24, f.data.length, true)
    central.setUint16(28, name.length, true)
    central.setUint32(42, offset, true)   // remaining fields (extra/comment/disk/attrs) are 0
    centrals.push(new Uint8Array(central.buffer), name)

    offset += 30 + name.length + f.data.length
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)

  const parts = [...locals, ...centrals, new Uint8Array(end.buffer)]
  const out = new Uint8Array(parts.reduce((n, b) => n + b.length, 0))
  let p = 0
  for (const b of parts) { out.set(b, p); p += b.length }
  return out
}

export function columnName(i) {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

// 'YYYY-MM-DD' or a timestamp → Excel serial day (1900 date system), calendar day only.
export function excelDate(v) {
  if (!v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(typeof v === 'string' ? v : '')
  const d = m ? null : new Date(v)
  const [y, mo, day] = m ? [+m[1], +m[2] - 1, +m[3]] : [d.getFullYear(), d.getMonth(), d.getDate()]
  if (Number.isNaN(y)) return null
  return (Date.UTC(y, mo, day) - Date.UTC(1899, 11, 30)) / 86400000
}

const esc = s => String(s)
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Style ids (see STYLES): 0 normal, 1 header, 2 date, 3 link
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDEAE4"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF8A847A"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

function cellXml(ref, value, type) {
  if (value === null || value === undefined || value === '') return ''
  if (type === 'number' && Number.isFinite(Number(value))) return `<c r="${ref}"><v>${Number(value)}</v></c>`
  if (type === 'date') {
    const serial = excelDate(value)
    return serial === null ? '' : `<c r="${ref}" s="2"><v>${serial}</v></c>`
  }
  if (type === 'link') {
    const url = String(value)
    if (!/^https?:\/\//i.test(url) || url.length > 250) return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(url)}</t></is></c>`
    const f = `HYPERLINK("${url.replace(/"/g, '""')}","${url.replace(/"/g, '""')}")`
    return `<c r="${ref}" s="3" t="str"><f>${esc(f)}</f><v>${esc(url)}</v></c>`
  }
  // Yes/No text rather than t="b": real booleans render blank in some viewers (Quick Look).
  if (type === 'boolean') return `<c r="${ref}" t="inlineStr"><is><t>${value ? 'Yes' : 'No'}</t></is></c>`
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`
}

// columns: [{ header, type?: 'string'|'number'|'date'|'link'|'boolean', width? }]
// rows: arrays of values in column order.
export function buildXlsx({ sheetName = 'Sheet1', columns, rows, now }) {
  const name = esc(sheetName.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31))
  const lastCol = columnName(columns.length - 1)
  const lastRow = rows.length + 1
  const header = `<row r="1">${columns.map((c, i) => `<c r="${columnName(i)}1" s="1" t="inlineStr"><is><t>${esc(c.header)}</t></is></c>`).join('')}</row>`
  const body = rows.map((r, ri) => `<row r="${ri + 2}">${columns.map((c, ci) => cellXml(`${columnName(ci)}${ri + 2}`, r[ci], c.type)).join('')}</row>`).join('')
  const cols = `<cols>${columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 14}" customWidth="1"/>`).join('')}</cols>`

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="A1:${lastCol}${lastRow}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
${cols}<sheetData>${header}${body}</sheetData>
<autoFilter ref="A1:${lastCol}${lastRow}"/>
</worksheet>`

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets>
<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${name.replace(/'/g, "''")}'!$A$1:$${lastCol}$${lastRow}</definedName></definedNames>
</workbook>`

  const enc = new TextEncoder()
  const files = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`],
    ['xl/workbook.xml', workbook],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`],
    ['xl/worksheets/sheet1.xml', sheet],
    ['xl/styles.xml', STYLES],
  ].map(([n, xml]) => ({ name: n, data: enc.encode(xml) }))
  return zipStore(files, now)
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export function downloadBytes(bytes, filename, mime = XLSX_MIME) {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
