---
phase: 07-full-visual-reskin-motion-migration-instrument-stat-tiles
plan: 07
subsystem: ui
tags: [tailwind, react, design-tokens, shape-system]

# Dependency graph
requires:
  - phase: 07-full-visual-reskin-motion-migration-instrument-stat-tiles
    provides: "Plan 07-01's motion-package migration and Plan 07-02's ui/ChipToggleGroup.jsx primitive shape fix, which this plan's local Chip duplicate mirrors"
provides:
  - "NetworkGraphTab.jsx wrapper chrome (dark canvas frame + light legend panel) on the rounded-md shape scale, canvas file untouched and re-confirmed motion-free"
  - "QuickCaptureModal.jsx's full MessageBubble family (13 bubble render sites) on rounded-md with tail corners preserved, zero persistent shadow-sm"
  - "DiscoverTab.jsx, CompanyOnboarding.jsx, jobBoards/PreferencesPanel.jsx gradient headers using only locked tokens (ink-100 instead of off-token indigo-50)"
  - "CompanyOnboarding.jsx's local Chip pill on rounded-sm, matching ui/ChipToggleGroup.jsx's Plan 07-02 fix"
affects: [07-08, phase-7-regression-sweep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dark-surface exception to the border-only card rule: NetworkGraphTab's ink-900 wrapper deliberately keeps shadow-sm since a same-family border-ink-800 is nearly invisible against it — light-canvas cards drop shadow-sm, dark-canvas ones don't."

key-files:
  created: []
  modified:
    - app/src/components/NetworkGraphTab.jsx
    - app/src/components/QuickCaptureModal.jsx
    - app/src/components/DiscoverTab.jsx
    - app/src/components/CompanyOnboarding.jsx
    - app/src/components/jobBoards/PreferencesPanel.jsx

key-decisions:
  - "Extended Task 2's rounded-2xl/shadow-sm fix beyond the plan's 5 named lines to all 13 chat-bubble render sites in QuickCaptureModal.jsx's MessageBubble family, since the plan's own whole-file acceptance criteria (rounded-2xl count == 0) required it and all sites share the identical tail-corner bubble pattern."
  - "Applied the pill-shaped Chip rounded-full->rounded-sm fix to CompanyOnboarding.jsx instead of jobBoards/PreferencesPanel.jsx as literally stated in the plan, because jobBoards/PreferencesPanel.jsx has no Chip component at all — the actual local duplicate of ui/ChipToggleGroup.jsx's pattern (matching the plan's own description word-for-word) lives in CompanyOnboarding.jsx."

patterns-established:
  - "Chat-bubble tail-corner convention (rounded-md + one sharp rounded-tl-sm/rounded-tr-sm corner) applied consistently across every AI-drafted and system bubble variant in a modal, not just the styled 'card' subset."

requirements-completed: [VIS-01]

coverage:
  - id: D1
    description: "NetworkGraphTab.jsx's two wrapper cards render rounded-md; dark-surface frame keeps shadow-sm (deliberate depth cue), light legend panel drops it; NetworkGraphView.jsx (canvas) untouched and confirmed motion-free"
    requirement: "VIS-01"
    verification:
      - kind: other
        ref: "grep -c rounded-xl src/components/NetworkGraphTab.jsx == 0; grep -c rounded-md == 2; grep -c shadow-sm == 1; grep -c 'framer-motion|motion/react' NetworkGraphTab.jsx NetworkGraphView.jsx sums to 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "QuickCaptureModal.jsx's chat-bubble cards (5 AI-drafted cards plus 8 additional MessageBubble variants) render rounded-md rounded-tl-sm/tr-sm with no persistent shadow-sm"
    requirement: "VIS-01"
    verification:
      - kind: other
        ref: "grep -c rounded-2xl src/components/QuickCaptureModal.jsx == 0; grep -c shadow-sm == 0; grep -c 'rounded-md rounded-tl-sm' == 12; grep -c 'rounded-md rounded-tr-sm' == 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "DiscoverTab.jsx, CompanyOnboarding.jsx, jobBoards/PreferencesPanel.jsx gradient headers use ink-100 not indigo-50; DiscoverTab's Recommended-list row is bordered-flat; CompanyOnboarding's local Chip pill is rounded-sm"
    requirement: "VIS-01"
    verification:
      - kind: other
        ref: "grep -c indigo- across the 3 files sums to 0; grep -c to-ink-100 sums to 3; grep -c shadow-sm DiscoverTab.jsx == 0; grep -c rounded-full CompanyOnboarding.jsx == 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Production build succeeds against the fully merged tree"
    human_judgment: true
    verification: []
    rationale: "This worktree has no node_modules installed (isolated per-agent environment), so `npm run build` cannot run here — matches the same limitation documented in Phase 5's SUMMARY. Must be verified during the phase-level regression sweep against the merged tree, where dependencies are installed."

# Metrics
duration: 12min
completed: 2026-08-21
status: complete
---

# Phase 7 Plan 7: Network Graph, Quick Capture, and Gradient-Header Shape Sweep Summary

**Finished the D-02 shape/color sweep's last cluster — NetworkGraphTab's wrapper chrome, QuickCaptureModal's full chat-bubble family, and 3 files' shared gradient-header/pill-chip pattern — all moved onto the locked rounded-md/ink token system with zero motion-package regression on the graph canvas.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-21T17:38:00Z
- **Completed:** 2026-08-21T17:50:48Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- `NetworkGraphTab.jsx`'s two wrapper cards (dark canvas frame, light legend panel) tightened to `rounded-md`; canvas file `NetworkGraphView.jsx` confirmed untouched and motion-free, re-verifying D-05 holds after this phase's shape edits too.
- `QuickCaptureModal.jsx`'s entire `MessageBubble` family (13 render sites across user/thinking/text/error/success/draft-card variants) moved off `rounded-2xl`/persistent `shadow-sm` onto `rounded-md` with tail corners (`rounded-tl-sm`/`rounded-tr-sm`) preserved.
- `DiscoverTab.jsx`, `CompanyOnboarding.jsx`, and `jobBoards/PreferencesPanel.jsx`'s shared decorative gradient headers swapped the off-token `indigo-50` second stop for the locked `ink-100` token, plus radius tightened to `rounded-md`.
- `DiscoverTab.jsx`'s Recommended-list row card dropped `shadow-sm` and moved its neutral-tier fallback border from `ink-100` to `ink-300`.
- `CompanyOnboarding.jsx`'s local `Chip` pill component moved from `rounded-full` to `rounded-sm`, matching `ui/ChipToggleGroup.jsx`'s Plan 07-02 primitive fix.

## Task Commits

Each task was committed atomically:

1. **Task 1: NetworkGraphTab.jsx wrapper shape (D-05 re-verification)** - `74b7dcb` (fix)
2. **Task 2: QuickCaptureModal.jsx chat-bubble shape** - `7bddd21` (fix)
3. **Task 3: Gradient-header sweep + Chip pill fix** - `0eea52a` (fix)

_Note: all 3 commits are `fix` type — className-only shape/token corrections, no new behavior._

## Files Created/Modified
- `app/src/components/NetworkGraphTab.jsx` - Wrapper card radii tightened to `rounded-md`; dark frame keeps `shadow-sm`, light panel drops it and moves to `border-ink-300`
- `app/src/components/QuickCaptureModal.jsx` - All 13 `MessageBubble` render sites (5 plan-named + 8 additional) moved to `rounded-md` with tail corner preserved, `shadow-sm` dropped
- `app/src/components/DiscoverTab.jsx` - Gradient header + Recommended-list row card both tightened; `indigo-50` → `ink-100`
- `app/src/components/CompanyOnboarding.jsx` - Gradient header tightened, `indigo-50` → `ink-100`; local `Chip` pill `rounded-full` → `rounded-sm`
- `app/src/components/jobBoards/PreferencesPanel.jsx` - Gradient header tightened, `indigo-50` → `ink-100`

## Decisions Made
- Extended Task 2's fix to all 13 `MessageBubble` render sites (not just the 5 the plan's `read_first` named) because the plan's own acceptance criteria required the whole file to have zero `rounded-2xl` occurrences, and all 13 sites share the identical AI-drafted-bubble tail-corner pattern — this was the only way to satisfy the plan's stated "done" bar.
- Applied the "pill-shaped Chip" fix to `CompanyOnboarding.jsx` rather than `jobBoards/PreferencesPanel.jsx` as the plan literally states, because `jobBoards/PreferencesPanel.jsx` has no `Chip` component (verified via `grep -rn "function Chip"` across `components/`) — the real local duplicate of `ui/ChipToggleGroup.jsx`'s pattern, matching the plan's own description ("locally-defined duplicate... needs its own `rounded-full` to `rounded-sm` fix"), lives in `CompanyOnboarding.jsx`. `jobBoards/PreferencesPanel.jsx` already had zero `rounded-full` occurrences, so its acceptance criterion passed without any edit needed there.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] QuickCaptureModal.jsx's chat-bubble fix under-scoped in the plan's action text vs. its own acceptance criteria**
- **Found during:** Task 2
- **Issue:** The plan's `read_first`/`action` named only 5 specific lines (314, 362, 440, 492, 515) as the target for the `rounded-2xl rounded-tl-sm shadow-sm` → `rounded-md rounded-tl-sm` fix. But the same task's `acceptance_criteria` requires `grep -c "rounded-2xl" app/src/components/QuickCaptureModal.jsx` to return 0 for the whole file — and 8 other `MessageBubble` bubble variants (user message, thinking indicator, plain text, error, 4 success-confirmation variants) also used `rounded-2xl` with the same tail-corner pattern, just without the `shadow-sm`/`p-3.5 space-y-3` styling that matched the plan's literal grep pattern.
- **Fix:** Applied the identical corner-tightening rule (`rounded-2xl` → `rounded-md`, tail corner unchanged) to all 8 additional sites.
- **Files modified:** `app/src/components/QuickCaptureModal.jsx`
- **Verification:** `grep -c "rounded-2xl" src/components/QuickCaptureModal.jsx` returns 0; `grep -c "shadow-sm"` returns 0; both plan-stated acceptance criteria now pass.
- **Committed in:** `7bddd21` (Task 2 commit)

