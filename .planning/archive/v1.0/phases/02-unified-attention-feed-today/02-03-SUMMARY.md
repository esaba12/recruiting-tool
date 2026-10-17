---
phase: 02-unified-attention-feed-today
plan: 3
subsystem: ui
tags: [react, nav, routing, attention-feed, cutover]

# Dependency graph
requires:
  - phase: 02-unified-attention-feed-today
    provides: "app/src/components/TodayTab.jsx's exact prop contract (contacts, apps, interactions, calls, relationships, onFindPeople, onRefresh, onRefreshRelationships, isDemoMode) (02-02); lib/attention.js's 8 derivation functions + keepInTouchDue re-export, NAV_ICON.today (02-01)"
provides:
  - "Today reachable as the first nav item in both the real app and /demo, rendering TodayTab live"
  - "ActionsTab.jsx deleted; OverviewTab's nudge sections removed; CalendarTab's TimelineFindsPanel mount removed; NetworkTab's Keep-in-Touch standalone view removed"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sidebar badge counts sourced from lib/attention.js's derivation functions instead of ad hoc inline filter math duplicated per-component"

key-files:
  created: []
  modified:
    - app/src/components/layout/Sidebar.jsx
    - app/src/lib/icons.js
    - app/src/App.jsx
    - app/src/components/OverviewTab.jsx
    - app/src/components/CalendarTab.jsx
    - app/src/shared.jsx
    - app/src/lib/attention.js
    - app/src/lib/oaResearch.js
    - app/src/components/QuickScheduleModal.jsx
    - app/src/components/TodayTab.jsx

key-decisions:
  - "Reworded 5 files' stale 'ActionsTab.jsx' provenance/traceability comments (left behind by already-committed Plans 02-01/02-02) to remove the literal substring, since this plan's own ATTN-03 verification gate is a literal repo-wide grep for 'ActionsTab' with no comment/code distinction — comment text only, zero behavior change"
  - "Left CalendarTab.jsx's now-unused `calls` prop in its destructured signature untouched, per the plan's explicit 'the component file itself is not touched further' scope boundary for that file's edit — vite build doesn't lint on unused args, so this is inert, not a defect"

patterns-established: []

requirements-completed: [ATTN-01, ATTN-03]

coverage:
  - id: D1
    description: "Today is reachable as the first item in the persistent nav in both AppInner and DemoApp, and clicking it renders TodayTab with live data"
    requirement: "ATTN-01"
    verification:
      - kind: unit
        ref: "bash grep verification embedded in 02-03-PLAN.md Task 1/2 <verify> blocks (NAV_ITEMS first-entry check, tab==='today' && <TodayTab render-block presence in both AppInner and DemoApp) plus npx esbuild parse"
        status: pass
      - kind: integration
        ref: "cd app && npm run build"
        status: pass
    human_judgment: true
    rationale: "Deterministic gates confirm the nav item, routing branch, and prop wiring are all correct and the app compiles end-to-end — but actual click-through/visual verification of the live rendered feed in a browser is deferred to this phase's staged end-of-phase human visual-verification pass, per workflow.human_verify_mode=end-of-phase."
  - id: D2
    description: "ActionsTab.jsx, Overview's nudge sections, and Keep in Touch's standalone Network view no longer exist anywhere in app/src — not just App.jsx's own render branch"
    requirement: "ATTN-03"
    verification:
      - kind: unit
        ref: "bash repo-wide grep for 'ActionsTab' and the quoted string 'actions' across app/src/ — zero hits (02-03-PLAN.md Task 3 <verify>); grep for 'keepintouch' in App.jsx — zero hits (Task 2 <verify>)"
        status: pass
    human_judgment: false
  - id: D3
    description: "TimelineFindsPanel no longer mounts inside CalendarTab.jsx — its only remaining mount point is TodayTab.jsx"
    requirement: "ATTN-03"
    verification:
      - kind: unit
        ref: "bash grep for 'TimelineFindsPanel' in CalendarTab.jsx — zero hits (02-03-PLAN.md Task 3 <verify>); grep confirms it still mounts in TodayTab.jsx"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-08-17
status: complete
---

# Phase 2 Plan 3: Nav Cutover + Legacy Surface Retirement Summary

