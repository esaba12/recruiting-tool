---
phase: 03-grow-discovery-funnel-merge
plan: 02
subsystem: ui
tags: [react, lucide-react, nav, sidebar]

# Dependency graph
requires: []
provides:
  - "NAV_ICON.grow (Sprout icon) exported from app/src/lib/icons.js"
  - "Sidebar.jsx's NAV_ITEMS array has a grow/'Grow' entry in place of explore/'Explore', same array position"
affects: [03-07, 03-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nav item id/icon renaming stays a two-file, additive-lookup change: NAV_ITEMS id + NAV_ICON[id] map, no per-tab special-casing"

key-files:
  created: []
  modified:
    - app/src/lib/icons.js
    - app/src/components/layout/Sidebar.jsx

key-decisions:
  - "Used lucide-react's Sprout icon for the Grow nav item (human-confirmed for this run over 03-RESEARCH.md's tentative TrendingUp suggestion), confirmed present in the installed lucide-react package"

requirements-completed: [GROW-01]

coverage:
  - id: D1
    description: "Sidebar's primary nav shows a 'Grow' item with a Sprout icon in the exact array position 'Explore' used to occupy, on both desktop and mobile nav renders"
    requirement: "GROW-01"
    verification:
      - kind: other
        ref: "grep -c \"id: 'grow'\" app/src/components/layout/Sidebar.jsx == 1; grep -c \"id: 'explore'\" app/src/components/layout/Sidebar.jsx == 0; grep -c \"grow: Sprout\" app/src/lib/icons.js == 1; cd app && npm run build (succeeded)"
        status: pass
    human_judgment: true
    rationale: "Automated grep/build checks confirm the code-level rename and icon wiring, but actual on-screen icon rendering (both desktop aside and mobile bottom bar) still needs a human visual glance — folded into this phase's end-of-phase regression sweep (plan 03-08) per the plan's own verification step 4."

# Metrics
duration: 1min
completed: 2026-08-18
status: complete
---

# Phase 3 Plan 2: Rename Sidebar 'Explore' Nav Entry to 'Grow' Summary

**Renamed the Sidebar's `explore` nav id/label to `grow`/"Grow" and added a matching `Sprout`-icon `NAV_ICON.grow` entry, dropping the now-unused `Compass` import from `icons.js` only.**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-08-18T23:32:40Z
- **Completed:** 2026-08-18T23:32:50Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- `lib/icons.js`'s `NAV_ICON` map now has `grow: Sprout` in the exact array position `explore: Compass` previously occupied; the `Compass` import was removed from this file (still independently imported/used by `NotFoundPage.jsx`, untouched).
- `Sidebar.jsx`'s `NAV_ITEMS` array now has `{ id: 'grow', label: 'Grow' }` in place of `{ id: 'explore', label: 'Explore' }`, same array position (3rd entry, between `network` and `pipeline`). No other line in the file changed — `NAV_ICON[item.id]` already resolves the icon dynamically at both the desktop `<aside>` nav and the mobile bottom bar.
- `cd app && npm run build` succeeds with no import-resolution errors, confirming `Sprout` resolves from the installed `lucide-react` version and `Compass`'s removal from `icons.js` doesn't break `NotFoundPage.jsx`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add NAV_ICON.grow (Sprout) to lib/icons.js, remove the now-unused Compass import** - `db1f6d5` (feat)
2. **Task 2: Rename Sidebar's NAV_ITEMS 'explore' entry to 'grow'** - `77cec6b` (feat)

**Plan metadata:** committed separately after this SUMMARY (docs: complete plan)

_Note: No TDD tasks in this plan — both were `tdd="false"`, single commit each._

## Files Created/Modified
- `app/src/lib/icons.js` - `NAV_ICON.grow` (value `Sprout`) added in place of `NAV_ICON.explore` (value `Compass`); `Compass` dropped from this file's `lucide-react` import block, `Sprout` added.
- `app/src/components/layout/Sidebar.jsx` - `NAV_ITEMS`' `explore`/`Explore` entry replaced by `grow`/`Grow`, same array position.

## Decisions Made
None beyond the plan's own pre-resolved decision (Sprout icon, confirmed by the plan's objective text as a human-confirmed choice for this run) - followed plan as specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The `grow` nav id and its `Sprout` icon now exist and render correctly (per build success + grep verification), but `App.jsx`'s tab-routing logic has not yet been updated to route the `grow` id to a `GrowTab.jsx` destination — that lands in Plan 03-07, per this plan's explicit scope boundary. Until 03-07 lands, clicking the "Grow" nav item in a running dev/prod build will not route anywhere new (still resolves via `App.jsx`'s existing `activeTab === 'explore'` check, which will simply never match `'grow'`) — this is the expected, non-shipped intermediate state documented in the plan's `<objective>`, not a regression introduced by this plan.

No blockers for Plan 03-03 (which has `depends_on: []` per the phase's plan list, wave 1).

---
*Phase: 03-grow-discovery-funnel-merge*
*Completed: 2026-08-18*

## Self-Check: PASSED

- FOUND: app/src/lib/icons.js
- FOUND: app/src/components/layout/Sidebar.jsx
- FOUND: .planning/phases/03-grow-discovery-funnel-merge/03-02-SUMMARY.md
- FOUND: db1f6d5 (Task 1 commit)
- FOUND: 77cec6b (Task 2 commit)
