---
phase: 02-unified-attention-feed-today
reviewed: 2026-08-17T00:00:00Z
depth: standard
files_reviewed: 13
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
  - app/src/lib/timelineFinder.js
  - app/src/lib/useTimelineFinds.js
  - app/src/shared.jsx
findings:
  critical: 1
  warning: 9
  info: 5
  total: 15
status: issues_found
---

# Phase 02: Code Review Report (Re-Review 2)

**Reviewed:** 2026-08-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

This is the third pass over this phase, following Plan 02-06's extraction of
`app/src/lib/useTimelineFinds.js` to close **CR-01 (new)** from the prior review
(`TodayTab.jsx`'s `allEmpty` early-return gating whether `TimelineFindsPanel` — the
app's only call site for the daily `findTimelineEvents()` scan — ever mounted).

**CR-01 (new) is confirmed fixed, and correctly, without reintroducing the
previously-rejected "always mount the panel" approach.** `TodayTab.jsx:356-359` now
calls `useTimelineFinds({ apps, calls, interactions, contacts, enabled: !isDemoMode })`
unconditionally, several lines above the `allEmpty` gate at `:384-388`. Because React
hooks execute in declaration order on every render regardless of which JSX branch a
component's function body ultimately returns, the hook's internal mount effect
(`useTimelineFinds.js:56-62`, `if (meta.lastCheck !== todayStr()) scan({ force: false })`)
now fires on every mount of `TodayTab` — including the render where `allEmpty` evaluates
`true` and the function returns `<EmptyState/>` before `<TimelineFindsPanel/>`'s JSX is
ever reached. The scan trigger's fate is no longer coupled to whether the *presentational*
panel (`TimelineFindsPanel.jsx`, now purely props-driven with no owned state or effects)
gets rendered. `allEmpty` itself still correctly folds all 9 signals — the 8
`lib/attention.js` arrays plus `(isDemoMode || timelineFinds.length === 0)` — into one
gate feeding a single `EmptyState`, so the all-9-arrays/single-`EmptyState` contract is
intact: the panel is still conditionally rendered (`{!isDemoMode && <TimelineFindsPanel .../>}`
at `:452-457`), it just no longer controls whether the underlying scan can run. This is
the smaller, correct fix — equivalent in spirit to the prior review's suggested "Option
B" (decouple the daily scan from the panel's mount lifecycle) rather than "Option A"
(always render the panel), and it does not resurrect the single-`EmptyState` violation
Option A would have caused.

While verifying the hook extraction line-by-line, a new correctness bug was found in
`useTimelineFinds.js`'s `scan()` that wasn't present in the previous review's list (see
**WR-09**, new) — a stale-closure race that can resurrect a just-dismissed Timeline Find
if the user dismisses it while an AI scan is still in flight.

Of the 2 Critical, 8 Warning, and 5 Info items carried forward from the prior review:
**CR-02 remains unresolved** (Plan 02-06 was scoped only to CR-01/new). **All 8
Warnings and all 5 Info items are re-confirmed present**, unchanged in substance, at
updated line numbers below (some content shifted ~1 line due to the new
`useTimelineFinds` import in `TodayTab.jsx`; `TimelineFindsPanel.jsx`'s line numbers
shifted more substantially since it was rewritten to be purely presentational — IN-03's
underlying bug moved with the code it was attached to, into `useTimelineFinds.js`). No
secrets, injection vectors, or dangerous-function usage were found in these 13 files.

## Critical Issues

### CR-02: `CalendarTab`'s Feed view never refreshes after creating or deleting an event *(carried forward, unresolved — not in scope of the 02-06 fix)*

**File:** `app/src/components/CalendarTab.jsx:47` (`feedEvents` state), `:102-105` (fetch-once guard), `:291` (delete), `:299` (create)
**Issue:** The Feed view sources events from its own `feedEvents` state, fetched once
and cached (`if (viewMode === 'feed' && feedEvents === null) fetchFeedEvents()` at
`:102-105`). Both event-mutation call sites still only refresh the grid's month cache:
```js
{selectedEvent && (
  <EventDetailModal
    event={selectedEvent}
    onClose={() => setSelectedEvent(null)}
    onDeleted={() => { setSelectedEvent(null); refetchMonth() }}   // :291 — feedEvents untouched
  />
)}
{addEventOpen && (
  <AddEventModal
    defaultDate={selectedDay || undefined}
    onClose={() => setAddEventOpen(false)}
    onCreated={() => { setAddEventOpen(false); refetchMonth() }}   // :299 — feedEvents untouched
  />
)}
```
`EventDetailModal` is directly reachable from the Feed view itself
(`openTimelineItem`'s `refType === 'event'` branch at `:146-149` sets `selectedEvent`
from a Feed row), so deleting an event from the Feed leaves it visibly listed in
Overdue/Next 7 Days/Later until a full page reload. Creating an event while on the Feed
view has the mirror problem — it never appears until reload, since toggling `viewMode`
away and back doesn't re-fetch (`feedEvents` is no longer `null`).
**Fix:** Invalidate/refetch `feedEvents` alongside the grid cache on both mutation paths:
```js
onDeleted={() => { setSelectedEvent(null); refetchMonth(); if (feedEvents !== null) fetchFeedEvents() }}
...
onCreated={() => { setAddEventOpen(false); refetchMonth(); if (feedEvents !== null) fetchFeedEvents() }}
```

