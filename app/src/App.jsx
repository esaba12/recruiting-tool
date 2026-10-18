import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react'
import { fetchContacts, fetchApplications, fetchInteractions, fetchCalls, fetchContactRelationships, fetchActionItems, fetchDailyRecap } from './db.js'
import { researchOaDeadlines } from './lib/oaResearch.js'
import { useAuth } from './lib/AuthContext.jsx'
import useApplicationsLive from './lib/useApplicationsLive.js'
import useEventIngest from './lib/useEventIngest.js'
import useRecruitingEvents from './lib/useRecruitingEvents.js'
import useEventCalendarSync from './lib/useEventCalendarSync.js'
import { useTargetCompanies } from './lib/useTargetCompanies.js'
import LoginPage from './components/LoginPage.jsx'
import { STATUS_COLOR, URGENCY_COLOR, REFERRAL_STATUS_COLOR, daysSince, daysUntil, fmt, Badge, EmptyState, isOverdue } from './shared.jsx'
import { statusIconFor, URGENCY_ICON } from './lib/icons.js'
import AppShell from './components/layout/AppShell.jsx'
import SidePanel from './components/ui/SidePanel.jsx'
import ContactPanelBody from './components/panels/ContactPanelBody.jsx'
import QuickAddContactModal from './components/QuickAddContactModal.jsx'
import LogInteractionModal from './components/LogInteractionModal.jsx'
import MetButton from './components/MetButton.jsx'
import { logMetWithContact } from './lib/quickLog.js'
import { DEMO_PIPELINE_VIEWS, pipelineViewsFor } from './components/pipelineViews.js'
import TodayTab from './components/TodayTab.jsx'
import { buildThreads } from './lib/inbox.js'
import useLearning from './lib/learning/useLearning.js'
import NotFoundPage from './components/NotFoundPage.jsx'
import FeedbackHost from './components/onboarding/FeedbackHost.jsx'
import { needsOnboarding } from './lib/onboarding.js'
import { useKeysReady } from './lib/useKeyStatus.js'
import { NAV_ITEMS } from './components/layout/Sidebar.jsx'
import { overdueFollowUps, staleApplications, highUrgencyContacts, wantToSchedule, oaDue, oaNeedsCheck, keepInTouchDue, needsReviewApps } from './lib/attention.js'
import { Table2, LayoutGrid, Share2, Send, Waypoints } from 'lucide-react'
import NetworkingFlowPanel from './components/NetworkingFlowPanel.jsx'
import DelayedFallback from './components/ui/DelayedFallback.jsx'
import { preloadCharts } from './components/charts/lazy.jsx'

// ── Lazy tabs (v1.3 spec 09) ─────────────────────────────────────────────────────
// Today is the landing tab and stays in the entry chunk; every other tab (and the
// Network graph/Outbox views) loads on first open. Once the app is idle after its first
// load, prefetchTabs() warms all of them so later switches don't wait on the network.
const TAB_CHUNKS = {
  pipeline: () => import('./components/PipelineTab.jsx'),
  inbox:    () => import('./components/InboxTab.jsx'),
  grow:     () => import('./components/GrowTab.jsx'),
  learn:    () => import('./components/LearnTab.jsx'),
  calendar: () => import('./components/CalendarTab.jsx'),
  settings: () => import('./components/SettingsTab.jsx'),
  graph:    () => import('./components/NetworkGraphTab.jsx'),
  outbox:   () => import('./components/OutboxTab.jsx'),
  contactsTable: () => import('./components/ContactsTable.jsx'), // @tanstack/table
}
const PipelineTab     = lazy(TAB_CHUNKS.pipeline)
const InboxTab        = lazy(TAB_CHUNKS.inbox)
const GrowTab         = lazy(TAB_CHUNKS.grow)
const LearnTab        = lazy(TAB_CHUNKS.learn)
const CalendarTab     = lazy(TAB_CHUNKS.calendar)
const SettingsTab     = lazy(TAB_CHUNKS.settings)
const NetworkGraphTab = lazy(TAB_CHUNKS.graph)
const OutboxTab       = lazy(TAB_CHUNKS.outbox)
const ContactsTable   = lazy(TAB_CHUNKS.contactsTable)
// Open-on-demand modals and the new-user wizard: most sessions never render them.
const AddToCalendarModal = lazy(() => import('./components/AddToCalendarModal.jsx'))
const QuickScheduleModal = lazy(() => import('./components/QuickScheduleModal.jsx'))
const QuickCaptureModal  = lazy(() => import('./components/QuickCaptureModal.jsx'))
const OnboardingWizard   = lazy(() => import('./components/onboarding/OnboardingWizard.jsx'))

