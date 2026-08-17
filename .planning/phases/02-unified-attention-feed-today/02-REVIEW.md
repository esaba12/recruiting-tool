---
phase: 02-unified-attention-feed-today
reviewed: 2026-08-17T01:24:38Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - app/src/App.jsx
  - app/src/components/CalendarTab.jsx
  - app/src/components/layout/Sidebar.jsx
  - app/src/components/OverviewTab.jsx
  - app/src/components/QuickScheduleModal.jsx
  - app/src/components/TimelineFindsPanel.jsx
  - app/src/components/TodayTab.jsx
  - app/src/lib/attention.js
  - app/src/lib/icons.js
  - app/src/lib/oaResearch.js
  - app/src/shared.jsx
findings:
  critical: 2
  warning: 7
  info: 4
  total: 13
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-08-17T01:24:38Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the unified attention-feed / Today-tab phase — `TodayTab.jsx` and its row
components, `lib/attention.js`, `lib/oaResearch.js`, `TimelineFindsPanel.jsx`,
`CalendarTab.jsx`'s new Feed view, `QuickScheduleModal.jsx`, plus the wiring in
`App.jsx`/`Sidebar.jsx`/`OverviewTab.jsx`/`shared.jsx`/`icons.js`.

Most of `lib/attention.js` is a faithful, well-documented port of pre-existing logic and
is sound. The new surface area introduced by this phase — the `TodayTab` "all clear"
gate, `CalendarTab`'s Feed view cache, and `oaResearch.js`'s batch OA-deadline
lookup — has two correctness bugs serious enough to hide or stale-out the exact data
this phase exists to surface, plus a cluster of missing-error-handling and
data-consistency issues. No security vulnerabilities, secrets, or dangerous-function
usage were found in these files.

## Critical Issues

### CR-01: TodayTab's "nothing needs attention" gate can permanently hide real Timeline Finds

**File:** `app/src/components/TodayTab.jsx:372-381` (gate) and `app/src/components/TodayTab.jsx:445` (panel mount)
**Issue:**
`allEmpty` is computed from the 8 `lib/attention.js`-derived arrays plus a local
`timelineFindsCount` state variable that starts at `0`:

```js
const allEmpty = overdueContacts.length === 0 && staleApps.length === 0 && highUrgency.length === 0
  && keepInTouch.length === 0 && needsReview.length === 0 && scheduleContacts.length === 0
  && oaDueList.length === 0 && oaNeedsCheckList.length === 0 && (isDemoMode || timelineFindsCount === 0)

if (allEmpty) return <EmptyState msg="✓ Nothing needs your attention. You're on top of it." />
```

`timelineFindsCount` is only ever updated via `TimelineFindsPanel`'s `onPendingChange`
callback — but `<TimelineFindsPanel .../>` is mounted later in the same render, at
line 445, *after* the `if (allEmpty) return` early exit. On first mount, if the other 8
arrays are all empty (a very common state — e.g. a user who is otherwise caught up),
`allEmpty` evaluates `true` using the *initial* `timelineFindsCount` value of `0`,
regardless of what's actually sitting in `localStorage`'s `rec_timeline_pending`
(`TimelineFindsPanel.jsx:23`, `PENDING_KEY`). The component returns `<EmptyState/>`
instead of rendering `<TimelineFindsPanel/>`, so the panel — the *only* thing capable of
reading `rec_timeline_pending` and calling `onPendingChange` to correct the count —
never mounts. The count can never become non-zero, so the bug is self-reinforcing:
Today shows "Nothing needs your attention" forever, even when there are real staged
Timeline Finds (extracted dates from application notes/calls/interactions) waiting for
approval. The sidebar's own `today` badge count (`App.jsx:291`) doesn't include
Timeline Finds at all, so there's no other surface that would tip the user off either.

**Fix:** Don't gate a component's mount on state that only that component can produce.
Either (a) read the pending count synchronously from storage before deciding whether to
render, or (b) always render `TimelineFindsPanel` unconditionally and let `allEmpty` be
computed purely from the 8 attention arrays for section visibility, with a separate
render branch for "nothing else, but Timeline Finds exists":

