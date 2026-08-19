import { useState, useEffect, useRef } from 'react'
import { normalizeCompanyName } from '../lib/networkGraph.js'
import { companyCoverage } from '../lib/networkCoverage.js'
import { warmPathsToCompany, pathLabel } from '../lib/warmIntro.js'
import { STAGE_COLOR, Badge, EmptyState } from '../shared.jsx'
import ContactDetailModal from './ContactDetailModal.jsx'
import DraftPanel from './DraftPanel.jsx'
import { RowCap } from './ui/Section.jsx'

// Referral coverage: cross-references a user-maintained target-company list against
// Contacts (do I know anyone there?) and Applications (have I already applied?).
// Referred candidates convert at roughly 4x the rate of cold applicants and make up
// ~2% of applicants but ~11% of hires — so a company with zero contacts is the single
// highest-leverage gap to close before applying cold. Coverage strength uses
// lib/networkCoverage.js's companyCoverage (tie-strength bucket + affinity tags) rather
// than just "any contact at all" — a company where your only contact is a total stranger
// you added but never talked to isn't meaningfully covered. Shared with Pipeline, which
// tags applications the same way.
// ROW_CAP mirrors the RowCap cap={} value below — kept as a shared constant so the
// deep-link focus/reorder logic (see the `rows` computation) can guarantee a focused
// company always lands within the visibly-rendered slice, without hardcoding "5" twice.
const ROW_CAP = 5