## Warnings

### WR-01: `hasRecruitingActivity` ignores the app's own `isUntriaged` policy *(carried forward, unresolved)*

**File:** `app/src/components/OverviewTab.jsx:36`
**Issue:** `const hasRecruitingActivity = apps.length > 0` gates the KPI row (Active
Apps/Interviews/Offers + funnel chart) vs. a single "Companies" KPI, counting *every*
application including ones `isUntriaged()` (`shared.jsx:107-109`) excludes from every
other "active" stat in the app. A user whose only applications are freshly bulk-imported
Needs-Review/Wishlist rows gets the funnel branch — but `triagedApps` (used to build
`funnelData`/`stageCounts`) filters those same rows out, producing an all-zero funnel
chart and 0/0/0 KPI tiles instead of the friendlier "Companies" card designed for this
exact state.
**Fix:**
```js
const hasRecruitingActivity = triagedApps.length > 0
```

### WR-02: Hardcoded status filter list will drift from `shared.jsx`'s `STATUS_OPTIONS` *(carried forward, unresolved)*

**File:** `app/src/App.jsx:77`
**Issue:**
```js
const statuses = ['ALL', '🟢 Warm', '🟡 Cooling', '🔴 Cold', '⭐ Champion', '✅ Closed']
```
`shared.jsx` already exports `STATUS_OPTIONS = Object.keys(STATUS_COLOR)` for exactly
this purpose, and other components (`ContactDetailModal.jsx`, `QuickCaptureModal.jsx`)
use it. A future status add/rename silently won't reach this filter bar.
**Fix:**
```js
const statuses = ['ALL', ...STATUS_OPTIONS]
```

### WR-03: OA-research prompt's "today" date is frozen at module load, not per call *(carried forward, unresolved)*

**File:** `app/src/lib/oaResearch.js:39,44`
**Issue:** `PROMPT_HEADER` is a module-level `const` embedding
`new Date().toISOString().slice(0, 10)`, evaluated once per page load/SPA session.
`researchOaDeadlines()` runs repeatedly over a long-lived tab (triggered from `App.jsx`'s
`apps`-dependent effect on every load), so a session left open across a day boundary
resolves relative deadlines ("expires in 7 days") against a stale "today," writing wrong
absolute dates straight to Supabase via `updateApplication`.
**Fix:** Compute the date string inside `researchChunk` at call time instead of baking
it into a module-level constant.

### WR-04: Positional fallback in `researchChunk` can misattribute OA page content across applications *(carried forward, unresolved)*

**File:** `app/src/lib/oaResearch.js:64-69`
**Issue:**
```js
const byUrl = new Map(pages.map(p => [normalizeUrl(p.url || p.id), p]))
const digest = apps.map((a, i) => {
  const page = byUrl.get(normalizeUrl(a.oaLink)) || pages[i]
  ...
})
```
When the URL-keyed lookup misses (Exa normalizes/redirects differently than
`normalizeUrl()`, or some URLs in the batch failed and were dropped from `pages`), the
code falls back to `pages[i]` — a purely positional guess that `pages` preserves the
same order/count as `urls`. A single dropped/reordered entry shifts every subsequent
app in the chunk onto the wrong page's text, and a resulting `deadline` gets written via
`updateApplication` against the wrong application's `id`.
**Fix:** Drop the positional fallback — treat a URL-lookup miss as "no page content":
```js
const page = byUrl.get(normalizeUrl(a.oaLink))
const text = (page?.text || '').trim()
```

### WR-05: `QuickScheduleModal`'s name search crashes on a contact with no `name` *(carried forward, unresolved)*

**File:** `app/src/components/QuickScheduleModal.jsx:24-26`
**Issue:**
```js
const nameMatches = !selectedId && name.trim().length > 1
  ? contacts.filter(c => c.name.toLowerCase().includes(name.toLowerCase())).slice(0, 5)
  : []
```
No guard against `c.name` being `null`/`undefined`. `App.jsx`'s equivalent search
(`[c.name, c.company, c.role, c.email].some(f => f?.toLowerCase().includes(q))`) uses
optional chaining specifically to avoid this. Any contact lacking a name throws a
`TypeError` the moment 2+ characters are typed into this modal.
**Fix:**
```js
? contacts.filter(c => c.name?.toLowerCase().includes(name.toLowerCase()))
```