```js
// TimelineFindsPanel.jsx already exports PENDING_KEY's shape via lsGet — reuse it here
// so the initial gate can't be wrong on first paint:
import { lsGet } from './jobBoards/helpers.js'
const [timelineFindsCount, setTimelineFindsCount] = useState(
  () => (isDemoMode ? 0 : (lsGet('rec_timeline_pending') || []).length)
)
```
or simpler — move `TimelineFindsPanel` above the `allEmpty` check and let it always
render (it already renders its own "Nothing pending" empty state internally), only
folding the *other* 8 sections into the collapsed "all clear" message.

---

### CR-02: CalendarTab's Feed view never refreshes after creating or deleting an event

**File:** `app/src/components/CalendarTab.jsx:47,103,265-266,278-300`
**Issue:** The Feed view sources Google Calendar events from its own `feedEvents` state,
fetched once via `fetchFeedEvents()` and cached (`feedEvents === null` guard at line 103
prevents re-fetching once populated). Both event-mutation call sites only refresh the
*grid* month cache, never `feedEvents`:

```js
{selectedEvent && (
  <EventDetailModal
    event={selectedEvent}
    onClose={() => setSelectedEvent(null)}
    onDeleted={() => { setSelectedEvent(null); refetchMonth() }}   // line 291 — no feed refresh
  />
)}
{addEventOpen && (
  <AddEventModal
    defaultDate={selectedDay || undefined}
    onClose={() => setAddEventOpen(false)}
    onCreated={() => { setAddEventOpen(false); refetchMonth() }}   // line 299 — no feed refresh
  />
)}
```

`EventDetailModal` is reachable directly from the Feed view (`openTimelineItem`'s
`refType === 'event'` branch, line 148, sets `selectedEvent` from a Feed row), so a user
who deletes an event *from the Feed* will see it disappear from the modal but remain
listed in the Feed's Overdue/Next 7 Days/Later sections — stale, deleted data left
visible in the one view this phase adds specifically to surface calendar events. Adding
an event via "+ Add Event" while on the Feed view has the same problem in reverse: it
never appears in the Feed until a full page reload, since toggling `viewMode` away and
back doesn't re-trigger the fetch (`feedEvents` is no longer `null`).

**Fix:** Invalidate/refetch `feedEvents` alongside the grid cache on both mutation
paths:

```js
onDeleted={() => { setSelectedEvent(null); refetchMonth(); if (feedEvents !== null) fetchFeedEvents() }}
...
onCreated={() => { setAddEventOpen(false); refetchMonth(); if (feedEvents !== null) fetchFeedEvents() }}
```

## Warnings

### WR-01: `hasRecruitingActivity` ignores the app's own `isUntriaged` policy