let prefetched = false
function usePrefetchTabs(ready) {
  useEffect(() => {
    if (!ready || prefetched) return
    const idle = window.requestIdleCallback || (cb => setTimeout(cb, 1500))
    const cancel = window.cancelIdleCallback || clearTimeout
    const id = idle(() => {
      prefetched = true
      // A failed prefetch is harmless: lazy() retries the import on first open.
      Object.values(TAB_CHUNKS).forEach(load => load().catch(() => {}))
      preloadCharts().catch(() => {})
    })
    return () => cancel(id)
  }, [ready])
}

// ── Network Tab ───────────────────────────────────────────────────────────────

const NETWORK_VIEWS = [
  { key: 'table',    label: 'Table',    icon: Table2 },
  { key: 'cards',    label: 'Cards',    icon: LayoutGrid },
  { key: 'graph',    label: 'Graph',    icon: Share2 },
  { key: 'flow',     label: 'Flow',     icon: Waypoints },
  { key: 'outbox',   label: 'Outbox',   icon: Send },
]

// The public /demo route (see DemoApp below) only shows views that need zero AI/BYOK
// keys and no deep-links into ones that do — Outbox calls Exa+Claude/GPT (401s
// with no signed-in user), Keep in Touch's "Log" leans on the same AI extraction.
// Table/Cards/Graph/Flow are pure local rendering over the seeded demo data, so they
// work perfectly with no backend at all.
const DEMO_NETWORK_VIEWS = NETWORK_VIEWS.filter(v => ['table', 'cards', 'graph', 'flow'].includes(v.key))

