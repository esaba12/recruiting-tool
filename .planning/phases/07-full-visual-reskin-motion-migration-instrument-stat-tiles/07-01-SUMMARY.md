---
phase: 07-full-visual-reskin-motion-migration-instrument-stat-tiles
plan: 01
subsystem: ui
tags: [motion, framer-motion, tailwind, modal, sidepanel, npm-dependency]

# Dependency graph
requires: []
provides:
  - motion (^13.1.1) installed in app/package.json as framer-motion's replacement
  - motion/react importable everywhere framer-motion used to be imported
  - Modal.jsx and SidePanel.jsx updated to the D-01 bordered-flat shape system (rounded-md, border-ink-300)
affects: [07-02 (Card/Section shape system), 07-08 (stat-tile work needing motion/react)]

# Tech tracking
tech-stack:
  added: [motion@13.1.1]
  patterns: ["motion/react import path (replaces 'framer-motion') for AnimatePresence/motion.div usage", "bordered-flat shape system: rounded-md + border-ink-300 replacing rounded-2xl + shadow-2xl on modal-style primitives"]

key-files:
  created: []
  modified:
    - app/package.json
    - app/package-lock.json
    - app/src/components/layout/AppShell.jsx
    - app/src/components/NotFoundPage.jsx
    - app/src/lib/useMediaQuery.js
    - app/src/components/ui/Modal.jsx
    - app/src/components/ui/SidePanel.jsx

key-decisions:
  - "Task 1's package-legitimacy checkpoint was already approved in a prior attempt (verified: motion's registry maintainers include popmotion/mattgperry@gmail.com, same account as framer-motion's maintainer list; official repo github.com/motiondivision/motion; 15.7M weekly downloads; MIT license) — skipped re-verification per retry instructions and proceeded directly to Task 2."
  - "npm resolved motion to ^13.1.1, matching the version cited in the prior attempt's approved checkpoint."

requirements-completed: [VIS-04, VIS-01]

coverage:
  - id: D1
    description: "app/package.json depends on motion (^13.1.1), framer-motion removed"
    requirement: "VIS-04"
    verification:
      - kind: unit
        ref: "grep -c framer-motion app/package.json == 0; app/node_modules/motion exists"
        status: pass
    human_judgment: false
  - id: D2
    description: "All 5 framer-motion import/reference sites (AppShell.jsx, NotFoundPage.jsx, Modal.jsx, SidePanel.jsx, useMediaQuery.js comment) now reference motion/react instead"
    requirement: "VIS-04"
    verification:
      - kind: unit
        ref: "grep -rc framer-motion across the 5 files sums to 0; grep -c \"from 'motion/react'\" is 1 in each of AppShell.jsx/NotFoundPage.jsx/Modal.jsx/SidePanel.jsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "Modal.jsx and SidePanel.jsx render with rounded-md corners and border-ink-300 in place of rounded-2xl/shadow-2xl"
    requirement: "VIS-01"
    verification:
      - kind: unit
        ref: "grep -c 'rounded-t-2xl|rounded-2xl|shadow-2xl' returns 0 for both files; grep -c border-ink-300 returns 1 for both; grep -c md:rounded-none returns 1 for SidePanel.jsx (desktop behavior unchanged)"
        status: pass
      - kind: other
        ref: "cd app && npm run build (exit 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "NetworkGraphTab.jsx and the 3 chart wrapper files (BarChart/DonutChart/TrendChart) remain free of any motion package import (D-05 exclusion holds after the swap)"
    requirement: "VIS-04"
    verification:
      - kind: unit
        ref: "grep -rc framer-motion across NetworkGraphTab.jsx, charts/BarChart.jsx, charts/DonutChart.jsx, charts/TrendChart.jsx sums to 0"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-08-21
status: complete
---

# Phase 07 Plan 01: Motion Package Migration + Modal/SidePanel Shape System Summary

**Replaced the `framer-motion` dependency with its official successor `motion` (^13.1.1) across all 5 call sites, and applied the new bordered-flat shape system (rounded-md + border-ink-300) to Modal.jsx and SidePanel.jsx.**

## Performance

