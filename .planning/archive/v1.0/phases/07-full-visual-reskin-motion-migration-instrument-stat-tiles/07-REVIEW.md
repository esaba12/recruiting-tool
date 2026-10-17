---
phase: 07-full-visual-reskin-motion-migration-instrument-stat-tiles
reviewed: 2026-08-21T18:17:00Z
depth: quick
files_reviewed: 45
files_reviewed_list:
  - app/package.json
  - app/src/components/AddEventModal.jsx
  - app/src/components/AddToCalendarModal.jsx
  - app/src/components/ApplicationsView.jsx
  - app/src/components/CalendarTab.jsx
  - app/src/components/CompanyOnboarding.jsx
  - app/src/components/ContactsTable.jsx
  - app/src/components/DiscoverTab.jsx
  - app/src/components/EventDetailModal.jsx
  - app/src/components/ExploreTab.jsx
  - app/src/components/KeepInTouchTab.jsx
  - app/src/components/LogInteractionModal.jsx
  - app/src/components/LoginPage.jsx
  - app/src/components/NetworkGraphTab.jsx
  - app/src/components/NotFoundPage.jsx
  - app/src/components/OutboxTab.jsx
  - app/src/components/QuickCaptureModal.jsx
  - app/src/components/ReferralCoverageTab.jsx
  - app/src/components/StatTileRow.jsx
  - app/src/components/TimelineFindsPanel.jsx
  - app/src/components/TodayTab.jsx
  - app/src/components/charts/ChartTooltip.jsx
  - app/src/components/charts/theme.js
  - app/src/components/jobBoards/CalendarView.jsx
  - app/src/components/jobBoards/JobCard.jsx
  - app/src/components/jobBoards/PreferencesPanel.jsx
  - app/src/components/jobBoards/RepoJobsView.jsx
  - app/src/components/jobBoards/RepoStats.jsx
  - app/src/components/jobBoards/UserProfileView.jsx
  - app/src/components/jobBoards/helpers.js
  - app/src/components/layout/AppShell.jsx
  - app/src/components/panels/ApplicationPanelBody.jsx
  - app/src/components/panels/ContactPanelBody.jsx
  - app/src/components/panels/JobPanelBody.jsx
  - app/src/components/ui/Badge.jsx
  - app/src/components/ui/Button.jsx
  - app/src/components/ui/Card.jsx
  - app/src/components/ui/ChipToggleGroup.jsx
  - app/src/components/ui/Modal.jsx
  - app/src/components/ui/Section.jsx
  - app/src/components/ui/SidePanel.jsx
  - app/src/components/ui/Tabs.jsx
  - app/src/lib/statTiles.js
  - app/src/lib/timeline.js
  - app/src/lib/useMediaQuery.js
findings:
  critical: 0
  warning: 1
  info: 1
  total: 2
status: issues_found
---

# Phase 07: Code Review Report

**Reviewed:** 2026-08-21T18:17:00Z
**Depth:** quick
**Files Reviewed:** 45 (`app/package-lock.json` excluded — lockfile, not source)
**Status:** issues_found

## Summary

