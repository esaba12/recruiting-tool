---
phase: 07-full-visual-reskin-motion-migration-instrument-stat-tiles
plan: 03
subsystem: design-system-tokens
tags: [charts, jobBoards, design-tokens, contrast, low-traffic-screens]
status: complete

dependency-graph:
  requires: []
  provides:
    - "charts/theme.js hex mirror resynced to live index.css @theme values"
    - "jobBoards/helpers.js BUCKET_ACTIVE/BUCKET_TAG on the 5-token system"
    - "RepoStats.jsx + UserProfileView.jsx generic-card shape sweep"
  affects:
    - app/src/components/charts/theme.js
    - app/src/components/jobBoards/helpers.js
    - app/src/components/jobBoards/RepoStats.jsx
    - app/src/components/jobBoards/UserProfileView.jsx
    - app/src/components/jobBoards/TodayTab.jsx (inherits BUCKET_ACTIVE/BUCKET_TAG fix, no edit)
    - app/src/components/panels/JobPanelBody.jsx (inherits, no edit)
    - app/src/components/jobBoards/JobCard.jsx (inherits, no edit)
    - app/src/components/jobBoards/RepoJobsView.jsx (inherits, no edit)
    - app/src/components/panels/ApplicationPanelBody.jsx (inherits, no edit)

tech-stack:
  added: []
  patterns:
    - "Chart hex mirror stays a manual translation layer (Recharts needs hex strings, index.css @theme provides CSS custom properties) — recompute contrast comments whenever the source hex changes, don't just copy digits"
    - "Bucket-color maps follow shared.jsx's STAGE_COLOR semantic convention: ink=neutral, accent=primary-progress, warning=uncertain, success=positive, danger=declined"

key-files:
  created: []
  modified:
    - app/src/components/charts/theme.js
    - app/src/components/jobBoards/helpers.js
    - app/src/components/jobBoards/RepoStats.jsx
    - app/src/components/jobBoards/UserProfileView.jsx

decisions:
  - "Recomputed (not copied) the two WCAG-ratio-citing comment blocks in theme.js after the hex resync — verdicts held (still WARN on warning-500/accent-500 vs light canvas, still chroma-floor FAIL on ink-400, all GRAPH_*_DARK pairs still clear >=3:1) but danger-500 vs dark surface dropped from 3.88:1 to 3.03:1, now close to the floor — flagged in the comment for future hex changes"
  - "BUCKET_ACTIVE warning/danger active-state chips use the 600 step (not 500) for white-text WCAG contrast, matching the same fix RepoJobsView.jsx gets in Plan 07-04"
  - "LEVEL_COLOR (GitHub heatmap) and LANG_COLOR (per-language dots) left untouched — literal-hex/categorical GitHub-visual-parity palettes, not UI chrome, per the plan's explicit scope exclusion"
  - "Avatar image and language-bar progress track/fill in UserProfileView.jsx kept rounded-full (legitimately circular UI: a profile photo and a progress-bar end-cap) — not the pill-badge pattern D-01 targets, and not named in the plan's action text"

metrics:
  duration: "~35 min"
  completed: "2026-08-21"
---

# Phase 07 Plan 03: Chart Hex Resync + Job Boards Token Remap + Low-Traffic Shape Sweep Summary

Closed three independent visual-reskin audit findings: `charts/theme.js`'s hex mirror was stale against Phase 1's real `index.css` values, `jobBoards/helpers.js`'s bucket-color maps used raw Tailwind literals feeding 5 consumer files, and `RepoStats.jsx`/`UserProfileView.jsx` still carried the pre-reskin generic-card shape.

## What Was Built