**File:** `app/src/components/OverviewTab.jsx:36`
**Issue:** `const hasRecruitingActivity = apps.length > 0` gates whether the KPI row
shows Active Apps/Interviews/Offers (plus the Application Funnel chart) versus a single
"Companies" KPI. It counts *every* application, including ones excluded everywhere else
in the app via `isUntriaged()` (`shared.jsx:107-109` — "excluded from
Overview/Pipeline/Actions 'active' stats so a big board import doesn't drown out real
pipeline activity"). A user whose only applications are freshly bulk-imported
Needs-Review/Wishlist rows (the documented common case after a Job Boards pull) gets
`hasRecruitingActivity = true`, so the funnel/KPI branch renders — but `triagedApps`
(used to build `funnelData`/`stageCounts`) filters those same rows out via
`isUntriaged`, producing an all-zero Application Funnel chart and 0/0/0 KPI tiles
instead of the friendlier "Companies" card that was designed for exactly this state.
**Fix:**
```js
const hasRecruitingActivity = triagedApps.length > 0
```
(move `triagedApps` computation above this line, or reorder the two statements).

### WR-02: Hardcoded status filter list will drift from `shared.jsx`'s `STATUS_OPTIONS`

**File:** `app/src/App.jsx:77`
**Issue:** `NetworkTab`'s filter chips hardcode the status vocabulary:
```js
const statuses = ['ALL', '🟢 Warm', '🟡 Cooling', '🔴 Cold', '⭐ Champion', '✅ Closed']
```
`shared.jsx` already exports `STATUS_OPTIONS = Object.keys(STATUS_COLOR)` for this exact
purpose, and other components (`ContactDetailModal.jsx`, `QuickCaptureModal.jsx`) use it
instead of a literal list. If a status is ever added/renamed in `STATUS_COLOR`, this
filter bar silently won't offer it while every other status-driven UI element will.
**Fix:**
```js
import { STATUS_OPTIONS } from '../shared.jsx' // already imported STATUS_COLOR etc.
const statuses = ['ALL', ...STATUS_OPTIONS]
```

### WR-03: OA-research prompt's "today" date is frozen at module load, not per call

**File:** `app/src/lib/oaResearch.js:39,44`
**Issue:**
```js
const PROMPT_HEADER = `...
- Resolve relative dates using today's date: ${new Date().toISOString().slice(0, 10)}.
...`
```
`PROMPT_HEADER` is a module-level `const`, evaluated once when the module is first
imported (once per page load / SPA session). `researchOaDeadlines()` can run
repeatedly over a long-lived tab (it's kicked off from `App.jsx`'s `apps`-dependent
effect on every load), so a session left open across a day boundary will have the AI
resolve relative deadlines ("expires in 7 days", "complete within 3 days") against a
stale "today," producing wrong absolute dates that get written straight to Supabase via
`updateApplication(r.id, { oaDueDate: r.deadline })`.
**Fix:** Compute the date string inside `researchChunk` (or pass it into the prompt at
call time) instead of baking it into a module-level constant:
```js
function buildPromptHeader() {
  return `...today's date: ${new Date().toISOString().slice(0, 10)}...`
}
// in researchChunk: const parsed = await aiJSON({ ..., content: buildPromptHeader() + digest, ... })
```

### WR-04: Positional fallback in `researchChunk` can misattribute OA page content across applications

**File:** `app/src/lib/oaResearch.js:64-69`
**Issue:**
```js
const byUrl = new Map(pages.map(p => [normalizeUrl(p.url || p.id), p]))
const digest = apps.map((a, i) => {
  const page = byUrl.get(normalizeUrl(a.oaLink)) || pages[i]
  ...
})
```
When the URL-keyed lookup misses (e.g. Exa normalizes/redirects the URL differently
than `normalizeUrl()` does, or a subset of URLs in the batch failed to fetch and were
dropped from `pages`), the code falls back to `pages[i]` — a purely positional
assumption that `pages` preserves the same order/count as the requested `urls`. If any
earlier URL in the batch is missing from the response, every subsequent app in that
chunk gets shifted onto the wrong page's text, and the AI can return a `deadline` that
gets written (via `updateApplication`) against the *wrong* application's `id` (the
digest correctly labels each entry with `a.id`, but the underlying `text` may belong to
a different company's OA).
**Fix:** Drop the positional fallback; when the URL isn't found, treat it as "no page
content" rather than guessing:
```js
const page = byUrl.get(normalizeUrl(a.oaLink))
const text = (page?.text || '').trim()
```

### WR-05: `QuickScheduleModal`'s name search crashes on a contact with no `name`

**File:** `app/src/components/QuickScheduleModal.jsx:25`
**Issue:**
```js
const nameMatches = !selectedId && name.trim().length > 1
  ? contacts.filter(c => c.name.toLowerCase().includes(name.toLowerCase()))
  : []
