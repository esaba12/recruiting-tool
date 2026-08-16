---
phase: 01-visual-foundation-industrial-design-tokens-primitives
plan: 2
subsystem: ui
tags: [react, tailwind, design-tokens, wcag, accessibility, typography]

# Dependency graph
requires:
  - phase: 01-visual-foundation-industrial-design-tokens-primitives (Plan 1)
    provides: The live industrial @theme token ramp (accent-500/600/700, ink scale, etc.) that Button/Badge/Tabs now consume via the new hex steps and that Mono's font-mono class resolves against.
provides:
  - "New app/src/components/ui/Mono.jsx primitive (font-mono text-xs font-normal tabular-nums tracking-wide), ready for Plans 3/4 to import at every dense-data call site"
  - "Button.jsx primary variant WCAG contrast fix (accent-500->600 / hover accent-600->700, 2.23:1 -> 4.59:1) plus font-medium->font-semibold base weight bump across all 4 variants"
  - "Badge.jsx and Tabs.jsx bumped to the locked Label-role weight (font-medium -> font-semibold)"
affects: ["01-03", "01-04 (Mono rollout at ContactsTable/PipelineTab/JobCard/JobDetailModal)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mono.jsx follows the majority ui/ primitive convention (cn() from lib/cn.js for className merging) rather than Badge's/ChipToggleGroup's raw template-literal minority pattern."
    - "Typography weight contract: two weights only across ui/ primitives — font-normal (400) for dense Mono data, font-semibold (600) for Label-role text (Badge, Tabs, Button, headings). font-medium (500) is retired from these primitives."

key-files:
  created:
    - app/src/components/ui/Mono.jsx
  modified:
    - app/src/components/ui/Button.jsx
    - app/src/components/ui/Badge.jsx
    - app/src/components/ui/Tabs.jsx

key-decisions:
  - "Mono.jsx uses cn() (not a raw template literal) to match the majority convention among the 8 existing ui/ primitives."
  - "Button's primary variant color fix (accent-500/600 -> accent-600/700) was scoped to primary only — secondary/ghost/danger and SIZES left byte-identical, per plan and UI-SPEC."

patterns-established:
  - "Pattern: any new ui/ primitive that renders children as plain text should default to cn()-based className merging, not string concatenation."

requirements-completed: [VIS-02]

coverage:
  - id: D1
    description: "Mono.jsx typography primitive created with the exact locked implementation (cn import, base class string, default export shape)"
    requirement: "VIS-02"
    verification:
      - kind: unit
        ref: "bash automated verify: grep-based file/import/class/export checks (see 01-02-PLAN.md Task 1 <verify>)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Button.jsx primary variant fixed to clear WCAG 4.5:1 contrast (accent-600/700) and all variants bumped to font-semibold"
    requirement: "VIS-02"
    verification:
      - kind: unit
        ref: "bash automated verify: grep-based class-string checks confirming primary/secondary/danger variants and font-semibold (see 01-02-PLAN.md Task 2 <verify>)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Badge.jsx and Tabs.jsx bumped to font-semibold (600) Label-role weight, Input.jsx/Select.jsx left untouched"
    requirement: "VIS-02"
    verification:
      - kind: unit
        ref: "bash automated verify: grep-based class-string checks on Badge.jsx/Tabs.jsx plus git diff confirming Input.jsx/Select.jsx unmodified (see 01-02-PLAN.md Task 3 <verify>)"
        status: pass
    human_judgment: false

# Metrics
duration: 2min
completed: 2026-08-16
status: complete
---

# Phase 1 Plan 2: Mono Primitive + Button/Badge/Tabs Typography & WCAG Fixes Summary

**New Mono.jsx dense-data typography primitive plus a pre-existing Button WCAG contrast fix (accent-500->600, 2.23:1->4.59:1) and Badge/Tabs weight bump to the locked 600 Label-role weight**

## Performance

- **Duration:** 2 min
- **Started:** 2026-08-15T23:25:00-04:00
- **Completed:** 2026-08-15T23:26:15-04:00
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Created `app/src/components/ui/Mono.jsx`, the shared dense-data typography primitive every Plan 3/4 call site (ContactsTable, PipelineTab, JobCard, JobDetailModal) will import — structural analog of Badge.jsx, uses `cn()` for className merging.
- Fixed Button.jsx's primary variant, a pre-existing WCAG failure undetected before this phase: `accent-500`/white measured 2.23:1, now `accent-600`/white measures 4.59:1 (hover `accent-700` measures 6.09:1). Bumped the shared base weight from `font-medium` to `font-semibold` across all 4 variants.
- Bumped Badge.jsx and Tabs.jsx — the app's two most-used Label-role text surfaces (every status/stage/type chip, every segmented control) — from `font-medium` to `font-semibold`, matching UI-SPEC's Typography table.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the Mono primitive (app/src/components/ui/Mono.jsx)** - `ded22e8` (feat)
2. **Task 2: Fix Button.jsx's primary variant (WCAG hex-step + weight bump)** - `5a83f96` (fix)
3. **Task 3: Bump Badge.jsx and Tabs.jsx to the locked Label-role weight (600)** - `c1c48d3` (feat)

**Plan metadata:** (this commit, follows)

## Files Created/Modified
- `app/src/components/ui/Mono.jsx` - New dense-data typography primitive (font-mono text-xs font-normal tabular-nums tracking-wide)
- `app/src/components/ui/Button.jsx` - Primary variant hex-step (accent-500/600 -> accent-600/700) + base font-medium -> font-semibold
- `app/src/components/ui/Badge.jsx` - font-medium -> font-semibold on the status/type chip span
- `app/src/components/ui/Tabs.jsx` - font-medium -> font-semibold on the segmented-control wrapper div

## Decisions Made
- Mono.jsx uses `cn()` rather than Badge's raw template-literal style, following the majority convention among existing primitives (per plan instruction).
- Button's color edit was scoped strictly to the `primary` variant string; `secondary`/`ghost`/`danger`/`SIZES` verified byte-identical post-edit via automated grep checks.

## Deviations from Plan

None - plan executed exactly as written. All 3 tasks' automated `<verify>` commands passed on first attempt; `npm run build` confirmed a clean production build with no errors after all edits landed.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `Mono.jsx` exists with the exact locked export shape Plans 3/4 depend on for their imports — no blockers for those plans.
- Button/Badge/Tabs now match UI-SPEC's locked typography and WCAG contract; the other 5 named primitives (Card, Input, Select, Modal, EmptyState) plus ChipToggleGroup remain untouched, confirmed to pick up the new palette automatically from 01-01's token swap.
- `git diff --stat` against the pre-plan HEAD confirms exactly 4 `ui/` primitive files changed (1 new, 3 modified) — no unintended scope creep into other primitives.

---
*Phase: 01-visual-foundation-industrial-design-tokens-primitives*
*Completed: 2026-08-16*

## Self-Check: PASSED

All created/modified files verified present on disk; all 4 task/summary commit hashes (ded22e8, 5a83f96, c1c48d3, 9ab918d) verified in git log.
