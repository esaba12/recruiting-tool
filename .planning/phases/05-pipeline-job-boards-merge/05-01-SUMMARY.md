---
phase: 05-pipeline-job-boards-merge
plan: 01
subsystem: ui
tags: [react, vite, navigation, view-switcher, lucide-react]

# Dependency graph
requires:
  - phase: 04-shared-record-side-panel
    provides: "SidePanel + ApplicationPanelBody/JobPanelBody already wired into both bodies (PANEL-01/02) — this plan inherits that infrastructure unchanged"
  - phase: 03-grow-discovery-funnel-merge
    provides: "Shell-wraps-renamed-bodies merge precedent (GrowTab.jsx) this plan's PipelineTab.jsx shell follows"
provides:
  - "Merged Pipeline destination: one nav entry hosting an Applications view and a Job Boards view behind an in-page segmented control (PIPE-01)"
  - "ApplicationsView.jsx and jobBoards/JobBoardsView.jsx — renamed, content-identical bodies (PIPE-02)"
  - "DEMO_PIPELINE_VIEWS export — demo route renders Applications only, switcher chrome fully suppressed"
  - "7-entry Sidebar.jsx NAV_ITEMS (Job Boards nav id removed)"
affects: [06-navigation-consolidation, 07-full-visual-reskin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mutually-exclusive view shell (ternary render, single useState, no local prop copies) — same family as NetworkTab's NETWORK_VIEWS but without GrowTab's simultaneous-Section-stack shape, since Pipeline's two views never render together"
    - "views.length > 1 gate to fully suppress switcher chrome in demo mode, rather than a disabled/single-button toggle"

key-files:
  created:
    - app/src/components/ApplicationsView.jsx
    - app/src/components/jobBoards/JobBoardsView.jsx
  modified:
    - app/src/components/PipelineTab.jsx
    - app/src/App.jsx
    - app/src/components/layout/Sidebar.jsx
    - app/src/components/TodayTab.jsx

key-decisions:
  - "Followed the plan's exact task ordering (rename Job Boards body -> rename Applications body + shell -> collapse branches) with zero deviation from the specified diffs"
  - "Banner comment above ApplicationsView's export reworded to '// ── Applications View ─────...' preserving the original box-drawing width (81 chars) per the plan's 'roughly same width' instruction"

requirements-completed: [PIPE-01, PIPE-02, PIPE-03]

coverage:
  - id: D1
    description: "Pipeline destination renders a two-segment switcher (Applications | Job Boards) with Applications landing by default; primary nav has 7 entries, no separate Job Boards entry"
    requirement: "PIPE-01"
    verification:
      - kind: unit
        ref: "grep-based structural gates in 05-01-PLAN.md Task 2/3 verify blocks (views array, useState count, switcher class strings, NAV_ITEMS count) — all executed, all pass"
        status: pass
      - kind: e2e
        ref: "no live browser render performed in this worktree (no browser automation tool available); Applications-lands-first + switcher-toggles behavior not visually confirmed"
        status: unknown
    human_judgment: true
    rationale: "Structural/grep gates confirm the code shape is correct, but nobody has actually clicked the switcher in a running app yet — needs a live-render check, deferred to the phase-level UAT per workflow.human_verify_mode=end-of-phase"
  - id: D2
    description: "Both renamed bodies (ApplicationsView.jsx, jobBoards/JobBoardsView.jsx) are content-identical to their pre-merge originals apart from the export identifier and one banner comment — no Job Boards capability regressed"
    requirement: "PIPE-02"
    verification:
      - kind: unit
        ref: "diff <old-blob> <new-file> | grep -c '^[<>]' == 2 (JobBoardsView) and == 4 (ApplicationsView); git diff base..HEAD -- app/src/components/jobBoards/ touches only the renamed file"
        status: pass
    human_judgment: false
  - id: D3
    description: "Auto-import path (RepoJobsView -> addApplication -> Today's needsReviewApps) and the attention-feed derivation are untouched by this plan"
    requirement: "PIPE-03"
    verification:
      - kind: unit
        ref: "git diff base..HEAD -- app/src/lib/attention.js app/src/db.js app/src/components/ui/ app/src/components/panels/ is empty"
        status: pass
    human_judgment: false
  - id: D4
    description: "Demo route's Pipeline destination renders Applications only, with no switcher chrome"
    verification:
      - kind: unit
        ref: "DEMO_PIPELINE_VIEWS filters to a single entry; PipelineTab.jsx gates the switcher block on views.length > 1"
        status: pass
      - kind: e2e
        ref: "no live /demo render performed in this worktree"
        status: unknown
    human_judgment: true
    rationale: "Code-level gate is correct by inspection but not visually confirmed against a running /demo route"

duration: ~15min
completed: 2026-08-19
status: complete
---

# Phase 5 Plan 1: Pipeline + Job Boards Merge Summary

**Merged the Job Boards top-level tab into the Pipeline destination as a second view behind a segmented control, via two verbatim body renames (`ApplicationsView.jsx`, `jobBoards/JobBoardsView.jsx`) and a new 45-line thin shell at `PipelineTab.jsx`.**

## Performance

- **Duration:** ~15 min (includes `npm install` in this fresh worktree checkout, which had no `node_modules`)
- **Completed:** 2026-08-19
- **Tasks:** 3 completed
- **Files modified:** 6 (2 renames, 1 new file at a reused path, 3 integration edits)

## Accomplishments

- Renamed `jobBoards/GitHubTab.jsx` → `jobBoards/JobBoardsView.jsx` (`git mv`, one line changed: the export identifier). Job Boards' entire sub-component tree (`RepoJobsView`, `TrackedBoardsPanel`, `CalendarView`, `RepoStats`, `UserProfileView`, `PreferencesPanel`, `JobCard`, `helpers.js`) is untouched.
- Renamed `PipelineTab.jsx` (the Applications list body) → `ApplicationsView.jsx` (`git mv`, two lines changed: the export identifier and the section banner comment). All 230 lines of application logic — `DuplicatesPanel`, coverage badges, triage mutation, stats memo, filter/search/sort chain, `SidePanel`/`ApplicationPanelBody` wiring — carried over byte-for-byte.
- Wrote a new 45-line thin shell at `PipelineTab.jsx`: `PIPELINE_VIEWS` array, `DEMO_PIPELINE_VIEWS` (filtered, not hand-duplicated), a single `useState('applications')`, a segmented control copied class-for-class from `NetworkTab`'s `NETWORK_VIEWS` switcher (active state `bg-ink-900`, not `accent`), gated to render only when `views.length > 1`, and a ternary render between `ApplicationsView`/`JobBoardsView` with no local copy of `apps`.
- Collapsed `App.jsx`'s two render branches (`tab === 'pipeline'` / `tab === 'github'`) into one; `AppInner`'s Pipeline render line is byte-identical to its pre-phase form; `DemoApp`'s gained exactly one new prop (`views={DEMO_PIPELINE_VIEWS}`).
- Removed the `github`/"Job Boards" entry from `Sidebar.jsx`'s `NAV_ITEMS` (8 → 7 entries); `SettingsTab.jsx`'s unrelated `github` BYOK-provider key was left untouched.
- Repointed two stale provenance comments in `TodayTab.jsx` from `PipelineTab.jsx` to `ApplicationsView.jsx` (comment text only, zero behavior change).

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename the Job Boards body to JobBoardsView.jsx** — `5624e7b` (feat)
2. **Task 2: Rename the Applications body and drop in the new PipelineTab shell** — `be8cb71` (feat)
3. **Task 3: Collapse the render branches, remove the nav entry, refresh two stale cross-references** — `e2cdc01` (feat)

_No plan-metadata commit in worktree mode — SUMMARY.md is committed separately below per the worktree protocol._

## Diff-line counts (exact, per plan's `<output>` spec)

- **Resolved pre-phase base SHA:** `5e6535d353138e5afc3a0b8847ae3d0f86dd8bc8`
- `jobBoards/GitHubTab.jsx` → `jobBoards/JobBoardsView.jsx`: `diff` reports **2** changed lines (1 removed, 1 added — the export identifier only), matching the plan's exact acceptance criterion.
- `PipelineTab.jsx` (old) → `ApplicationsView.jsx` (new): `diff` reports **4** changed lines (2 removed, 2 added — the export identifier and the banner comment), matching the plan's exact acceptance criterion.
- **Final shell line count:** `app/src/components/PipelineTab.jsx` is **45 lines** (plan's ceiling was <65).
- Full-phase `git diff --name-status -M` against the base SHA: `jobBoards/GitHubTab.jsx → JobBoardsView.jsx` is auto-detected as a rename (`R098`) by git; `PipelineTab.jsx → ApplicationsView.jsx` shows as `A`(dded)/`M`(odified) rather than `R`, because `PipelineTab.jsx`'s path is immediately reused by the new shell content in the same task — git's rename heuristic always prefers a same-path modify match over a cross-path rename match. This is expected given the plan's own task-ordering rationale (Task 2 "drops the shell into the path App.jsx already imports") and is not a defect: `git log --follow -- app/src/components/ApplicationsView.jsx` correctly traces the full pre-rename history back through `PipelineTab.jsx`'s entire lineage, and the plan's own Task 2 verification step used a direct content-diff (not rename detection) for exactly this reason.

## Files Created/Modified

- `app/src/components/jobBoards/JobBoardsView.jsx` — renamed from `GitHubTab.jsx`, export identifier only change
- `app/src/components/ApplicationsView.jsx` — renamed from `PipelineTab.jsx`, export identifier + banner comment only
- `app/src/components/PipelineTab.jsx` — rewritten as the 45-line view-switch shell
- `app/src/App.jsx` — dropped the standalone Job Boards import/render branch; `PipelineTab` import now also pulls `DEMO_PIPELINE_VIEWS`; `DemoApp`'s Pipeline render gained `views={DEMO_PIPELINE_VIEWS}`
- `app/src/components/layout/Sidebar.jsx` — `NAV_ITEMS` down to 7 entries (Job Boards entry deleted)
- `app/src/components/TodayTab.jsx` — two provenance comments repointed from `PipelineTab.jsx` to `ApplicationsView.jsx`

## Decisions Made

- Followed the plan's exact specified diffs verbatim for every task — no scope deviation.
- Banner comment reworded to `// ── Applications View ─────────────────────────────────────────────────────────` (81 characters, matching the original `Pipeline Tab` banner's total width exactly, computed via a Python length check rather than eyeballed).
- Fixed one self-inflicted grep-gate collision during Task 2: the shell's header comment originally repeated the literal string `onImported = onRefresh` in prose, which double-counted against the plan's `grep -c "onImported = onRefresh"` == 1 gate (it was matching both the prose comment and the actual default-parameter code). Reworded the comment to describe the same mechanic without using the literal token string, bringing the count back to the required 1. This is copy-only and does not fall under the deviation-rule framework (no plan-specified content changed) — noted here for transparency since it required a second pass on the file.

## Deviations from Plan

None — plan executed exactly as written. (The grep-gate self-correction above was a same-task authoring fix, not a deviation from any plan instruction; the shell's final content matches every acceptance criterion in Task 2's verify block.)

## Issues Encountered

- This worktree checkout had no `app/node_modules` (git-ignored, not present in a fresh worktree). Ran `npm install` once at the start of Task 1 verification (229 packages, ~3s) so `npm run build` gates could run for all three tasks. Not a deviation — infrastructure setup required to execute the plan's own verification commands, no plan content changed.
- Bash tool sandboxing rejected a couple of multi-command `cd /Users/ethansaba/code/recruiter && ...` invocations as "too complex to verify stays inside the worktree" and one `diff <(...)` process-substitution invocation for the same reason. Worked around by running commands directly from the worktree root (its default cwd) without `cd`, and by extracting `git show` blobs to the scratchpad directory before diffing with plain file arguments. No effect on verification correctness — every plan-specified check still ran and passed.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- PIPE-01/02/03 structurally satisfied and verified via git diff scoping, grep gates, and a clean production build after each task.
- **Not done in this worktree (flagged for the phase-end sweep, per `05-02` and `workflow.human_verify_mode=end-of-phase`):** an actual browser render + screenshot of the merged Pipeline destination. No browser-automation tool was available in this execution environment, so the `05-UI-SPEC.md` Open Question 2 spacing check (does the switcher row plus each body's own first element read with correct spacing?) is answered here only at the code level — neither `ApplicationsView.jsx` (first element: `DuplicatesPanel`) nor `JobBoardsView.jsx` (first element: `TrackedBoardsPanel`) renders its own page-level header, so per the UI-SPEC's own reasoning no header-strip conflict is expected — but this has not been visually confirmed. **Recommendation to the sweep plan:** perform the live-render + screenshot check (both views, plus `/demo`'s Applications-only render) as part of the phase-level UAT pass, since this plan's execution environment had no rendering capability.
- Ready for Task/Plan `05-02` (the phase's regression sweep) to pick up the full end-of-phase verification, including the deferred visual check above.

---
*Phase: 05-pipeline-job-boards-merge*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: app/src/components/ApplicationsView.jsx
- FOUND: app/src/components/jobBoards/JobBoardsView.jsx
- FOUND: app/src/components/PipelineTab.jsx
- FOUND: .planning/phases/05-pipeline-job-boards-merge/05-01-SUMMARY.md
- FOUND: commit 5624e7b (Task 1)
- FOUND: commit be8cb71 (Task 2)
- FOUND: commit e2cdc01 (Task 3)
- FOUND: commit 99028a8 (docs: summary)
