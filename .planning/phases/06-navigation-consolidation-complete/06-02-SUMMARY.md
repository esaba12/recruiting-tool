---
phase: 06-navigation-consolidation-complete
plan: 02
subsystem: ui
tags: [react, navigation, sidebar, settings]

# Dependency graph
requires:
  - phase: 06-navigation-consolidation-complete
    provides: "TodayTab.jsx's ActivitySection (funnel/donut/trend charts), ported from OverviewTab.jsx in Plan 06-01, ahead of OverviewTab.jsx's deletion here"
provides:
  - "Sidebar.jsx's NAV_ITEMS shrunk to exactly five entries (today, network, grow, pipeline, calendar)"
  - "Two new Settings affordances (desktop footer button, mobile floating button) both dispatching onTabChange('settings') and sharing the hideQuickActions gate"
  - "App.jsx's AppInner and DemoApp both boot to 'today' and no longer render an 'overview' branch"
  - "app/src/components/OverviewTab.jsx deleted; DEMO_NAV_ITEMS trimmed to ['today','network','pipeline']"
affects: [06-03-navigation-consolidation-complete]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Settings relocated from a NAV_ITEMS entry to two footer/floating buttons reusing the existing hideQuickActions gate and onTabChange callback — no new prop, no new visibility boolean"

key-files:
  created: []
  modified:
    - app/src/components/layout/Sidebar.jsx
    - app/src/App.jsx
  deleted:
    - app/src/components/OverviewTab.jsx

key-decisions:
  - "Both Settings buttons copy sibling button class strings byte-for-byte per plan constraint 9 — desktop uses the neutral bg-ink-800/hover:bg-ink-700 fill (amber reserved for the group's one primary CTA, Quick Capture) with an amber active state matching every other nav destination's convention; mobile uses the same neutral fill with an aria-label since it is icon-only"
  - "Left the network-view state declaration (networkInitialView/setNetworkInitialView) and its prop pass-through untouched per constraint 8, even though its only setter caller (the deleted Overview branch's onOpenGraph) is now dead — flagged below as a Phase 7 cleanup candidate, not touched here"
  - "Left app/src/lib/icons.js's now-fully-unreferenced 'overview' NAV_ICON key untouched per constraint 7 — that lookup map is out of scope for this plan, sweeping it belongs to Phase 7"

patterns-established: []

requirements-completed: [NAV-01, NAV-02, NAV-04]

coverage:
  - id: D1
    description: "Primary nav array holds exactly five entries (today, network, grow, pipeline, calendar) on both desktop rail and mobile bottom bar"
    requirement: NAV-01
    verification:
      - kind: other
        ref: "Task 1 automated verify block (13 grep assertions + npm run build) — all pass except one miscounted threshold, documented under Deviations"
        status: pass
    human_judgment: true
    rationale: "Automated checks confirm array contents and structural placement but cannot confirm visual rendering on both desktop rail and mobile bottom bar — staged for the phase's end-of-phase human-check per workflow.human_verify_mode=end-of-phase"
  - id: D2
    description: "Settings reachable from a footer button (desktop) and a floating-action button (mobile), both showing active state, both gated on hideQuickActions"
    requirement: NAV-02
    verification:
      - kind: other
        ref: "Task 1 automated verify block — dispatch/icon/gate/active-state assertions all pass"
        status: pass
    human_judgment: true
    rationale: "Automated checks confirm the buttons exist with correct handlers/classes but cannot confirm visual spacing (bottom-56 clearing the three existing floats) or that clicking actually opens Settings and turns amber — staged for end-of-phase human-check"
  - id: D3
    description: "Both app roots (AppInner, DemoApp) boot to Today with content rendered, not a blank main area"
    requirement: NAV-01
    verification:
      - kind: other
        ref: "Task 2 automated verify block (9 grep/diff assertions + npm run build) — all pass"
        status: pass
    human_judgment: true
    rationale: "Automated checks confirm the tab-state default and render-branch list changed together (no missing-branch gap) but cannot confirm a real hard-refresh renders visible content — staged for end-of-phase human-check"
  - id: D4
    description: "Demo route's nav trimmed to exactly three ids (today, network, pipeline), no Settings id"
    requirement: NAV-04
    verification:
      - kind: other
        ref: "Task 2 automated verify block — demo filter grep assertion passes"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-20
