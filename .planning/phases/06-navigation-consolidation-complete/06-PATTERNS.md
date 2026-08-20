# Phase 6: Navigation Consolidation Complete - Pattern Map

**Mapped:** 2026-08-20
**Files analyzed:** 4 (1 deleted, 3 modified — no new files this phase)
**Analogs found:** 4 / 4 (all edits are to existing files; each file's own current content is its own best "analog" for byte-for-byte porting)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `app/src/components/TodayTab.jsx` (modified — gains merged charts Section) | component | transform (client-side aggregation over props) | `app/src/components/OverviewTab.jsx` (source of the ported block) | exact — verbatim port |
| `app/src/components/OverviewTab.jsx` (deleted) | component | transform | n/a (deletion) | n/a |
| `app/src/components/layout/Sidebar.jsx` (modified — `NAV_ITEMS` shrink + Settings footer/mobile buttons) | component | request-response (click → `onTabChange`) | itself, Pattern 1 precedent: Phase 5's removal of `'github'` from `NAV_ITEMS` | exact — same array-filter + button-insertion pattern already used once |
| `app/src/App.jsx` (modified — `useState` defaults, delete `'overview'` branches, `DEMO_NAV_ITEMS` filter) | component/router | request-response | itself (current file) | exact — subtractive edit, no new logic |

## Pattern Assignments

### `app/src/components/TodayTab.jsx` (component, transform)

**Analog:** `app/src/components/OverviewTab.jsx` (the file being merged in, then deleted)

**Imports to add** (from `OverviewTab.jsx` lines 1-5, merge with `TodayTab.jsx`'s existing imports — `STATUS_COLOR` already imported in `TodayTab.jsx`, do not duplicate):
```javascript
import BarChartWrapper from './charts/BarChart.jsx'
import DonutChart from './charts/DonutChart.jsx'
import TrendChart from './charts/TrendChart.jsx'
import { STATUS_CHART_COLORS } from './charts/theme.js'
import { TERMINAL_STAGES, INTERVIEW_STAGES, isUntriaged } from '../shared.jsx' // add alongside existing STATUS_COLOR import
import { Activity } from 'lucide-react' // add to existing lucide-react import line
```
Note: `NetworkGraphView` import is **not** needed — the "Your Network" preview card and KPI row are dropped per RESEARCH.md's Assumption A1 (only the 3 charts are ported).

**Core computation pattern** (`OverviewTab.jsx` lines ~19-25 `weekStart` helper, lines 29-66 data prep) — port verbatim as local consts inside `TodayTab.jsx`'s function body:
```javascript
function weekStart(d) {
  const date = new Date(d)
  const day = (date.getDay() + 6) % 7 // 0=Monday
  date.setDate(date.getDate() - day)
  date.setHours(0, 0, 0, 0)
  return date
}
// ...inside component:
const triagedApps  = apps.filter(a => !isUntriaged(a))
const hasRecruitingActivity = apps.length > 0
const stageCounts = {}
triagedApps.forEach(a => { stageCounts[a.stage] = (stageCounts[a.stage] || 0) + 1 })
const funnelStages = ['Wishlist','Applied','Phone Screen','Technical','Onsite','Offer']
const funnelData = funnelStages.map(stage => ({ label: stage, value: stageCounts[stage] || 0 }))
const conversions = [] // ...stage-to-stage % loop, ported verbatim
const donutData = Object.keys(STATUS_COLOR)
  .map(status => ({ label: status, value: contacts.filter(c => c.status === status).length, color: STATUS_CHART_COLORS[status] }))
  .filter(d => d.value > 0)
// trendWeeks/trendData loop ported verbatim
const hasInteractions = interactions.length > 0
```

**JSX shell pattern** — use `Section` (already imported in `TodayTab.jsx` from `./ui/Section.jsx`) instead of `OverviewTab.jsx`'s raw `<div className="bg-white rounded-xl p-5 shadow-sm border border-ink-100">` wrappers:
```javascript
<Section title="Activity" accent="ink" icon={Activity}>
  {hasRecruitingActivity && (
    <div className="py-3">
      <h3 className="text-xs font-medium text-ink-500 mb-3">Application Funnel</h3>
      <BarChartWrapper data={funnelData} height={180} />
      {conversions.length > 0 && (/* ...same conversions <p> as OverviewTab.jsx, verbatim */)}
    </div>
  )}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-3">
    <div>
      <h3 className="text-xs font-medium text-ink-500 mb-3">Network by Status</h3>
      {contacts.length === 0 ? <p className="text-sm text-ink-400">No contacts yet.</p> : <DonutChart data={donutData} centerLabel="contacts" />}
    </div>
    <div>
      <h3 className="text-xs font-medium text-ink-500 mb-3">Networking Activity</h3>
      {!hasInteractions ? <p className="text-sm text-ink-400">No logged interactions yet — use "+ Log Interaction" in Network.</p> : <TrendChart data={trendData} />}
    </div>
  </div>
</Section>
```
Note: `Section`'s own `divide-y divide-ink-100` wraps children — the nested `<div className="py-3">` blocks above replace `OverviewTab.jsx`'s separate white-card-per-chart wrappers, since `Section` is now the single card. Adjust class names as needed to avoid double-bordering; this is presentation detail, not a new pattern.

**Placement relative to `allEmpty` gate** — per `06-UI-SPEC.md`'s Interaction Contract (load-bearing, not discretionary): the existing early return
```javascript
if (allEmpty) return <EmptyState msg="✓ Nothing needs your attention. You're on top of it." />
```
at `TodayTab.jsx` (current location ~line 351) must be restructured so it does **not** also swallow the new charts Section. Concretely: compute `funnelData`/`donutData`/`trendData`/`hasRecruitingActivity`/`hasInteractions` *before* this early return, and change the return shape so the charts Section renders even when `allEmpty` is true — e.g. wrap the existing attention-Sections JSX in `{!allEmpty && (...)}` and render the new `<Section title="Activity" .../>` unconditionally alongside it, rather than returning early with a bare `<EmptyState/>`.

---

### `app/src/components/layout/Sidebar.jsx` (component, request-response)

**Analog:** itself — this is the exact same array-filter + button-list pattern already used for the desktop `<aside>` and mobile `<nav>`; Phase 5 already removed `'github'` from `NAV_ITEMS` the same way.

**`NAV_ITEMS` shrink** (lines 3-11, current 7-item array):
```javascript
const NAV_ITEMS = [
  { id: 'today', label: 'Today' },
  { id: 'overview', label: 'Overview' },   // DELETE
  { id: 'network',  label: 'Network' },
  { id: 'grow',     label: 'Grow' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'settings', label: 'Settings' },   // DELETE (moves to footer/mobile-float below)
]
```
→ becomes the 5 entries: today, network, grow, pipeline, calendar. Both the desktop `<aside>` nav (line ~28 `navItems.map`) and mobile bottom `<nav>` (line ~88 `navItems.map`) read this same array — no separate edit needed for either surface's list-shrink half.

**Desktop footer Settings button** — insert into the existing footer group (lines 49-68, inside `{!hideQuickActions && (<>...</>)}`), copying the sibling `+ Event` button's exact class string and the active-state ternary already used by `NAV_ITEMS` buttons (line ~36 `active ? 'bg-accent-500 text-white' : ...`):
```javascript
<button onClick={() => onTabChange('settings')}
  className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
    ${activeTab === 'settings' ? 'bg-accent-500 text-white' : 'bg-ink-800 text-ink-100 hover:bg-ink-700'}`}>
  <NAV_ICON.settings size={13} />
  Settings
</button>
```
`NAV_ICON` is already imported whole at line 1 (`import { NAV_ICON, REFRESH_ICON, ... } from '../../lib/icons.js'`) — `NAV_ICON.settings` needs no new import.

**Mobile floating Settings button** — insert into the mobile floating-action stack (lines 101-117, same `{!hideQuickActions && (<>...</>)}` gate), following the exact sibling pattern (`onQuickCapture`/`onAddSchedule`/`onAddEvent` buttons at `bottom-52`/`bottom-36`/`bottom-20`):
```javascript
<button onClick={() => onTabChange('settings')}
  className="md:hidden fixed right-4 bottom-56 z-30 w-12 h-12 rounded-full bg-ink-800 text-white shadow-lg flex items-center justify-center hover:bg-ink-700">
  <NAV_ICON.settings size={20} />
</button>
```
Do not use `bg-accent-500` (that's reserved for Quick Capture, the one primary CTA in the group) — use the same `bg-ink-800`/`hover:bg-ink-700` neutral fill as `+ Schedule`/`+ Event`.

**Gating** — both new buttons reuse `hideQuickActions` (already `demoMode`-equivalent at its only call site, `AppShell.jsx:19`) rather than inventing a new prop — per RESEARCH.md's explicit anti-pattern warning against a second boolean.

---

### `app/src/App.jsx` (component/router, request-response)

**Analog:** itself — pure subtractive edit to existing conditionals, no new pattern needed.

**Default-tab fix** (`AppInner` line 225, `DemoApp` line 361) — both currently:
```javascript
const [tab, setTab] = useState('overview')
```
→ change both to `useState('today')`. This must land in the same commit as the render-branch deletion below, or the app boots blank (RESEARCH.md Pitfall 1).

**Delete `'overview'` render branches**:
```javascript
// AppInner, lines ~304-309 — delete:
{!loading && tab === 'overview' && (
  <OverviewTab contacts={contacts} apps={apps} interactions={interactions}
    onOpenGraph={() => { setNetworkInitialView('graph'); setTab('network') }}
    onOpenActions={() => setTab('today')} />
)}

// DemoApp, lines ~397-400 — delete:
{!loading && tab === 'overview' && (
  <OverviewTab contacts={contacts} apps={apps} interactions={interactions}
    onOpenGraph={() => setTab('network')} onOpenActions={() => setTab('today')} />
)}

// Delete the now-unused import (line ~18):
import OverviewTab from './components/OverviewTab.jsx'
```

**`DEMO_NAV_ITEMS` filter** (line 358):
```javascript
const DEMO_NAV_ITEMS = NAV_ITEMS.filter(item => ['today', 'overview', 'network', 'pipeline'].includes(item.id))
```
→
```javascript
const DEMO_NAV_ITEMS = NAV_ITEMS.filter(item => ['today', 'network', 'pipeline'].includes(item.id))
```

**Untouched (verify-only, per NAV-03 audit — do not edit)**:
```javascript
// AppInner — leave byte-for-byte identical:
const goFindPeople = company => { setGrowFocusCompany({ company, ts: Date.now() }); setTab('grow') }
{!loading && tab === 'grow' && (
  <GrowTab contacts={contacts} apps={apps} interactions={interactions} contactRelationships={contactRelationships} onRefresh={load}
    onRefreshRelationships={refreshContactRelationships} initialPeopleFocus={growFocusCompany} />
)}
```
This conditional's unmount/remount-on-tab-switch shape is what makes `GrowTab.jsx`'s `useState(initialPeopleFocus)` re-seed correctly on repeat "Find people →" clicks (RESEARCH.md Pitfall 3). No file in this phase's scope needs to touch `GrowTab.jsx`, `DiscoverTab.jsx`, `ExploreTab.jsx`, `ReferralCoverageTab.jsx`, `PipelineTab.jsx`, `ApplicationsView.jsx`, or `panels/ApplicationPanelBody.jsx` — they're read-only context for the audit.

---

## Shared Patterns

### `Section`/`RowCap`/`HEADING_COLOR` primitive
**Source:** `app/src/components/ui/Section.jsx` (full file, 45 lines — reproduced in full below since it's small and every consumer needs the exact shape)
```javascript
function Section({ title, subtitle, accent, icon: Icon, step, children }) {
  const border = { danger: 'border-danger-200', warning: 'border-warning-200', ink: 'border-ink-200', accent: 'border-accent-200' }[accent] || 'border-ink-200'
  const heading = HEADING_COLOR[accent] || 'text-ink-700'
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border ${border}`}>
      <h2 className={`text-sm font-semibold ${heading} mb-1 flex items-center gap-1.5`}>
        {step && <Mono className="text-ink-500">{step}</Mono>}
        {Icon && <Icon size={16} strokeWidth={2} />} {title}
      </h2>
      {subtitle && <p className="text-xs text-ink-400 mb-3">{subtitle}</p>}
      <div className="divide-y divide-ink-100">{children}</div>
    </div>
  )
}
```
**Apply to:** the new merged charts Section in `TodayTab.jsx` — use `accent="ink"` (data display, not a call-to-action; matches `01-UI-SPEC.md`'s accent-budget rule).

### Active-nav-item styling (reused for the new Settings footer/mobile buttons)
**Source:** `Sidebar.jsx`'s existing `NAV_ITEMS` button ternary (line ~36):
```javascript
${active ? 'bg-accent-500 text-white' : 'text-ink-300 hover:bg-ink-800 hover:text-white'}
```
**Apply to:** desktop Settings footer button (adapted to the footer's base classes, per the Pattern Assignments section above) — active state is `bg-accent-500 text-white` when `activeTab === 'settings'`, same convention every other nav destination uses.

### Deep-link re-trigger mechanism (`{company, ts: Date.now()}` + `useEffect([focus?.ts])`)
**Source:** `App.jsx`'s `goFindPeople`, mirrored in `GrowTab.jsx`'s `goToPeople` and consumed by `DiscoverTab.jsx`'s `useEffect([focus?.ts])`.
**Apply to:** nothing new this phase — this is documented here only so the planner knows **not** to touch it. Any plan step touching `App.jsx`'s `AppInner`/`DemoApp` functions must leave this mechanism (and the `{tab === 'grow' && <GrowTab/>}` conditional-mount shape it depends on) byte-for-byte unchanged.

## No Analog Found

None — every file in this phase's scope is a modification of an already-existing file (or deletion), so each file's own current source is the analog for what to preserve/port. No new file/component type is introduced.

## Metadata

**Analog search scope:** `app/src/App.jsx`, `app/src/components/TodayTab.jsx`, `app/src/components/OverviewTab.jsx`, `app/src/components/layout/Sidebar.jsx`, `app/src/components/ui/Section.jsx` — all read directly, no broader search needed since CONTEXT.md/RESEARCH.md already named the exact files and line ranges.
**Files scanned:** 5 (all read in full or targeted ranges)
**Pattern extraction date:** 2026-08-20
