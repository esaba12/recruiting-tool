# Phase 2: Unified Attention Feed (Today) - Pattern Map

**Mapped:** 2026-08-16
**Files analyzed:** 8 (new/modified) + 2 deletions
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/src/lib/attention.js` (new) | utility (derivation/selector module) | transform (filter+sort over already-fetched arrays) | `app/src/components/ActionsTab.jsx` (inline computations, lines 7-44) + `app/src/lib/keepInTouch.js` (existing standalone module to re-export from) | exact (logic is a verbatim extraction) |
| `app/src/components/TodayTab.jsx` (new) | component (feed/page) | request-response (renders already-fetched props, no own fetch) | `app/src/components/ActionsTab.jsx` (Section pattern, row components) + `app/src/components/KeepInTouchTab.jsx` (card row + modal click target) + `app/src/components/TimelineFindsPanel.jsx` (approve/dismiss card, reused as embedded section) | exact (direct structural descendant of ActionsTab) |
| `app/src/App.jsx` (modified — `AppInner`) | controller (root state/routing) | request-response (nav state, prop threading) | itself, prior version — diff against current `ActionsTab` import/render/count lines | exact (same file, incremental edit) |
| `app/src/App.jsx` (modified — `DemoApp`/`DEMO_NAV_ITEMS`) | controller (demo routing) | request-response | itself, prior version | exact |
| `app/src/components/layout/Sidebar.jsx` (modified — `NAV_ITEMS`) | config/route (nav registry) | CRUD (static list edit) | itself, prior version | exact |
| `app/src/lib/icons.js` (modified — `NAV_ICON`) | config | — | itself, prior version | exact |
| `app/src/components/OverviewTab.jsx` (modified — remove nudge sections) | component | request-response | itself, prior version | exact |
| `app/src/components/CalendarTab.jsx` (modified — remove `TimelineFindsPanel` mount) | component | request-response | itself, prior version | exact |
| `app/src/components/ActionsTab.jsx` (deleted) | component | — | — | n/a (deletion) |
| `app/src/components/KeepInTouchTab.jsx` standalone view wiring in `App.jsx`'s `NetworkTab`/`NETWORK_VIEWS` (modified — remove standalone entry; component file itself is NOT deleted, its row markup is the Type-2 analog reused inside `TodayTab.jsx`) | component | request-response | itself | exact |

## Pattern Assignments

### `app/src/lib/attention.js` (new utility, transform)

**Analog:** `app/src/components/ActionsTab.jsx` lines 7-44 (inline computations) + `app/src/lib/keepInTouch.js` (existing standalone derivation module — copy its "pure function over already-fetched arrays, returns sorted array" shape, don't reinvent it)

**Imports pattern** (mirror `ActionsTab.jsx` lines 1-4, trimmed to only what moves):
```js
import { TERMINAL_STAGES, daysSince, daysUntil, isUntriaged, isOverdue, isStaleApplication } from '../shared.jsx'
import { keepInTouchQueue } from './keepInTouch.js'
```

**Core extraction pattern — copy these verbatim from `ActionsTab.jsx` into named exports** (source lines cited):
```js
// ActionsTab.jsx:7 (activeApps helper, needed by staleApplications)
export function activeApps(apps) {
  return apps.filter(a => !TERMINAL_STAGES.includes(a.stage) && !isUntriaged(a))
}

// ActionsTab.jsx:13-15
export function oaDue(apps) {
  return apps
    .filter(a => a.oaDueDate && !a.oaCompleted)
    .sort((a, b) => daysUntil(a.oaDueDate) - daysUntil(b.oaDueDate))
}

// ActionsTab.jsx:16-17
export function oaNeedsCheck(apps) {
  return apps.filter(a => a.oaLink && !a.oaDueDate && !a.oaCompleted && a.oaResearchCheckedAt)
}

// ActionsTab.jsx:21-28
export function wantToSchedule(contacts) {
  return contacts
    .filter(c => c.wantsToSchedule)
    .sort((a, b) => {
      if (!a.scheduleBy && !b.scheduleBy) return 0
      if (!a.scheduleBy) return 1
      if (!b.scheduleBy) return -1
      return new Date(a.scheduleBy) - new Date(b.scheduleBy)
    })
}

// ActionsTab.jsx:30-32
export function overdueFollowUps(contacts) {
  return contacts.filter(isOverdue).sort((a, b) => daysUntil(a.followUpDate) - daysUntil(b.followUpDate))
}