**2. [Rule 1 - Bug] Plan misattributed the pill-shaped Chip component to the wrong file**
- **Found during:** Task 3
- **Issue:** The plan's action for Task 3 instructs fixing "`jobBoards/PreferencesPanel.jsx`'s own pill-shaped `Chip` component (around line 19)" — but that file contains no `Chip` component and no `rounded-full` occurrence at all (confirmed via `grep -rn "function Chip" app/src/components/`, which surfaced the real local `Chip` definition in `CompanyOnboarding.jsx` line 12, plus the shared primitive in `ui/ChipToggleGroup.jsx`). The plan's own description of the component ("this is the same pill-shaped chip-toggle pattern as `ui/ChipToggleGroup.jsx`... just a locally-defined duplicate in this file") matches `CompanyOnboarding.jsx` exactly, not `jobBoards/PreferencesPanel.jsx`.
- **Fix:** Applied the `rounded-full` → `rounded-sm` fix to `CompanyOnboarding.jsx`'s `Chip` component instead.
- **Files modified:** `app/src/components/CompanyOnboarding.jsx`
- **Verification:** `grep -c "rounded-full" app/src/components/jobBoards/PreferencesPanel.jsx` returns 0 (plan's literal acceptance criterion, already true without edit); `grep -c "rounded-full" app/src/components/CompanyOnboarding.jsx` now returns 0 too, matching plan intent.
- **Committed in:** `0eea52a` (Task 3 commit)

**3. [Rule 1 - Bug] CompanyOnboarding.jsx's gradient header didn't exactly match the plan's stated pattern**
- **Found during:** Task 3
- **Issue:** The plan's `read_first` cited "CompanyOnboarding.jsx line 15" for the gradient header, and described the exact class string as `rounded-xl border border-accent-100 bg-gradient-to-r from-accent-50 to-indigo-50 overflow-hidden` shared identically across all 3 files. In reality the header is at line 47 and uses `rounded-2xl` + `bg-gradient-to-br` (not `rounded-xl` + `bg-gradient-to-r`).
- **Fix:** Applied the same intent (radius tightened one step toward `rounded-md`, `indigo-50` → `ink-100`) while preserving the file's actual `bg-gradient-to-br` direction, since neither the truths nor acceptance criteria test gradient direction.
- **Files modified:** `app/src/components/CompanyOnboarding.jsx`
- **Verification:** `grep -c "indigo-"` and `grep -c "to-ink-100"` both match the plan's stated whole-cluster totals (0 and 3 respectively).
- **Committed in:** `0eea52a` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bugs/inaccuracies in the plan's literal file/line targeting, corrected to satisfy the plan's own stated acceptance criteria and intent)
**Impact on plan:** All three deviations expanded scope only within the same class-only, zero-behavior-change shape sweep the plan already authorized (VIS-01) — no architectural changes, no new components, no scope creep beyond making the plan's own acceptance criteria pass.

