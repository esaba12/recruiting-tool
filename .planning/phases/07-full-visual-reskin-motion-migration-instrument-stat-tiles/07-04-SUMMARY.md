---
phase: 07-full-visual-reskin-motion-migration-instrument-stat-tiles
plan: 04
subsystem: ui
tags: [tailwind, design-tokens, wcag, react]

# Dependency graph
requires:
  - phase: 07-01
    provides: cool-gunmetal/safety-orange @theme token ramp (ink/accent/success/warning/danger), WCAG-validated
provides:
  - Zero indigo-*/orange-*/teal-* Tailwind literals in JobPanelBody.jsx, ApplicationPanelBody.jsx, CalendarTab.jsx, lib/timeline.js, ExploreTab.jsx, ReferralCoverageTab.jsx, TimelineFindsPanel.jsx, ApplicationsView.jsx
  - RepoJobsView.jsx's "Hide stale" toggle at WCAG AA (4.73:1, was 2.45:1)
  - Generic-card shape fixes (shadow-sm dropped, rounded-xl->rounded-md, border-ink-100->border-ink-300) folded into every touched file's card containers
  - JobCard.jsx's 4 status/deadline pills moved from rounded-full to rounded-sm, matching Badge.jsx/Tabs.jsx precedent
affects: [07-05, 07-06, 07-07, 07-08, 07-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cautionary alert banners (DuplicatesPanel) use warning-* tokens for container/text/non-destructive-action, danger-* only for the destructive action itself (matches Button.jsx's danger variant semantics)"
    - "School-calendar-slot purple (bg-purple-100 text-purple-700) is the one deliberate 6th-color exception to the 5-token system, confined to EVENT_BADGE_COLOR.school and CalendarTab's event.slot==='school' ternary — never expanded to other purple-* usages found in the same sweep (Schedule badge, gradient end-stop), which moved to locked tokens instead"

key-files:
  created: []
  modified:
    - app/src/components/panels/JobPanelBody.jsx
    - app/src/components/panels/ApplicationPanelBody.jsx
    - app/src/components/CalendarTab.jsx
    - app/src/lib/timeline.js
    - app/src/components/ExploreTab.jsx
    - app/src/components/ReferralCoverageTab.jsx
    - app/src/components/TimelineFindsPanel.jsx
    - app/src/components/ApplicationsView.jsx
    - app/src/components/jobBoards/RepoJobsView.jsx
    - app/src/components/jobBoards/JobCard.jsx

key-decisions:
  - "Followed the plan's exact token remap table verbatim for every named line; the school-calendar-slot purple exception was preserved exactly where documented and nowhere else"
  - "Extended the plan's shadow-sm/rounded-xl/border-ink-100 shape sweep to card patterns the action text didn't explicitly name (CalendarTab's 3 day-agenda row buttons, JobCard's 2 extra status pills) because the plan's own deterministic acceptance criteria required a zero-count grep across the whole file — treated as Rule 1/3 auto-fixes to satisfy the plan's stated verification gate, not scope creep"
  - "Fixed one out-of-task-list orange-600 literal in ApplicationPanelBody.jsx (line 277, days-in-stage stale text) that the plan's task list never named but its overall <verification> step's 8-file indigo-|orange- sum check required to be zero"

patterns-established:
  - "Stale/overdue inline text uses text-warning-700, matching the DuplicatesPanel and application-row precedent, wherever a days-in-stage or staleness indicator previously used orange-600"

requirements-completed: [VIS-01]

coverage:
  - id: D1
    description: "AI-fit 'Analyze ->' button on Job and Application detail panels renders in accent tokens instead of indigo"
    requirement: "VIS-01"
    verification:
      - kind: other
        ref: "grep -c indigo- app/src/components/panels/JobPanelBody.jsx app/src/components/panels/ApplicationPanelBody.jsx == 0; grep -c 'bg-accent-50 text-accent-600' sums to 2"
        status: pass
    human_judgment: false
  - id: D2
    description: "Calendar Feed-view Follow-up/Schedule/Reconnect badges and the Follow-ups overlay chip use token colors (accent/ink/warning); school-calendar-slot purple preserved as the sole documented exception; ExploreTab/ReferralCoverageTab/TimelineFindsPanel badges and gradient end-stop remapped off indigo; generic-card shape fixes folded in across all 5 files"
    requirement: "VIS-01"
    verification:
      - kind: other
        ref: "grep -c indigo- across CalendarTab.jsx/lib/timeline.js/ExploreTab.jsx/ReferralCoverageTab.jsx/TimelineFindsPanel.jsx sums to 0; teal- in timeline.js == 0; purple- in timeline.js == 1 and CalendarTab.jsx == 1 (school-slot only); shadow-sm across the 4 files sums to 0; border-ink-300 in ExploreTab.jsx == 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "ApplicationsView.jsx's DuplicatesPanel renders in warning/danger tokens (no orange); RepoJobsView.jsx's active 'Hide stale' toggle passes WCAG AA at 4.73:1; JobCard.jsx's container and status/deadline pills match the D-01 shape system"
    requirement: "VIS-01"
    verification:
      - kind: other
        ref: "grep -c orange- app/src/components/ApplicationsView.jsx == 0; grep -c 'bg-warning-500 text-white border-warning-500' RepoJobsView.jsx == 0 and 'bg-warning-600...' == 1; grep -cE 'rounded-xl|rounded-full' JobCard.jsx == 0; grep -c border-ink-300 JobCard.jsx == 3"
        status: pass
    human_judgment: false
  - id: D4
    description: "Plan-level regression gate: zero indigo-/orange- literals across all 8 named seed-list files, verified after folding in the one out-of-scope ApplicationPanelBody.jsx fix required to satisfy it"
    requirement: "VIS-01"
    verification:
      - kind: other
        ref: "grep -rc 'indigo-|orange-' across all 8 files sums to 0"
        status: pass
    human_judgment: true
    rationale: "Production build (`npm run build`) could not be run in this isolated worktree — no node_modules installed (consistent with the same limitation documented in 05-02-SUMMARY.md for this repo's worktree execution). Deterministic grep verification passed for every gate the plan specifies, but a human/orchestrator should run the actual build once the wave merges to catch any JSX syntax issue the grep-based checks can't detect."

duration: 25min
completed: 2026-08-21
status: complete
---

# Phase 7 Plan 04: Mid-Traffic Indigo/Orange Token Remap + WCAG Fix Summary

**Remapped every remaining hardcoded indigo-*/orange-*/teal-* Tailwind literal across 10 mid-traffic files to the 5-token industrial palette, fixed RepoJobsView's pre-existing WCAG contrast failure (2.45:1 -> 4.73:1), and folded in generic-card shape fixes (drop shadow-sm, rounded-xl->rounded-md, border-ink-100->border-ink-300, rounded-full->rounded-sm on status pills) everywhere the plan's own acceptance gates required a zero-count sweep.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-21T17:18:00Z
- **Completed:** 2026-08-21T17:43:00Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- AI-fit "Analyze →" button on both Job and Application detail panels now uses accent tokens instead of indigo
- Calendar Feed view's Follow-up/Schedule/Reconnect badges, the Follow-ups overlay chip, ExploreTab's domain badge, ReferralCoverageTab's gradient/referral-chain text, and TimelineFindsPanel's source badge all moved off indigo/purple/teal to token colors — school-calendar-slot purple preserved as the one documented exception
- Pipeline's DuplicatesPanel renders in warning/danger tokens (cautionary banner = warning, destructive Archive = danger) with zero orange literals remaining
- RepoJobsView's "Hide stale" toggle closes a pre-existing WCAG AA failure flagged since Phase 1 (2.45:1 → 4.73:1)
- JobCard.jsx's container and all 4 status/deadline pills now match the D-01 shape system (rounded-md container, border-ink-300, rounded-sm pills)
- Generic-card shape fixes (no persistent shadow-sm, rounded-xl→rounded-md, border-ink-100→border-ink-300) folded into every card container touched across all 10 files

## Task Commits

Each task was committed atomically:

1. **Task 1: AI-fit "Analyze →" button — indigo to accent (JobPanelBody.jsx, ApplicationPanelBody.jsx)** - `0e855a9` (feat)
2. **Task 2: Calendar/badge indigo-purple-teal token remap (CalendarTab.jsx, lib/timeline.js, ExploreTab.jsx, ReferralCoverageTab.jsx, TimelineFindsPanel.jsx)** - `d900d4c` (feat)
3. **Task 3: ApplicationsView.jsx DuplicatesPanel remap + RepoJobsView.jsx WCAG fix + JobCard.jsx shape** - `29390d4` (feat, includes the required ApplicationPanelBody.jsx out-of-scope fix)

**Plan metadata:** (pending — this SUMMARY commit)

_Note: No TDD tasks in this plan — all 3 are className/color-literal edits, no test files touched._

## Files Created/Modified
- `app/src/components/panels/JobPanelBody.jsx` - Analyze button indigo→accent
- `app/src/components/panels/ApplicationPanelBody.jsx` - Analyze button indigo→accent; days-in-stage stale text orange→warning (out-of-scope fix, see Deviations)
- `app/src/components/CalendarTab.jsx` - Follow-ups overlay chip/dot, Feed badges, school-slot exception preserved; 6 card-shape fixes (month grid, empty state, section wrapper, 3 agenda row buttons)
- `app/src/lib/timeline.js` - Follow-up/Schedule/Reconnect badgeColor remap; school-slot EVENT_BADGE_COLOR untouched
- `app/src/components/ExploreTab.jsx` - domain Badge indigo→accent; company-card shape fix
- `app/src/components/ReferralCoverageTab.jsx` - gradient end-stop and referral-chain text indigo→ink/accent; card shape fix
- `app/src/components/TimelineFindsPanel.jsx` - source Badge indigo→accent; panel shape fix
- `app/src/components/ApplicationsView.jsx` - DuplicatesPanel warning/danger remap; application-row shape fix + stale-text warning
- `app/src/components/jobBoards/RepoJobsView.jsx` - WCAG fix on "Hide stale" toggle; header card shape fix
- `app/src/components/jobBoards/JobCard.jsx` - container shape fix (3 branches); 4 status/deadline pills rounded-full→rounded-sm

## Decisions Made
- Followed the plan's exact token remap table verbatim for every explicitly named line, including the school-calendar-slot purple exception (kept in exactly 2 places, `lib/timeline.js`'s `EVENT_BADGE_COLOR.school` and `CalendarTab.jsx`'s `event.slot === 'school'` ternary — never expanded to any other purple usage, all of which moved to locked tokens instead)
- Extended the shape sweep beyond the action text's explicitly-named lines where the plan's own deterministic acceptance criteria demanded a file-wide zero count (see Deviations)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/3 - Verification-gate completeness] Extended CalendarTab.jsx's shape sweep to 3 unnamed day-agenda row buttons**
- **Found during:** Task 2 (Calendar/badge token remap)
- **Issue:** The plan's action text named only 3 "generic-card shape hits" (lines 191, 343, 353), but Task 2's own acceptance criteria requires `shadow-sm` to sum to 0 across CalendarTab.jsx. The file's 3 day-agenda row buttons (Events/Follow-up/Applied rows) also carried `bg-white rounded-xl px-4 py-3 shadow-sm border border-ink-100 hover:shadow-md ...` — the same generic-card pattern, just not enumerated in the action text.
- **Fix:** Applied the identical treatment used everywhere else in this plan (drop persistent `shadow-sm`, `rounded-xl`→`rounded-md`, `border-ink-100`→`border-ink-300`, kept `hover:shadow-md hover:border-accent-200` per D-01's interaction-feedback exception).
- **Files modified:** app/src/components/CalendarTab.jsx
- **Verification:** `grep -c shadow-sm` across the 4 Task-2 files sums to 0 (was 3 before this fix)
- **Committed in:** d900d4c (Task 2 commit)

**2. [Rule 1/3 - Verification-gate completeness] Extended JobCard.jsx's rounded-full→rounded-sm sweep to 2 unnamed pills**
- **Found during:** Task 3 (JobCard shape fix)
- **Issue:** The action text named only the 2 `DeadlineBadge` pill spans (lines 12/16). Task 3's acceptance criteria requires `rounded-xl|rounded-full` to be 0 across JobCard.jsx, but the "Stale" badge and the bucket-status badge (2 more `rounded-full` pill spans) also existed in the file.
- **Fix:** Applied the same `rounded-full`→`rounded-sm` treatment (matching Badge.jsx/Tabs.jsx pill precedent already established in Plan 07-02) to both remaining pills.
- **Files modified:** app/src/components/jobBoards/JobCard.jsx
- **Verification:** `grep -cE "rounded-xl|rounded-full"` JobCard.jsx == 0 (was 2 before this fix); the plan's actual Task 3 `<verify><automated>` command now passes.
- **Committed in:** 29390d4 (Task 3 commit)

**3. [Rule 3 - Blocking, plan-level verification] Fixed an out-of-task-list orange-600 literal in ApplicationPanelBody.jsx**
- **Found during:** Running the plan's overall `<verification>` step after Task 3
- **Issue:** `ApplicationPanelBody.jsx` line 277 (a days-in-stage staleness indicator, `app.daysInStage > 14 ? 'text-orange-600 font-medium' : 'text-ink-400'`) was never named in any task's action text, but the file is one of the 8 named in the plan's overall `<verification>` command (`grep -rc "indigo-|orange-"` across all 8 sums to 0). Without fixing it, the plan-level gate would fail even though every individual task's own verify passed.
- **Fix:** Applied the same `text-warning-700 font-medium` treatment already used for the identical pattern in `ApplicationsView.jsx` (line 186, part of Task 3's plan).
- **Files modified:** app/src/components/panels/ApplicationPanelBody.jsx
- **Verification:** `grep -rc "indigo-|orange-"` across all 8 named files sums to 0
- **Committed in:** 29390d4 (folded into Task 3's commit, since it was discovered while validating Task 3's changeset before the plan-level check)

---

**Total deviations:** 3 auto-fixed (2 verification-gate-completeness shape/pill sweeps, 1 blocking plan-level gate fix)
**Impact on plan:** All three were required for the plan's own stated deterministic acceptance criteria to pass — none introduced new visual patterns beyond what the plan already established elsewhere (warning-700 stale text, rounded-sm pills, shadow-sm removal). No scope creep beyond satisfying the plan's own gates.

## Issues Encountered
- `npm run build` could not be run in this isolated worktree — no `node_modules` installed (this worktree was created without a dependency install step). All verification in this plan was done via the deterministic `grep`-based checks the plan itself specifies, which is the plan's primary `<verify>` mechanism per-task. This matches the same limitation documented in `05-02-SUMMARY.md` for this repo's worktree-isolated execution model. Flagged for the orchestrator/end-of-phase regression sweep to run the real build once this wave merges into a tree with dependencies installed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 10 files in this plan's scope are now fully off indigo-*/orange-*/teal-* literals, with the single documented school-calendar-slot purple exception intact
- RepoJobsView's long-flagged WCAG failure (tracked since Phase 1) is closed
- Recommend running `cd app && npm run build` once this worktree's changes merge into a tree with `node_modules` installed, to catch anything a JSX-unaware grep sweep can't — no syntax issues are expected (every edit was a className-literal string swap with no structural changes), but this wasn't directly confirmed in-worktree

---
*Phase: 07-full-visual-reskin-motion-migration-instrument-stat-tiles*
*Completed: 2026-08-21*

## Self-Check: PASSED

All 10 modified files plus this SUMMARY.md confirmed present on disk. All 3 task commits (`0e855a9`, `d900d4c`, `29390d4`) confirmed in `git log`.