**Task 1 — `charts/theme.js` hex resync (D-02).** Replaced all 12 stale hex literals (`CHART_SERIES`, `STATUS_CHART_COLORS`'s 5 entries, `CHART_GRID`, `CHART_AXIS_TEXT`, `CHART_SURFACE`, `GRAPH_SURFACE_DARK`, `GRAPH_NODE_NEUTRAL_DARK`, `GRAPH_TEXT_DARK`, `GRAPH_LINK_DARK`) with the current `index.css` `@theme` values. Recomputed the WCAG contrast ratios cited in the file's two comment blocks (rather than just copying corrected hex) using a standalone luminance/contrast script cross-checked against the `dataviz` skill's methodology (the skill's `validate_palette.js` script wasn't materialized in this sandbox — see Deviations):
- STATUS_CHART_COLORS donut vs light canvas (`#f2f3f4`): warning-500 2.20:1, accent-500 2.80:1 — both still below the 3:1 graphics-contrast floor, verdict unchanged (still WARN, still needs the visible-legend relief channel). ink-400's OKLab chroma (~1.5) is still far below the other four status hues' chroma (~15-19) — chroma-floor FAIL unchanged, still intentional.
- GRAPH_*_DARK vs dark surface (`#101215`): success-500 4.57:1, warning-500 7.67:1, danger-500 3.03:1, accent-500 6.04:1, ink-400 3.54:1 — all still clear the >=3:1 floor, but danger-500 dropped from 3.88:1 to 3.03:1 (now barely clearing) — flagged in the comment for future hex changes.

**Task 2 — `jobBoards/helpers.js` `BUCKET_ACTIVE`/`BUCKET_TAG` token remap (audit find).** Remapped both exported maps off raw `gray-/blue-/amber-/green-/red-` literals onto the locked 5-token system, following `shared.jsx`'s `STAGE_COLOR` semantic convention (ink=neutral, accent=primary-progress, warning=uncertain, success=positive, danger=declined). `maybe`/`pass` active-state chips use the `600` step (not `500`) for white-text WCAG contrast. Since `TodayTab.jsx`, `panels/JobPanelBody.jsx`, `jobBoards/JobCard.jsx`, `jobBoards/RepoJobsView.jsx`, and `panels/ApplicationPanelBody.jsx` all import these two consts, all 5 inherit the fix with zero consumer-file edits. `LEVEL_COLOR`/`LANG_COLOR` left untouched per the plan's explicit scope exclusion (GitHub-visual-parity dataviz palettes, not UI chrome).

**Task 3 — `RepoStats.jsx` + `UserProfileView.jsx` low-traffic shape sweep.** Applied the generic-card fix (drop `shadow-sm`, `rounded-xl`→`rounded-md`, `border-ink-100`→`border-ink-300`) to every stat-pill/profile/repo/language/activity card in both files (3 in RepoStats, 5 in UserProfileView), radius-only fix on two already-tokened banners (accent "new this week" banner, warning "profile unavailable" banner), and `rounded-full`→`rounded-sm` on the two tag-chip patterns (tech-stack tag, multi-role company tag) per the D-01 pill rule from Plan 07-02. Both screens are literally named in `07-UI-SPEC.md`'s seed list and ROADMAP's Phase 7 success criterion 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `dataviz` skill's `validate_palette.js` not materialized in this sandbox**
- **Found during:** Task 1
- **Issue:** Invoking the `dataviz` skill to re-run its six-check validator returned instructions referencing `scripts/validate_palette.js`, but the skill's `scripts/` directory was empty in this environment (`node scripts/validate_palette.js` → `MODULE_NOT_FOUND`).
- **Fix:** Implemented the WCAG 2.1 relative-luminance/contrast formula and an sRGB→OKLab chroma calculation directly (matching the CSS Color 4 / Björn Ottosson OKLab reference implementation), then verified methodology correctness by reproducing the *original* (pre-resync) hex values against the *original* surface colors and confirming an exact match to the numbers already cited in the theme.js comments (5.03:1, 7.67:1, 3.88:1, 8.03:1, 4.96:1, 11.98:1, 8.29:1 — all reproduced exactly). Only after confirming the methodology matched did I apply it to the corrected hex values.
- **Files modified:** app/src/components/charts/theme.js (comment text only)
- **Commit:** b301d62

**2. [Rule 1 - Bug] Comment's `#101215` literal citation collided with the acceptance criterion requiring exactly 1 occurrence**
- **Found during:** Task 1 self-check
- **Issue:** The GRAPH_*_DARK comment block initially cited the dark surface as a literal hex (`against #101215`), which pushed `grep -c "#101215"` to 2 — violating the acceptance criterion that expects exactly 1 (the export line only).
- **Fix:** Reworded the comment to reference `GRAPH_SURFACE_DARK` by name instead of repeating its literal hex.
- **Files modified:** app/src/components/charts/theme.js
- **Commit:** b301d62

**3. [Rule 3 - Blocking] `node_modules` absent in worktree, blocking the plan's `npm run build` verification step**
- **Found during:** Task 3, plan-level verification
- **Issue:** This worktree had no `node_modules` (expected — gitignored, not checked out with the worktree), so `vite build` failed with `command not found`.
- **Fix:** Ran `npm install` (hydrating from the committed `package-lock.json`, not adding any new/unverified package) to materialize existing declared dependencies, then re-ran `npm run build` successfully (3787 modules, no errors). Confirmed via `git status` that `node_modules`/`dist` remained correctly gitignored and nothing extraneous was staged.
- **Files modified:** none (dependency install only, no package.json/lockfile changes)
- **Commit:** N/A (no file changes to commit)

### Known Verification-Script Limitations (not code issues)

Two of the plan's own automated `<verify>`/`<acceptance_criteria>` grep patterns produce a false FAIL against code that is correct per the plan's own action text, because the grep patterns are broader than the action's documented scope exclusions:

1. **Task 2:** `grep -c "gray-\|blue-\|amber-\|...\|red-500\|..."` on `helpers.js` returns 1, not 0 — but that 1 match is `LANG_COLOR`'s `bg-blue-500`/`bg-red-500` (line 5), which the plan's own action text explicitly instructs to leave "UNCHANGED and out of scope" (a GitHub-language-parity categorical palette, not UI chrome). Excluding that one documented line, the file has zero raw Tailwind color literals (`grep -v "^export const LANG_COLOR" helpers.js | grep -c "..."` → 0). `BUCKET_ACTIVE`/`BUCKET_TAG` themselves are fully tokenized.
2. **Task 3:** `grep -c "rounded-xl\|rounded-full"` on `UserProfileView.jsx` returns 3, not 0 — all 3 are the avatar `<img>` (line 22) and the language-bar progress track/fill (lines 77-78), which are legitimately circular UI (a profile photo, a progress-bar end-cap), not the pill-badge pattern the D-01 rule targets, and not named anywhere in the plan's Task 3 action text. The plan's top-level `<verification>` block (the one that actually gates the whole plan) only checks `"shadow-sm\|rounded-xl"` — not `rounded-full` — and that check passes cleanly (0 in both files).

No code changes were made for either of these — flagging here so the verifier doesn't mistake a documented, deliberate scope exclusion for a missed fix.

### Auth Gates

None — no authentication-gated operations in this plan.

## Known Stubs

None.

## Threat Flags

None — className/hex-value-only changes, no new network endpoints, auth paths, file access, or schema changes.

## Verification Results

- `cd app && npm run build` — succeeds, 3787 modules transformed, no errors (after `npm install` to hydrate `node_modules`, see Deviations #3)
- `grep -c "#e17f26\|#3c9a46\|#16171d" app/src/components/charts/theme.js` → 0 ✅
- `grep -c "bg-gray-\|bg-blue-\|bg-amber-" app/src/components/jobBoards/helpers.js` → 1 (documented `LANG_COLOR` exception, see Deviations) ⚠️ expected
- `grep -c "shadow-sm\|rounded-xl" app/src/components/jobBoards/RepoStats.jsx app/src/components/jobBoards/UserProfileView.jsx` → 0 total ✅
- All Task 1/2/3 per-task acceptance criteria verified individually (see task commits) — all pass except the two documented scope-exclusion false-positives above

## Self-Check: PASSED

- FOUND: app/src/components/charts/theme.js (modified, hex values verified via grep)
- FOUND: app/src/components/jobBoards/helpers.js (modified, token classes verified via grep)
- FOUND: app/src/components/jobBoards/RepoStats.jsx (modified, shape classes verified via grep)
- FOUND: app/src/components/jobBoards/UserProfileView.jsx (modified, shape classes verified via grep)
- FOUND commit b301d62 (Task 1)
- FOUND commit 1facc12 (Task 2)
- FOUND commit e35efc2 (Task 3)