**Executed the phase's single atomic cutover — Today is now first in the nav and renders the live unified attention feed in both the real app and /demo, while ActionsTab.jsx, Overview's nudge sections, Calendar's TimelineFindsPanel mount, and Network's Keep-in-Touch standalone view are all gone, verified by a clean repo-wide ATTN-03 grep and a passing production build.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-16T18:03:00Z
- **Completed:** 2026-08-16T18:08:00Z
- **Tasks:** 3 completed
- **Files modified:** 10 (0 new, 9 modified, 1 deleted)

## Accomplishments
- `Sidebar.jsx`'s `NAV_ITEMS` now leads with `{ id: 'today', label: 'Today' }`; `actions` is gone from the array. `icons.js`'s `NAV_ICON` drops the `actions: ListChecks` entry (and the now-unused `ListChecks` import); `today: Gauge` (added in Plan 02-01) is untouched.
- `App.jsx`'s `AppInner` and `DemoApp` both swap `ActionsTab` for `TodayTab` in their render branches, with the sidebar badge count now computed from `lib/attention.js`'s 8 derivation functions instead of ad hoc inline filter math. `AppInner`'s call includes `onFindPeople={goFindPeople}` and `calls`; `DemoApp`'s call deliberately omits both (no `calls` fetch, no `goFindPeople` closure in demo mode), matching `TodayTab.jsx`'s own `isDemoMode`-gated `TimelineFindsPanel` suppression.
- `NetworkTab`'s Keep-in-Touch standalone view (`view === 'keepintouch'` branch, the `KeepInTouchTab` import, the `logContact` state, and its `LogInteractionModal` render block) is fully removed — `TodayTab` now owns the equivalent Keep-in-Touch row wiring independently. `KeepInTouchTab.jsx` and `TimelineFindsPanel.jsx` remain on disk (only their old mount points were removed, per the plan's explicit scope), since both are still used elsewhere.
- `DEMO_NAV_ITEMS`'s filter list is now exactly `['today', 'overview', 'network', 'pipeline']`, per D-03b.
- `ActionsTab.jsx` is deleted outright. `OverviewTab.jsx`'s "want to schedule" nudge and "Needs Attention" blocks (plus their now-dead local consts `scheduleQueue`/`overdueContacts`/`staleApps` and the `onOpenActions` prop) are gone. `CalendarTab.jsx`'s `TimelineFindsPanel` mount and import are gone — its only remaining mount point is `TodayTab.jsx`.
- The phase's ATTN-03 repo-wide grep (`ActionsTab` or the quoted string `'actions'` anywhere in `app/src/`) returns zero hits, and `cd app && npm run build` succeeds — the first point in the phase `TodayTab.jsx` is actually reachable from the entry point.

## Task Commits

Each task was committed atomically:

1. **Task 1: Nav registry cutover — Sidebar.jsx NAV_ITEMS + icons.js NAV_ICON** - `76d109e` (feat)
2. **Task 2: App.jsx cutover — AppInner + DemoApp render Today, NetworkTab drops Keep-in-Touch** - `b5aee2a` (feat)
3. **Task 3: Retire ActionsTab.jsx, Overview's nudges, CalendarTab's TimelineFindsPanel mount** - `53c743c` (feat)

## Files Created/Modified
- `app/src/components/layout/Sidebar.jsx` - `NAV_ITEMS` gains `today` (first), loses `actions`
- `app/src/lib/icons.js` - `NAV_ICON.actions` removed; unused `ListChecks` import dropped
- `app/src/App.jsx` - `AppInner`/`DemoApp` render `TodayTab` instead of `ActionsTab`; `NETWORK_VIEWS` drops `keepintouch`; `DEMO_NAV_ITEMS` swaps `actions` for `today`; badge counts sourced from `lib/attention.js`
- `app/src/components/OverviewTab.jsx` - Nudge sections + `onOpenActions` prop removed; unused imports dropped
- `app/src/components/CalendarTab.jsx` - `TimelineFindsPanel` mount + import removed
- `app/src/shared.jsx`, `app/src/lib/attention.js`, `app/src/lib/oaResearch.js`, `app/src/components/QuickScheduleModal.jsx`, `app/src/components/TodayTab.jsx` - Rule 1 deviation: stale `ActionsTab.jsx` provenance comments reworded (see Deviations below)
- `app/src/components/ActionsTab.jsx` - Deleted

