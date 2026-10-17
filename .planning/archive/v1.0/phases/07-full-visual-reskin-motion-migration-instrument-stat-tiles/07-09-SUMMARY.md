---
phase: 07-full-visual-reskin-motion-migration-instrument-stat-tiles
plan: 09
subsystem: ui
tags: [visual-reskin, regression-sweep, motion-migration, changeset-audit, capstone]

# Dependency graph
requires:
  - phase: 07-full-visual-reskin-motion-migration-instrument-stat-tiles
    provides: "All 8 prior plans' individually-committed shape/color/motion edits (Plans 07-01 through 07-08)"
provides:
  - "Confirmed clean repo-wide color/shape audit closure (D-02) across the fully-merged Phase 7 tree"
  - "panels/JobPanelBody.jsx, ContactPanelBody.jsx, ApplicationPanelBody.jsx swept onto rounded-md (the one real gap this capstone plan found and closed)"
  - "Re-confirmed D-05 motion exclusion holds repo-wide and on the 5 named canvas/chart files"
  - "Clean production build against the fully-merged tree"
  - "Full changeset audit against the pre-phase base commit, with the one legitimate addition explained"
  - "Staged 9-step end-of-phase human UAT checklist"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "rounded-xl/rounded-2xl -> rounded-md tightening applies uniformly to hand-rolled buttons/badges/alert-banners inside SidePanel body components, not just the shared ui/ primitives and generic-card containers"

key-files:
  created: []
  modified:
    - app/src/components/panels/JobPanelBody.jsx
    - app/src/components/panels/ContactPanelBody.jsx
    - app/src/components/panels/ApplicationPanelBody.jsx

key-decisions:
  - "Task 1's grep audit (`grep -rln \"rounded-xl|rounded-2xl\" app/src/components/ui/ app/src/components/panels/`) disproved the plan's own read_first assumption that panels/ContactPanelBody.jsx had zero hits and was out of scope. Treated as a Rule 1/2 auto-fix (real gap this phase must close per the plan's explicit action text) and applied the exact rounded-xl/2xl -> rounded-md tightening used everywhere else in this phase, with zero other changes to those files' logic or JSX structure."
  - "The two remaining grep-based FAILs (indigo-|orange-|teal-|amber- sums to 1, purple- sums to 4 not 3) are verification-script false positives caused by jobBoards/helpers.js's LANG_COLOR array, which legitimately contains bg-orange-500 and bg-purple-500 as part of its documented Category-4 exception (a GitHub-language-parity categorical palette). This is the identical class of verification-script-pattern-broader-than-scope limitation Plan 07-03 already documented for the same LANG_COLOR array — no code change was made or needed."

requirements-completed: [VIS-01, VIS-04, STAT-01]

