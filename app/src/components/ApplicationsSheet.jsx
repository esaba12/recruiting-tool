import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { ArrowUpRight, Columns3, Download, Rows3, Search, Upload, Waypoints, X } from 'lucide-react'
import { addApplication, archiveApplication, updateApplication, updateApplicationTriage } from '../db.js'
import { BUCKET_TO_TRIAGE } from './jobBoards/helpers.js'
import { STAGE_ORDER, STAGE_COLOR, TERMINAL_STAGES, Badge, fmt } from '../shared.jsx'
import {
  SHEET_COLUMNS, DEFAULT_HIDDEN, SHEET_FILTERS, cellValue, makeContext, compareBy,
  stageSideEffects, applicationsToXlsx, applicationsToCsv,
} from '../lib/applicationSheet.js'
import { downloadBytes } from '../lib/xlsx.js'
import { todayLocal } from '../lib/dates.js'
import { recentStageChange, describeStageChange } from '../lib/stageHistory.js'
import { lsGet, lsSet } from '../lib/scopedStorage.js'
import SidePanel from './ui/SidePanel.jsx'
import ApplicationPanelBody from './panels/ApplicationPanelBody.jsx'
import Mono from './ui/Mono.jsx'
import ApplicationFlowPanel from './ApplicationFlowPanel.jsx'
import { ApplicationFunnel } from './charts/ActivityCharts.jsx'
import ImportModal from './import/ImportPanel.jsx'

// Pipeline → Sheet. A spreadsheet over every application: sort, filter, show/hide
// columns, edit cells in place (arrows / Enter / Esc / Tab, or just start typing), add
// rows at the bottom, export what's on screen to .xlsx or .csv. Column model, filters
// and export live in lib/applicationSheet.js; edits go through db.js updateApplication
// and then a quiet apps-only refresh, so the grid never unmounts mid-edit.

const PREFS_KEY = 'rec_sheet_prefs'
const isPrintable = e => e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey

function CellDisplay({ col, app, value }) {
  if (value === null || value === undefined || value === '') {
    if (col.type === 'boolean') return <span className="text-ink-300">—</span>
    return <span className="text-ink-300">·</span>
  }
  switch (col.id) {
    case 'company': return <span className="font-semibold text-ink-900">{value}</span>
    case 'stage': {
      const moved = recentStageChange(app)
      return (
        <span className="inline-flex items-center gap-1.5" title={moved ? describeStageChange(moved) : undefined}>
          <Badge label={value} color={STAGE_COLOR[value]} />
          {moved && <span aria-label={describeStageChange(moved)} className="w-1.5 h-1.5 rounded-full bg-accent-500 motion-safe:animate-pulse" />}
        </span>
      )
    }
    case 'daysInStage': {
      const stale = value > 14 && !TERMINAL_STAGES.includes(app.stage) && app.stage !== 'Wishlist'
      return (
        <Mono className={stale ? 'text-warning-700 font-medium' : 'text-ink-600'}>
          <span title={app.historyEstimated ? 'Estimated: stage history predates tracking' : undefined}>
            {app.historyEstimated ? '~' : ''}{value}d
          </span>
        </Mono>
      )
    }
    case 'oaCompleted': return value ? <span className="text-success-700 font-semibold">✓</span> : <span className="text-ink-300">—</span>
    case 'jdLink': {
      let host = value
      try { host = new URL(value).hostname.replace(/^www\./, '') } catch { /* not a URL — show raw */ }
      return /^https?:\/\//i.test(value)
        ? <a href={value} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-link hover:underline">{host} ↗</a>
        : <span>{value}</span>
    }
    case 'source': return <span className="text-ink-500">{value}</span>
    case 'notes': return <span className="text-ink-500">{value}</span>
  }
  if (col.type === 'date') return <Mono className="text-ink-600">{fmt(value)}</Mono>
  if (col.type === 'number') return <Mono className="text-ink-600">{value}</Mono>
  return <span>{value}</span>
}