export default function ReferralCoverageTab({ contacts, apps, interactions, contactRelationships = [], onRefresh, onFindPeople, focus, targets, setTargets, loaded }) {
  const [editingList, setEditingList] = useState(false)
  const [draft, setDraft] = useState('')
  const [addingFor, setAddingFor] = useState(null) // target company name string | null
  const [draftingCompany, setDraftingCompany] = useState(null) // company key currently showing a DraftPanel | null
  const rowRefs = useRef(new Map()) // company key → row DOM node, for the Grow deep-link scroll

  // One-time init once the real list has loaded from Supabase — mirrors the old
  // lazy-useState behavior (start in "edit" mode iff the list starts empty) without
  // assuming synchronous localStorage availability.
  useEffect(() => {
    if (!loaded) return
    setDraft(targets.join('\n'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  // Deep-link scroll/highlight — mirrors DiscoverTab.jsx's donor pattern exactly. `ts` (not
  // just company) is in the dep array so re-clicking the same company re-triggers the scroll
  // even though the string itself didn't change.
  useEffect(() => {
    if (!focus) return
    const key = normalizeCompanyName(focus.company)
    const el = rowRefs.current.get(key)
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.ts])

  function saveTargets() {
    const list = [...new Set(draft.split('\n').map(s => s.trim()).filter(Boolean))]
    setTargets(list)
    setEditingList(false)
  }

  if (!loaded) return <EmptyState msg="Loading target companies..." />

  const rows = targets
    .map(company => {
      const key = normalizeCompanyName(company)
      const matchedApps = apps.filter(a => a.company?.trim() && normalizeCompanyName(a.company) === key)
      const { matchedContacts, status } = companyCoverage(company, contacts, interactions)
      // Shortest path into this company — referral chains plus tagged relationships —
      // if any of the matched contacts were introduced to you or are connected to someone
      // you know rather than added cold. Surfaces a path you might've forgotten.
      const paths = matchedContacts.length > 0 ? warmPathsToCompany(contacts, company, contactRelationships) : []
      const bestPath = paths.find(p => p.chain.length > 0) || null
      return { company, matchedContacts, matchedApps, status, bestPath }
    })
    .sort((a, b) => ({ gap: 0, weak: 1, strong: 2 }[a.status]) - ({ gap: 0, weak: 1, strong: 2 }[b.status]))

  // Deep-link guard (03-REVIEW.md WR-01): `rows` is rendered through <RowCap cap={ROW_CAP}>,
  // which only shows the first ROW_CAP entries until the user manually expands it. Without
  // this, a focused company ranked 6th+ never gets a `ref` set (rowRefs only fires for
  // rendered rows), so the deep-link scroll/highlight effect above silently no-ops. Pin the
  // focused row to the front only when it would otherwise fall outside the visible slice —
  // this is a targeted splice, not a permanent re-sort, so status ordering is left untouched
  // whenever the focused company is already within the cap (or there's no pending focus).
  if (focus) {
    const focusKey = normalizeCompanyName(focus.company)
    const idx = rows.findIndex(r => normalizeCompanyName(r.company) === focusKey)
    if (idx >= ROW_CAP) {
      const [row] = rows.splice(idx, 1)
      rows.unshift(row)
    }
  }

  const gapCount = rows.filter(r => r.status === 'gap').length
  const weakCount = rows.filter(r => r.status === 'weak').length

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-accent-100 bg-gradient-to-r from-accent-50 to-indigo-50 overflow-hidden">
        <button onClick={() => { setDraft(targets.join('\n')); setEditingList(o => !o) }}
          className="w-full px-5 py-3 flex items-center justify-between text-sm font-medium text-accent-800">
          <span>🎯 Target companies {targets.length > 0 ? `· ${targets.length} tracked` : '· click to set'}</span>
          <span className="text-accent-400 text-xs">{editingList ? '▲ collapse' : '▼ edit'}</span>
        </button>
        {editingList && (
          <div className="px-5 pb-5">
            <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={6}
              placeholder={'One company per line, e.g.\nStripe\nDatadog\nRipple'}
              className="w-full px-3 py-2 border border-accent-200 rounded-lg text-sm bg-white focus:outline-none focus:border-accent-400 resize-none font-mono" />
            <div className="flex justify-end mt-2">
              <button onClick={saveTargets}
                className="px-4 py-1.5 bg-accent-600 text-white text-xs rounded-lg hover:bg-accent-700 font-medium">
                Save target list
              </button>
            </div>
          </div>
        )}
      </div>

      {targets.length === 0 ? (
        <EmptyState msg="Add target companies above to see referral gaps." />
      ) : (
        <>
          {(gapCount > 0 || weakCount > 0) && (
            <p className="text-sm text-danger-600 font-medium">
              {gapCount > 0 && `${gapCount} target compan${gapCount !== 1 ? 'ies' : 'y'} with no contact yet.`}
              {gapCount > 0 && weakCount > 0 && ' '}
              {weakCount > 0 && `${weakCount} covered only by a cold or unengaged contact.`}
            </p>
          )}
          <div className="space-y-2">
            <RowCap items={rows} cap={ROW_CAP} tier="ink" renderItem={r => (
              <div key={r.company} ref={el => { if (el) rowRefs.current.set(normalizeCompanyName(r.company), el) }}
                className={`bg-white rounded-xl p-4 shadow-sm border flex items-start justify-between gap-3 ${focus && normalizeCompanyName(focus.company) === normalizeCompanyName(r.company) ? 'ring-2 ring-accent-300' : ''} ${r.status === 'gap' ? 'border-danger-200' : r.status === 'weak' ? 'border-warning-200' : 'border-ink-100'}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink-900">{r.company}</span>
                    {r.status === 'gap' && <Badge label="No contact" color="bg-danger-100 text-danger-700" />}
                    {r.status === 'weak' && <Badge label={`${r.matchedContacts.length} contact${r.matchedContacts.length !== 1 ? 's' : ''} · weak tie`} color="bg-warning-100 text-warning-800" />}
                    {r.status === 'strong' && <Badge label={`${r.matchedContacts.length} contact${r.matchedContacts.length !== 1 ? 's' : ''}`} color="bg-success-100 text-success-800" />}
                    {r.matchedApps.length > 0 && (
                      <Badge label={r.matchedApps[0].stage} color={STAGE_COLOR[r.matchedApps[0].stage]} />
                    )}
                  </div>
                  {r.matchedContacts.length > 0 && (
                    <p className="text-xs text-ink-500 mt-1 truncate">
                      {r.matchedContacts.map(c => c.name).join(', ')}
                    </p>
                  )}
                  {r.bestPath && (
                    <p className="text-[11px] text-indigo-600 mt-0.5 truncate" title="Referral chain that led to this contact">
                      ↩ Path: {pathLabel(r.bestPath)}
                    </p>
                  )}
                  {draftingCompany === r.company && r.matchedContacts[0] && (
                    <DraftPanel contact={r.matchedContacts[0]} kind="cold_open" />
                  )}
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1.5">
                  <button onClick={() => onFindPeople(r.company)}
                    className="px-3 py-1.5 bg-accent-600 text-white rounded-full text-xs font-medium hover:bg-accent-700">
                    🔍 Find people
                  </button>
                  {r.status === 'gap' ? (
                    <button onClick={() => setAddingFor(r.company)}
                      className="px-3 py-1.5 bg-white border border-ink-200 rounded-full text-xs font-medium text-ink-600 hover:border-accent-300">
                      + Add contact
                    </button>
                  ) : (
                    <button onClick={() => setDraftingCompany(c => c === r.company ? null : r.company)}
                      className="px-3 py-1.5 bg-white border border-ink-200 rounded-full text-xs font-medium text-ink-600 hover:border-accent-300">
                      {draftingCompany === r.company ? 'Hide' : '✎ Draft outreach'}
                    </button>
                  )}
                </div>
              </div>
            )} />
          </div>
        </>
      )}

      {addingFor && (
        <ContactDetailModal
          contact={null}
          initial={{ company: addingFor }}
          contacts={contacts}
          interactions={interactions}
          contactRelationships={contactRelationships}
          onClose={() => setAddingFor(null)}
          onSaved={() => { setAddingFor(null); onRefresh() }}
        />
      )}
    </div>
  )
}
