---
phase: 02-unified-attention-feed-today
reviewed: 2026-08-16T00:00:00Z
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
  warning: 8
  info: 5
  total: 15
status: issues_found
---

# Phase 02: Code Review Report (Re-Review)

**Reviewed:** 2026-08-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

This is a re-review of the same 11 files after `02-05-PLAN.md`'s gap-closure fix for
**CR-01** from the prior pass (`TodayTab.jsx`'s `timelineFindsCount` initializing from a
hardcoded `0` instead of `localStorage`).

**CR-01 (original) is confirmed fixed.** `TodayTab.jsx:355-356` now initializes
`timelineFindsCount` synchronously from `lsGet(PENDING_KEY)` at mount time
(`isDemoMode ? 0 : (lsGet(PENDING_KEY) || []).length`), using the same scoped-storage
key (`rec_timeline_pending`, namespaced per signed-in user via `scopedStorage.js`) that
`TimelineFindsPanel.jsx` itself reads/writes. The race between an early `allEmpty`
bail-out and a not-yet-mounted `TimelineFindsPanel` correcting a stale `0` is closed —
the gate now reflects real stored state on first paint.

However, tracing the same code path further surfaced a **new, closely related Critical
bug that the gap-closure fix did not address**: `TodayTab`'s `allEmpty` early-return
still gates whether `TimelineFindsPanel` *mounts at all*, and `TimelineFindsPanel` is the
only place `findTimelineEvents()` (the daily background scan) is ever invoked. When a
user reaches the exact "you're all caught up" state the app is designed to converge
toward — all 8 `lib/attention.js` arrays empty *and* zero pending Timeline Finds — the
panel never mounts, so the scan that would discover *new* dates from today's call notes/
application updates/interactions never runs, on that visit or any subsequent one, until
some unrelated attention item happens to appear. See CR-01 (new) below.

None of the 7 Warnings or 4 Info items from the prior review were addressed by the
02-05 gap-closure plan (which was scoped narrowly to the one bug) — all are re-confirmed
present in the current code at the line numbers below, plus one new Warning and one new
Info item found in this pass. No secrets, injection vectors, or dangerous-function usage
were found in these 11 files.

## Critical Issues

### CR-01: `TimelineFindsPanel`'s daily background scan can never run once the user is fully caught up

**File:** `app/src/components/TodayTab.jsx:355-356` (count init), `:380-384` (gate), `:448` (panel mount); `app/src/components/TimelineFindsPanel.jsx:58-63` (scan-on-mount effect)
**Issue:**
```js
// TodayTab.jsx
const [timelineFindsCount, setTimelineFindsCount] = useState(() =>
  isDemoMode ? 0 : (lsGet(PENDING_KEY) || []).length)
...
const allEmpty = overdueContacts.length === 0 && staleApps.length === 0 && highUrgency.length === 0
  && keepInTouch.length === 0 && needsReview.length === 0 && scheduleContacts.length === 0
  && oaDueList.length === 0 && oaNeedsCheckList.length === 0 && (isDemoMode || timelineFindsCount === 0)

if (allEmpty) return <EmptyState msg="✓ Nothing needs your attention. You're on top of it." />
...
{!isDemoMode && <TimelineFindsPanel apps={apps} calls={calls} interactions={interactions} contacts={contacts} onPendingChange={setTimelineFindsCount} />}
```
```js
// TimelineFindsPanel.jsx
useEffect(() => {
  if (ranRef.current) return
  ranRef.current = true
  if (meta.lastCheck !== todayStr()) scan({ force: false })
}, [])
```
`findTimelineEvents()` (the AI pass over application notes/calls/interactions that
discovers new calendar-worthy dates) is called from exactly one place in the app:
`TimelineFindsPanel`'s mount effect (or its "↻ Rescan" button, which lives inside the
same component). `TimelineFindsPanel` is only rendered on the branch of `TodayTab` that
survives the `if (allEmpty) return <EmptyState/>` early exit.

When `timelineFindsCount` is genuinely `0` (no items currently pending) *and* the other
8 attention arrays are all empty — i.e. exactly the "nothing needs your attention" state
the empty-state copy describes — `allEmpty` is `true`, `TodayTab` returns `<EmptyState/>`,
and the JSX branch containing `<TimelineFindsPanel/>` (line 448) is never reached. The
component that owns the only call site for the daily scan is never instantiated, so:
- `meta.lastCheck` is never updated (it's `TimelineFindsPanel`'s own state, persisted
  only from inside its `scan()`), so the "have we scanned today?" gate can never
  progress.
- There is no "↻ Rescan" button rendered anywhere in this state either, so there's no
  manual escape hatch — the user cannot even trigger a scan by hand.