// ActionsTab.jsx:34-40 (depends on activeApps above)
export function staleApplications(apps) {
  return activeApps(apps).filter(isStaleApplication).sort((a, b) => {
    const da = a.daysInStage ?? daysSince(a.lastActivity)
    const db = b.daysInStage ?? daysSince(b.lastActivity)
    return db - da
  })
}

// ActionsTab.jsx:42-44
export function highUrgencyContacts(contacts) {
  return contacts.filter(c =>
    c.urgency === 'HIGH' && c.status !== '✅ Closed' && (!c.followUpDate || daysUntil(c.followUpDate) > 0)
  )
}

// NEW — mirrors RESEARCH.md's exact spec, source #7
export function needsReviewApps(apps) {
  return apps.filter(a => a.triage === 'Needs Review' && a.stage === 'Wishlist')
}

// Thin re-export, do NOT duplicate lib/keepInTouch.js's cadence math
export { keepInTouchQueue as keepInTouchDue } from './keepInTouch.js'
```

**Error handling:** none needed — pure synchronous array transforms over already-validated props, same as the functions being extracted (no try/catch in the originals).

---

### `app/src/components/TodayTab.jsx` (new component)

**Primary analog:** `app/src/components/ActionsTab.jsx` (whole-file structural analog — Section wrapper, EmptyState guard, row components)

**Imports pattern** (mirror `ActionsTab.jsx:1-4`, extended per UI-SPEC's new modal wiring and `lib/attention.js`):
```js
import { useState } from 'react'
import { STATUS_COLOR, URGENCY_COLOR, STAGE_COLOR, fmt, daysUntil, daysSince, Badge, EmptyState, isUntriaged } from '../shared.jsx'
import { updateContact, addInteraction, updateApplication } from '../db.js'
import { overdueFollowUps, staleApplications, highUrgencyContacts, wantToSchedule, oaDue, oaNeedsCheck, keepInTouchDue, needsReviewApps } from '../lib/attention.js'
import { tieStrengthBucket } from '../lib/affinity.js'
import { lastPointOfContact } from '../lib/keepInTouch.js'
import DraftPanel from './DraftPanel.jsx'
import ContactDetailModal from './ContactDetailModal.jsx'
import ApplicationDetailModal from './ApplicationDetailModal.jsx'
import TimelineFindsPanel from './TimelineFindsPanel.jsx'
import MetButton from './MetButton.jsx'
import Mono from './ui/Mono.jsx'
import { CalendarClock, Hourglass, AlertTriangle, HeartHandshake, Inbox, UserPlus, ClipboardCheck, Search, CalendarSearch } from 'lucide-react'
```

**Section wrapper — copy `ActionsTab.jsx:113-123`'s `Section` component, re-key `accent` to the 4 locked tiers instead of `red/orange/yellow/indigo`:**
```js
// ActionsTab.jsx:113-123, ORIGINAL (off-token) — port the shape, remap the border/heading maps
function Section({ title, subtitle, accent, icon: Icon, children }) {
  const border = { danger: 'border-danger-200', warning: 'border-warning-200', ink: 'border-ink-200', accent: 'border-accent-200' }[accent] || 'border-ink-200'
  const heading = { danger: 'text-danger-700', warning: 'text-warning-700', ink: 'text-ink-700', accent: 'text-accent-700' }[accent] || 'text-ink-700'
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border ${border}`}>
      <h2 className={`text-sm font-semibold ${heading} mb-1 flex items-center gap-1.5`}>
        {Icon && <Icon size={16} strokeWidth={2} />} {title}
      </h2>
      {subtitle && <p className="text-xs text-ink-400 mb-3">{subtitle}</p>}
      <div className="divide-y divide-ink-100">{children}</div>
    </div>
  )
}
```

**Type 1 — Contact Row (Overdue, High Urgency, Want to Schedule):** copy `ActionsTab.jsx:133-183`'s `OverdueContactRow` verbatim as the base, then apply the UI-SPEC's required click-target split — name/company block's `onClick` now opens `ContactDetailModal` (new local `selectedContactId` state) instead of toggling `expanded`; the inline draft-panel toggle moves to its own small chevron button:
```js
// BEFORE (ActionsTab.jsx:153): <div className="min-w-0 cursor-pointer" onClick={() => setExpanded(e => !e)}>
// AFTER (per UI-SPEC "New click-target contract"):
<div className="min-w-0 cursor-pointer" onClick={() => setSelectedContactId(c.id)}>
  ...
</div>
<button onClick={() => setExpanded(e => !e)} className="shrink-0 text-ink-400 hover:text-ink-600">
  <ChevronIcon />
</button>
```
Mono-wrap date/day-count per UI-SPEC's typography table:
```js
// BEFORE (ActionsTab.jsx:160):
<p className="text-xs font-medium text-danger-600">Was due {fmt(c.followUpDate)} ({Math.abs(daysUntil(c.followUpDate))}d ago)</p>
// AFTER:
<p className="text-xs font-medium text-danger-600">
  Was due <Mono>{fmt(c.followUpDate)}</Mono> (<Mono className="text-danger-600 font-medium">{Math.abs(daysUntil(c.followUpDate))}d</Mono> ago)
</p>
```
"Mark followed up" inline action: copy `ActionsTab.jsx:138-148`'s `markFollowedUp` verbatim (calls `updateContact` + `addInteraction`, then `onRefresh()`). "Want to Schedule" row: copy `ActionsTab.jsx:188-231`'s `ScheduleQueueRow` verbatim with the same name-click → modal split applied.

**Type 2 — Keep-in-Touch Card:** copy `KeepInTouchTab.jsx:40-87` verbatim (card shape, `onEdit`/`onLog`/`onMet` props, `MetButton`, tie-strength badge) — only the border color changes (`border-warning-300`/`border-ink-100` per tier instead of `border-accent-200`/`border-ink-100`). Click target (`onClick={() => onEdit(c)}` → `ContactDetailModal`) is **already correct, no new wiring needed** — this is the one row type already satisfying ATTN-02.

**Type 3 — Application Row (Stale Applications, Job Boards Needs-Review):** copy `PipelineTab.jsx:163-206`'s clickable-row pattern (`onClick={() => setSelectedAppId(a.id)}`) as the click-target analog — NOT `ActionsTab.jsx`'s inert `ActionRow` (lines 279-293), which has no click handler at all. Modal mount: copy `PipelineTab.jsx:208-223`'s `ApplicationDetailModal` usage verbatim, including **`onFindPeople={onFindPeople}`** (must be threaded from `App.jsx`'s `goFindPeople`, exactly as `PipelineTab.jsx:219` does — omitting it is a fail-soft regression, not a crash).
```js
// PipelineTab.jsx:208-223, verbatim prop contract to replicate in TodayTab.jsx
<ApplicationDetailModal
  app={selectedApp}
  contacts={contacts}
  apps={apps}
  interactions={interactions}
  relationships={relationships}
  onStatusChange={s => changeTriage(selectedApp, s)}
  onClose={() => setSelectedAppId(null)}
  onDelete={async () => { await archiveApplication(selectedApp.id); setSelectedAppId(null); onRefresh() }}
  onSaved={() => onRefresh()}
  onFindPeople={onFindPeople}
  onRefresh={onRefresh}
  onRefreshRelationships={onRefreshRelationships}
/>
```
Needs-Review variant's triage chips: reuse `jobBoards/JobCard.jsx`'s `BUCKET_TAG` chip styling (not read in this pass — planner/executor should grep `BUCKET_CONFIG`/`BUCKET_TAG` in `jobBoards/helpers.js`+`JobCard.jsx` directly), each `onClick` calling `e.stopPropagation()` before the triage-change call, mirroring `PipelineTab.jsx`'s own JD-link `stopPropagation` at line 190.