function NetworkTab({ contacts, apps, interactions, calls = [], contactRelationships = [], onRefresh, onRefreshRelationships, initialView = 'table', views = NETWORK_VIEWS }) {
  const [filter, setFilter]   = useState('ALL')
  const [search, setSearch]   = useState('')
  const [view, setView]       = useState(initialView) // 'table' | 'cards' | 'graph'
  const [editing, setEditing] = useState(null)   // contact object | 'new' | null
  const [logOpen, setLogOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  const filtered = contacts
    .filter(c => {
      if (filter !== 'ALL' && c.status !== filter) return false
      if (search) {
        const q = search.toLowerCase()
        if (![c.name, c.company, c.role, c.email].some(f => f?.toLowerCase().includes(q))) return false
      }
      return true
    })
    .sort((a, b) => {
      const u = { HIGH: 0, MED: 1, LOW: 2 }
      if (u[a.urgency] !== u[b.urgency]) return (u[a.urgency] ?? 2) - (u[b.urgency] ?? 2)
      if (a.followUpDate && b.followUpDate) return new Date(a.followUpDate) - new Date(b.followUpDate)
      return 0
    })

  const statuses = ['ALL', '🟢 Warm', '🟡 Cooling', '🔴 Cold', '⭐ Champion', '✅ Closed']

  async function handleMet(contact) {
    await logMetWithContact(contact)
    onRefresh()
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        {statuses.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filter === s
              ? 'bg-accent-600 text-on-accent border-accent-600'
              : 'bg-surface text-ink-600 border-ink-200 hover:border-accent-300'}`}>
            {s === 'ALL' ? `All (${contacts.length})` : s}
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          className="px-3 py-1 border border-ink-200 rounded-full text-xs focus:outline-none focus:border-accent-400 w-44" />
        <div className="ml-auto flex items-center gap-2 flex-wrap justify-end min-w-0 max-w-full">
          <div className="flex max-w-full overflow-x-auto border border-ink-200 rounded-full text-xs font-medium">
            {views.map(v => (
              <button key={v.key} onClick={() => setView(v.key)}
                className={`shrink-0 whitespace-nowrap px-3 py-1 flex items-center gap-1.5 transition-colors ${view === v.key ? 'bg-ink-900 text-on-fill' : 'bg-surface text-ink-500 hover:bg-ink-50'}`}>
                <v.icon size={13} strokeWidth={2.25} />
                {v.label}
              </button>
            ))}
          </div>
          <button onClick={() => setLogOpen(true)}
            className="px-3 py-1 bg-surface border border-ink-200 rounded-full text-xs font-medium text-ink-600 hover:border-accent-300 whitespace-nowrap">
            + Log Interaction
          </button>
          <button onClick={() => setQuickAddOpen(true)}
            className="px-3 py-1 bg-accent-600 text-on-accent rounded-full text-xs font-medium hover:bg-accent-700 whitespace-nowrap">
            + Contact
          </button>
        </div>
      </div>

      <Suspense fallback={<DelayedFallback />}>
      {view === 'flow'
        ? (
          <div className="bg-surface rounded-md p-4 border border-ink-200">
            <h2 className="text-sm font-semibold text-ink-700 mb-3">Where Networking Went</h2>
            <NetworkingFlowPanel contacts={contacts} interactions={interactions} calls={calls} height={320} onOpenContact={c => setEditing(c)} />
          </div>
        )
        : view === 'graph'
        ? <NetworkGraphTab contacts={contacts} contactRelationships={contactRelationships} />
        : view === 'outbox'
        ? <OutboxTab contacts={contacts} interactions={interactions} />
        : filtered.length === 0
        ? <EmptyState msg={contacts.length === 0 ? 'No contacts yet — the email pipeline will add them as recruiting emails come in.' : 'No contacts match this filter.'} />
        : view === 'table'
        ? <ContactsTable contacts={filtered} onEdit={c => setEditing(c)} onMet={handleMet} />
        : (
          <div className="space-y-2">
            {filtered.map(c => {
              const overdue = isOverdue(c)
              const lastSeen = daysSince(c.lastInteraction)
              return (
                <div key={c.id} onClick={() => setEditing(c)}
                  className={`bg-surface rounded-xl px-4 py-3 shadow-sm border transition-shadow hover:shadow-md cursor-pointer ${overdue ? 'border-danger-200' : 'border-ink-100'}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-ink-900">{c.name}</span>
                        {c.company && <span className="text-sm text-ink-500">@ {c.company}</span>}
                        {c.role && <span className="text-xs text-ink-400">· {c.role}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <Badge label={c.status} color={STATUS_COLOR[c.status]} icon={statusIconFor(c.status)} />
                        {c.urgency && c.urgency !== 'LOW' && <Badge label={c.urgency} color={URGENCY_COLOR[c.urgency]} icon={URGENCY_ICON[c.urgency]} />}
                        {c.referredByName && <Badge label={`↩ ${c.referredByName}`} color="bg-indigo-50 text-indigo-600" />}
                        {c.referralStatus && c.referralStatus !== 'Not Asked' && <Badge label={c.referralStatus} color={REFERRAL_STATUS_COLOR[c.referralStatus]} />}
                        {c.email && (
                          <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} className="text-xs text-link hover:underline">{c.email}</a>
                        )}
                        {c.linkedin && (
                          <a href={c.linkedin} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-link hover:underline">LinkedIn ↗</a>
                        )}
                      </div>
                      {c.whatTheyDid && (
                        <p className="text-xs text-ink-500 mt-1 line-clamp-1 italic">"{c.whatTheyDid}"</p>
                      )}
                      {!c.whatTheyDid && c.notes && (
                        <p className="text-xs text-ink-400 mt-1 line-clamp-1">{c.notes}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0 space-y-1 text-xs">
                      {lastSeen !== null && (
                        <p className="text-ink-400">Last: {fmt(c.lastInteraction)}</p>
                      )}
                      {c.followUpDate && (
                        <p className={`font-medium ${overdue ? 'text-danger-600' : 'text-ink-500'}`}>
                          {overdue
                            ? `⚠ ${Math.abs(daysUntil(c.followUpDate))}d overdue`
                            : `Due ${fmt(c.followUpDate)}`}
                        </p>
                      )}
                      <MetButton contact={c} onMet={handleMet} className="mt-1" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Suspense>

      <SidePanel open={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <ContactPanelBody
            contact={editing === 'new' ? null : editing}
            contacts={contacts}
            interactions={interactions}
            contactRelationships={contactRelationships}
            onClose={() => setEditing(null)}
            onSaved={() => { setEditing(null); onRefresh() }}
            onRefreshRelationships={onRefreshRelationships}
          />
        )}
      </SidePanel>

      {logOpen && (
        <LogInteractionModal
          contacts={contacts}
          onClose={() => setLogOpen(false)}
          onSaved={() => { setLogOpen(false); onRefresh() }}
        />
      )}

      {quickAddOpen && (
        <QuickAddContactModal
          contacts={contacts}
          onClose={() => setQuickAddOpen(false)}
          onSaved={() => { setQuickAddOpen(false); onRefresh() }}
        />
      )}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

function AuthGate({ children }) {
  const { user, profile, loading, profileLoading } = useAuth()
  if (loading || profileLoading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <p className="text-sm text-ink-400">Loading...</p>
      </div>
    )
  }
  if (!user) return <LoginPage />
  if (needsOnboarding(profile)) return <Suspense fallback={<DelayedFallback />}><OnboardingWizard /></Suspense>
  return children
}

// The active tab lives in the URL hash (#pipeline) and sessionStorage, so a reload, a
// remount, or an OAuth round trip (Connect Calendar/Gmail redirect back to `/`) lands you
// on the tab you were on instead of Today. Opening Settings remembers the tab you came
// from; saving in Settings (or its Back link) returns you there.
const TAB_IDS = new Set([...NAV_ITEMS.map(i => i.id), 'settings'])
const TAB_KEY = 'rec_tab'
const RETURN_TAB_KEY = 'rec_settings_return_tab'
function storedTab(key) {
  try { const v = sessionStorage.getItem(key); return TAB_IDS.has(v) ? v : null } catch { return null }
}
function storeTab(key, value) {
  try { sessionStorage.setItem(key, value) } catch { /* private mode etc. — URL hash still works */ }
}
function hashTab() {
  const h = window.location.hash.slice(1)
  return TAB_IDS.has(h) ? h : null
}

function AppInner() {
  const [tab, setTabState]      = useState(() => hashTab() || storedTab(TAB_KEY) || 'today')
  const [settingsReturnTab, setSettingsReturnTab] = useState(() => storedTab(RETURN_TAB_KEY) || 'today')
  const tabRef = useRef(tab)
  tabRef.current = tab
  const setTab = useCallback(next => {
    const prev = tabRef.current
    if (!TAB_IDS.has(next) || next === prev) return
    if (next === 'settings') setSettingsReturnTab(prev)
    setTabState(next)
    window.history.pushState(null, '', `#${next}`)
  }, [])
  useEffect(() => { storeTab(TAB_KEY, tab) }, [tab])
  useEffect(() => { storeTab(RETURN_TAB_KEY, settingsReturnTab) }, [settingsReturnTab])
  // Reflect a restored tab in the URL, and follow browser back/forward between tabs.
  useEffect(() => {
    if (hashTab() !== tabRef.current) window.history.replaceState(null, '', `#${tabRef.current}`)
    const onPop = () => { const h = hashTab(); if (h) setTabState(h) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const leaveSettings = useCallback(() => setTab(settingsReturnTab), [setTab, settingsReturnTab])
  // Deep links from outside the tab tree (e.g. NeedsKey's "add a key in Settings").
  useEffect(() => {
    const onNavigate = e => { if (e.detail?.tab) setTab(e.detail.tab) }
    window.addEventListener('rec:navigate', onNavigate)
    return () => window.removeEventListener('rec:navigate', onNavigate)
  }, [])
  const [networkInitialView, setNetworkInitialView] = useState('table')
  const [growFocusCompany, setGrowFocusCompany] = useState(null)
  // Deep-link into Grow's People section, pre-searching one company — shared by Pipeline's
  // and Today's "who could I meet here" panels so both land in the same place.
  const goFindPeople = company => {
    setGrowFocusCompany({ company, ts: Date.now() }); setTab('grow')
  }
  const [contacts, setContacts] = useState([])
  const [apps, setApps]         = useState([])
  const [interactions, setInteractions] = useState([])
  const [calls, setCalls]       = useState([])
  const [contactRelationships, setContactRelationships] = useState([])
  const [actionItems, setActionItems] = useState([])
  const [dailyRecap, setDailyRecap] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [lastLoaded, setLastLoaded] = useState(null)
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [addScheduleOpen, setAddScheduleOpen] = useState(false)
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false)
  // Learn tab data lives here (not in LearnTab) so Today's Interview Prep section can read it.
  const learning = useLearning({ enabled: true })
  const [learnLogRequest, setLearnLogRequest] = useState(null)
  const logOa = app => { setLearnLogRequest({ kind: 'assessment', applicationId: app.id, title: `${app.company} OA` }); setTab('learn') }

  useEffect(() => { load() }, [])

  // Recruiting Events: hands-off daily pull of the school's feeds into the shared
  // pool (server-side cooldown means only the first open of the day at a campus
  // actually pulls). Lives here, not in CalendarTab, so it fires on any tab. A
  // successful pull bumps `eventsRefreshKey` so the pool hook below re-reads.
  const [eventsRefreshKey, setEventsRefreshKey] = useState(0)
  const { profile, user } = useAuth()
  // No campus → the server can only answer 400 "pick your campus", so don't ask daily.
  useEventIngest({ enabled: !!profile?.school_id, onIngested: () => setEventsRefreshKey(k => k + 1) })
  const { targets: targetCompanies } = useTargetCompanies()
  // Shared pool + this user's overlay; consumed by Today (attention sections) and
  // Calendar (Events view). Enrichment/relevance run inside the hook.
  const eventPool = useRecruitingEvents({
    enabled: !!profile?.school_id, profile, targets: targetCompanies, contacts, apps, refreshKey: eventsRefreshKey,
  })
  // Google Calendar push for the pool (dedicated "Recruiting" calendar) — auto-pushes
  // relevance-high events, reconciles Google-side deletes; exposes push/unpush to the UI.
  const eventCalendarSync = useEventCalendarSync({ pool: eventPool, enabled: !!profile?.school_id })
  usePrefetchTabs(!loading)

  async function load() {
    setLoading(true); setError(null)
    try {
      const [c, a, i, cl, cr, ai, dr] = await Promise.all([
        fetchContacts(), fetchApplications(), fetchInteractions(), fetchCalls(), fetchContactRelationships(),
        fetchActionItems(), fetchDailyRecap(),
      ])
      setContacts(c); setApps(a); setInteractions(i); setCalls(cl); setContactRelationships(cr)
      setActionItems(ai); setDailyRecap(dr)
      setLastLoaded(new Date().toLocaleTimeString())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  // Cloud-agent research fallback for OA due dates the email pipeline couldn't extract — see
  // lib/oaResearch.js. Runs whenever `apps` changes; researchOaDeadlines() itself filters down to
  // applications actually needing a (re)check, so most runs after the first are a fast no-op.
  // oaResearchRunningRef guards against overlapping runs when `apps` changes again (e.g. from
  // load() below) before a prior pass has finished; the effect naturally converges because a
  // completed pass stamps oaDueDate/oaResearchCheckedAt on every app it touched, so the next
  // pass's filter no longer matches them.
  const oaResearchRunningRef = useRef(false)
  const oaKeysReady = useKeysReady('ai', 'exa')
  useEffect(() => {
    if (loading || !oaKeysReady || oaResearchRunningRef.current) return
    oaResearchRunningRef.current = true
    researchOaDeadlines(apps)
      .then(count => { if (count > 0) load() })
      .catch(() => { /* fail-soft — OA due dates just stay unresolved until next load */ })
      .finally(() => { oaResearchRunningRef.current = false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apps, oaKeysReady])

  // Narrower than load() on purpose: doesn't touch `loading`, which gates whether
  // NetworkTab (and the open record panel it may have open) is even mounted —
  // toggling it while a record is mid-edit would unmount and silently close it.
  async function refreshContactRelationships() {
    setContactRelationships(await fetchContactRelationships())
  }

  // Same reasoning for the Pipeline Sheet: an inline cell edit (or a live update from the
  // email pipeline) must not unmount the grid and lose the active cell / scroll position.
  async function refreshApps() {
    setApps(await fetchApplications())
  }
  async function refreshContacts() {
    setContacts(await fetchContacts())
  }
  useApplicationsLive({ userId: user?.id, onChange: refreshApps })

  const activeApps = apps.filter(a => !['Rejected','Accepted'].includes(a.stage))
  const openActionItemCount = actionItems.filter(i => !i.completedAt && !i.dismissedAt).length
  const todayCount = overdueFollowUps(contacts).length + staleApplications(apps).length + highUrgencyContacts(contacts).length + wantToSchedule(contacts).length + oaDue(apps).length + oaNeedsCheck(apps).length + keepInTouchDue(contacts, interactions).length + needsReviewApps(apps).length + openActionItemCount

  const inboxUnread = useMemo(
    () => buildThreads({ interactions }).filter(t => t.unread).length, [interactions])

  const counts = {
    inbox: inboxUnread > 0 ? inboxUnread : null,
    network: contacts.length,
    pipeline: activeApps.length,
    today: todayCount > 0 ? todayCount : null,
  }

  return (
    <AppShell
      activeTab={tab}
      onTabChange={setTab}
      counts={counts}
      loading={loading}
      lastLoaded={lastLoaded}
      onRefresh={load}
      onAddEvent={() => setAddEventOpen(true)}
      onAddSchedule={() => setAddScheduleOpen(true)}
      onQuickCapture={() => setQuickCaptureOpen(true)}
      error={error}
    >
      {loading && <EmptyState msg="Loading your data..." />}
      <Suspense fallback={<DelayedFallback />}>
      {!loading && tab === 'network'  && (
        <NetworkTab contacts={contacts} apps={apps} interactions={interactions} calls={calls} contactRelationships={contactRelationships} onRefresh={load}
          onRefreshRelationships={refreshContactRelationships}
          initialView={networkInitialView} />
      )}
      {!loading && tab === 'grow'     && (
        <GrowTab contacts={contacts} apps={apps} interactions={interactions} contactRelationships={contactRelationships} onRefresh={load}
          onRefreshRelationships={refreshContactRelationships} initialPeopleFocus={growFocusCompany} />
      )}
      {!loading && tab === 'pipeline' && (
        <PipelineTab apps={apps} contacts={contacts} interactions={interactions} relationships={contactRelationships} onRefresh={load}
          onFindPeople={goFindPeople} onRefreshRelationships={refreshContactRelationships} onRefreshApps={refreshApps} views={pipelineViewsFor(profile)} />
      )}
      {!loading && tab === 'today'    && <TodayTab contacts={contacts} apps={apps} interactions={interactions} calls={calls} relationships={contactRelationships} actionItems={actionItems} dailyRecap={dailyRecap} learning={learning} onOpenLearn={() => setTab('learn')} onLogOa={logOa} onFindPeople={goFindPeople} onRefresh={load} onRefreshRelationships={refreshContactRelationships} eventPool={eventPool} onOpenEvents={() => setTab('calendar')} />}
      {!loading && tab === 'inbox'    && (
        <InboxTab contacts={contacts} apps={apps} interactions={interactions} actionItems={actionItems} onRefresh={load} />
      )}
      {!loading && tab === 'learn'    && <LearnTab learning={learning} apps={apps} profile={profile} logRequest={learnLogRequest} onLogRequestHandled={() => setLearnLogRequest(null)} />}
      {!loading && tab === 'calendar' && <CalendarTab contacts={contacts} apps={apps} interactions={interactions} calls={calls} onRefresh={load} eventPool={eventPool} eventCalendarSync={eventCalendarSync} onRefreshContacts={refreshContacts} />}
      {tab === 'settings' && (
        <SettingsTab onDone={leaveSettings}
          returnLabel={NAV_ITEMS.find(i => i.id === settingsReturnTab)?.label || 'Today'} />
      )}
      </Suspense>

      <FeedbackHost />
      <Suspense fallback={null}>
      {addEventOpen && <AddToCalendarModal onClose={() => setAddEventOpen(false)} />}
      {addScheduleOpen && (
        <QuickScheduleModal
          contacts={contacts}
          onClose={() => setAddScheduleOpen(false)}
          onSaved={() => { setAddScheduleOpen(false); load() }}
        />
      )}
      {quickCaptureOpen && (
        <QuickCaptureModal
          contacts={contacts}
          apps={apps}
          onClose={() => setQuickCaptureOpen(false)}
          onSaved={load}
        />
      )}
      </Suspense>
    </AppShell>
  )
}

// ── Demo (public /demo route, no sign-in) ───────────────────────────────────────
//
// Reuses the exact same tab components as the real app — db.js's isDemoMode() branch
// (keyed off this same /demo path) means every fetch*/add*/update* call these components
// already make transparently reads/writes an in-memory seed dataset instead of Supabase,
// so nothing here needed forking into a separate "read-only" UI. Scope is deliberately
// trimmed to the tabs that need zero AI/BYOK keys and zero external OAuth (Today,
// Network table/cards/graph, Pipeline, Learn — Learn's AI plan/explain-back buttons are
// fail-soft and the tab says so in demo mode) — Grow/Outbox/Job
// Boards/Calendar/Settings all call Claude/OpenAI/Exa/GitHub/Google proxies that
// `requireUser()`-gate on a real signed-in session and would just 401 for an anonymous
// visitor, so they're left out rather than shown half-broken.
const DEMO_NAV_ITEMS = NAV_ITEMS.filter(item => ['today', 'inbox', 'network', 'pipeline', 'calendar', 'learn'].includes(item.id))

function DemoApp() {
  const [tab, setTab] = useState('today')
  const [contacts, setContacts] = useState([])
  const [apps, setApps] = useState([])
  const [interactions, setInteractions] = useState([])
  const [contactRelationships, setContactRelationships] = useState([])
  const [loading, setLoading] = useState(true)
  const learning = useLearning({ enabled: true })
  // Recruiting events from demoData.js (db.js's demo branch). isDemo skips the AI
  // enrichment pass; there's no Google account, so no calendar sync hook.
  const eventPool = useRecruitingEvents({ enabled: true, isDemo: true, contacts, apps })
  usePrefetchTabs(!loading)

  useEffect(() => { load() }, [])


  async function load() {
    setLoading(true)
    const [c, a, i, cr] = await Promise.all([fetchContacts(), fetchApplications(), fetchInteractions(), fetchContactRelationships()])
    setContacts(c); setApps(a); setInteractions(i); setContactRelationships(cr)
    setLoading(false)
  }

  // See AppInner's identical helper: avoids toggling `loading` (which would unmount
  // NetworkTab and close the open record panel mid-edit).
  async function refreshContactRelationships() {
    setContactRelationships(await fetchContactRelationships())
  }

  async function refreshApps() {
    setApps(await fetchApplications())
  }
  async function refreshContacts() {
    setContacts(await fetchContacts())
  }

  const activeApps = apps.filter(a => !['Rejected', 'Accepted'].includes(a.stage))
  const todayCount = overdueFollowUps(contacts).length + staleApplications(apps).length + highUrgencyContacts(contacts).length + wantToSchedule(contacts).length + oaDue(apps).length + oaNeedsCheck(apps).length + keepInTouchDue(contacts, interactions).length + needsReviewApps(apps).length
  const inboxUnread = buildThreads({ interactions }).filter(t => t.unread).length
  const counts = { inbox: inboxUnread || null, network: contacts.length, pipeline: activeApps.length, today: todayCount > 0 ? todayCount : null }

  return (
    <AppShell
      activeTab={tab}
      onTabChange={setTab}
      counts={counts}
      loading={loading}
      navItems={DEMO_NAV_ITEMS}
      demoMode
    >
      {loading && <EmptyState msg="Loading the demo..." />}
      <Suspense fallback={<DelayedFallback />}>
      {!loading && tab === 'network' && (
        <NetworkTab contacts={contacts} apps={apps} interactions={interactions} contactRelationships={contactRelationships} onRefresh={load}
          onRefreshRelationships={refreshContactRelationships} views={DEMO_NETWORK_VIEWS} />
      )}
      {!loading && tab === 'pipeline' && (
        <PipelineTab apps={apps} contacts={contacts} interactions={interactions} relationships={contactRelationships} onRefresh={load}
          onRefreshRelationships={refreshContactRelationships} onRefreshApps={refreshApps} views={DEMO_PIPELINE_VIEWS} />
      )}
      {!loading && tab === 'today' && (
        <TodayTab contacts={contacts} apps={apps} interactions={interactions} relationships={contactRelationships}
          learning={learning} onOpenLearn={() => setTab('learn')}
          onRefresh={load} onRefreshRelationships={refreshContactRelationships} isDemoMode
          eventPool={eventPool} onOpenEvents={() => setTab('calendar')} />
      )}
      {!loading && tab === 'calendar' && (
        <CalendarTab contacts={contacts} apps={apps} interactions={interactions} calls={[]} onRefresh={load} eventPool={eventPool} eventCalendarSync={null} isDemoMode onRefreshContacts={refreshContacts} />
      )}
      {!loading && tab === 'inbox' && (
        <InboxTab contacts={contacts} apps={apps} interactions={interactions} onRefresh={load} demoMode />
      )}
      {!loading && tab === 'learn' && <LearnTab learning={learning} apps={apps} isDemoMode />}
      </Suspense>
    </AppShell>
  )
}

export default function App() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'
  const isDemo = pathname.startsWith('/demo')
  if (isDemo) return <DemoApp />

  // No client-side router — every real feature lives at "/" as tab state, so any other
  // path (typo, dead link, stale bookmark) is genuinely unknown.
  if (pathname !== '/') return <NotFoundPage path={pathname} />

  return (
    <AuthGate>
      <AppInner />
    </AuthGate>
  )
}