Reviewed the full Phase 7 file set: the `framer-motion` → `motion` import swap (6 files, all consistent — `motion/react` imports verified, no lingering `framer-motion` imports anywhere in `app/src`, `package.json` correctly lists `motion@^13.1.1`), the border-radius/shadow-to-border "shape system" sweep across 8 `ui/` primitives plus ~35 consumer files, the `indigo-*`/`orange-*` → design-token color sweep, the `charts/theme.js` hex resync (every hex value cross-checked byte-for-byte against `index.css`'s `@theme` tokens — all match exactly), and the two genuinely new files (`lib/statTiles.js`, `StatTileRow.jsx`) implementing the Today-tab instrument-panel stat tiles.

Grep sweeps for hardcoded secrets, dangerous functions (`eval`/`innerHTML`/`dangerouslySetInnerHTML`), debug artifacts, and empty catch blocks came back clean across all 45 files. The shared `ui/` primitives (Button, Badge, Card, Tabs, ChipToggleGroup, Section, Modal, SidePanel) are consistent, correctly tokenized, and free of regressions. `useMediaQuery.js` is a clean, defensively-written hook.

Two issues found, neither blocking: a genuine edge-case gap in the new `nextDeadlines()` stat tile (doesn't distinguish an already-missed deadline from a real countdown), and dead/leftover `rounded-t-2xl` classes on 5 modal header divs whose parent containers were migrated to the new shape system but whose inner sticky-header element wasn't — harmless today (the parent's `overflow` clip wins) but inconsistent with the phase's own stated goal and confusing to a future maintainer who edits the parent radius expecting it to change what's visible.

## Warnings

### WR-01: `nextDeadlines()` doesn't filter out already-expired deadlines, so the Next Deadline stat tile can show a negative countdown

**File:** `app/src/lib/statTiles.js:22-38` (renders via `app/src/components/StatTileRow.jsx:44-50`)
**Issue:** `daysUntilDeadline()` (`app/src/components/jobBoards/helpers.js:108-112`) can return a negative number once a real, confirmed deadline has passed. `nextDeadlines()` only filters out `days === null` (missing/rolling entries) — it never excludes `days < 0` — and because the sort is ascending (`x.days - y.days`), an expired deadline sorts to the very front, ahead of every still-open deadline. `StatTileRow.jsx` then renders it unconditionally as `<Mono>{soonest.days}d</Mono>` (e.g. "-5d"), which reads as a countdown rather than "this deadline has passed and the application is still sitting in Needs Review/Applying" — the opposite of what a glanceable urgency tile should communicate. The sibling implementation this module explicitly compares itself against, `lib/timeline.js`'s `buildTimelineItems()`/`tierFor()` (timeline.js:26-31, 84-98), handles the identical `days < 0` case by bucketing into a distinct `'overdue'` tier so the UI can label it correctly — `statTiles.js`'s inline doc comment even calls out that it's intentionally narrower in scope than `timeline.js`, but doesn't carry over this handling.
**Fix:** Either exclude expired entries from the candidate pool, or thread through enough information for the tile to render "expired" instead of a negative day count:
```js
// app/src/lib/statTiles.js
const days = daysUntilDeadline(info)
if (days === null) continue
matches.push({ company: a.company, role: a.role, deadline: info.deadline, days })
```
```js
// app/src/components/StatTileRow.jsx
{soonest ? (
  soonest.days < 0 ? (
    <>
      <Mono className="block text-2xl mt-1 text-danger-600">Past due</Mono>
      <p className="text-xs text-ink-400 mt-0.5">{soonest.company} — {Math.abs(soonest.days)}d ago</p>
    </>
  ) : (
    /* existing countdown rendering */
  )
) : ( /* ... */ )}
```

## Info

### IN-01: Leftover `rounded-t-2xl` header classes across 5 files migrated in the shape-system sweep

**File:** `app/src/components/AddEventModal.jsx:35`, `app/src/components/EventDetailModal.jsx:36`, `app/src/components/QuickCaptureModal.jsx:192`, `app/src/components/panels/JobPanelBody.jsx:33`, `app/src/components/panels/ApplicationPanelBody.jsx:253`
**Issue:** In each file, the modal/panel's outer container was correctly migrated from the old radius scale to the new shape system (e.g. `AddEventModal.jsx:34`: `rounded-t-2xl md:rounded-2xl shadow-2xl` → `rounded-t-md md:rounded-md border border-ink-300`), but the inner sticky-header `<div>` immediately inside it still carries the old `rounded-t-2xl` (or `md:rounded-t-2xl`) class. Since the outer container clips via `overflow-y-auto`, the header's own radius is currently masked by the tighter parent clip and has no visible effect — but it's dead code left behind by an incomplete find-and-replace, contradicts the phase's own stated "shape system tightening" migration for these exact files, and is a footgun for a future edit: if the outer container's `overflow` or radius is ever changed without noticing the header's stale class, the visual mismatch becomes real (the 2xl-radius header peeking out past a tighter-radius parent edge). `QuickCaptureModal.jsx` is the clearest case — it already uses the fully-migrated shared `ui/Modal.jsx` (which is `rounded-t-md`) yet its own header div independently re-declares `rounded-t-2xl`.
**Fix:** Update the 5 header divs to match their parent's current radius token (`rounded-t-md`, or drop the radius class entirely where the parent already clips it, e.g. `QuickCaptureModal.jsx` doesn't need any radius class on the header at all since `ui/Modal.jsx` owns it):
```jsx
// app/src/components/AddEventModal.jsx:35 and EventDetailModal.jsx:36
<div className="sticky top-0 bg-white border-b border-ink-100 px-5 py-4 rounded-t-md flex items-center justify-between">
```
```jsx
// app/src/components/QuickCaptureModal.jsx:192
<div className="sticky top-0 bg-white border-b border-ink-100 px-5 py-4 flex items-center justify-between z-10">
```

---

_Reviewed: 2026-08-21T18:17:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