function CellEditor({ col, app, initial, contacts, onCommit, onCancel }) {
  const [draft, setDraft] = useState(initial)
  const ref = useRef(null)
  const done = useRef(false)
  const finish = (fn, ...args) => { if (done.current) return; done.current = true; fn(...args) }
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    if (typeof initial === 'string' && el.setSelectionRange && col.edit.kind === 'text') el.setSelectionRange(initial.length, initial.length)
  }, [])

  const keys = e => {
    if (e.key === 'Escape') { e.preventDefault(); finish(onCancel) }
    else if (e.key === 'Enter') { e.preventDefault(); finish(onCommit, draft, 'down') }
    else if (e.key === 'Tab') { e.preventDefault(); finish(onCommit, draft, e.shiftKey ? 'left' : 'right') }
  }
  const cls = 'w-full h-full px-2 py-1.5 bg-surface text-ink-900 text-xs outline-none ring-2 ring-inset ring-accent-500'

  if (col.edit.kind === 'select' || col.edit.kind === 'contact') {
    const options = col.edit.kind === 'contact'
      ? [{ value: '', label: '— none —' }, ...[...contacts].sort((a, b) => a.name.localeCompare(b.name)).map(c => ({ value: c.id, label: `${c.name}${c.company ? ` · ${c.company}` : ''}` }))]
      : col.edit.options().map(o => ({ value: o, label: o }))
    return (
      <select ref={ref} value={draft ?? ''} className={cls}
        onChange={e => finish(onCommit, e.target.value, null)} onKeyDown={keys} onBlur={() => finish(onCancel)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }
  return (
    <input ref={ref} type={col.edit.kind === 'date' ? 'date' : 'text'} value={draft ?? ''} className={`${cls} ${col.edit.kind === 'date' ? 'font-mono' : ''}`}
      onChange={e => setDraft(e.target.value)} onKeyDown={keys} onBlur={() => finish(onCommit, draft, null)} />
  )
}

export default function ApplicationsSheet({ apps, contacts = [], interactions = [], relationships = [], onRefresh, onRefreshApps, onFindPeople, onRefreshRelationships, children }) {
  const saved = lsGet(PREFS_KEY) || {}
  const [filter, setFilter] = useState(saved.filter || 'applied')
  const [hidden, setHidden] = useState(saved.hidden || DEFAULT_HIDDEN)
  const [grouped, setGrouped] = useState(saved.grouped ?? false)
  const [showFlow, setShowFlow] = useState(saved.showFlow ?? false)
  const [importOpen, setImportOpen] = useState(false)
  const [pick, setPick] = useState(null)       // a clicked Sankey band/node: { label, appIds }
  const [sort, setSort] = useState(saved.sort || null) // { id, desc }
  const [search, setSearch] = useState('')
  const [active, setActive] = useState(null)   // { r, c } into rows / cols
  const [editing, setEditing] = useState(null) // { r, c, initial }
  const [overlay, setOverlay] = useState({})   // optimistic { [appId]: fields }
  const [error, setError] = useState(null)
  const [showCols, setShowCols] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newCompany, setNewCompany] = useState('')
  const [panelId, setPanelId] = useState(null)
  const gridRef = useRef(null)
  const pendingFocusId = useRef(null)

  useEffect(() => {
    try { lsSet(PREFS_KEY, { filter, hidden, grouped, sort, showFlow }) } catch { /* storage unavailable */ }
  }, [filter, hidden, grouped, sort, showFlow])

  const ctx = useMemo(() => makeContext(contacts), [contacts])
  const cols = useMemo(() => SHEET_COLUMNS.filter(c => !hidden.includes(c.id)), [hidden])

  const merged = useMemo(() => apps.map(a => overlay[a.id] ? { ...a, ...overlay[a.id] } : a), [apps, overlay])

  const counts = useMemo(() => Object.fromEntries(SHEET_FILTERS.map(f => [f.key, merged.filter(f.test).length])), [merged])

  // The flow is drawn from the filtered + searched set; a clicked band narrows the grid further.
  const base = useMemo(() => {
    const f = SHEET_FILTERS.find(x => x.key === filter) || SHEET_FILTERS[0]
    const q = search.trim().toLowerCase()
    let out = merged.filter(f.test)
    if (q) out = out.filter(a => [a.company, a.role, a.location, a.notes].some(v => v?.toLowerCase().includes(q)))
    return out
  }, [merged, filter, search])

  const rows = useMemo(() => {
    const ids = pick && new Set(pick.appIds)
    const out = ids ? base.filter(a => ids.has(a.id)) : base
    const sortCol = sort && SHEET_COLUMNS.find(c => c.id === sort.id)
    const bySort = sortCol ? compareBy(sortCol, ctx, sort.desc) : (a, b) => (b.appliedDate || '').localeCompare(a.appliedDate || '')
    const byStage = (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage)
    return out.slice().sort(grouped ? (a, b) => byStage(a, b) || bySort(a, b) : bySort)
  }, [base, pick, sort, grouped, ctx])

  // Keep the active cell on the same application across re-sorts/refreshes.
  const activeId = active ? rows[active.r]?.id : null
  const lastActiveId = useRef(null)
  useEffect(() => { if (activeId) lastActiveId.current = activeId }, [activeId])
  useEffect(() => {
    const want = pendingFocusId.current || lastActiveId.current
    if (!want || !active) return
    const r = rows.findIndex(a => a.id === want)
    if (r !== -1 && r !== active.r) setActive(a => ({ ...a, r }))
    if (pendingFocusId.current && r !== -1) pendingFocusId.current = null
  }, [rows])

  // Manual scroll-into-view: the browser's version ignores the sticky header row and the
  // pinned # / Company columns, so it parks cells underneath them.
  useEffect(() => {
    const grid = gridRef.current
    const cell = active && grid?.querySelector(`[data-cell="${active.r}:${active.c}"]`)
    if (!cell) return
    const head = grid.querySelector('thead')?.offsetHeight || 0
    const pinned = [...grid.querySelectorAll('thead th')].filter(th => getComputedStyle(th).left !== 'auto')
    const pinnedW = cell.classList.contains('sticky') ? 0 : pinned.reduce((w, th) => w + th.offsetWidth, 0)
    const { offsetTop: top, offsetLeft: left, offsetHeight: h, offsetWidth: w } = cell
    if (top - head < grid.scrollTop) grid.scrollTop = top - head
    else if (top + h > grid.scrollTop + grid.clientHeight) grid.scrollTop = top + h - grid.clientHeight
    if (left - pinnedW < grid.scrollLeft) grid.scrollLeft = left - pinnedW
    else if (left + w > grid.scrollLeft + grid.clientWidth) grid.scrollLeft = left + w - grid.clientWidth
  }, [active])

  const focusGrid = () => requestAnimationFrame(() => gridRef.current?.focus({ preventScroll: true }))

  const move = useCallback((dr, dc) => {
    setActive(a => {
      const cur = a || { r: 0, c: 0 }
      return {
        r: Math.max(0, Math.min(rows.length - 1, cur.r + dr)),
        c: Math.max(0, Math.min(cols.length - 1, cur.c + dc)),
      }
    })
  }, [rows.length, cols.length])

  async function save(app, fields) {
    const changed = Object.fromEntries(Object.entries(fields).filter(([k, v]) => (app[k] ?? '') !== (v ?? '')))
    if (!Object.keys(changed).length) return
    setError(null)
    setOverlay(o => ({ ...o, [app.id]: { ...o[app.id], ...changed } }))
    try {
      await updateApplication(app.id, changed)
      await (onRefreshApps || onRefresh)?.()
    } catch (e) {
      setError(`Couldn't save ${app.company}: ${e.message}`)
    } finally {
      setOverlay(o => {
        const rest = { ...o[app.id] }
        for (const k of Object.keys(changed)) delete rest[k]
        const next = { ...o }
        if (Object.keys(rest).length) next[app.id] = rest; else delete next[app.id]
        return next
      })
    }
  }

  function commitEdit(r, c, raw, then) {
    const app = rows[r], col = cols[c]
    setEditing(null)
    if (app && col?.edit) {
      let value = raw
      if (col.edit.kind === 'text') value = (raw ?? '').trim()
      if (col.edit.kind === 'date' || col.edit.kind === 'contact') value = raw || null
      const fields = { [col.edit.field]: value }
      if (col.edit.field === 'stage' && value) Object.assign(fields, stageSideEffects(app, value))
      if (col.edit.field === 'company' && !value) { focusGrid(); return } // company is required
      save(app, fields)
    }
    if (then === 'down') move(1, 0)
    else if (then === 'right') move(0, 1)
    else if (then === 'left') move(0, -1)
    focusGrid()
  }

  function startEdit(r, c, initialOverride) {
    const app = rows[r], col = cols[c]
    if (!app || !col?.edit) return
    if (col.edit.kind === 'toggle') { save(app, { [col.edit.field]: !app[col.edit.field] }); return }
    const current = col.edit.field === 'referredById' ? app.referredById : app[col.edit.field]
    const initial = initialOverride !== undefined ? initialOverride
      : col.edit.kind === 'date' && current ? String(current).slice(0, 10) : current ?? ''
    setEditing({ r, c, initial })
  }

  function onGridKey(e) {
    if (editing || !rows.length) return
    const a = active || { r: 0, c: 0 }
    const k = e.key
    if (k === 'ArrowDown') { e.preventDefault(); move(1, 0) }
    else if (k === 'ArrowUp') { e.preventDefault(); move(-1, 0) }
    else if (k === 'ArrowRight' || (k === 'Tab' && !e.shiftKey)) { e.preventDefault(); move(0, 1) }
    else if (k === 'ArrowLeft' || (k === 'Tab' && e.shiftKey)) { e.preventDefault(); move(0, -1) }
    else if (k === 'Home') { e.preventDefault(); setActive({ r: a.r, c: 0 }) }
    else if (k === 'End') { e.preventDefault(); setActive({ r: a.r, c: cols.length - 1 }) }
    else if (k === 'Enter' || k === 'F2') { e.preventDefault(); if (!active) setActive(a); startEdit(a.r, a.c) }
    else if (k === ' ' && cols[a.c]?.edit?.kind === 'toggle') { e.preventDefault(); startEdit(a.r, a.c) }
    else if ((k === 'Backspace' || k === 'Delete') && cols[a.c]?.edit && cols[a.c].edit.kind !== 'toggle' && cols[a.c].id !== 'company' && cols[a.c].id !== 'stage') {
      e.preventDefault(); commitEdit(a.r, a.c, '', null)
    }
    else if (k === 'Escape') setActive(null)
    else if (isPrintable(e) && cols[a.c]?.edit?.kind === 'text') { e.preventDefault(); if (!active) setActive(a); startEdit(a.r, a.c, e.key) }
  }

  async function addRow() {
    const company = newCompany.trim()
    if (!company) { setAdding(false); return }
    setError(null)
    try {
      const { id } = await addApplication({ company })
      await updateApplication(id, { stage: 'Applied', triage: 'Applied', appliedDate: todayLocal() })
      pendingFocusId.current = id
      lastActiveId.current = id
      setNewCompany('')
      setAdding(false)
      if (filter !== 'all' && filter !== 'applied' && filter !== 'open') setFilter('applied')
      setActive({ r: 0, c: Math.max(0, cols.findIndex(c => c.id === 'role')) })
      await (onRefreshApps || onRefresh)?.()
      focusGrid()
    } catch (e) { setError(`Couldn't add ${company}: ${e.message}`) }
  }

  function exportFile(kind) {
    if (kind === 'xlsx') {
      const { bytes, filename } = applicationsToXlsx(rows, cols, ctx)
      downloadBytes(bytes, filename)
    } else {
      const { text, filename } = applicationsToCsv(rows, cols, ctx)
      downloadBytes(new TextEncoder().encode('\uFEFF' + text), filename, 'text/csv;charset=utf-8')
    }
  }

  function toggleSort(id) {
    setSort(s => !s || s.id !== id ? { id, desc: false } : !s.desc ? { id, desc: true } : null)
  }

  const panelApp = panelId ? apps.find(a => a.id === panelId) : null

  // Group header rows interleaved with data rows when grouped by stage.
  const body = []
  rows.forEach((app, r) => {
    if (grouped && (r === 0 || rows[r - 1].stage !== app.stage)) {
      const n = rows.filter(x => x.stage === app.stage).length
      body.push(
        <tr key={`g-${app.stage}`} className="bg-ink-50">
          <td colSpan={cols.length + 1} className="sticky left-0 px-3 pt-3 pb-1.5 border-b border-ink-200">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">{app.stage}</span>
            <Mono className="ml-2 text-ink-400">{n}</Mono>
          </td>
        </tr>
      )
    }
    body.push(
      <tr key={app.id} className={`group ${overlay[app.id] ? 'opacity-80' : ''}`}>
        <td className="sticky left-0 z-10 w-10 min-w-10 bg-surface border-b border-r border-ink-200 px-1 text-right">
          <button onClick={() => setPanelId(app.id)} title="Open details"
            className="w-full flex items-center justify-end gap-0.5 text-ink-400 hover:text-link">
            <Mono className="group-hover:hidden text-[10px]">{r + 1}</Mono>
            <ArrowUpRight size={13} className="hidden group-hover:block" />
          </button>
        </td>
        {cols.map((col, c) => {
          const isActive = active && active.r === r && active.c === c
          const isEditing = editing && editing.r === r && editing.c === c
          const value = cellValue(col, app, ctx)
          return (
            <td key={col.id} data-cell={`${r}:${c}`}
              onMouseDown={() => { if (!isEditing) setActive({ r, c }) }}
              onDoubleClick={() => startEdit(r, c)}
              style={{ minWidth: `${col.width * 0.5}rem`, maxWidth: `${col.width * 0.75}rem` }}
              className={`relative h-8 border-b border-r border-ink-200 text-xs text-ink-700 whitespace-nowrap overflow-hidden text-ellipsis
                ${col.sticky ? 'sticky left-10 z-10 bg-surface' : ''}
                ${isEditing ? 'p-0' : 'px-2'}
                ${isActive && !isEditing ? 'outline-2 -outline-offset-2 outline-accent-500 bg-accent-50' : ''}
                ${col.edit ? 'cursor-cell' : 'cursor-default'}`}>
              {isEditing
                ? <CellEditor col={col} app={app} initial={editing.initial} contacts={contacts}
                    onCommit={(v, then) => commitEdit(r, c, v, then)}
                    onCancel={() => { setEditing(null); focusGrid() }} />
                : <CellDisplay col={col} app={app} value={value} />}
            </td>
          )
        })}
      </tr>
    )
  })

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex max-w-full overflow-x-auto border border-ink-300 rounded-sm text-xs font-medium">
          {SHEET_FILTERS.map(f => (
            <button key={f.key} onClick={() => { setFilter(f.key); setPick(null); setActive(null) }}
              className={`shrink-0 whitespace-nowrap px-2.5 py-1 border-r border-ink-200 last:border-r-0 transition-colors ${filter === f.key ? 'bg-ink-900 text-on-fill' : 'bg-surface text-ink-600 hover:bg-ink-50'}`}>
              {f.label} <Mono className={filter === f.key ? 'text-on-fill opacity-70' : 'text-ink-400'}>{counts[f.key]}</Mono>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 px-2 py-1 border border-ink-300 rounded-sm bg-surface text-xs w-48 focus-within:border-accent-400">
          <Search size={12} className="text-ink-400 shrink-0" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPick(null); setActive(null) }} placeholder="Find…"
            className="w-full bg-transparent outline-none text-ink-800" />
          {search && <button onClick={() => setSearch('')} className="text-ink-400 hover:text-ink-700"><X size={12} /></button>}
        </label>
        <div className="flex items-center gap-1.5 ml-auto">
          <button onClick={() => { setShowFlow(f => !f); setPick(null) }}
            className={`flex items-center gap-1 px-2.5 py-1 border rounded-sm text-xs font-medium ${showFlow ? 'bg-ink-900 text-on-fill border-ink-900' : 'bg-surface text-ink-600 border-ink-300 hover:bg-ink-50'}`}>
            <Waypoints size={13} /> Flow
          </button>
          <button onClick={() => setGrouped(g => !g)}
            className={`flex items-center gap-1 px-2.5 py-1 border rounded-sm text-xs font-medium ${grouped ? 'bg-ink-900 text-on-fill border-ink-900' : 'bg-surface text-ink-600 border-ink-300 hover:bg-ink-50'}`}>
            <Rows3 size={13} /> Group by stage
          </button>
          <div className="relative">
            <button onClick={() => setShowCols(s => !s)}
              className="flex items-center gap-1 px-2.5 py-1 border border-ink-300 rounded-sm bg-surface text-xs font-medium text-ink-600 hover:bg-ink-50">
              <Columns3 size={13} /> Columns
            </button>
            {showCols && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowCols(false)} />
                <div className="absolute right-0 mt-1 z-40 w-52 bg-surface border border-ink-300 rounded-sm shadow-lg py-1">
                  {SHEET_COLUMNS.map(c => (
                    <label key={c.id} className={`flex items-center gap-2 px-3 py-1 text-xs ${c.sticky ? 'text-ink-400' : 'text-ink-700 hover:bg-ink-50 cursor-pointer'}`}>
                      <input type="checkbox" disabled={c.sticky} checked={!hidden.includes(c.id)} className="accent-accent-600"
                        onChange={() => setHidden(h => h.includes(c.id) ? h.filter(x => x !== c.id) : [...h, c.id])} />
                      {c.header}
                    </label>
                  ))}
                  <button onClick={() => setHidden(DEFAULT_HIDDEN)} className="w-full text-left px-3 pt-1.5 mt-1 border-t border-ink-100 text-[11px] text-link hover:underline">Reset columns</button>
                </div>
              </>
            )}
          </div>
          <button onClick={() => setImportOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 border border-ink-300 rounded-sm bg-surface text-xs font-medium text-ink-600 hover:bg-ink-50">
            <Upload size={13} /> Import
          </button>
          <div className="flex border border-ink-300 rounded-sm overflow-hidden">
            <button onClick={() => exportFile('xlsx')} disabled={!rows.length}
              className="flex items-center gap-1 px-2.5 py-1 bg-accent-600 text-on-accent text-xs font-semibold hover:bg-accent-700 disabled:opacity-50">
              <Download size={13} /> Excel
            </button>
            <button onClick={() => exportFile('csv')} disabled={!rows.length}
              className="px-2 py-1 bg-surface text-xs font-medium text-ink-600 border-l border-ink-300 hover:bg-ink-50 disabled:opacity-50">
              CSV
            </button>
          </div>
        </div>
      </div>

      {children}

      {importOpen && (
        <ImportModal kind="tracker" apps={apps} onClose={() => setImportOpen(false)}
          onImported={() => (onRefreshApps || onRefresh)?.()} />
      )}

      {showFlow && (
        <div className="mb-3 bg-surface border border-ink-300 rounded-sm px-4 pt-3 pb-2">
          <ApplicationFunnel apps={base} />
          <ApplicationFlowPanel apps={base}
            selectedLabel={pick?.label}
            onSelect={p => { setPick(cur => cur?.label === p.label ? null : p); setActive(null) }}
            footer={<span>Click a band or stage to filter the sheet.</span>} />
        </div>
      )}

      {pick && (
        <div className="mb-2 flex items-center gap-2 text-xs text-ink-600">
          <span>Showing <span className="font-semibold text-ink-900">{pick.label}</span> · <Mono>{rows.length}</Mono></span>
          <button onClick={() => setPick(null)} className="flex items-center gap-0.5 text-link hover:underline"><X size={12} /> clear</button>
        </div>
      )}

      {error && (
        <div className="mb-2 flex items-center justify-between gap-2 px-3 py-1.5 bg-danger-50 border border-danger-200 rounded-sm text-xs text-danger-700">
          {error}
          <button onClick={() => setError(null)}><X size={12} /></button>
        </div>
      )}

      {/* Grid */}
      <div ref={gridRef} tabIndex={0} onKeyDown={onGridKey}
        className="relative bg-surface border border-ink-300 rounded-sm overflow-auto max-h-[calc(100vh-15rem)] focus:outline-none">
        <table className="border-separate border-spacing-0 w-max min-w-full">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-30 w-10 min-w-10 bg-ink-100 border-b border-r border-ink-300" />
              {cols.map(col => (
                <th key={col.id}
                  className={`sticky top-0 ${col.sticky ? 'left-10 z-30' : 'z-20'} bg-ink-100 border-b border-r border-ink-300 px-2 py-1.5 text-left`}>
                  <button onClick={() => toggleSort(col.id)}
                    className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500 hover:text-ink-900 whitespace-nowrap">
                    {col.header}
                    <span className="text-accent-600">{sort?.id === col.id ? (sort.desc ? '↓' : '↑') : ''}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body}
            <tr>
              <td className="sticky left-0 z-10 bg-surface border-r border-ink-200 text-center text-ink-400 text-xs">+</td>
              <td colSpan={cols.length} className="px-0 py-0">
                {adding ? (
                  <input autoFocus value={newCompany} onChange={e => setNewCompany(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addRow(); if (e.key === 'Escape') { setAdding(false); setNewCompany('') } }}
                    onBlur={() => { if (!newCompany.trim()) setAdding(false) }}
                    placeholder="Company name, then Enter — added as Applied today"
                    className="sticky left-10 w-[min(100%,32rem)] h-8 px-2 text-xs bg-accent-50 text-ink-900 outline-none ring-2 ring-inset ring-accent-500" />
                ) : (
                  <button onClick={() => setAdding(true)} className="sticky left-10 h-8 px-2 text-xs text-ink-400 hover:text-link">
                    Add application
                  </button>
                )}
              </td>
            </tr>
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="text-center py-10 text-ink-400 text-sm">
            {apps.length === 0 ? 'No applications yet. Add one below or let the email pipeline fill this in.' : 'Nothing matches this filter.'}
          </p>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-ink-400">
        <Mono>{rows.length}</Mono> rows · Arrow keys move · Enter or type to edit · Esc cancels · Double-click works too
      </p>

      <SidePanel open={!!panelApp} onClose={() => setPanelId(null)}>
        {panelApp && (
          <ApplicationPanelBody
            app={panelApp} contacts={contacts} apps={apps} interactions={interactions} relationships={relationships}
            onStatusChange={async key => { await updateApplicationTriage(panelApp.id, BUCKET_TO_TRIAGE[key === null ? 'review' : key], panelApp.stage); await (onRefreshApps || onRefresh)?.() }}
            onClose={() => setPanelId(null)}
            onDelete={async () => { await archiveApplication(panelApp.id); setPanelId(null); await (onRefreshApps || onRefresh)?.() }}
            onSaved={() => (onRefreshApps || onRefresh)?.()}
            onFindPeople={onFindPeople} onRefresh={onRefreshApps || onRefresh} onRefreshRelationships={onRefreshRelationships}
          />
        )}
      </SidePanel>
    </div>
  )
}