- **Duration:** ~2 min (Tasks 2-3; Task 1's checkpoint was pre-approved in a prior attempt)
- **Started:** 2026-08-21T10:49:09-07:00
- **Completed:** 2026-08-21T10:49:57-07:00
- **Tasks:** 3 (Task 1 checkpoint pre-approved from prior attempt, Tasks 2-3 executed this session)
- **Files modified:** 7

## Accomplishments
- `app/package.json` now depends on `motion@^13.1.1`; `framer-motion` fully removed from dependencies and package-lock.json
- `AppShell.jsx`, `NotFoundPage.jsx`, `Modal.jsx`, `SidePanel.jsx` all import `AnimatePresence`/`motion` from `motion/react` instead of `framer-motion`; `useMediaQuery.js`'s comment reworded to name `motion` instead
- `Modal.jsx` and `SidePanel.jsx` now render with `rounded-md`/`rounded-t-md` corners and a `border border-ink-300` bezel replacing their old `rounded-2xl`/`shadow-2xl` treatment (D-01 shape system), while `SidePanel.jsx`'s desktop `md:rounded-none` flush-edge treatment is unchanged
- Confirmed D-05 exclusion intact: `NetworkGraphTab.jsx` and the 3 chart wrapper files (`BarChart.jsx`, `DonutChart.jsx`, `TrendChart.jsx`) import zero motion package, before or after the swap
- `cd app && npm run build` exits 0 with the new `motion/react` imports and shape classes in place

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify `motion` package legitimacy before install** — checkpoint, pre-approved in a prior attempt (no commit this session; see Deviations)
2. **Task 2: Swap framer-motion for motion — dependency + 3 non-primitive import sites** - `1eb011d` (feat)
3. **Task 3: Modal.jsx + SidePanel.jsx — motion import swap + D-01 shape system** - `9cd3c55` (feat)

_Note: this SUMMARY commit follows as a separate docs commit._

## Files Created/Modified
- `app/package.json` - `framer-motion` dependency removed, `motion@^13.1.1` added
- `app/package-lock.json` - lockfile regenerated by `npm install motion` / `npm uninstall framer-motion`
- `app/src/components/layout/AppShell.jsx` - import swapped to `motion/react`
- `app/src/components/NotFoundPage.jsx` - import swapped to `motion/react`
- `app/src/lib/useMediaQuery.js` - comment reworded to reference `motion` instead of `framer-motion`
- `app/src/components/ui/Modal.jsx` - import swapped to `motion/react`; className changed from `rounded-t-2xl md:rounded-2xl shadow-2xl` to `rounded-t-md md:rounded-md border border-ink-300`
- `app/src/components/ui/SidePanel.jsx` - import swapped to `motion/react`; comment reworded; className changed from `rounded-t-2xl md:rounded-none shadow-2xl` to `rounded-t-md md:rounded-none border border-ink-300`

## Decisions Made
- Let `npm install motion` resolve and pin the latest version rather than hand-typing a version number, per the plan's explicit instruction — resolved to `^13.1.1`, matching the version already verified legitimate in the prior attempt's approved checkpoint.
- Task 1's checkpoint was not re-run: per the retry instructions, the orchestrator/human had already approved `motion`'s package legitimacy in a prior attempt of this same plan before that attempt's worktree was reclaimed with zero file changes made. Re-verifying would have been redundant.

## Deviations from Plan

None - plan executed exactly as written. Task 1's checkpoint approval was inherited from a prior attempt (per explicit retry instructions in this session's prompt), not re-derived or skipped without basis.

## Issues Encountered
None. `npm install motion` + `npm uninstall framer-motion` completed cleanly (233 packages added, 3 removed), all grep-based acceptance criteria and the full `npm run build` passed on the first attempt for both tasks.

## User Setup Required

None - no external service configuration required. This is a pure npm dependency swap plus className changes.

## Next Phase Readiness
- `motion/react` is now importable app-wide, unblocking Wave 2's stat-tile work (Plan 07-08) which needs it.
- Modal.jsx and SidePanel.jsx are two of the phase's four primary "primitives change once" targets — the remaining two (Card/Section) are handled in parallel by Plan 07-02, which lands in the same wave.
- No blockers identified for downstream plans in this phase.

---
*Phase: 07-full-visual-reskin-motion-migration-instrument-stat-tiles*
*Completed: 2026-08-21*
