import { useState, useMemo } from 'react'
import { archiveApplication, updateApplicationTriage } from '../db.js'
import { STAGE_ORDER, STAGE_COLOR, TERMINAL_STAGES, daysSince, daysBetween, fmt, Badge, EmptyState, isUntriaged, findDuplicateGroups } from '../shared.jsx'
import { BUCKET_TO_TRIAGE } from './jobBoards/helpers.js'
import { companyCoverage } from '../lib/networkCoverage.js'
import SidePanel from './ui/SidePanel.jsx'
import ApplicationPanelBody from './panels/ApplicationPanelBody.jsx'
import Mono from './ui/Mono.jsx'

const COVERAGE_BADGE = {
  gap:    { color: 'bg-danger-100 text-danger-700',   label: () => 'Need network' },
  weak:   { color: 'bg-warning-100 text-warning-800', label: n => `${n} contact${n !== 1 ? 's' : ''} · weak` },
  strong: { color: 'bg-success-100 text-success-800', label: n => `${n} contact${n !== 1 ? 's' : ''} here` },
}

function DuplicatesPanel({ apps, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [error, setError] = useState(null)

  const groups = useMemo(() => findDuplicateGroups(apps), [apps])
  if (groups.length === 0) return null

  const extraCount = groups.reduce((sum, g) => sum + (g.length - 1), 0)

  async function dedupe() {
    setArchiving(true); setError(null)
    try {
      for (const g of groups) {
        const [, ...dupes] = g // keep the oldest (first), archive the rest
        for (const d of dupes) await archiveApplication(d.id)
      }
      onRefresh()
    } catch (e) {
      setError(e.message)
    } finally {
      setArchiving(false)
    }
  }

  return (
    <div className="mb-4 bg-warning-50 border border-warning-200 rounded-md p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm text-warning-800">
            <strong>{groups.length}</strong> duplicate group{groups.length !== 1 ? 's' : ''} found
            (<strong>{extraCount}</strong> extra row{extraCount !== 1 ? 's' : ''} — same company + role).
          </p>
          <p className="text-xs text-warning-700 mt-0.5">Matches exact company/role text only — differently-worded listings of the same job aren't caught.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setExpanded(e => !e)}
            className="px-3 py-1.5 bg-white border border-warning-200 text-warning-700 text-xs rounded-lg hover:bg-warning-100 font-medium">
            {expanded ? 'Hide' : 'Review'}
          </button>
          <button onClick={() => { if (confirm(`Archive ${extraCount} duplicate row${extraCount !== 1 ? 's' : ''}? This keeps the oldest copy of each and archives the rest in Notion (recoverable from Notion's trash).`)) dedupe() }}
            disabled={archiving}
            className="px-3 py-1.5 bg-danger-600 text-white text-xs rounded-lg hover:bg-danger-700 disabled:opacity-50 font-medium">
            {archiving ? 'Archiving...' : `Archive ${extraCount} duplicate${extraCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-danger-600 mt-2">{error}</p>}

      {expanded && (
        <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
          {groups.map((g, i) => (
            <div key={i} className="bg-white rounded-lg border border-warning-100 px-3 py-2">
              <p className="text-xs font-semibold text-ink-700">{g[0].company} · {g[0].role || '(no role)'} — {g.length} copies</p>
              <div className="mt-1 space-y-0.5">
                {g.map((a, j) => (
                  <p key={a.id} className="text-[11px] text-ink-400">
                    {j === 0 ? '✓ keep' : '✕ archive'} · {a.stage} · {a.triage}{a.sourceRepo ? ` · ${a.sourceRepo}` : ''} · <Mono>{fmt(a.createdTime)}</Mono>
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Applications View ─────────────────────────────────────────────────────────

export default function ApplicationsView({ apps, contacts = [], interactions = [], relationships = [], onRefresh, onFindPeople, onRefreshRelationships }) {
  const [filter, setFilter] = useState('active')
  const [search, setSearch] = useState('')
  const [selectedAppId, setSelectedAppId] = useState(null)
  const [addingNew, setAddingNew] = useState(false)
  const selectedApp = selectedAppId ? apps.find(a => a.id === selectedAppId) : null

  async function changeTriage(app, bucketKey) {
    await updateApplicationTriage(app.id, BUCKET_TO_TRIAGE[bucketKey === null ? 'review' : bucketKey], app.stage)
    onRefresh()
  }

  // Planning-vs-applied at a glance — Wishlist (triaged) is "planning to apply", every
  // non-terminal stage past that is active/applied, Offer+Accepted are wins.
  const stats = useMemo(() => {
    let planning = 0, activePipeline = 0, offers = 0
    for (const a of apps) {
      if (isUntriaged(a)) continue
      if (a.stage === 'Wishlist') planning++
      else if (a.stage === 'Offer' || a.stage === 'Accepted') offers++
      else if (!TERMINAL_STAGES.includes(a.stage)) activePipeline++
    }
    return { planning, activePipeline, offers }
  }, [apps])

  const filtered = apps
    .filter(a => {
      if (filter === 'active' && (TERMINAL_STAGES.includes(a.stage) || isUntriaged(a))) return false
      if (filter === 'review' && !(a.triage === 'Needs Review' && a.stage === 'Wishlist')) return false
      if (search) {
        const q = search.toLowerCase()
        if (!a.company?.toLowerCase().includes(q) && !a.role?.toLowerCase().includes(q)) return false
      }
      return true
    })
    .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))

  return (
    <div>
      <DuplicatesPanel apps={apps} onRefresh={onRefresh} />

      {apps.length > 0 && (
        <p className="text-xs text-ink-400 mb-3">
          📝 <strong className="text-ink-600">{stats.planning}</strong> planning to apply ·
          {' '}🚀 <strong className="text-ink-600">{stats.activePipeline}</strong> applied / in process
          {stats.offers > 0 && <> · 🎉 <strong className="text-ink-600">{stats.offers}</strong> offer{stats.offers !== 1 ? 's' : ''}</>}
        </p>
      )}

      <div className="flex gap-2 mb-4 items-center">
        {[['active','Active'],['review','Needs Review'],['all','All incl. rejected']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filter === val
              ? 'bg-accent-600 text-white border-accent-600'
              : 'bg-white text-ink-600 border-ink-200 hover:border-accent-300'}`}>
            {label}
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search company, role..."
          className="px-3 py-1 border border-ink-200 rounded-full text-xs focus:outline-none focus:border-accent-400 w-44" />
        <button onClick={() => setAddingNew(true)}
          className="ml-auto px-3 py-1 bg-accent-600 text-white rounded-full text-xs font-medium hover:bg-accent-700">
          + Add Application
        </button>
      </div>

      {filtered.length === 0
        ? <EmptyState msg={apps.length === 0 ? 'No applications yet. Add them in Notion or let the email pipeline populate them.' : 'No applications match this filter.'} />
        : (
          <div className="space-y-2">
            {filtered.map(a => {
              const days = a.daysInStage ?? daysSince(a.lastActivity)
              const stale = days !== null && days > 14 && !TERMINAL_STAGES.includes(a.stage) && a.stage !== 'Offer'
              const coverage = a.company?.trim() ? companyCoverage(a.company, contacts, interactions) : null
              return (
                <div key={a.id} onClick={() => setSelectedAppId(a.id)}
                  className={`bg-white rounded-md px-4 py-3 border transition-all cursor-pointer hover:shadow-md hover:border-accent-200 ${stale ? 'border-warning-200' : 'border-ink-300'}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-ink-900">{a.company}</span>
                        {a.role && <span className="text-sm text-ink-500">· {a.role}</span>}
                        <Badge label={a.stage} color={STAGE_COLOR[a.stage]} />
                        {isUntriaged(a) && <Badge label={a.triage} color={a.triage === 'Pass' ? 'bg-danger-100 text-danger-500' : 'bg-ink-100 text-ink-500'} />}
                        {coverage && coverage.status !== 'none' && (
                          <Badge label={COVERAGE_BADGE[coverage.status].label(coverage.matchedContacts.length)}
                            color={COVERAGE_BADGE[coverage.status].color} />
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {a.appliedDate && <span className="text-xs text-ink-400">Applied <Mono>{fmt(a.appliedDate)}</Mono></span>}
                        {a.closedDate && (
                          <span className="text-xs text-ink-400">
                            Closed <Mono>{fmt(a.closedDate)}</Mono>{a.appliedDate ? ` (${daysBetween(a.appliedDate, a.closedDate)}d)` : ''}
                          </span>
                        )}
                        {days !== null && (
                          <span className={`text-xs ${stale ? 'text-warning-700 font-medium' : 'text-ink-400'}`}>
                            <Mono>{days}</Mono>d in stage{stale ? ' ⚠' : ''}
                          </span>
                        )}
                        {a.jdLink && (
                          <a href={a.jdLink} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                            className="text-xs text-accent-500 hover:underline">JD ↗</a>
                        )}
                      </div>
                      {a.referredById && (
                        <p className="text-xs text-accent-600 mt-0.5">
                          Referred by {contacts.find(c => c.id === a.referredById)?.name || '—'}
                        </p>
                      )}
                      {a.notes && <p className="text-xs text-ink-400 mt-0.5 line-clamp-1">{a.notes}</p>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      <SidePanel open={!!(selectedApp || addingNew)} onClose={() => { setSelectedAppId(null); setAddingNew(false) }}>
        {(selectedApp || addingNew) && (
          <ApplicationPanelBody
            app={selectedApp}
            contacts={contacts}
            apps={apps}
            interactions={interactions}
            relationships={relationships}
            onStatusChange={s => changeTriage(selectedApp, s)}
            onClose={() => { setSelectedAppId(null); setAddingNew(false) }}
            onDelete={async () => { await archiveApplication(selectedApp.id); setSelectedAppId(null); onRefresh() }}
            onSaved={() => { setAddingNew(false); onRefresh() }}
            onFindPeople={onFindPeople}
            onRefresh={onRefresh}
            onRefreshRelationships={onRefreshRelationships}
          />
        )}
      </SidePanel>
    </div>
  )
}