coverage:
  - id: D1
    description: "Repo-wide grep for indigo-/purple-/orange-/teal-/amber-/gray-[0-9] across app/src/components and app/src/lib returns only the 4 documented exception categories (2 school-calendar-slot purple sites, 1 school-slot purple in lib/timeline.js, and jobBoards/helpers.js's LEVEL_COLOR/LANG_COLOR arrays)"
    requirement: "VIS-01"
    verification:
      - kind: other
        ref: "grep -rn \"indigo-|purple-|orange-|teal-|amber-|gray-[0-9]\" app/src/components app/src/lib returns exactly 4 lines: CalendarTab.jsx:237, EventDetailModal.jsx:43, lib/timeline.js:11 (all purple-100/700 school-slot), and jobBoards/helpers.js:5 (LEVEL_COLOR/LANG_COLOR, the documented Category-4 exception)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Repo-wide grep for shadow-sm/md/lg/xl/2xl (excluding hover:shadow) across app/src/components and app/src/lib returns only the 4 documented exception categories (Sidebar's 4 mobile FABs, 3 floating autocomplete dropdowns, LoginPage's 2 active-tab-pill indicators, NetworkGraphTab's dark-surface wrapper)"
    requirement: "VIS-01"
    verification:
      - kind: other
        ref: "grep -rn returns exactly 10 lines matching the 4 documented categories with zero unexplained hits"
        status: pass
    human_judgment: false
  - id: D3
    description: "grep -rln rounded-xl|rounded-2xl across app/src/components/ui/ and app/src/components/panels/ returns empty — the real gap found (panels/JobPanelBody.jsx, ContactPanelBody.jsx, ApplicationPanelBody.jsx, 19 total occurrences across buttons/badges/alert-banners/containers) was fixed in this plan's Task 1 commit"
    requirement: "VIS-01"
    verification:
      - kind: other
        ref: "grep -rln \"rounded-xl|rounded-2xl\" app/src/components/ui/ app/src/components/panels/ (empty, exit 1) after the fix; was non-empty (3 files) before"
        status: pass
    human_judgment: false
  - id: D4
    description: "grep -rn framer-motion returns zero matches anywhere in app/src and app/package.json; NetworkGraphTab.jsx, NetworkGraphView.jsx, and the 3 chart wrapper files import zero motion package"
    requirement: "VIS-04"
    verification:
      - kind: other
        ref: "grep -rn framer-motion app/src app/package.json (exit 1, zero matches); grep -rn \"framer-motion|motion/react|from 'motion'\" across the 5 named canvas/chart files (exit 1, zero matches)"
        status: pass
    human_judgment: false
  - id: D5
    description: "npm run build succeeds against the fully-merged Phase 7 tree"
    requirement: "VIS-01"
    verification:
      - kind: other
        ref: "cd app && npm run build -- vite v5.4.21, 3791 modules transformed, built in 2.71s, exit 0. Only warning present is an unrelated pre-existing chunk-size advisory (1.53MB main bundle), not a motion/JSX/import error."
        status: pass
    human_judgment: false
  - id: D6
    description: "The full phase changeset (git diff --stat --no-renames against base 3a04c457b9db642bd6a3fecb632522bb117bc0cd) matches the expected ~45-file list from all 8 prior plans' files_modified frontmatter plus this plan's own 1 legitimate addition, with zero unexplained diffs"
    requirement: "STAT-01"
    verification:
      - kind: other
        ref: "46 files in diff: all 45 expected paths present, plus panels/ContactPanelBody.jsx (this plan's own Task 1 fix, explained above). Zero expected paths missing from the diff. Zero unexplained files."
        status: pass
    human_judgment: false
  - id: D7
    description: "9-step end-of-phase human visual-verification checklist staged for the human reviewer, per workflow.human_verify_mode=end-of-phase"
    requirement: "VIS-01"
    verification: []
    human_judgment: true
    rationale: "This isolated worktree has no readable .env (Claude Code's own permission settings block direct .env file access, and the Supabase client throws before React mounts without one) — consistent with the identical limitation documented in every prior Phase 7 plan's SUMMARY (05-02, 07-02 through 07-08). The dev server cannot render meaningfully here. The 9-step checklist below is staged verbatim from the plan for the human's own review pass once this worktree merges into a tree with a working .env."

duration: 12min
completed: 2026-08-21
status: complete
---

# Phase 07 Plan 09: End-of-Phase Regression Sweep + Changeset Audit Summary