```
No guard against `c.name` being `null`/`undefined`/empty. The equivalent search filter
in `App.jsx`'s `NetworkTab` (`[c.name, c.company, c.role, c.email].some(f =>
f?.toLowerCase().includes(q))`, line 66) uses optional chaining specifically to avoid
this. If any contact lacks a name, typing 2+ characters into this modal's autocomplete
throws a `TypeError` and crashes the modal (and, absent an error boundary, potentially
the tab).
**Fix:**
```js
? contacts.filter(c => c.name?.toLowerCase().includes(name.toLowerCase()))
```

### WR-06: Silent catch blocks in TodayTab's inline mark-done actions

**File:** `app/src/components/TodayTab.jsx:81-83,136-138,306-308`
**Issue:** `OverdueRow.markFollowedUp`, `ScheduleRow.markScheduled`, and
`OaRow.markCompleted` all follow this pattern:
```js
} catch {
  setMarking(false)
}
```
On failure (e.g. a Supabase write error), the button simply resets to its clickable
state with zero feedback — the user has no way to know their "Mark followed up" / "✓
Scheduled" / "✓ Mark completed" click didn't actually persist. Every other failure path
added in this phase (`TimelineFindsPanel.approve`, `CalendarTab`'s event fetches,
`QuickScheduleModal.save`) surfaces `e.message` into an error state shown in the UI.
**Fix:** Thread an error state through and surface it, or at minimum re-throw/log so
the failure is observable:
```js
} catch (e) {
  setMarking(false)
  setError(e.message) // new local state, rendered like the other rows in this file
}
```

### WR-07: Triage/mutation handlers have no error handling — unhandled promise rejections

**File:** `app/src/components/TodayTab.jsx:365-368`, `app/src/components/CalendarTab.jsx:134-137`, `app/src/App.jsx:79-82`
**Issue:** `changeAppTriage` (defined identically in both `TodayTab.jsx` and
`CalendarTab.jsx`) and `handleMet` (in `App.jsx`'s `NetworkTab` and mirrored in
`TodayTab.jsx`) call mutating functions with no `try`/`catch`:
```js
async function changeAppTriage(app, bucketKey) {
  await updateApplicationTriage(app.id, BUCKET_TO_TRIAGE[bucketKey === null ? 'review' : bucketKey], app.stage)
  onRefresh?.()
}
```
These are invoked directly from `onClick` handlers (e.g. `ApplicationRow`'s triage
chips, `MetButton`'s `onMet`) without a `.catch()` at the call site either. A rejected
write produces an unhandled promise rejection with no user-visible error and no state
rollback of any optimistic UI.
**Fix:** Wrap in `try`/`catch` and surface the error the same way other write paths in
this phase do, e.g.:
```js
async function changeAppTriage(app, bucketKey) {
  try {
    await updateApplicationTriage(app.id, BUCKET_TO_TRIAGE[bucketKey === null ? 'review' : bucketKey], app.stage)
    onRefresh?.()
  } catch (e) {
    setError?.(e.message) // or a toast/inline error, consistent with sibling components
  }
}
```

## Info

### IN-01: `todayCount` expression duplicated verbatim between `AppInner` and `DemoApp`

**File:** `app/src/App.jsx:291`, `app/src/App.jsx:392`
**Issue:** The exact same 8-function-call expression computing `todayCount` is
duplicated between the real app and the demo app. Any future change to which signals
count toward "Today" has to be made in two places.
**Fix:** Extract to `lib/attention.js`, e.g. `export function todayCount(contacts, apps, interactions) { return overdueFollowUps(contacts).length + ... }`, and call it from both.

### IN-02: `changeAppTriage` duplicated across three components

**File:** `app/src/components/CalendarTab.jsx:134-137`, `app/src/components/TodayTab.jsx:365-368` (and, per its own comment, `PipelineTab.jsx`)
**Issue:** The same triage-mutation function body is copy-pasted in at least three
places. `TodayTab.jsx`'s comment even says "Matches PipelineTab.jsx's changeTriage
exactly," acknowledging the duplication. Combined with WR-07's missing error handling,
a fix would otherwise need to be applied in 3 places.
**Fix:** Extract to a shared hook or a `db.js`/`lib` helper, e.g. `changeApplicationTriage(app, bucketKey, onRefresh)`.

### IN-03: `TimelineFindsPanel.approve()` always writes to the "personal" calendar slot

**File:** `app/src/components/TimelineFindsPanel.jsx:76-82`
**Issue:** `createEvent({...})` is called without a `slot`, so it silently defaults to
`'personal'` (`googleCalendar.js:78`). `AddEventModal.jsx` and
`AddToCalendarModal.jsx` both expose a Personal/School picker per the multi-calendar
feature; this is the one event-creation surface in the reviewed set that doesn't, so a
user who wants Timeline Finds routed to their School calendar has no way to do that
from this panel.
**Fix:** Add the same Personal/School selector used elsewhere, or at minimum document
the default behavior in the UI copy.

### IN-04: `Section`'s outer `divide-y` wrapper has no effect

**File:** `app/src/components/TodayTab.jsx:33-41`
**Issue:** `Section` wraps its single `children` (always one `RowCap` element) in
`<div className="divide-y divide-ink-100">{children}</div>`. `divide-y` only applies
borders between *sibling* children, and there's exactly one child here, so the class is
dead. Cosmetic only.
**Fix:** Remove the `divide-y divide-ink-100` from `Section`'s wrapper (it's correctly
applied inside `RowCap` itself, line 51, where it actually has multiple row siblings).

---

_Reviewed: 2026-08-17T01:24:38Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