## Decisions Made
- Reworded 5 files' stale `ActionsTab.jsx` comment references rather than leaving them, since the plan's own ATTN-03 verification is a literal grep with no comment/code distinction — comment-text-only changes, zero behavior impact.
- Left `CalendarTab.jsx`'s `calls` prop in its destructured signature even though it's now unused in that file, per the plan's explicit "the component file itself is not touched further" instruction for that edit — inert, not a defect (`vite build` doesn't lint unused args).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 3's own ATTN-03 grep gate failed on stale comment references to the deleted ActionsTab.jsx**
- **Found during:** Task 3, running the plan's own `<verify>` command
- **Issue:** Plans 02-01 and 02-02 (already committed before this plan started) left several `// ActionsTab.jsx:NN-NN` provenance/traceability comments in `shared.jsx`, `lib/attention.js`, `lib/oaResearch.js`, `components/QuickScheduleModal.jsx`, and `components/TodayTab.jsx`, documenting where logic was ported from. Task 3's own acceptance criteria and `<verify>` command require a repo-wide `grep -rn "ActionsTab\|'actions'" app/src/` to return zero hits — a literal string match that doesn't distinguish code references from comments, so these 5 files' historical comments tripped the gate even though `ActionsTab.jsx` itself, and every real import/render of it, were already fully removed by Task 2.
- **Fix:** Reworded each comment to remove the literal `ActionsTab` substring (e.g. "ported verbatim from `ActionsTab.jsx:129-131`" → "ported verbatim from the former Actions tab"), preserving the historical/provenance meaning without the now-stale filename. No logic, imports, or exports changed in any of the 5 files — comment text only.
- **Files modified:** `app/src/shared.jsx`, `app/src/lib/attention.js`, `app/src/lib/oaResearch.js`, `app/src/components/QuickScheduleModal.jsx`, `app/src/components/TodayTab.jsx`
- **Verification:** Re-ran the plan's exact `<verify>` grep command after the edits — zero hits, confirmed clean. `npx esbuild` parse on each touched file confirmed no syntax breakage.
- **Committed in:** `53c743c`

---

**Total deviations:** 1 auto-fixed (Rule 1 — verification-gate bug, comment text only)
**Impact on plan:** The plan's own `<verification>` section explicitly lists only `Sidebar.jsx, icons.js, App.jsx, OverviewTab.jsx, CalendarTab.jsx` plus `ActionsTab.jsx` (deleted) as this plan's expected changeset — the 5 comment-only files above are outside that literal list, but the fix was required to make the plan's own stated acceptance criteria (a zero-hit repo-wide grep) actually pass. No scope creep beyond that: no logic, prop, or behavior changed in any of the 5 files.

## Issues Encountered
None beyond the deviation documented above — caught and fixed inline during Task 3, not discovered as a later failure.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Today is reachable first in the nav in both the real app and `/demo`; the full production build (`cd app && npm run build`) succeeds with `TodayTab.jsx` live in the entry graph for the first time this phase.
- `ActionsTab.jsx` no longer exists; the repo-wide ATTN-03 grep (`ActionsTab` / `'actions'`) is clean across `app/src/`.
- `KeepInTouchTab.jsx` and `TimelineFindsPanel.jsx` remain on disk (only their old standalone mount points were removed) — both are still imported and used, `TimelineFindsPanel` now exclusively from `TodayTab.jsx`.
- Live browser/UAT click-through verification (row → modal, Show more/fewer, triage chips, Timeline Finds approve/dismiss, nav badge counts) is still deferred to this phase's staged end-of-phase human visual-verification pass, per `workflow.human_verify_mode=end-of-phase` — this plan only made the surface reachable and compile-clean, it did not itself run a live browser check.
- No blockers.

---
*Phase: 02-unified-attention-feed-today*
*Completed: 2026-08-17*

## Self-Check: PASSED

`app/src/components/ActionsTab.jsx` confirmed absent from disk; `app/src/components/TodayTab.jsx`, `app/src/App.jsx`, `app/src/components/layout/Sidebar.jsx`, `app/src/lib/icons.js`, `app/src/components/OverviewTab.jsx`, `app/src/components/CalendarTab.jsx` all found on disk. All 3 task commit hashes (`76d109e`, `b5aee2a`, `53c743c`) found in `git log`.