**Type 4 — OA Row:** copy `ActionsTab.jsx:236-277`'s `OaRow` verbatim (layout, `markCompleted`, needsCheck branch) — only add the same row-click → `ApplicationDetailModal` wiring as Type 3, with `stopPropagation` on the existing "Open assessment ↗" link and "✓ Mark completed" button (mirroring Type 3's chip pattern, per UI-SPEC).

**Type 5 — Timeline Find Card:** mount `TimelineFindsPanel` (`app/src/components/TimelineFindsPanel.jsx`, full file, unchanged internals) as-is for its per-item card markup, but per UI-SPEC replace its own bespoke accordion header (gradient background, `open`/`setOpen` toggle) with the same `Section` wrapper used by every other section — i.e. **do not render `<TimelineFindsPanel>` as an opaque black box**; either (a) refactor `TimelineFindsPanel.jsx` to accept a `headerless` prop that suppresses its own header and renders only the card list, or (b) extract its card-rendering into a sub-component reusable from both `TodayTab.jsx`'s `Section` wrapper and (if kept anywhere else) its own header. Props unchanged: `apps, calls, interactions, contacts, onEventCreated`.

**Page-level empty state:** copy `ActionsTab.jsx:46-48`'s all-empty guard pattern:
```js
if (allNine.every(arr => arr.length === 0)) {
  return <EmptyState msg="✓ Nothing needs your attention. You're on top of it." />
}
```

