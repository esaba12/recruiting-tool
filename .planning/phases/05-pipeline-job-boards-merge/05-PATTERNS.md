# Phase 5: Pipeline + Job Boards Merge - Pattern Map

**Mapped:** 2026-08-19
**Files analyzed:** 6 (2 renames, 1 new shell, 3 modified integration points)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|---------------|
| `app/src/components/PipelineTab.jsx` (rewritten as thin shell) | component (view-switch shell) | request-response (client-only) | `app/src/App.jsx`'s `NetworkTab` (`NETWORK_VIEWS`/`views` prop) for the switcher; `app/src/components/GrowTab.jsx` for shell-wraps-bodies structure | exact (switcher) / exact (shell shape) |
| `app/src/components/ApplicationsView.jsx` (new file, = current `PipelineTab.jsx` body, renamed) | component | CRUD | itself (`app/src/components/PipelineTab.jsx`, current content — pure rename, zero logic change) | exact |
| `app/src/components/jobBoards/JobBoardsView.jsx` (new file, = current `jobBoards/GitHubTab.jsx`, renamed) | component | request-response / event-driven (board fetch + auto-import) | itself (`app/src/components/jobBoards/GitHubTab.jsx`, current content — pure rename, zero logic change) | exact |
| `app/src/App.jsx` (modified: imports, render branches, `DEMO_NAV_ITEMS` unaffected but Pipeline render calls change) | route/controller (top-level tab router) | request-response | itself, current `tab === 'pipeline'` / `tab === 'github'` branches (lines 320-326, 407-410) | exact |
| `app/src/components/layout/Sidebar.jsx` (modified: remove `'github'` from `NAV_ITEMS`) | component (nav config) | n/a (static config) | itself, current `NAV_ITEMS` array (lines 3-12) | exact |
| `app/src/lib/icons.js` (unchanged, but `NAV_ICON.github`'s `GitFork` import gets reused inside the new shell) | utility (icon lookup map) | n/a | itself | exact |

## Pattern Assignments

### `app/src/components/PipelineTab.jsx` (new thin shell)

**Analog 1 — segmented control:** `app/src/App.jsx` lines 35-49, 94-103 (`NETWORK_VIEWS` + `NetworkTab`'s switcher JSX)

**Views array + demo filter pattern** (lines 35-47):
```jsx
const NETWORK_VIEWS = [
  { key: 'table',    label: 'Table',    icon: Table2 },
  { key: 'cards',    label: 'Cards',    icon: LayoutGrid },
  { key: 'graph',    label: 'Graph',    icon: Share2 },
  { key: 'outbox',   label: 'Outbox',   icon: Send },
]
const DEMO_NETWORK_VIEWS = NETWORK_VIEWS.filter(v => ['table', 'cards', 'graph'].includes(v.key))
```
Apply directly: `PIPELINE_VIEWS = [{key:'applications', label:'Applications', icon: Kanban}, {key:'jobBoards', label:'Job Boards', icon: GitFork}]` and `DEMO_PIPELINE_VIEWS = PIPELINE_VIEWS.filter(v => v.key === 'applications')`, co-located inside the new `PipelineTab.jsx` (per RESEARCH.md Pattern 1's recommendation — `GrowTab.jsx` defines nothing view-related in `App.jsx` either).

**Switch state + `views` prop signature** (line 49):
```jsx
function NetworkTab({ ..., initialView = 'table', views = NETWORK_VIEWS }) {
  const [view, setView] = useState(initialView)
```
Apply: `function PipelineTab({ apps, contacts, interactions, relationships, onRefresh, onFindPeople, onRefreshRelationships, views = PIPELINE_VIEWS }) { const [view, setView] = useState('applications') ... }`. Note `initialView` isn't needed here since D-01 locks the default to `'applications'` always (no deep-link-into-Job-Boards requirement in this phase, unlike Network's `initialView`).

**Switcher JSX** (lines 94-103) — copy verbatim, byte-for-byte class strings (UI-SPEC.md mandates this):
```jsx
<div className="flex border border-ink-200 rounded-full overflow-hidden text-xs font-medium">
  {views.map(v => (
    <button key={v.key} onClick={() => setView(v.key)}
      className={`px-3 py-1 flex items-center gap-1.5 transition-colors ${view === v.key ? 'bg-ink-900 text-white' : 'bg-white text-ink-500 hover:bg-ink-50'}`}>
      <v.icon size={13} strokeWidth={2.25} />
      {v.label}
    </button>
  ))}
</div>
```
**UI-SPEC.md addendum (new condition, not in `NetworkTab`'s precedent):** wrap this whole block in `{views.length > 1 && (...)}` — in demo mode `views` has only 1 entry and the switcher must not render at all (not a single-button toggle).

**Analog 2 — shell-wraps-bodies structure:** `app/src/components/GrowTab.jsx` (full file, 61 lines)

```jsx
export default function GrowTab({ contacts, apps, interactions, contactRelationships, onRefresh, onRefreshRelationships, initialPeopleFocus = null }) {
  // owns only shared state needed by >1 child (targets) — Pipeline has no such need
  return (
    <div className="space-y-4">
      <Section step="01" title="Companies" icon={Building2} accent="ink">
        <ExploreTab apps={apps} onTargetAdded={goToCoverage} onFindPeople={goToPeople} targets={targets} setTargets={setTargets} loaded={targetsLoaded} />
      </Section>
      {/* ... */}
    </div>
  )
}
```
**Key divergence for Pipeline:** Grow's children render simultaneously (needs `Section` wrappers, scroll refs, a lifted `useTargetCompanies` hook). Pipeline's two views are **mutually exclusive** — no `Section`, no scroll-ref, no lifted hook. Structure instead should be a conditional render matching `NetworkTab`'s `view === 'graph' ? <A/> : view === 'outbox' ? <B/> : ...` ternary chain (lines 115-118), NOT `GrowTab`'s always-both pattern. Concretely:
```jsx
<div className="mb-4">{/* switcher */}</div>
{view === 'applications'
  ? <ApplicationsView apps={apps} onRefresh={onRefresh} onFindPeople={onFindPeople} relationships={relationships} interactions={interactions} contacts={contacts} onRefreshRelationships={onRefreshRelationships} />
  : <JobBoardsView apps={apps} onImported={onRefresh} />}
```
(Exact prop list for each body must be re-verified against `ApplicationsView.jsx`'s/`JobBoardsView.jsx`'s actual destructured signature after rename — see Pitfall 2 below.)

**Critical prop-name pitfall (from RESEARCH.md Pitfall 2, confirmed by reading both files):** current `PipelineTab.jsx` body expects `onRefresh`; current `GitHubTab.jsx` expects `onImported`. Both are the same underlying `App.jsx` `load` function but **must be passed to each body under its own existing prop name** — do not rename either body's prop to unify them:
```jsx
// ApplicationsView.jsx keeps expecting onRefresh — from PipelineTab.jsx line 1-40 (unchanged after rename)
// JobBoardsView.jsx keeps expecting onImported — from GitHubTab.jsx line 10 (unchanged after rename):
export default function GitHubTab({ apps, onImported }) { ... }
```

**No local `apps` copying (RESEARCH.md Pitfall 1):** the shell must forward `apps` straight through as-received every render, never into a `useState`. `GrowTab.jsx` never copies `apps` locally either — confirms this is the established discipline, not new to Pipeline.

---

### `app/src/components/ApplicationsView.jsx` (renamed from `PipelineTab.jsx`)

**Analog:** itself — `app/src/components/PipelineTab.jsx`, current full content (230 lines), verified imports at lines 1-8:
```jsx
import { useState, useMemo } from 'react'
import { archiveApplication, updateApplicationTriage } from '../db.js'
import { STAGE_ORDER, STAGE_COLOR, TERMINAL_STAGES, daysSince, daysBetween, fmt, Badge, EmptyState, isUntriaged, findDuplicateGroups } from '../shared.jsx'
import { BUCKET_TO_TRIAGE } from './jobBoards/helpers.js'
import { companyCoverage } from '../lib/networkCoverage.js'
import SidePanel from './ui/SidePanel.jsx'
import ApplicationPanelBody from './panels/ApplicationPanelBody.jsx'
import Mono from './ui/Mono.jsx'
```
**Import path fixups required by the file move (still same directory `app/src/components/`, so relative imports are unaffected):** since `ApplicationsView.jsx` stays in `app/src/components/` (not moved into a subdirectory), every relative import above (`../db.js`, `../shared.jsx`, `./jobBoards/helpers.js`, `../lib/networkCoverage.js`, `./ui/SidePanel.jsx`, `./panels/ApplicationPanelBody.jsx`, `./ui/Mono.jsx`) needs **zero path changes** — a pure content copy + filename rename + default-export rename (`PipelineTab` → `ApplicationsView`) is sufficient. This is the "zero logic changes" instruction applied literally: only the file name and the function/export name change.

**No content excerpt beyond imports needed** — every internal line (state, `DuplicatesPanel`, JSX, `SidePanel`/`ApplicationPanelBody` wiring) carries over verbatim per D-02.

---

### `app/src/components/jobBoards/JobBoardsView.jsx` (renamed from `jobBoards/GitHubTab.jsx`)

**Analog:** itself — `app/src/components/jobBoards/GitHubTab.jsx`, current full content (98 lines), imports at lines 1-8:
```jsx
import { useState } from 'react'
import { fetchGitHubProfile, fetchRepoJobs, parseGitHubInput } from '../../github.js'
import { pullAllBoards } from './boardsRegistry.js'
import { recordPostingSnapshot } from '../../lib/hiringVelocity.js'
import { EmptyState } from '../../shared.jsx'
import RepoJobsView from './RepoJobsView.jsx'
import UserProfileView from './UserProfileView.jsx'
import TrackedBoardsPanel from './TrackedBoardsPanel.jsx'
```
Stays in `app/src/components/jobBoards/` (per D-02 — "stays in the `jobBoards/` directory alongside its existing sub-components"), so these relative imports (`../../github.js`, `./boardsRegistry.js`, `../../lib/hiringVelocity.js`, `../../shared.jsx`, `./RepoJobsView.jsx`, `./UserProfileView.jsx`, `./TrackedBoardsPanel.jsx`) need **zero path changes** either — pure filename + default-export rename (`GitHubTab` → `JobBoardsView`).

**Component signature to preserve exactly** (line 10):
```jsx
export default function GitHubTab({ apps, onImported }) {
```
becomes
```jsx
export default function JobBoardsView({ apps, onImported }) {
```
(prop names unchanged — see shell's pitfall note above).

---

### `app/src/App.jsx` (integration point — imports + render branches)

**Analog:** itself, current content.

**Import changes** (lines 19, 22):
```jsx
// BEFORE
import PipelineTab from './components/PipelineTab.jsx'
import GitHubTab from './components/jobBoards/GitHubTab.jsx'
// AFTER
import PipelineTab from './components/PipelineTab.jsx'   // now the shell (same import path, new content)
// GitHubTab import removed entirely — JobBoardsView is imported inside the new PipelineTab.jsx shell, not here (per D-05)
```

**`AppInner` render branches to collapse** (lines 320-326):
```jsx
// BEFORE
{!loading && tab === 'pipeline' && (
  <PipelineTab apps={apps} contacts={contacts} interactions={interactions} relationships={contactRelationships} onRefresh={load}
    onFindPeople={goFindPeople} onRefreshRelationships={refreshContactRelationships} />
)}
...
{tab === 'github'   && <GitHubTab apps={apps} onImported={load} />}

// AFTER — one branch, union of props (both onRefresh and onFindPeople/onRefreshRelationships already present;
// onImported is no longer threaded from App.jsx at all — the shell derives it internally from onRefresh, since
// both point at the same `load` function; see shell pitfall note: JobBoardsView still needs its own onImported
// prop name, but the shell can supply it as onImported={onRefresh} internally, no new App.jsx prop required)
{!loading && tab === 'pipeline' && (
  <PipelineTab apps={apps} contacts={contacts} interactions={interactions} relationships={contactRelationships} onRefresh={load}
    onFindPeople={goFindPeople} onRefreshRelationships={refreshContactRelationships} />
)}
```
Note: RESEARCH.md's own code example (lines 316-321 of RESEARCH.md) shows threading `onImported={load}` directly from `App.jsx` too — either approach (App.jsx passes both `onRefresh` and `onImported`, or the shell internally maps `onRefresh` to `JobBoardsView`'s `onImported` prop) is valid; the shell-internal-mapping approach shown above is slightly cleaner (one fewer prop threaded from `App.jsx`) but planning may choose either — both satisfy Pitfall 2's "don't lose the callback" constraint as long as `JobBoardsView` ultimately receives a working `onImported`.

**`DemoApp` render branch** (lines 407-410) — add the `views` filter, no `onImported`/`onFindPeople` needed since Job Boards never mounts in demo:
```jsx
// AFTER
{!loading && tab === 'pipeline' && (
  <PipelineTab apps={apps} contacts={contacts} interactions={interactions} relationships={contactRelationships} onRefresh={load}
    onRefreshRelationships={refreshContactRelationships} views={DEMO_PIPELINE_VIEWS} />
)}
```
`DEMO_PIPELINE_VIEWS` should be defined near `DEMO_NETWORK_VIEWS` (line 47) if planning puts `PIPELINE_VIEWS` in `App.jsx`, or exported from `PipelineTab.jsx` if co-located there per RESEARCH.md's recommendation (Assumption A2 — either location is functionally fine; matching `GrowTab.jsx`'s "no view constants in App.jsx" precedent favors co-locating in `PipelineTab.jsx` and importing `DEMO_PIPELINE_VIEWS` from there into `App.jsx`, mirroring how `DEMO_NETWORK_VIEWS` is currently colocated with `NETWORK_VIEWS` since `NetworkTab` itself is inline in `App.jsx`).

---

### `app/src/components/layout/Sidebar.jsx` (nav cleanup)

**Analog:** itself, current `NAV_ITEMS` (lines 3-12):
```jsx
const NAV_ITEMS = [
  { id: 'today', label: 'Today' },
  { id: 'overview', label: 'Overview' },
  { id: 'network',  label: 'Network' },
  { id: 'grow',     label: 'Grow' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'github',   label: 'Job Boards' },   // ← DELETE this line
  { id: 'settings', label: 'Settings' },
]
```
`'pipeline'` entry itself is unchanged (keeps `Kanban` icon via `NAV_ICON.pipeline`, per D-05). No other edit needed in this file — `NAV_ICON` lookup in `lib/icons.js` degrades gracefully (an unmatched id just renders no icon), but since the `NAV_ITEMS` entry is deleted entirely, `NAV_ICON.github` becomes simply unused-by-nav (still fine to leave in `icons.js` since the new Pipeline shell reuses `GitFork` directly for its Job Boards segment icon, per D-05/UI-SPEC.md).

---

## Shared Patterns

### Segmented view-switch (app-wide convention)
**Source:** `app/src/App.jsx` lines 35-40, 94-103 (`NETWORK_VIEWS`, `NetworkTab`'s switcher) — also mirrored internally by `jobBoards/RepoJobsView.jsx`'s own list/calendar toggle.
**Apply to:** the new `PipelineTab.jsx` shell only. Exact classes: wrapper `flex border border-ink-200 rounded-full overflow-hidden text-xs font-medium`; button `px-3 py-1 flex items-center gap-1.5 transition-colors`; active state `bg-ink-900 text-white` (NOT `accent` — UI-SPEC.md explicitly confirms accent is reserved for primary CTAs, not this switcher); inactive `bg-white text-ink-500 hover:bg-ink-50`; icon `size={13} strokeWidth={2.25}`.

### Demo-mode view filtering (views-prop mechanism, not isDemoMode boolean)
**Source:** `app/src/App.jsx` line 47 (`DEMO_NETWORK_VIEWS`) + line 405 (`<NetworkTab ... views={DEMO_NETWORK_VIEWS} />`)
**Apply to:** `PipelineTab.jsx` shell + `App.jsx`'s `DemoApp`. Pattern: define a filtered array constant, pass it as the `views` prop only from the demo call site; the real `AppInner` call site passes nothing and the component's own default parameter (`views = PIPELINE_VIEWS`) applies. Do NOT introduce an `isDemoMode` boolean prop for this component (Assumption A1 in RESEARCH.md — `TodayTab.jsx`'s alternate mechanism exists in the codebase but D-01 already locks this component to the `NETWORK_VIEWS`-style pattern, so consistency favors the views-prop mechanism).

### Shell-wraps-renamed-bodies, zero internal logic changes
**Source:** `app/src/components/GrowTab.jsx` (Phase 3 precedent)
**Apply to:** `PipelineTab.jsx`'s relationship to `ApplicationsView.jsx`/`JobBoardsView.jsx`. Divergence from Grow: no `Section` wrapper, no scroll-ref, no lifted shared hook — Pipeline's two views are mutually exclusive (conditional render, not simultaneous), so the structural template is actually closer to `NetworkTab`'s `view === X ? <A/> : <B/>` ternary than to `GrowTab`'s always-both `<Section>` stack.

### Prop-forwarding without local copies
**Source:** `app/src/components/GrowTab.jsx` (never copies `apps` into local state, forwards the prop straight through to all children every render)
**Apply to:** `PipelineTab.jsx` shell — must not introduce `useState(apps)` or similar; forward `apps` (and all other props) as-received.

## No Analog Found

None — every file in this phase's scope has a byte-identical "analog" because 4 of 5 changed files are the files being renamed/edited themselves (pure structural moves), and the one genuinely new pattern (the segmented control + demo-view-filtering combination) has a complete, directly-reusable analog in `NetworkTab`/`NETWORK_VIEWS` already in `App.jsx`.

## Metadata

**Analog search scope:** `app/src/App.jsx`, `app/src/components/PipelineTab.jsx`, `app/src/components/jobBoards/GitHubTab.jsx`, `app/src/components/GrowTab.jsx`, `app/src/components/layout/Sidebar.jsx`, `app/src/lib/icons.js` — all read in full this session (no re-reads of overlapping ranges).
**Files scanned:** 6 (all read directly, zero Glob/Grep-only inference — RESEARCH.md had already done the equivalent search this phase needed)
**Pattern extraction date:** 2026-08-19