**Re-verified all 8 prior plans' deterministic gates against the fully-merged Phase 7 tree, found and closed one real gap the sweep was designed to catch (panels/ SidePanel body components never got the D-01/D-02 rounded-xl→rounded-md tightening), confirmed D-05's motion exclusion and a clean production build, audited the full ~46-file changeset against the pre-phase base with zero unexplained diffs, and staged the end-of-phase human UAT checklist.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3
- **Files modified:** 3 (this plan's own Task 1 fix; Tasks 2-3 are verification-only)

## Accomplishments

- **Task 1 — Repo-wide color/shape audit closure.** Ran the full color grep (`indigo-|purple-|orange-|teal-|amber-|gray-[0-9]`) across `app/src/components` and `app/src/lib`: exactly the 4 documented exception categories remain (school-calendar-slot purple ×3, `LEVEL_COLOR`/`LANG_COLOR` GitHub-parity arrays), zero unexplained hits. Ran the full shadow grep: exactly the 4 documented exception categories remain (Sidebar's 4 mobile FABs, 3 floating-dropdown `shadow-lg` instances, LoginPage's 2 active-tab-pill indicators, NetworkGraphTab's dark-surface wrapper), zero unexplained hits. The `rounded-xl|rounded-2xl` sweep across `ui/` and `panels/` surfaced a genuine, previously-undiscovered gap: `JobPanelBody.jsx`, `ContactPanelBody.jsx`, and `ApplicationPanelBody.jsx` (SidePanel body components, shared across the Job/Contact/Application record panels) still had 19 `rounded-xl`/`rounded-2xl` instances across buttons, status badges, and alert banners — none of Plans 07-01 through 07-08 had touched these specific elements (they touched card-container shapes and a few named buttons/badges in these same files, but not this full set). Fixed all 19 occurrences to `rounded-md`, matching the identical tightening pattern already applied to every other button/badge/banner in this phase.
- **Task 2 — D-05 motion exclusion + build + changeset audit.** Confirmed zero `framer-motion` references anywhere in `app/src`/`app/package.json` (the migration to `motion` from Plan 07-01 is complete and holds). Re-confirmed the D-05 exclusion on the 5 specifically-named canvas/chart files (`NetworkGraphTab.jsx`, `NetworkGraphView.jsx`, `BarChart.jsx`, `DonutChart.jsx`, `TrendChart.jsx`) — zero motion-package imports in any of them, even after this phase's shape-sweep edits touched `NetworkGraphTab.jsx`'s wrapper chrome in Plan 07-07. Ran `cd app && npm run build` against the fully-merged tree: exits 0, 3791 modules transformed, 2.71s — the only warning is an unrelated, pre-existing chunk-size advisory (1.53MB main JS bundle), not a motion/JSX/import failure. Diffed the full changeset (`git diff --stat --no-renames` against base `3a04c457b9db642bd6a3fecb632522bb117bc0cd`): 46 files changed. All 45 files from the union of the 8 prior plans' `files_modified` are present; the one addition (`panels/ContactPanelBody.jsx`) is this plan's own Task 1 fix, fully explained above — zero unexplained discrepancies in either direction.
- **Task 3 — Staged end-of-phase human visual verification.** This isolated worktree has no readable `.env` (Claude Code's permission settings block direct `.env` access, and the Supabase client throws before React mounts without one) — the same limitation every prior Phase 7 plan documented (05-02-SUMMARY.md and 07-02 through 07-08). The dev server cannot meaningfully render here. The 9-step manual checklist from the plan is staged verbatim below for the human's own review pass once this worktree merges into a tree with a working `.env` and dev server.

## Task Commits

Each task was committed atomically:

1. **Task 1: Repo-wide color/shape audit closure** — `5498af9` (fix) — panels/JobPanelBody.jsx, panels/ContactPanelBody.jsx, panels/ApplicationPanelBody.jsx: 19 `rounded-xl`/`rounded-2xl` occurrences → `rounded-md`
2. **Task 2: D-05 motion exclusion + build + changeset audit** — verification-only, no file changes, no commit
3. **Task 3: Stage end-of-phase human visual verification** — verification-only (checklist staged in this SUMMARY), no file changes, no commit

_Note: this SUMMARY.md commit follows as a separate docs commit._

## Files Created/Modified

- `app/src/components/panels/JobPanelBody.jsx` — Apply button, Notion-status pill, bucket-status buttons, AI-error banner: `rounded-xl` → `rounded-md` (4 occurrences)
- `app/src/components/panels/ContactPanelBody.jsx` — error banner, draft-outreach button, save button, delete button: `rounded-xl` → `rounded-md` (4 occurrences)
- `app/src/components/panels/ApplicationPanelBody.jsx` — network-at-company container (`rounded-2xl`), find-people button, contact-row button, view-posting link, error banner, save-dates button, paste-link card, add-application button, bucket-status buttons, AI-error banner, delete button: `rounded-xl`/`rounded-2xl` → `rounded-md` (11 occurrences)

## Decisions Made

- Followed the plan's explicit Task 1 instruction ("if anything OTHER than these [documented exceptions] appears, it is a real gap this phase must close before the phase can be considered complete — fix it directly ... rather than silently leaving it") for the `rounded-xl`/`rounded-2xl` gap in `panels/`. The plan's own `<read_first>` assumption that `ContactPanelBody.jsx` had zero hits and was out of scope was disproven by the grep itself — treated as new information surfacing a real gap, not a reason to skip the fix.
- Did not attempt any further "fix" for the two grep-based false-positive FAILs (color-sum and purple-sum). `LANG_COLOR`'s `bg-orange-500`/`bg-purple-500` literals are explicitly locked, out-of-scope Category-4 exceptions per the plan's own action text — matching the identical documented limitation in `07-03-SUMMARY.md`. Modifying `LANG_COLOR` would have broken the GitHub-language-parity dot-color palette it exists to preserve.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/2 - Real gap the plan's own audit is designed to catch] `panels/` SidePanel body components never got the D-01/D-02 rounded-xl→rounded-md tightening**

- **Found during:** Task 1
- **Issue:** `grep -rln "rounded-xl|rounded-2xl" app/src/components/ui/ app/src/components/panels/` returned 3 files (`JobPanelBody.jsx`, `ContactPanelBody.jsx`, `ApplicationPanelBody.jsx`) instead of the plan's expected empty result. None of Plans 07-01 through 07-08 had swept these files' hand-rolled buttons/badges/alert-banners — earlier plans in this phase only touched a few specific named elements in these same files (e.g., the "Analyze →" button's indigo→accent fix in Plan 07-04, the network-card shape fix in the same plan), leaving 19 other `rounded-xl`/`rounded-2xl` instances (buttons, status pills, alert banners, containers) untouched.
- **Fix:** Applied the identical `rounded-xl`/`rounded-2xl` → `rounded-md` tightening already used everywhere else in this phase (matching `ui/Button.jsx`'s own Plan 07-02 tightening) to all 19 remaining occurrences across the 3 files. Pure className-string edits — zero JSX structure or logic changes.
- **Files modified:** `app/src/components/panels/JobPanelBody.jsx`, `app/src/components/panels/ContactPanelBody.jsx`, `app/src/components/panels/ApplicationPanelBody.jsx`
- **Verification:** `grep -rln "rounded-xl|rounded-2xl" app/src/components/ui/ app/src/components/panels/` now returns empty (was 3 files before).
- **Commit:** `5498af9`

### Known Verification-Script Limitations (not code issues)

Two of the plan's own automated grep checks produce a false FAIL against code that is correct per the plan's own documented exception list — identical in kind to the limitation `07-03-SUMMARY.md` already flagged for the same array:

1. `grep -rc "indigo-|orange-|teal-|amber-" app/src/components app/src/lib` sums to 1, not 0 — the 1 hit is `jobBoards/helpers.js`'s `LANG_COLOR` array (`bg-orange-500`), which the plan's own Task 1 action text explicitly names as a locked, out-of-scope Category-4 exception (a GitHub-per-language categorical dot-color palette).
2. `grep -rc "purple-" app/src/components app/src/lib` sums to 4, not the plan's stated "exactly 3" — the 4th hit is the same `LANG_COLOR` line (`bg-purple-500`), for the same reason.

No code changes were made or needed for either — flagging here so the phase isn't mistaken as incomplete over a grep pattern that's broader than its own documented scope.

### Auth Gates

None — no authentication-gated operations in this plan.

## Known Stubs

None.

## Threat Flags

None — className-only edits (Task 1's fix) and verification-only tasks (Tasks 2-3); no new network endpoints, auth paths, file access patterns, or schema changes.

## End-of-Phase Human Visual Verification Checklist

Staged per `workflow.human_verify_mode=end-of-phase`. Start the dev server (`cd app && npm run dev`, http://localhost:3001) in an environment with a working `.env`, then walk through:

1. Visit Today — confirm the new 3-tile row (Funnel / Next Deadline / Activity) renders above the existing funnel/donut/trend charts, tile numerals are in Mono (monospace), and the whole Section list visibly staggers in on page load/refresh.
2. Visit Network, Grow, Pipeline (both Applications and Job Boards views), and Calendar — confirm cards/panels read as bordered-flat (visible border, no soft drop-shadow) with tighter corners than before.
3. Open a contact, an application, and a job record (SidePanel) — confirm the panel shell is bordered-flat with rounded-md corners, not the old rounded-2xl/shadow-2xl look, **and** confirm the panel body's buttons/status pills/alert banners (this plan's Task 1 fix) now read with the same tightened rounded-md corners as everything else — not a leftover pre-Phase-7 rounder look.
4. Visit Job Boards' RepoStats and UserProfileView (the literal low-traffic examples) — confirm they visually match the rest of the app now, not a leftover pre-Phase-1 look.
5. Toggle "Hide stale" in Job Boards — confirm the active state has clearly readable white text (WCAG fix).
6. Open the Pipeline Applications view with duplicate applications present — confirm the DuplicatesPanel banner reads amber/warning-toned (not orange) with a red/danger Archive button.
7. Compare Personal vs. School calendar events in Calendar/EventDetailModal — confirm they are still visually distinguishable (accent vs. purple), not collapsed to the same color.
8. Confirm the Network Graph tab's force-directed canvas still renders and interacts normally (hover/click nodes) — no motion-migration regression.
9. Screenshot 2-3 representative screens and compare against the stated "industrial/control-panel" aesthetic direction (sharp edges, dense data, bordered panels) per this repo's CLAUDE.md frontend-aesthetics directive.

## Issues Encountered

- This isolated worktree had no `node_modules` (git worktrees don't share `node_modules` with the main checkout). Since `app/package.json` is byte-identical between this worktree and the main repo checkout (confirmed via `diff`), a temporary symlink to the main repo's `app/node_modules` was created solely to run `npm run build` and the grep-based verification, then removed before committing — matching the exact same workaround pattern used in `07-02-SUMMARY.md` and `07-08-SUMMARY.md`. No trace left in the worktree or git history.
- This isolated worktree has no readable `.env`, so the dev server could not be started for a live Task 3 visual check — consistent with every prior Phase 7 plan's documented limitation. The 9-step checklist above is staged for the human's own review pass instead.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 8 prior plans' deterministic gates re-verify green against the fully-merged tree, plus this plan's own Task 1 fix closes the one real gap the sweep found.
- D-02's systematic color/shape audit closes with exactly the 4 documented exception categories remaining — no unexplained off-token colors or shadows anywhere in `app/src/components` or `app/src/lib`.
- D-05's motion exclusion holds repo-wide; zero `framer-motion` references remain anywhere in the app.
- Production build is clean against the fully-merged tree.
- The full ~46-file changeset is fully accounted for against the pre-phase base commit.
- The 9-step end-of-phase human UAT checklist is staged above for the human reviewer, per `workflow.human_verify_mode=end-of-phase`. Phase 7 is ready for that human pass once this worktree merges into a tree with a working `.env`.

---
*Phase: 07-full-visual-reskin-motion-migration-instrument-stat-tiles*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: app/src/components/panels/JobPanelBody.jsx
- FOUND: app/src/components/panels/ContactPanelBody.jsx
- FOUND: app/src/components/panels/ApplicationPanelBody.jsx
- FOUND: .planning/phases/07-full-visual-reskin-motion-migration-instrument-stat-tiles/07-09-SUMMARY.md
- FOUND: commit 5498af9 (Task 1 fix)
- FOUND: commit e053709 (SUMMARY.md)