**Row-cap "Show N more":** new interaction pattern (UI-SPEC explicitly flags this as new, not a verbatim copy) — no existing exact analog; closest precedent is `CalendarTab.jsx`'s static (non-interactive) `FEED_LATER_CAP` hint, which the executor should grep in `CalendarTab.jsx` for the visual copy pattern only (text/color), then add real `useState`-driven show-more/show-fewer toggle per section.

---

### `app/src/App.jsx` (`AppInner`) — nav/routing edit

**Analog:** itself, prior version (this is a diff, not a new-pattern file)

**Import swap** (App.jsx:20):
```js
// BEFORE
import ActionsTab from './components/ActionsTab.jsx'
// AFTER
import TodayTab from './components/TodayTab.jsx'
```

**Count computation swap** (App.jsx:305-308, 313) — replace inline math with `lib/attention.js` calls:
```js
// BEFORE
const overdueCount = contacts.filter(isOverdue).length
const staleCount = activeApps.filter(isStaleApplication).length
const scheduleCount = contacts.filter(c => c.wantsToSchedule).length
const actionCount = overdueCount + staleCount + scheduleCount
// ...
actions: actionCount > 0 ? actionCount : null,

// AFTER
const todayCount = overdueFollowUps(contacts).length
  + staleApplications(apps).length
  + highUrgencyContacts(contacts).length
  + wantToSchedule(contacts).length
  + oaDue(apps).length
  + oaNeedsCheck(apps).length
  + keepInTouchDue(contacts, interactions).length
  + needsReviewApps(apps).length
// ...
today: todayCount > 0 ? todayCount : null,
```

**Render swap** (App.jsx:333, 347):
```js
// BEFORE
onOpenActions={() => setTab('actions')} />
...
{!loading && tab === 'actions'  && <ActionsTab contacts={contacts} apps={apps} interactions={interactions} onRefresh={load} />}

// AFTER
onOpenActions={() => setTab('today')} />
...
{!loading && tab === 'today'  && <TodayTab contacts={contacts} apps={apps} interactions={interactions} calls={calls}
  relationships={relationships} onFindPeople={goFindPeople} onRefresh={load} onRefreshRelationships={refreshContactRelationships} />}
```
(`calls`/`relationships`/`onFindPeople`/`onRefreshRelationships` — confirm exact variable names already in scope in `AppInner` per `PipelineTab.jsx`'s own usage at line ~345 of `App.jsx`, shown in RESEARCH.md's grep output.)

### `app/src/App.jsx` (`DemoApp`/`DEMO_NAV_ITEMS`) — demo nav edit

**Analog:** itself, prior version

