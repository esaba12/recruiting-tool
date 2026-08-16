---
phase: 01-visual-foundation-industrial-design-tokens-primitives
plan: 01
subsystem: ui
tags: [tailwind, css-custom-properties, design-tokens, wcag, contrast, dataviz]

# Dependency graph
requires: []
provides:
  - "app/src/index.css's @theme block carrying the full industrial (cool-gunmetal/safety-orange) hex ramp under the unchanged canvas/ink/accent/success/warning/danger token names"
  - "app/src/shared.jsx's 5 badge-color maps (STATUS_COLOR/URGENCY_COLOR/TYPE_COLOR/REFERRAL_STATUS_COLOR/STAGE_COLOR) with zero stock-Tailwind orange-/purple- literals"
  - "Live, re-run WCAG contrast confirmation (dataviz skill's contrast()) against the values as landed in index.css, not just as documented in UI-SPEC"
affects: [01-visual-foundation-industrial-design-tokens-primitives (all remaining plans in this phase), every later milestone phase touching ink-*/accent-*/success-*/warning-*/danger-* Tailwind utility classes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Token-value-only reskin: hex values change inside an existing @theme block, token names frozen, so every consumer across ~50 app/src files recompiles automatically with zero call-site edits"
    - "dataviz skill's scripts/validate_palette.js contrast(a,b) invoked directly via a Node ESM dynamic import against a skill's resolved base directory, to re-validate WCAG pairs live against shipped code rather than trusting spec documentation"

key-files:
  created: []
  modified:
    - app/src/index.css
    - app/src/shared.jsx

key-decisions:
  - "Applied the plan's exact 44 old->new hex pairs verbatim in index.css, including the unchanged warning-800 (#6b4b12) value and updated stale 'warm' comment text to describe the new cooler palette"
  - "Applied the plan's exact 8 shared.jsx remaps verbatim (Champion, URGENCY MED/LOW, TYPE LinkedIn/Meeting, REFERRAL_STATUS Not Asked, STAGE Technical/Onsite), eliminating all stock-Tailwind orange-/purple- literals"
  - "Task 3's live re-validation used the exact 16 distinct WCAG pairs and hex values called for in the plan, sourced from the values actually landed in index.css after Task 1, not retyped from UI-SPEC's prose"

patterns-established:
  - "Any future token-value-only palette swap in this repo should follow the same pattern: edit @theme values in place, never rename/add a token family, then re-run dataviz's contrast() against the live file before declaring VIS-03-style requirements satisfied"

requirements-completed: [VIS-03]

coverage:
  - id: D1
    description: "index.css's @theme block carries all 44 new industrial hex values under the unchanged canvas/ink/accent/success/warning/danger token names"
    requirement: "VIS-03"
    verification:
      - kind: unit
        ref: "Task 1 automated verify: bash grep-based presence+count check over app/src/index.css (44 declarations, all target hex values present)"
        status: pass
    human_judgment: false
  - id: D2
    description: "shared.jsx's 5 badge-color maps contain zero stock-Tailwind orange-/purple- literals; all 8 fixed entries resolve through the ink/accent/warning token scale"
    requirement: "VIS-03"
    verification:
      - kind: unit
        ref: "Task 2 automated verify: bash grep-based zero-orange/purple check + exact-count checks over app/src/shared.jsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "All 16 distinct WCAG text/background pairs touched by this phase re-confirmed passing against the live index.css hex values via the dataviz skill's contrast() function, zero unmitigated FAIL"
    requirement: "VIS-03"
    verification:
      - kind: unit
        ref: "Task 3 automated verify: node --input-type=module contrast() re-check of 16 pairs against DATAVIZ_DIR/scripts/validate_palette.js, all PASS, exit 0"
        status: pass
    human_judgment: false

duration: 21min
completed: 2026-08-16
status: complete
---

# Phase 1 Plan 1: Industrial Design Token Value Swap Summary

**Cool-gunmetal/safety-orange @theme token ramp landed in index.css (44 hex values, names unchanged) plus 8 off-token orange-/purple- badge-color fixes in shared.jsx, both re-confirmed WCAG-passing via dataviz's live contrast() check.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-08-16T02:59:56Z
- **Completed:** 2026-08-16T03:20:56Z
- **Tasks:** 3 completed (2 code-changing, 1 validation-only)
- **Files modified:** 2

## Accomplishments
- Swapped all 44 `--color-*` hex literals inside `app/src/index.css`'s `@theme` block from the warm-paper/amber palette to the cool-gunmetal/safety-orange industrial ramp, with token names (`canvas`, `ink`, `accent`, `success`, `warning`, `danger`) completely unchanged — every Tailwind utility class across ~50 `app/src` files picks up the new values automatically on next build, zero call-site edits required
- Fixed 8 hardcoded stock-Tailwind `orange-*`/`purple-*` literals in `app/src/shared.jsx`'s `STATUS_COLOR`, `URGENCY_COLOR`, `TYPE_COLOR`, `REFERRAL_STATUS_COLOR`, and `STAGE_COLOR` maps, remapping them onto the app's own `accent`/`warning`/`ink` token scale per the UI-SPEC's checker-approved remap table
- Re-ran the `dataviz` skill's `contrast(a,b)` WCAG function against all 16 distinct text/background pairs touched by this phase, using the hex values as they actually exist in `index.css` post-edit (not retyped from spec) — all 16 PASS, zero FAIL, satisfying VIS-03

## Task Commits

Each task was committed atomically:

1. **Task 1: Swap @theme token values to the industrial ramp (index.css)** - `6fcfdb1` (feat)
2. **Task 2: Fix shared.jsx's off-token orange/purple badge-color entries** - `1e23586` (fix)
3. **Task 3: Re-validate every touched color pair against the values actually landed in index.css** - no commit (validation-only task, zero file diff — see Task Commits note below)

**Plan metadata:** (this commit, created after this SUMMARY)

_Note: Task 3 is a pure verification step per the plan (`<files>app/src/index.css</files>` listed only because it's the file being validated, not edited) — it produced no code changes to commit. Its automated verify command was run directly and its PASS result is recorded in this SUMMARY's coverage block (D3)._

## Files Created/Modified
- `app/src/index.css` - All 44 `@theme` block `--color-*` hex values swapped from the warm-paper/amber palette to the cool-gunmetal/safety-orange industrial ramp; token names, fonts, dark-variant declaration, and body/heading font-family rules untouched
- `app/src/shared.jsx` - 8 badge-color map entries (`STATUS_COLOR['⭐ Champion']`, `URGENCY_COLOR.MED`/`.LOW`, `TYPE_COLOR.LinkedIn`/`.Meeting`, `REFERRAL_STATUS_COLOR['Not Asked']`, `STAGE_COLOR.Technical`/`.Onsite`) remapped from stock-Tailwind `orange-*`/`purple-*` literals onto token-scale classes

## Decisions Made
- Followed the plan's 44-pair hex table and 8-entry shared.jsx remap table exactly as specified, including the deliberately-unchanged `--color-warning-800` value and the one-ramp-step-darker WCAG fixes (`warning-400`→`600`, `ink-400`→`500`) called out in UI-SPEC's "Fixes beyond the reskin" — no deviation from documented values
- Resolved the `dataviz` skill's base directory once via a lookup-only Skill invocation and reused it for Task 3's live `contrast()` re-validation, per the plan's exact instruction to check against values "actually landed in index.css" rather than trusting spec prose

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's Task 1/Task 2 automated verify grep commands failed on `--` prefixed patterns**
- **Found during:** Task 1 and Task 2 verification
- **Issue:** The plan's bundled `<verify><automated>` bash used `grep -qF "$kv"`/`grep -cF "$kv"` where `$kv` begins with `--color-` or contains no leading dash issue for Task 2, but Task 1's patterns (e.g. `"--color-canvas: #f2f3f4"`) were interpreted by `grep` as option flags rather than literal search patterns, causing `grep: unrecognized option` failures unrelated to the actual file content
- **Fix:** Re-ran the identical checks locally with `grep -qF -- "$kv"` (POSIX `--` end-of-options marker) instead of editing the plan file itself; confirmed all 44 Task 1 values and the Task 2 zero-orange/purple + exact-count checks pass against the real file content
- **Files modified:** None (verification-tooling-only fix, not a code change)
- **Verification:** Both corrected verify runs printed "ALL 44 TOKEN VALUES PRESENT, COUNT OK" / (see next deviation for Task 2's count nuance)
- **Committed in:** N/A (no file change — shell invocation only)

**2. [Rule 1 - Bug] Plan's Task 2 acceptance criteria undercounted a pre-existing `bg-ink-100 text-ink-500` occurrence**
- **Found during:** Task 2 verification
- **Issue:** The plan asserted `bg-ink-100 text-ink-500` should appear exactly twice after Task 2's edits (from `URGENCY_COLOR.LOW` and `REFERRAL_STATUS_COLOR['Not Asked']`, both newly darkened by this task). The actual count came back as 3, because `STATUS_COLOR['✅ Closed']` already used the identical `bg-ink-100 text-ink-500` value before this plan touched the file (visible in the pre-edit Read of `shared.jsx`, line 10) — the plan's table only tracked the two entries it intentionally changed and didn't account for this pre-existing coincidental match
- **Fix:** No code change needed — verified each of the 8 intended remap values individually by exact string match instead of relying on the plan's aggregate count assertion, confirming all 8 land exactly as specified and zero `orange-`/`purple-` literals remain
- **Files modified:** None
- **Verification:** Individual `grep -cF` checks for all 8 target class-pair strings each returned their correct expected count (1 for the four singly-occurring pairs, 2 for `bg-warning-600 text-white`, 3 for `bg-ink-100 text-ink-500` including the pre-existing entry)
- **Committed in:** N/A (no file change — verification-tooling-only fix)

---

**Total deviations:** 2 auto-fixed (both Rule 1, verification-script-only — no production code was incorrect or changed as a result)
**Impact on plan:** Zero impact on shipped code. Both deviations were plan-verification-script quirks (a grep quoting bug and a stale/incomplete count assumption), not defects in `index.css` or `shared.jsx`. The plan's underlying acceptance criteria — "zero stock-Tailwind orange-/purple- literals" and the 4 uniquely-occurring class pairs — hold exactly as written.

## Issues Encountered
- `node --input-type=module -e` with `process.env.DATAVIZ_DIR` returned `undefined` on the first Task 3 attempt because the shell variable was set without `export` in the same multi-line Bash invocation, so the child `node` process didn't inherit it. Fixed by re-running with `export DATAVIZ_DIR=...` before the `node` invocation — no plan or code impact, purely a shell-scoping correction during manual execution of the plan's documented verify command.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The full industrial token ramp is live in `index.css` and every downstream Tailwind utility class (`bg-accent-600`, `text-ink-700`, etc.) across the app now resolves to the new hex values automatically — later plans in this phase (Button/Badge/Tabs restyling, the Mono rollout) can proceed without re-touching token definitions
- `shared.jsx`'s 5 badge-color maps are fully token-driven with zero remaining off-token literals, so any component consuming `STATUS_COLOR`/`URGENCY_COLOR`/`TYPE_COLOR`/`REFERRAL_STATUS_COLOR`/`STAGE_COLOR` already renders correctly against the new palette with no further code changes needed in this plan's scope
- `charts/theme.js`'s `STATUS_CHART_COLORS` categorical palette is explicitly deferred to Phase 7 per UI-SPEC — not touched by this plan, no action needed here
- No blockers identified for subsequent plans in Phase 1

---
*Phase: 01-visual-foundation-industrial-design-tokens-primitives*
*Completed: 2026-08-16*

## Self-Check: PASSED

- FOUND: app/src/index.css
- FOUND: app/src/shared.jsx
- FOUND: .planning/phases/01-visual-foundation-industrial-design-tokens-primitives/01-01-SUMMARY.md
- FOUND commit: 6fcfdb1 (Task 1)
- FOUND commit: 1e23586 (Task 2)
- FOUND commit: 9c72be8 (SUMMARY doc commit)