status: complete
---

# Phase 6 Plan 2: Nav Cutover — Shrink to Five, Relocate Settings, Retire Overview Summary

**Shrunk Sidebar's NAV_ITEMS from seven to five entries, added a desktop footer Settings button and a mobile floating Settings button (both reusing the existing `onTabChange`/`hideQuickActions` wiring), and retired the merged-away Overview destination end to end — file deleted, import dropped, both render branches removed, both tab-state defaults moved to Today, demo nav trimmed to three ids.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-08-20
- **Tasks:** 2 completed
- **Files modified:** 2 modified, 1 deleted

## Final five nav ids (in order)

```
today, network, grow, pipeline, calendar
```

## Both Settings buttons' exact class strings

**Desktop footer button** (inside the existing `hideQuickActions`-gated fragment, after `+ Event`):
```
w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
  ${activeTab === 'settings' ? 'bg-accent-500 text-white' : 'bg-ink-800 text-ink-100 hover:bg-ink-700'}
```
Icon: `NAV_ICON.settings size={13}`. Label: `Settings`.

**Mobile floating button** (first child of the mobile floating-action stack, `bottom-56`):
```
md:hidden fixed right-4 bottom-56 z-30 w-12 h-12 rounded-full bg-ink-800 text-white shadow-lg flex items-center justify-center hover:bg-ink-700
```
Icon: `NAV_ICON.settings size={20}`. `aria-label="Settings"` (icon-only, no visible label).

Both dispatch `onClick={() => onTabChange('settings')}` — no new prop added.

## Deep-link relay confirmation