### WR-06: Silent catch blocks in TodayTab's inline mark-done actions *(carried forward, unresolved)*

**File:** `app/src/components/TodayTab.jsx:82-84` (`OverdueRow.markFollowedUp`), `:137-139` (`ScheduleRow.markScheduled`), `:307-309` (`OaRow.markCompleted`)
**Issue:** All three follow:
```js
} catch {
  setMarking(false)
}
```
On a write failure the button just resets to clickable with zero feedback — the user
has no way to know their action didn't persist. Every other write path in this phase
(`useTimelineFinds.approve`, `CalendarTab`'s event fetches, `QuickScheduleModal.save`)
surfaces `e.message` into a visible error state.
**Fix:**
```js
} catch (e) {
  setMarking(false)
  setError(e.message) // new local state, rendered like sibling rows
}
```

### WR-07: Triage/mutation handlers have no error handling — unhandled promise rejections *(carried forward, unresolved)*

**File:** `app/src/components/TodayTab.jsx:369-372`, `app/src/components/CalendarTab.jsx:134-137`, `app/src/App.jsx:79-82`
**Issue:** `changeAppTriage` (duplicated identically in `TodayTab.jsx`/`CalendarTab.jsx`)
and `handleMet` (`App.jsx`'s `NetworkTab`, mirrored in `TodayTab.jsx`) call mutating
functions with no `try`/`catch`, invoked directly from `onClick` with no `.catch()` at
the call site either. A rejected write is an unhandled promise rejection with no
user-visible error and no rollback of optimistic UI.
**Fix:** Wrap in `try`/`catch` and surface the error consistently with the rest of the
phase's write paths.

### WR-08: `oaResearch.js`'s batch write is all-or-nothing — one failed update silently drops the UI refresh for every successful write in the same batch *(carried forward, unresolved)*

**File:** `app/src/lib/oaResearch.js:110-118`
**Issue:**
```js
const now = new Date().toISOString()
await Promise.all(allResults.map(r =>
  r.deadline && r.confidence === 'stated'
    ? updateApplication(r.id, { oaDueDate: r.deadline })
    : updateApplication(r.id, { oaResearchCheckedAt: now })
))

return allResults.length
```
`Promise.all` rejects as soon as any one `updateApplication` call rejects. The other
`updateApplication` calls in the same `Promise.all` are independent, unawaited fire-off
writes that may well have already *succeeded* against Supabase by the time the whole
expression rejects — but because the function's `return allResults.length` is never
reached, `App.jsx`'s caller (`researchOaDeadlines(apps).then(count => { if (count > 0) load() })`)
never sees a `count`, so `load()` is never called. Those successful writes sit correctly
persisted in the database but invisible in the UI until some unrelated refresh happens —
and because `oaResearchCheckedAt`/`oaDueDate` weren't updated in local state, the next
effect pass may re-select the same app as a research candidate (`needsResearch`), doing
redundant work.
**Fix:** Use `Promise.allSettled` instead, and count only the fulfilled writes:
```js
const settled = await Promise.allSettled(allResults.map(r => ...))
return settled.filter(s => s.status === 'fulfilled').length
```

### WR-09 (new): `useTimelineFinds.scan()` can resurrect an item the user just dismissed, via a stale-closure race with the in-flight AI call

**File:** `app/src/lib/useTimelineFinds.js:31-51`
**Issue:**
```js
async function scan({ force = false } = {}) {
  if (running) return
  setRunning(true); setError(null)
  try {
    const { events, scannedKeys, error: partialError } = await findTimelineEvents({
      apps, calls, interactions, contactsById,
      skipHashes: force ? {} : meta.hashes,
    })
    if (events.length) {
      const byKey = new Map(pending.map(p => [p.key, p]))   // `pending` closed over at scan()'s call time
      for (const e of events) if (!byKey.has(e.key)) byKey.set(e.key, e)
      persistPending([...byKey.values()])
    }
    ...
```
`scan()` is `async` and its meaningful work (`findTimelineEvents`, an AI call batched up
to `CHUNK_SIZE = 30` records per Haiku call) can take several seconds. `pending` here is
the plain closed-over state variable from the render in which this particular `scan`
closure was created (the mount effect's initial render, or whichever render was current
when the "↻ Rescan" button was clicked) — not a functional `setPending(prev => ...)`
update. If the user dismisses (or edits) an already-pending Timeline Find while a scan
they triggered is still awaiting its AI response, `dismiss()`/`updateField()` correctly
update React state via `setPending`, but when `scan()`'s `await` resolves it merges new
events into the **stale, pre-dismiss** `pending` snapshot and calls
`persistPending([...byKey.values()])`, overwriting the just-updated state — silently
reintroducing the item the user just dismissed (or reverting an in-progress edit to a
pending item's title/date). `running` only guards against two overlapping *scans*; it
does nothing to protect `pending` mutations that happen via `dismiss`/`updateField`
while one scan is outstanding.
**Fix:** Use the functional form to merge against the freshest state rather than a
closed-over snapshot:
```js
if (events.length) {
  setPending(prevPending => {
    const byKey = new Map(prevPending.map(p => [p.key, p]))
    for (const e of events) if (!byKey.has(e.key)) byKey.set(e.key, e)
    const next = [...byKey.values()]
    lsSet(PENDING_KEY, next)
    return next
  })
}
```
(or equivalently, re-read `lsGet(PENDING_KEY)` immediately before merging).

## Info

### IN-01: `todayCount` expression duplicated verbatim between `AppInner` and `DemoApp` *(carried forward, unresolved)*

**File:** `app/src/App.jsx:291`, `app/src/App.jsx:392`
**Issue:** The identical 8-function-call expression computing `todayCount` is
duplicated between the real app and the demo app.
**Fix:** Extract to `lib/attention.js`, e.g.
`export function todayCount(contacts, apps, interactions) { ... }`, call from both.

### IN-02: `changeAppTriage` duplicated across three components *(carried forward, unresolved)*

**File:** `app/src/components/CalendarTab.jsx:134-137`, `app/src/components/TodayTab.jsx:369-372` (and, per its own comment, `PipelineTab.jsx`)
**Issue:** Same triage-mutation function body copy-pasted in at least three places;
combined with WR-07, a fix needs applying three times.
**Fix:** Extract to a shared hook/helper, e.g. `changeApplicationTriage(app, bucketKey, onRefresh)`.

### IN-03: Timeline Find approval always writes to the "personal" calendar slot *(carried forward, unresolved — relocated from `TimelineFindsPanel.jsx` to `useTimelineFinds.js` by the 02-06 extraction)*

**File:** `app/src/lib/useTimelineFinds.js:72-88` (`approve()`)
**Issue:**
```js
await createEvent({
  title: item.title,
  date: item.date,
  startTime: item.startTime || '',
  endTime: item.startTime ? addOneHour(item.startTime) : '',
  description: item.description,
})
```
`createEvent()` is called without a `slot`, silently defaulting to `'personal'`.
`AddEventModal.jsx`/`AddToCalendarModal.jsx` both expose a Personal/School picker; this
is the one event-creation surface in the reviewed set that doesn't, so a user who wants
a Timeline Find routed to School has no way to do that. Previously flagged against
`TimelineFindsPanel.jsx` (which owned `approve()` before this phase's extraction);
`TimelineFindsPanel.jsx` is now purely presentational and the underlying bug moved with
the logic into the new hook — same defect, new home.
**Fix:** Add the same Personal/School selector used elsewhere (threaded from
`TimelineFindsPanel` up through `onApprove`), or document the default in the UI copy.

### IN-04: `Section`'s outer `divide-y` wrapper has no effect *(carried forward, unresolved)*

**File:** `app/src/components/TodayTab.jsx:30-42` (specifically line 39)
**Issue:** `Section` wraps its single `children` (always one `RowCap` element) in
`<div className="divide-y divide-ink-100">{children}</div>`. `divide-y` only applies
borders between sibling children; with exactly one child, the class is dead. Cosmetic
only — `RowCap` (line 52) already applies the same class correctly where it has
multiple row siblings.
**Fix:** Remove `divide-y divide-ink-100` from `Section`'s wrapper div.

### IN-05: `CalendarTab`'s `calls` prop is destructured but never used *(carried forward, unresolved)*

**File:** `app/src/components/CalendarTab.jsx:35`
**Issue:** `export default function CalendarTab({ contacts, apps, interactions, calls, onRefresh })`
destructures `calls`, but it's never referenced anywhere else in the file. The Feed
view's `buildTimelineItems({ contacts, apps, interactions, calendarEvents: feedEvents || [] })`
(`lib/timeline.js`) doesn't accept a `calls` parameter at all, so call logs are entirely
absent from the unified Feed's date signals — whether that's an intentional scope
decision or a gap isn't documented anywhere in this phase's files, and the unused prop
is at minimum dead code either way.
**Fix:** If Calls genuinely has no calendar-relevant date signal, drop the unused
`calls` prop from `CalendarTab`'s signature and its call site in `App.jsx`. If it was
meant to feed the Feed view, wire it through `buildTimelineItems`.

---

_Reviewed: 2026-08-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