```js
// BEFORE (App.jsx:383)
const DEMO_NAV_ITEMS = NAV_ITEMS.filter(item => ['overview', 'network', 'pipeline', 'actions'].includes(item.id))
// AFTER
const DEMO_NAV_ITEMS = NAV_ITEMS.filter(item => ['today', 'overview', 'network', 'pipeline'].includes(item.id))

// BEFORE (App.jsx:409-410)
const overdueCount = contacts.filter(isOverdue).length
const counts = { network: contacts.length, pipeline: activeApps.length, actions: overdueCount > 0 ? overdueCount : null }
// AFTER
const todayCount = overdueFollowUps(contacts).length + staleApplications(apps).length + needsReviewApps(apps).length
const counts = { network: contacts.length, pipeline: activeApps.length, today: todayCount > 0 ? todayCount : null }

// BEFORE (App.jsx:424, 434)
onOpenGraph={() => setTab('network')} onOpenActions={() => setTab('actions')} />
...
{!loading && tab === 'actions' && <ActionsTab contacts={contacts} apps={apps} interactions={interactions} onRefresh={load} />}
// AFTER
onOpenGraph={() => setTab('network')} onOpenActions={() => setTab('today')} />
...
{!loading && tab === 'today' && <TodayTab contacts={contacts} apps={apps} interactions={interactions} onRefresh={load} isDemoMode />}
```
Per RESEARCH.md Pitfall 4, `TodayTab` must omit the Timeline Finds section entirely when `isDemoMode` is true (whole `Section` card, not just its content) — thread a prop, don't rely on `TimelineFindsPanel`'s own internal auth check (there isn't one).

---

### `app/src/components/layout/Sidebar.jsx` (`NAV_ITEMS`) — config edit

**Analog:** itself, prior version

```js
// BEFORE (Sidebar.jsx:3-12)
const NAV_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'network',  label: 'Network' },
  { id: 'explore',  label: 'Explore' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'actions',  label: 'Actions' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'github',   label: 'Job Boards' },
  { id: 'settings', label: 'Settings' },
]
// AFTER — 'today' first per D-03, 'actions' entry removed
const NAV_ITEMS = [
  { id: 'today',    label: 'Today' },
  { id: 'overview', label: 'Overview' },
  { id: 'network',  label: 'Network' },
  { id: 'explore',  label: 'Explore' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'github',   label: 'Job Boards' },
  { id: 'settings', label: 'Settings' },
]
```

### `app/src/lib/icons.js` (`NAV_ICON`) — config edit

**Analog:** itself, prior version

```js
// BEFORE (icons.js:36-45)
import { ..., LayoutDashboard, ..., ListChecks, ... } from 'lucide-react'
export const NAV_ICON = {
  overview: LayoutDashboard,
  network: Users,
  explore: Compass,
  pipeline: Kanban,
  actions: ListChecks,
  calendar: CalendarDays,
  github: GitFork,
  settings: Settings,
}
// AFTER — add Gauge import, add today: Gauge, remove actions: ListChecks (ListChecks import can be dropped if unused elsewhere — grep first)
import { ..., LayoutDashboard, Gauge, ... } from 'lucide-react'
export const NAV_ICON = {
  today: Gauge,
  overview: LayoutDashboard,
  network: Users,
  explore: Compass,
  pipeline: Kanban,
  calendar: CalendarDays,
  github: GitFork,
  settings: Settings,
}
```
Also add per-section icons used by `TodayTab.jsx`'s `Section` headers (`CalendarClock`, `Hourglass`, `AlertTriangle` — already imported elsewhere, reuse `URGENCY_ICON.HIGH` value directly per UI-SPEC — `HeartHandshake`, `Inbox` — reuse `BUCKET_ICON.review` value directly — `UserPlus` — reuse `SCHEDULE_ICON` export directly — `ClipboardCheck`, `Search` — reuse `SEARCH_ICON` export directly — `CalendarSearch`), either as new named exports here or imported directly in `TodayTab.jsx` per the Imports pattern above. Prefer re-exporting the existing `URGENCY_ICON.HIGH`/`BUCKET_ICON.review`/`SCHEDULE_ICON`/`SEARCH_ICON` values (UI-SPEC explicitly calls these out as "verbatim reuse") over re-importing fresh icon references for the same concept.

---

### `app/src/components/OverviewTab.jsx` — nudge removal

**Analog:** itself, prior version

Remove the "want to schedule" indigo nudge block (lines 80-88) and the "Needs Attention" danger block (lines 127-156) entirely — both reference `onOpenActions`/scheduleQueue/overdueContacts/staleApps computed at lines 30/37-40, which become dead code once these blocks are removed (delete the now-unused `scheduleQueue`, `overdueContacts`, `staleApps` local consts too, but leave `activeApps`/`interviews`/`offers` etc. which are still used by the KPI cards below). `onOpenActions` prop itself can stay (still passed from `App.jsx`) if any other element still references it, otherwise remove from the function signature and both call sites in `App.jsx`.

### `app/src/components/CalendarTab.jsx` — `TimelineFindsPanel` unmount

**Analog:** itself, prior version

Remove the `<TimelineFindsPanel apps={apps} calls={calls} interactions={interactions} contacts={contacts} .../>` mount at `CalendarTab.jsx:154` and its `import TimelineFindsPanel from './TimelineFindsPanel.jsx'` at line 12 — the component file itself is NOT deleted (still used, now mounted from `TodayTab.jsx` instead).

### `app/src/components/ActionsTab.jsx` — deletion

Delete outright once `App.jsx`'s import/render sites are repointed to `TodayTab.jsx` (per ATTN-03). Grep-verify zero remaining references: `grep -rn "ActionsTab\|'actions'" app/src/` should return zero hits (excluding `NAV_ICON`'s already-removed `actions:` key and this deletion itself).

### `app/src/components/KeepInTouchTab.jsx` standalone-view removal