## Issues Encountered
- Production build (`cd app && npm run build`) could not be run in this isolated worktree — no `node_modules` installed (same limitation documented in Phase 5's `05-02-SUMMARY.md`). All verification for this plan was done via `grep`-based structural checks against the plan's stated acceptance criteria, which is deterministic for pure className edits. Full build verification should happen during the phase-level regression sweep against the merged tree.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 5 files in this plan's scope are on the locked shape/token system; `indigo-` is now fully eliminated from the app (0 remaining hits across the 3 files this plan targeted, consistent with the phase's broader indigo-elimination goal).
- D-05 (motion-package exclusion for the force-graph canvas) re-confirmed holds after this phase's shape edits, not just after Plan 07-01's motion migration.
- Ready for the phase-level combined regression sweep (build verification, full-tree diff audit, human UAT) once all Phase 7 plans/waves land.

## Self-Check: PASSED

- FOUND: `.planning/phases/07-full-visual-reskin-motion-migration-instrument-stat-tiles/07-07-SUMMARY.md`
- FOUND: `74b7dcb` (Task 1 commit)
- FOUND: `7bddd21` (Task 2 commit)
- FOUND: `0eea52a` (Task 3 commit)
- FOUND: `2ca39c7` (SUMMARY.md commit)

---
*Phase: 07-full-visual-reskin-motion-migration-instrument-stat-tiles*
*Completed: 2026-08-21*