- Because `timelineFindsCount` is component state initialized once per mount, and
  `TodayTab` fully unmounts/remounts on every tab switch (`{!loading && tab === 'today' && <TodayTab .../>}`
  in `App.jsx`), revisiting the Today tab re-runs the same `lsGet` read, which is still
  `0` — the lockout is stable, not just a one-render glitch.

The only way out of this state is for some *unrelated* signal (an overdue follow-up, a
stale application, a Keep-in-Touch reconnect, etc.) to become non-empty on its own,
which incidentally lets `TimelineFindsPanel` mount and finally run its overdue scan.
Net effect: for a user who reaches (and stays in) a genuinely caught-up state, new
extractable dates from today's calls/notes/interactions are **silently never surfaced**
— the exact symptom the original CR-01 described, reintroduced by the same
mount-gating pattern one level up. The comment at `TodayTab.jsx:373-379` ("TimelineFindsPanel's
onPendingChange callback then keeps it in sync afterward") is only true once the panel
has had a chance to mount at least once with something else on screen; it doesn't hold
in the all-clear state.

The sidebar's own `today` nav badge (`App.jsx:291`,`:392`, `todayCount`) also never
counts Timeline Finds, so there is no other UI surface that would tip the user off that
anything is stuck.

**Fix:** Don't gate the *scanning* component's mount on whether it currently has
something to show. Two options:
```js
// Option A — always render TimelineFindsPanel (it already renders its own internal
// "Nothing pending" empty state), and only fold the *other* 8 sections behind allEmpty:
const otherSectionsEmpty = overdueContacts.length === 0 && staleApps.length === 0 && highUrgency.length === 0
  && keepInTouch.length === 0 && needsReview.length === 0 && scheduleContacts.length === 0
  && oaDueList.length === 0 && oaNeedsCheckList.length === 0

return (
  <div className="space-y-4">
    {!otherSectionsEmpty && ( /* existing 8 Section blocks */ )}
    {otherSectionsEmpty && timelineFindsCount === 0 && !isDemoMode && (
      <EmptyState msg="✓ Nothing needs your attention. You're on top of it." />
    )}
    {!isDemoMode && <TimelineFindsPanel ... />}
    {/* modals */}
  </div>
)
```
```js
// Option B — decouple the daily scan from the panel's own mount lifecycle: move the
// "has today's scan run?" check + scan() call up into TodayTab (or a hook shared with
// TimelineFindsPanel) so it fires regardless of whether the panel itself is rendered.
```
Option A is the smaller change and matches the pattern the prior CR-01 fix already
established (trust localStorage as the source of truth, don't hide the thing that keeps
it fresh).

---

### CR-02: `CalendarTab`'s Feed view never refreshes after creating or deleting an event *(carried forward, unresolved)*

**File:** `app/src/components/CalendarTab.jsx:47` (`feedEvents` state), `:102-105` (fetch-once guard), `:291` (delete), `:299` (create)
**Issue:** The Feed view sources events from its own `feedEvents` state, fetched once
and cached (`if (viewMode === 'feed' && feedEvents === null) fetchFeedEvents()`). Both
event-mutation call sites still only refresh the grid's month cache:
```js
{selectedEvent && (
  <EventDetailModal
    event={selectedEvent}
    onClose={() => setSelectedEvent(null)}
    onDeleted={() => { setSelectedEvent(null); refetchMonth() }}   // line 291 — feedEvents untouched
  />
)}
{addEventOpen && (
  <AddEventModal
    defaultDate={selectedDay || undefined}
    onClose={() => setAddEventOpen(false)}
    onCreated={() => { setAddEventOpen(false); refetchMonth() }}   // line 299 — feedEvents untouched
  />
)}
```
`EventDetailModal` is directly reachable from the Feed view itself
(`openTimelineItem`'s `refType === 'event'` branch sets `selectedEvent` from a Feed row),
so deleting an event from the Feed leaves it visibly listed in Overdue/Next 7 Days/Later
until a full page reload. Creating an event while on the Feed view has the mirror
problem — it never appears until reload, since toggling `viewMode` away and back doesn't
re-fetch (`feedEvents` is no longer `null`).
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

**File:** `app/src/components/QuickScheduleModal.jsx:25`
**Issue:**
```js
const nameMatches = !selectedId && name.trim().length > 1
  ? contacts.filter(c => c.name.toLowerCase().includes(name.toLowerCase()))
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

**File:** `app/src/components/TodayTab.jsx:81-83` (`OverdueRow.markFollowedUp`), `:136-138` (`ScheduleRow.markScheduled`), `:306-308` (`OaRow.markCompleted`)
**Issue:** All three follow:
```js
} catch {
  setMarking(false)
}
```
On a write failure the button just resets to clickable with zero feedback — the user
has no way to know their action didn't persist. Every other write path added in this
phase (`TimelineFindsPanel.approve`, `CalendarTab`'s event fetches, `QuickScheduleModal.save`)
surfaces `e.message` into a visible error state.
**Fix:**
```js
} catch (e) {
  setMarking(false)
  setError(e.message) // new local state, rendered like sibling rows
}
```

### WR-07: Triage/mutation handlers have no error handling — unhandled promise rejections *(carried forward, unresolved)*

**File:** `app/src/components/TodayTab.jsx:366-369`, `app/src/components/CalendarTab.jsx:134-137`, `app/src/App.jsx:79-82`
**Issue:** `changeAppTriage` (duplicated identically in `TodayTab.jsx`/`CalendarTab.jsx`)
and `handleMet` (`App.jsx`'s `NetworkTab`, mirrored in `TodayTab.jsx`) call mutating
functions with no `try`/`catch`, invoked directly from `onClick` with no `.catch()` at
the call site either. A rejected write is an unhandled promise rejection with no
user-visible error and no rollback of optimistic UI.
**Fix:** Wrap in `try`/`catch` and surface the error consistently with the rest of the
phase's write paths.

### WR-08 (new): `oaResearch.js`'s batch write is all-or-nothing — one failed update silently drops the UI refresh for every successful write in the same batch

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

## Info

### IN-01: `todayCount` expression duplicated verbatim between `AppInner` and `DemoApp` *(carried forward, unresolved)*

**File:** `app/src/App.jsx:291`, `app/src/App.jsx:392`
**Issue:** The identical 8-function-call expression computing `todayCount` is
duplicated between the real app and the demo app.
**Fix:** Extract to `lib/attention.js`, e.g.
`export function todayCount(contacts, apps, interactions) { ... }`, call from both.

### IN-02: `changeAppTriage` duplicated across three components *(carried forward, unresolved)*

**File:** `app/src/components/CalendarTab.jsx:134-137`, `app/src/components/TodayTab.jsx:366-369` (and, per its own comment, `PipelineTab.jsx`)
**Issue:** Same triage-mutation function body copy-pasted in at least three places;
combined with WR-07, a fix needs applying three times.
**Fix:** Extract to a shared hook/helper, e.g. `changeApplicationTriage(app, bucketKey, onRefresh)`.

### IN-03: `TimelineFindsPanel.approve()` always writes to the "personal" calendar slot *(carried forward, unresolved)*

**File:** `app/src/components/TimelineFindsPanel.jsx:76-82`
**Issue:** `createEvent({...})` is called without a `slot`, silently defaulting to
`'personal'`. `AddEventModal.jsx`/`AddToCalendarModal.jsx` both expose a Personal/School
picker; this is the one event-creation surface in the reviewed set that doesn't, so a
user who wants a Timeline Find routed to School has no way to do that from this panel.
**Fix:** Add the same Personal/School selector used elsewhere, or document the default
in the UI copy.

### IN-04: `Section`'s outer `divide-y` wrapper has no effect *(carried forward, unresolved)*

**File:** `app/src/components/TodayTab.jsx:29-41` (specifically line 38)
**Issue:** `Section` wraps its single `children` (always one `RowCap` element) in
`<div className="divide-y divide-ink-100">{children}</div>`. `divide-y` only applies
borders between sibling children; with exactly one child, the class is dead. Cosmetic
only — `RowCap` (line 51) already applies the same class correctly where it has
multiple row siblings.
**Fix:** Remove `divide-y divide-ink-100` from `Section`'s wrapper div.

### IN-05 (new): `CalendarTab`'s `calls` prop is destructured but never used

**File:** `app/src/components/CalendarTab.jsx:35`
**Issue:** `export default function CalendarTab({ contacts, apps, interactions, calls, onRefresh })`
destructures `calls`, but it's never referenced anywhere else in the file. The Feed
view's `buildTimelineItems({ contacts, apps, interactions, calendarEvents: feedEvents || [] })`
(`lib/timeline.js:37`) doesn't accept a `calls` parameter at all, so `calls` data (call
logs) is entirely absent from the unified Feed's date signals — whether that's an
intentional scope decision (calls don't carry their own future-dated field) or a gap
isn't documented anywhere in this phase's files, and the unused prop is at minimum dead
code either way.
**Fix:** If Calls genuinely has no calendar-relevant date signal, drop the unused
`calls` prop from `CalendarTab`'s signature and its call site in `App.jsx`. If it was
meant to feed the Feed view, wire it through `buildTimelineItems`.

---

_Reviewed: 2026-08-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