**Analog:** wherever `NETWORK_VIEWS`/the Network segmented control is defined in `App.jsx`'s `NetworkTab` (not fully read this pass — grep `NETWORK_VIEWS`/`KeepInTouchTab` in `App.jsx` before editing). Remove `'keepintouch'` (or equivalent id) from the view-switcher array and its render branch; `KeepInTouchTab.jsx` the file stays (its row markup is the Type 2 analog copied into `TodayTab.jsx`, not literally re-imported, since its internal empty-state/intro-banner chrome is Network-specific and shouldn't duplicate into Today's own section chrome).

---

## Shared Patterns

### Section chrome (accent-tier bordered Card + heading)
**Source:** `app/src/components/ActionsTab.jsx` lines 113-123 (`Section` component)
**Apply to:** all 9 `TodayTab.jsx` sections — re-keyed from `red/orange/yellow/indigo` to the 4 locked families (`danger`/`warning`/`ink`/`accent`) per `02-UI-SPEC.md`'s Color section.

### Mono-wrapping dense data (dates, day-counts)
**Source:** `app/src/components/PipelineTab.jsx` lines 178, 186 (`<Mono>{fmt(a.closedDate)}</Mono>`, `<Mono>{days}</Mono>d in {stage}`) and `app/src/components/ContactsTable.jsx:97` (overdue-color-on-Mono pattern)
**Apply to:** every date/day-count/countdown token in all 5 Today row types — wrap only the numeral/date token, never the surrounding sentence; apply tier color via `className` directly on `<Mono>` when overdue/danger.

### Inline action "mark done" mutation + refresh
**Source:** `app/src/components/ActionsTab.jsx` lines 138-148 (`markFollowedUp`), 193-201 (`markScheduled`), 240-248 (`markCompleted`) — all follow the same `setMarking(true) → try { await update*(...); onRefresh?.() } catch { setMarking(false) }` shape.
**Apply to:** every Today row's one-tap inline action (Type 1, Type 3's triage chips minus modal-open, Type 4's mark-completed).

### Row click opens detail modal, inline sub-actions use `stopPropagation`
**Source:** `app/src/components/PipelineTab.jsx` lines 163 (row `onClick={() => setSelectedAppId(a.id)}`) and 190 (`onClick={e => e.stopPropagation()}` on the nested JD link)
**Apply to:** Type 3 (Application Row) and Type 4 (OA Row) — new wiring not present in `ActionsTab.jsx` today; every nested interactive element inside a now-clickable row (external links, triage chips, mark-completed buttons) needs `stopPropagation`.

### `onFindPeople` cross-tab relay
**Source:** `app/src/components/PipelineTab.jsx` line 219 (`onFindPeople={onFindPeople}` passed straight through into `ApplicationDetailModal`), destination `app/src/App.jsx`'s `goFindPeople` closure (~line 252)
**Apply to:** `TodayTab.jsx`'s `ApplicationDetailModal` usage (Type 3 and Type 4) — must receive `onFindPeople` as a prop from `App.jsx` and forward it, or the "Find people →" button silently disappears (fail-soft, no crash — verify by testing this button specifically, since nothing will error if it's forgotten).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Row-cap "Show N more" / "Show fewer" toggle (inside `TodayTab.jsx`) | interaction/UI state | event-driven | No existing *interactive* precedent — `CalendarTab.jsx`'s `FEED_LATER_CAP` hint is static text only; UI-SPEC explicitly flags this as new behavior layered on a visual (not interaction) precedent. Build fresh with a per-section `useState` boolean. |
| `TimelineFindsPanel`'s header-suppression variant (`headerless` prop or extracted sub-component) | component refactor | request-response | Current component owns its own header+accordion; no existing "same component, alternate chrome" precedent elsewhere in this codebase to copy — planner should choose prop-flag vs. extraction based on how much of `TimelineFindsPanel.jsx`'s ~150+ remaining lines (not fully read this pass) are header vs. card-list logic. |

## Metadata

**Analog search scope:** `app/src/components/` (ActionsTab.jsx, KeepInTouchTab.jsx, PipelineTab.jsx, OverviewTab.jsx, CalendarTab.jsx, TimelineFindsPanel.jsx, ContactsTable.jsx grep-only), `app/src/App.jsx`, `app/src/components/layout/Sidebar.jsx`, `app/src/lib/icons.js`, `app/src/shared.jsx`, `app/src/components/ui/Mono.jsx`
**Files scanned:** 10 read in full/targeted, 2 grepped only (`ContactsTable.jsx`, `jobBoards/JobCard.jsx`/`helpers.js` — flagged for executor grep, not read this pass since row-chip styling is a small, low-risk lift)
**Pattern extraction date:** 2026-08-16
