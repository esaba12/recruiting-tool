---
phase: 04-shared-record-side-panel
plan: 01
subsystem: ui
tags: [react, framer-motion, tailwind, side-panel, jobBoards]

# Dependency graph
requires:
  - phase: 01-visual-foundation-industrial-design-tokens-primitives
    provides: ui/Modal.jsx (structural analog), ui/Mono.jsx (dense-data wrap), cn.js helper
provides:
  - "app/src/lib/useMediaQuery.js — window.matchMedia hook for JS-selected animation axis"
  - "app/src/components/ui/SidePanel.jsx — type-agnostic slide-over/bottom-sheet shell"
  - "app/src/components/panels/JobPanelBody.jsx — job record body, full capability parity"
affects: [04-02, 04-03, 04-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SidePanel shell + *PanelBody children composition (D-03) — shell owns overlay/animation/close semantics, body owns record-type knowledge"
    - "useMediaQuery(query) hook selects JS transform values where a Tailwind breakpoint class cannot (animation library limitation)"

key-files:
  created:
    - app/src/lib/useMediaQuery.js
    - app/src/components/ui/SidePanel.jsx
    - app/src/components/panels/JobPanelBody.jsx
  modified: []

key-decisions:
  - "useMediaQuery('(min-width: 768px)') drives the animated axis (x on desktop, y on mobile); all other responsive layout in SidePanel.jsx stays Tailwind md: classes, matching house convention"
  - "SidePanel.jsx is a new sibling of ui/Modal.jsx (D-04), not an extension — Modal.jsx verified byte-identical after this plan"
  - "JobPanelBody.jsx ported field-for-field from jobBoards/JobDetailModal.jsx; only wrapper divs removed and one className changed (rounded-t-2xl md:rounded-t-2xl -> md:rounded-none) for the flush-to-edge desktop layout"

patterns-established:
  - "Record-panel shell/body split: SidePanel renders arbitrary children with zero record-type knowledge; each *PanelBody brings its own sticky header, since headers differ materially per record type"

requirements-completed: [PANEL-01, PANEL-02]

coverage:
  - id: D1
    description: "useMediaQuery hook reacts to live viewport changes via matchMedia's change event (not resize), with a non-browser-safe lazy initializer"
    requirement: PANEL-01
    verification:
      - kind: unit
        ref: "grep-based structural checks: matchMedia >=2 occurrences, exactly 1 addEventListener('change'), exactly 1 removeEventListener, 0 innerWidth occurrences, [query] dep array present, <=25 non-comment lines"
        status: pass
    human_judgment: false
  - id: D2
    description: "SidePanel shell slides in from the right on desktop and up from the bottom on narrow viewports, closes on Escape/backdrop click, renders children at z-50 with zero record-type knowledge"
    requirement: PANEL-01
    verification:
      - kind: unit
        ref: "grep-based structural checks: exactly 4 imports (no record-body import), framer-motion (not bare motion) import, one x:'100%' + one y:'100%' transform, Escape/backdrop handlers present once each, z-50 present once, {children} present once, git diff Modal.jsx clean"
        status: pass
    human_judgment: false
  - id: D3
    description: "JobPanelBody renders the full job record surface (header, meta, ghost badge, deadline badge/recheck, apply link, status pill, triage buckets, AI fit analysis) as plain children of SidePanel with zero regression from JobDetailModal.jsx"
    requirement: PANEL-02
    verification:
      - kind: unit
        ref: "grep-based structural checks: 0 fixed inset-0 / 0 md:max-w-lg (wrappers removed), 3 <Mono> wraps, all 14 required identifiers present, git diff JobDetailModal.jsx clean"
        status: pass
      - kind: other
        ref: "cd app && npm run build (exit 0)"
        status: pass
      - kind: manual_procedural
        ref: "13-row capability-parity checklist below, verified by side-by-side read of JobDetailModal.jsx vs JobPanelBody.jsx"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-08-19
status: complete
---

# Phase 4 Plan 1: Shared Side-Panel Shell + Job Body Summary

**Type-agnostic `SidePanel` shell (right-slide desktop / bottom-sheet mobile via a new `useMediaQuery` hook) plus a field-for-field port of `JobDetailModal.jsx` into `panels/JobPanelBody.jsx`, with zero behavior change and `ui/Modal.jsx` left byte-identical.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-19T01:20:01Z
- **Completed:** 2026-08-19T01:26:05Z
- **Tasks:** 3
- **Files modified:** 3 (all new)

## Accomplishments
- `useMediaQuery(query)` hook — `window.matchMedia` wrapper with a live `change`-event listener (not resize), 20 non-comment lines, mirrors `useTargetCompanies.js`'s hook-file conventions.
- `SidePanel` shell — a new sibling of `ui/Modal.jsx` (not a variant): slides in on the `x` axis at ≥768px, on the `y` axis below that, both through `AnimatePresence` so the exit transition completes before unmount; closes on Escape or backdrop click; renders arbitrary `children` at `z-50` with zero knowledge of what record type it's hosting.
- `JobPanelBody` — full job-record surface ported from `jobBoards/JobDetailModal.jsx`: header, meta row, ghost-job badge, deadline badge + recheck, apply link, import-status pill, triage buckets, and AI fit analysis, all intact behind the shared shell.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the useMediaQuery hook** - `af38d69` (feat)
2. **Task 2: Create the SidePanel shell primitive** - `1fe6c6f` (feat)
3. **Task 3: Port the job record body into panels/JobPanelBody.jsx** - `023c49c` (feat)

_No TDD tasks in this plan — all `type="auto"`._

## Files Created/Modified
- `app/src/lib/useMediaQuery.js` - `window.matchMedia` hook selecting the animated transform axis per breakpoint
- `app/src/components/ui/SidePanel.jsx` - type-agnostic slide-over/bottom-sheet shell primitive, sibling of `ui/Modal.jsx`
- `app/src/components/panels/JobPanelBody.jsx` - job record body ported from `jobBoards/JobDetailModal.jsx` (new `panels/` directory created)

## Job Capability-Parity Checklist (PANEL-02)

Verified by reading `JobDetailModal.jsx` and `JobPanelBody.jsx` side by side:

| # | Capability | Verified |
|---|------------|----------|
| 1 | Header shows `job.company`, `blurb?.companyAbout`, `job.role`, `blurb?.roleSummary` | ✅ |
| 2 | Close `✕` button wired to `onClose` | ✅ |
| 3 | Meta row shows `job.location` and `job.dateAdded` (wrapped in `<Mono>`) | ✅ |
| 4 | Ghost-job badge when `isGhostJob(job)`, `ageDays` wrapped in `<Mono>` | ✅ |
| 5 | Deadline badge for `urgent`/`soon`/`known` tiers, countdown wrapped in `<Mono>` plus literal `deadline.deadline` | ✅ |
| 6 | Rolling state and unknown/checking state both render | ✅ |
| 7 | `↻ recheck` button wired to `onRecheckDeadline` | ✅ |
| 8 | `deadline?.note` italic line, rendered only when tier is not unknown | ✅ |
| 9 | Ghost-job explainer paragraph when stale | ✅ |
| 10 | `Apply ↗` external link rendered when `job.applyUrl` is set | ✅ |
| 11 | Import-status pill switching on `status` | ✅ |
| 12 | Triage bucket buttons over `BUCKET_CONFIG` (excl. `all`), disabled when `!status`, toggle-clear on active bucket, `BUCKET_ACTIVE` styling | ✅ |
| 13 | AI fit analysis: trigger, spinner naming `AI_PROVIDER_LABEL`, error banner, summary/fit bar/score, pros/cons, company context, idle hint with empty-prefs branch | ✅ |

Exactly 3 `<Mono>` wraps survive (criteria 3, 4, 5) — confirmed via grep.

## Decisions Made
- `useMediaQuery('(min-width: 768px)')` (JS) drives only the animated transform axis; every other responsive dimension in `SidePanel.jsx` (width, radius, alignment, height) stays Tailwind `md:` classes, per the plan's resolved implementation decision — the hook's breakpoint matches Tailwind's `md:` breakpoint so the two can never disagree.
- `SidePanel.jsx` created as a brand-new sibling file, never touching `ui/Modal.jsx` — verified via `git diff --exit-code app/src/components/ui/Modal.jsx` after every task.
- `JobPanelBody.jsx` keeps the exact same prop contract/order as `JobDetailModal.jsx`; only the two overlay wrapper `div`s were removed (the shell now owns backdrop + panel chrome) and one className changed (`rounded-t-2xl md:rounded-t-2xl` → `rounded-t-2xl md:rounded-none`) since the desktop panel is now flush to the right edge instead of a floating centered card.

## Deviations from Plan

None - plan executed exactly as written.

(One environment-only step not itself a plan deviation: this worktree had no `node_modules` — `npm install` was run in `app/` before `npm run build` could execute. No source files were affected.)

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `SidePanel`, `useMediaQuery`, and `JobPanelBody` are all in place with the exact signatures the phase's artifact table specifies — Plans 04-02/04-03 can now port `ContactPanelBody`/`ApplicationPanelBody` against the same shell.
- `jobBoards/JobDetailModal.jsx` (source) and `ui/Modal.jsx` (existing dialog primitive) are both untouched — Plan 04-04 owns re-pointing the 9 render sites and deleting the 3 legacy modal files.
- No call site in the app renders `SidePanel`/`JobPanelBody` yet (that's explicitly out of scope for this plan, per Plan 04-04's ownership) — `JobDetailModal.jsx`'s one render site (`jobBoards/RepoJobsView.jsx`) still renders the old modal directly and will continue to work unchanged until 04-04 swaps it.

---
*Phase: 04-shared-record-side-panel*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: `app/src/lib/useMediaQuery.js`
- FOUND: `app/src/components/ui/SidePanel.jsx`
- FOUND: `app/src/components/panels/JobPanelBody.jsx`
- FOUND: `.planning/phases/04-shared-record-side-panel/04-01-SUMMARY.md`
- FOUND commit `af38d69` (Task 1)
- FOUND commit `1fe6c6f` (Task 2)
- FOUND commit `023c49c` (Task 3)
- FOUND commit `7d916b2` (SUMMARY.md docs commit)
