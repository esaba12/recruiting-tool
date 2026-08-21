---
phase: 07-full-visual-reskin-motion-migration-instrument-stat-tiles
plan: 02
subsystem: ui
tags: [tailwind, react, shape-system, design-tokens, ui-primitives]

# Dependency graph
requires:
  - phase: 07-full-visual-reskin-motion-migration-instrument-stat-tiles
    provides: 07-01's rounded-md/sm shape-system tightening on Modal/SidePanel (the other 2 of 8 shared ui/ primitives)
provides:
  - Card.jsx, Section.jsx, Button.jsx, Badge.jsx, Tabs.jsx, ChipToggleGroup.jsx all render the D-01 bordered-flat, tighter-radius shape system
  - All 8 shared ui/ primitives (Card, Modal, SidePanel, Section, Button, Badge, Tabs, ChipToggleGroup) now visually consistent under the new shape system
affects: [07-04, 07-05, 07-06, 07-07 (the ~40 files that hand-roll equivalent Tailwind strings instead of using these primitives)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared ui/ primitives change once, every consumer inherits for free (Phase 1 precedent extended to shape system)"

key-files:
  created: []
  modified:
    - app/src/components/ui/Card.jsx
    - app/src/components/ui/Section.jsx
    - app/src/components/ui/Button.jsx
    - app/src/components/ui/Badge.jsx
    - app/src/components/ui/Tabs.jsx
    - app/src/components/ui/ChipToggleGroup.jsx

key-decisions:
  - "Section.jsx's tier-keyed border (danger-200/warning-200/ink-200/accent-200) was deliberately kept rather than collapsed to a flat border-ink-200 as UI-SPEC's generic Section table row suggested — an established, more-specific signal already shipped in Phases 2/3, per 07-CONTEXT.md's Claude's-Discretion clause."
  - "Button.jsx (not explicitly named in UI-SPEC's Radius Changes table) treated as a rectangular container/control (rounded-xl -> rounded-md), not a pill (rounded-full -> rounded-sm) — consistent with Card/Modal/Section/SidePanel's 'sharp edges' family, distinct from Badge/Tabs/ChipToggleGroup's pill-shape family."

patterns-established:
  - "Pill-shaped chip/tag primitives (Badge, Tabs outer container, ChipToggleGroup) use rounded-sm, not rounded-full — rounded-full reserved for genuinely circular elements (avatars, status dots), none of which exist in this primitive set."

requirements-completed: [VIS-01]

coverage:
  - id: D1
    description: "Card.jsx and Section.jsx render rounded-md with no shadow-sm; Card uses border-ink-300, Section keeps its tier-colored border"
    requirement: "VIS-01"
    verification:
      - kind: unit
        ref: "grep -c 'rounded-md border border-ink-300' app/src/components/ui/Card.jsx == 1; grep -c 'rounded-md p-5 border' app/src/components/ui/Section.jsx == 1; grep -c 'shadow-sm' (both files) sums to 0; grep -c 'danger-200|warning-200|accent-200' app/src/components/ui/Section.jsx == 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "Button.jsx's base control shape is rounded-md; all 4 variants and both sizes byte-identical to before"
    requirement: "VIS-01"
    verification:
      - kind: unit
        ref: "grep -c 'rounded-xl' app/src/components/ui/Button.jsx == 0; grep -c 'rounded-md font-semibold' app/src/components/ui/Button.jsx == 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "Badge.jsx, Tabs.jsx's outer container, and ChipToggleGroup.jsx's chips all render rounded-sm instead of rounded-full"
    requirement: "VIS-01"
    verification:
      - kind: unit
        ref: "grep -c 'rounded-full' (all 3 files) sums to 0; grep -c 'rounded-sm' each file == 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "Production build succeeds with all 6 edits applied"
    requirement: "VIS-01"
    verification:
      - kind: other
        ref: "cd app && npm run build (via symlinked node_modules from main repo) -- vite v5.4.21, 3787 modules transformed, built in 2.77s"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visual appearance of the 6 tightened primitives across live app screens (border weight, corner radius, absence of shadow) reads correctly in the browser"
    verification: []
    human_judgment: true
    rationale: "No dev server / live render available in this isolated worktree (no .env — Supabase client throws before React mounts, consistent with prior phases' isolated-worktree limitation). Deterministic grep + build checks cover the mechanical class-string correctness; actual pixel-level rendering needs a human visual pass, staged for end-of-phase UAT alongside 07-01's Modal/SidePanel primitives."

duration: 6min
completed: 2026-08-21
status: complete
---

# Phase 7 Plan 2: Shared UI Primitive Shape-System Tightening Summary

**Tightened Card, Section, Button, Badge, Tabs, and ChipToggleGroup to the D-01 bordered-flat, rounded-md/sm shape system — completing all 8 shared `ui/` primitives (paired with 07-01's Modal/SidePanel) so every consumer inherits the new shape for free.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-21T17:33:00Z
- **Completed:** 2026-08-21T17:39:07Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Card.jsx: `rounded-xl shadow-sm border border-ink-100` -> `rounded-md border border-ink-300` (dropped soft shadow entirely, moved to a crisper bordered-flat look)
- Section.jsx: `rounded-xl p-5 shadow-sm border ${border}` -> `rounded-md p-5 border ${border}`, deliberately preserving its existing tier-keyed border color
- Button.jsx: base className `rounded-xl` -> `rounded-md`, no changes to VARIANTS or SIZES
- Badge.jsx, Tabs.jsx (outer container), ChipToggleGroup.jsx (chip buttons): `rounded-full` -> `rounded-sm` (none are genuinely circular elements)
- Combined with Plan 07-01's Modal/SidePanel, all 8 shared `ui/` primitives now consistently reflect the tightened shape system

## Task Commits

Each task was committed atomically:

1. **Task 1: Card.jsx + Section.jsx shape system** - `d3af89b` (feat)
2. **Task 2: Button.jsx radius tightening** - `0aa47f0` (feat)
3. **Task 3: Badge.jsx, Tabs.jsx, ChipToggleGroup.jsx pill shape tightening** - `5e1e355` (feat)

**Plan metadata:** SUMMARY.md commit follows this file's creation.

## Files Created/Modified
- `app/src/components/ui/Card.jsx` - bg-white rounded-md border border-ink-300, no shadow
- `app/src/components/ui/Section.jsx` - rounded-md p-5 border ${tier-color}, no shadow, tier border object untouched
- `app/src/components/ui/Button.jsx` - base className rounded-md, VARIANTS/SIZES untouched
- `app/src/components/ui/Badge.jsx` - rounded-sm pill
- `app/src/components/ui/Tabs.jsx` - outer segmented-control shell rounded-sm
- `app/src/components/ui/ChipToggleGroup.jsx` - chip buttons rounded-sm

## Decisions Made
- Section.jsx's tier-keyed border (danger-200/warning-200/ink-200/accent-200) kept as-is rather than collapsed to a flat border-ink-200 — an established, more-specific signal from Phases 2/3, per 07-CONTEXT.md's Claude's-Discretion clause for "exact border-width/color pairing."
- Button.jsx (not explicitly named in UI-SPEC's Radius Changes table) treated as a rectangular container/control, following Card/Modal/Section/SidePanel's rounded-xl to rounded-md tightening rather than the pill treatment.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The worktree had no `node_modules` installed for `app/` (git worktrees don't share `node_modules` with the main checkout). Since `app/package.json` is byte-identical between the worktree and the main repo checkout, a temporary symlink to the main repo's `app/node_modules` was created solely to run `npm run build` for plan-level verification, then removed (along with the resulting `dist/` output) before committing — no trace left in the worktree or git history. This is a read-only, local-only workaround with zero effect on the committed changeset.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 8 shared `ui/` primitives (Card, Modal, SidePanel, Section, Button, Badge, Tabs, ChipToggleGroup) now consistently reflect the D-01 shape system — Plans 07-04 through 07-07 (the ~40 files that hand-roll equivalent Tailwind strings instead of using these primitives) can proceed independently of this plan.
- Live visual verification (border weight, corner radius, absence of shadow across real app screens) deferred to end-of-phase human UAT — this isolated worktree has no `.env`/Supabase client, consistent with the same limitation noted in prior phases' worktree-based summaries.
- No blockers.

---
*Phase: 07-full-visual-reskin-motion-migration-instrument-stat-tiles*
*Completed: 2026-08-21*
