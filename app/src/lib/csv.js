// One CSV line → trimmed cells. Handles quoted cells ("a, b"), doubled quotes, and tabs
// (pasted spreadsheet rows). Shared by event import and the LeetCode company lists.
export function splitCsvLine(line) {
  const out = []; let cur = ''; let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') q = false; else cur += c }
    else if (c === '"') q = true
    else if (c === ',' || c === '\t') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out.map(s => s.trim())
}

// A whole CSV file → rows of trimmed cells, with quoted cells that span lines (a Notes column
// exported from Sheets). A first line containing a tab means pasted spreadsheet rows: split on
// tabs only, since those cells often contain commas. Blank rows are dropped.
export function parseCsvRows(text) {
  const src = String(text ?? '').replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const firstLine = src.slice(0, src.indexOf('\n') === -1 ? src.length : src.indexOf('\n'))
  const delim = firstLine.includes('\t') ? '\t' : ','
  const rows = []
  let row = [], cur = '', q = false
  const endCell = () => { row.push(cur.trim()); cur = '' }
  const endRow = () => { endCell(); if (row.some(c => c)) rows.push(row); row = [] }
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"' && !cur.trim()) q = true
    else if (c === delim) endCell()
    else if (c === '\n') endRow()
    else cur += c
  }
  if (cur || row.length) endRow()
  return rows
}