`git diff HEAD~1 -- app/src/App.jsx` (Task 2's commit) shows the `goFindPeople` declaration, the `growFocusCompany` state, and the `{tab === 'grow' && <GrowTab .../>}` conditional block are **not present in the diff at all** — confirming they are byte-for-byte untouched by this plan, satisfying hard constraint 1. Only the tab-state initializer line, the deleted `'overview'` render branches, the demo nav filter/comment, and the demo tab-state initializer changed.

## Two deliberate leave-alone decisions (Phase 7 cleanup candidates)

1. **`networkInitialView`/`setNetworkInitialView` state declaration** (`App.jsx`, `AppInner`) — its only setter-caller was the deleted Overview branch's `onOpenGraph` callback. Per plan constraint 8, the declaration and its prop pass-through (`initialView={networkInitialView}` on `NetworkTab`) were left untouched rather than removed, since the getter is still read and passed down, and removing state three lines from the deep-link relay risked constraint 1 for no benefit this plan. Now dead state — a Phase 7 cleanup candidate.
2. **`app/src/lib/icons.js`'s `NAV_ICON.overview` key** — per plan constraint 7, this lookup-map key is now fully unreferenced (both the nav array entry and the render branch that would have used it are gone), but the file is explicitly out of this plan's scope. Sweeping it belongs to Phase 7, same as the `overview`/`github` keys Phase 5 already left behind.

## Task Commits

Each task was committed atomically:

1. **Task 1: Shrink the nav array to five and add both Settings affordances** - `a77df11` (feat)
2. **Task 2: Retire the merged-away destination across App.jsx and delete its file** - `15b4447` (feat)

**Plan metadata:** this SUMMARY's own commit (docs)

## Files Created/Modified

- `app/src/components/layout/Sidebar.jsx` - `NAV_ITEMS` shrunk from 7 to 5 entries; added desktop footer Settings button (Task 1); added mobile floating Settings button as the first child of the floating-action stack (Task 1).
- `app/src/App.jsx` - Dropped the `OverviewTab` import; changed both tab-state initializers (`AppInner`, `DemoApp`) from `'overview'` to `'today'`; deleted both `'overview'` render branches; shortened `DEMO_NAV_ITEMS` filter to `['today', 'network', 'pipeline']` and updated its explanatory comment (Task 2).
- `app/src/components/OverviewTab.jsx` - Deleted via `git rm` (Task 2). Its charts already live in `TodayTab.jsx`'s `ActivitySection` per Plan 06-01.

## Decisions Made

- Followed the plan's exact task ordering: Task 1 did all of `Sidebar.jsx` in one commit (array shrink + both new buttons together, so no commit ever has Settings removed from nav with no replacement affordance); Task 2 did the tab-state default, both render-branch deletions, the demo filter, and the file deletion all in one commit, since splitting the default-fix from the branch-deletion would boot the app blank (`06-RESEARCH.md` Pitfall 1).
- No architectural decisions beyond what the plan specified.

## Deviations from Plan

### Documented verify-script discrepancies (not implementation bugs)

**1. [Task 1] `bg-accent-500 text-white` count: plan expected 3, actual is 4.**
- **Found during:** Task 1 automated verification.
- **Issue:** The plan's automated verify command asserts `grep -c 'bg-accent-500 text-white' Sidebar.jsx` equals 3, with the acceptance criteria text explaining "nav rail, quick-capture button, new Settings button." This undercounts by one: the pre-existing file already had **two** buttons using that exact fill string before this plan touched anything — the desktop footer Quick Capture button *and* the mobile floating Quick Capture button — plus the nav rail's active-state ternary, for 3 pre-existing occurrences. Adding the new Settings button's required active-state ternary (specified byte-for-byte in action step B.5) correctly brings the total to 4, not 3.
- **Fix:** None needed — the implementation followed the plan's literal, byte-for-byte-specified action text. Verified the discrepancy is in the verify script's threshold, not the code, by manually confirming all 4 occurrences are legitimate (`grep -n` shows: nav rail ternary, desktop Quick Capture button, new Settings button ternary, mobile Quick Capture button).
- **Files modified:** None beyond the planned Task 1 edits.
- **Commit:** `a77df11`

**2. [Task 2] `git diff --stat` line count: plan expected fewer than 20, actual is exactly 20.**
- **Found during:** Task 2 automated verification.
- **Issue:** The plan's acceptance criteria asserts `git diff --stat HEAD -- app/src/App.jsx` shows fewer than 20 changed lines. The sum of insertions (5) + deletions (15) mandated by the plan's own byte-for-byte action steps (drop 1 import line, change 2 tab-state defaults, delete a 5-line and a 4-line render branch, edit a 2-line comment, edit 1 demo-filter line) totals exactly 20, not under 20.
- **Fix:** None needed — every edit was the minimal, literal change the action specified; there was no way to reduce the count further without deviating from the plan's explicit instructions (e.g., combining lines in a way that would break the byte-for-byte preservation constraints elsewhere in the file).
- **Files modified:** None beyond the planned Task 2 edits.
- **Commit:** `15b4447`

Both discrepancies are pre-existing arithmetic errors in the plan's own verify thresholds, not defects introduced by this execution — confirmed via manual line-by-line accounting and via `git diff HEAD~1` showing only the exact edits the action text specified.

## Issues Encountered

- This worktree checkout had no `app/node_modules` (git-ignored, not present in a fresh worktree) — ran `npm install` once before Task 1's build verification (229 packages, ~2s), same as Plans 06-01 and 05-01's worktrees.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The primary nav is now exactly five destinations on both viewports, Settings has two working affordances, and the retired Overview destination is fully gone from disk, the import graph, both render branches, and the demo nav list — everything Plan 06-03's NAV-03 deep-link-relay audit needs is in place, with the relay itself confirmed byte-identical via `git diff HEAD~1`.
- Human-check for this plan (desktop nav/Settings button visual/click verification, mobile floating-button spacing at `bottom-56`, `/demo` showing no Settings affordance on either viewport, both app roots landing on Today with content on hard refresh) is staged for the phase's end-of-phase manual pass per `workflow.human_verify_mode=end-of-phase` — not run inline in this worktree (no `.env`/Supabase client available in isolation, consistent with Plans 05-02/06-01's precedent).

---
*Phase: 06-navigation-consolidation-complete*
*Completed: 2026-08-20*

## Self-Check: PASSED

- FOUND: app/src/components/layout/Sidebar.jsx
- FOUND: app/src/App.jsx
- MISSING (expected — deleted): app/src/components/OverviewTab.jsx
- FOUND: commit a77df11 (Task 1)
- FOUND: commit 15b4447 (Task 2)
