---
phase: 05-pipeline-job-boards-merge
plan: 02
subsystem: ui
tags: [react, vite, navigation, view-switcher, regression-sweep, playwright]

# Dependency graph
requires:
  - phase: 05-pipeline-job-boards-merge
    provides: "Plan 05-01's rename+shell merge (ApplicationsView.jsx, jobBoards/JobBoardsView.jsx, PipelineTab.jsx shell) — this plan re-verifies it against the fully merged tree"
provides:
  - "Integrated regression sweep confirming every deterministic gate from 05-01's three tasks is green against one merged tree"
  - "Structural proof (empty diffs) that PIPE-02/PIPE-03 preservation held across the whole Job Boards subtree, attention derivation, db.js, and shared ui/panels components"
  - "Staged end-of-phase manual UAT checklist for the human verification pass required by workflow.human_verify_mode=end-of-phase"
affects: [06-navigation-consolidation, 07-full-visual-reskin]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sweep-plan pattern (same shape as 01-05/02-04/03-08/04-05): resolve base SHA -> changeset audit -> preservation diffs -> gate re-run -> build -> stage human checklist"

key-files:
  created: []
  modified: []

key-decisions:
  - "No source files touched — this plan is read-only verification plus the SUMMARY artifact, per its own <files> declaration"
  - "Live-render screenshot attempted via Playwright's Python CLI (playwright screenshot / a small sync_playwright driver script) against a worktree-local dev server on port 3002 (port 3001 was already occupied by an unrelated vite process rooted at the main checkout, left running from a prior session) — blocked by a hard environment constraint documented below, not skipped by choice"

requirements-completed: [PIPE-01, PIPE-02, PIPE-03]

coverage:
  - id: D1
    description: "Every deterministic gate from plan 05-01's three tasks (shell line count, useState count, views.length>1 gate, switcher class strings, accent-absence, DEMO_PIPELINE_VIEWS export, body reference counts, both renamed-body line counts, onImported absence in ApplicationsView, App.jsx render-branch/prop wiring, Sidebar NAV_ITEMS count, SettingsTab's surviving github BYOK entry, TodayTab provenance comments, repo-wide absence of GitHubTab/tab==='github') re-verified green against the fully merged tree"
    requirement: "PIPE-01"
    verification:
      - kind: unit
        ref: "22 individual grep/wc-based gate commands (decomposed from the plan's single combined command because the sandbox rejected multi-clause `&&` chains as too complex to verify worktree-containment) — all 22 executed, all pass; see Task 1 section below for the full list and results"
        status: pass
    human_judgment: false
  - id: D2
    description: "Changeset against the resolved pre-phase base (5e6535d) is exactly the 7 expected paths under app/ with zero unexplained drift, reconciled between rename-detecting (-M) and rename-suppressing (--no-renames) diff views"
    requirement: "PIPE-01"
    verification:
      - kind: unit
        ref: "git diff --stat -M 5e6535d..HEAD -- app/ (6 rows, GitHubTab->JobBoardsView collapsed as a rename) reconciled against git diff --stat --no-renames 5e6535d..HEAD -- app/ (7 rows, rename expanded) and git diff --name-status -M (R098 + 4 M/A rows) — all three views agree on the same 7 distinct file paths"
        status: pass
    human_judgment: false
  - id: D3
    description: "Preservation proof for PIPE-02/PIPE-03: all four scoped diffs against the base (Job Boards subtree minus the renamed body, attention.js/db.js/github.js, ui//panels/, icons.js/SettingsTab.jsx/index.css) are empty"
    requirement: "PIPE-02"
    verification:
      - kind: unit
        ref: "4 git diff commands against base 5e6535d, each piped to wc -l, each returning 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "Rename fidelity: both renamed bodies differ from their pre-phase originals by exactly the declared changed-line counts (2 for JobBoardsView, 4 for ApplicationsView)"
    requirement: "PIPE-02"
    verification:
      - kind: unit
        ref: "git show 5e6535d:<old path> | diff - <new file> | grep -c '^[<>]' == 2 and == 4 respectively"
        status: pass
    human_judgment: false
  - id: D5
    description: "Nav-id to render-branch table: all 7 AppInner NAV_ITEMS ids and all 4 DemoApp DEMO_NAV_ITEMS ids have exactly one matching render branch each, no orphans either direction (05-RESEARCH.md Pitfall 3 dangling-route check)"
    requirement: "PIPE-01"
    verification:
      - kind: unit
        ref: "id-by-id comparison of Sidebar.jsx NAV_ITEMS / App.jsx DEMO_NAV_ITEMS against App.jsx's tab === branches, recorded as an explicit table below"
        status: pass
    human_judgment: false
  - id: D6
    description: "Production build (cd app && npm run build) exits 0 against the merged tree"
    requirement: "PIPE-01"
    verification:
      - kind: unit
        ref: "npm run build output: '3788 modules transformed... built in 2.76s', exit 0"
        status: pass
    human_judgment: false
  - id: D7
    description: "Live-render + screenshot visual verification of the merged Pipeline destination's switcher-row spacing (05-RESEARCH.md Open Question 2)"
    requirement: "PIPE-01"
    verification:
      - kind: e2e
        ref: "Attempted via Playwright (chromium) against a worktree-local dev server (localhost:3002); blocked by 'supabaseUrl is required' thrown at module-import time because this fresh git worktree has no .env (gitignored, not present in a fresh worktree checkout, and this project's own CLAUDE.md documents that Claude Code's permission settings block reading/writing .env* files directly) — the crash happens before React mounts, on every route including /demo, so no pixel of any route could be captured in this execution environment"
        status: unknown
    human_judgment: true
    rationale: "Automation was genuinely attempted (not skipped by default) but hit a hard credential/environment wall that cannot be resolved without writing to a gitignored .env file, which this agent's permissions explicitly forbid. A code-level structural check was performed instead (read ApplicationsView.jsx's and JobBoardsView.jsx's actual root JSX: both start directly at content — DuplicatesPanel and TrackedBoardsPanel respectively — with no page-title/header, confirming the UI-SPEC's no-doubled-chrome prediction) but this is not a substitute for an eyes-on render. The staged checklist below requires a human (or an agent with valid Supabase credentials, e.g. the main checkout's already-running dev server once this wave merges) to complete this specific verification before Phase 5 is declared UAT-complete."
  - id: D8
    description: "Staged end-of-phase manual UAT checklist covering all 10 required areas, each annotated with the requirement/success-criterion it evidences"
    requirement: "PIPE-03"
    verification:
      - kind: manual_procedural
        ref: "10-row checklist in the '## Staged Manual Checklist' section below"
        status: unknown
    human_judgment: true
    rationale: "Every row requires a human click-through against a signed-in session (Applications<->Job Boards switching, auto-import round trip, side-panel open/edit, demo route, mobile responsive) — none of this is deterministically verifiable from source alone, by design (workflow.human_verify_mode=end-of-phase)."

duration: ~25min
completed: 2026-08-20
status: complete
---

# Phase 5 Plan 2: Pipeline + Job Boards Merge — Regression Sweep Summary

**Re-verified all 22 deterministic gates from plan 05-01 green against the fully merged tree, confirmed the exact 7-path changeset with zero drift via 4 empty preservation diffs, passed a clean production build, and staged (but could not complete) the end-of-phase visual/manual UAT pass — blocked on a missing-Supabase-credentials environment gap in this fresh worktree, not a code defect.**

## Performance

- **Duration:** ~25 min (includes `npm install` for a fresh worktree with no `node_modules`, and standing up a Playwright-driven headless-Chromium screenshot attempt)
- **Completed:** 2026-08-20
- **Tasks:** 2 completed
- **Files modified:** 0 (read-only sweep; only `.planning/phases/05-pipeline-job-boards-merge/05-02-SUMMARY.md` is new)

## Accomplishments

- **Resolved pre-phase base SHA:** `5e6535d353138e5afc3a0b8847ae3d0f86dd8bc8` — the commit that landed `05-PATTERNS.md`/`STATE.md` immediately after `05-01-PLAN.md`/`05-02-PLAN.md` were created (`526dc0c`) and immediately before Plan 05-01's first source commit (`5624e7b`). This is byte-identical to the SHA `05-01-SUMMARY.md` recorded, so no discrepancy to explain.
- **Changeset audit — exactly the 7 declared paths, zero drift:** reconciled `git diff --stat -M` (6 rows, `GitHubTab.jsx`→`JobBoardsView.jsx` auto-detected as `R098`) against `git diff --stat --no-renames` (7 rows, rename expanded to a delete+add pair) and `git diff --name-status -M` (`M app/src/App.jsx`, `A app/src/components/ApplicationsView.jsx`, `M app/src/components/PipelineTab.jsx`, `M app/src/components/TodayTab.jsx`, `R098 GitHubTab.jsx→JobBoardsView.jsx`, `M app/src/components/layout/Sidebar.jsx`) — all three views agree on the same 7 distinct file paths, none of them unexplained.
- **All 4 preservation diffs empty:** the Job Boards subtree minus the renamed body (`RepoJobsView.jsx`, `TrackedBoardsPanel.jsx`, `CalendarView.jsx`, `RepoStats.jsx`, `UserProfileView.jsx`, `PreferencesPanel.jsx`, `JobCard.jsx`, `helpers.js`, `boardsRegistry.js`, `useJobDeadlines.js`, `useJobBlurbs.js`), `attention.js`/`db.js`/`github.js`, `ui/`/`panels/`, and `icons.js`/`SettingsTab.jsx`/`index.css` all show 0 changed lines against the base — this is the structural proof that PIPE-02 (multi-board tracking, auto-import, deadline extraction, triage buckets, calendar/stats) and PIPE-03 (the auto-import → attention-feed data path) were preserved rather than re-implemented.
- **Rename fidelity re-measured and confirmed exact:** `jobBoards/GitHubTab.jsx` → `jobBoards/JobBoardsView.jsx` is **2** changed diff-marker lines (export identifier only); `PipelineTab.jsx` (old body) → `ApplicationsView.jsx` is **4** changed diff-marker lines (export identifier + banner comment) — matching 05-01-SUMMARY's own reported counts exactly.
- **All 22 deterministic gates from 05-01's three tasks pass** against the merged tree (decomposed into 22 individual commands since the sandbox rejected the plan's single combined `&&`-chained command as "too complex to verify stays inside the worktree" — same class of harness friction 05-01-SUMMARY already documented for a different command shape). Full list and results in the Task 1 section below.
- **Dangling-route check (05-RESEARCH.md Pitfall 3):** built an explicit id-by-id table (below) confirming all 7 `AppInner` nav ids and all 4 `DemoApp` demo nav ids each have exactly one matching render branch, with no orphan on either side.
- **Production build clean:** `cd app && npm run build` → `3788 modules transformed`, exit 0, `built in 2.76s`. The only warning is Vite's generic "chunks larger than 500 kB" bundle-size notice — not new to this phase (this phase adds zero new imports/dependencies and nets fewer total lines than before the merge; re-verifying this specific claim against the pre-phase base build was not possible without checking out a different ref, which the worktree branch-safety policy for this agent explicitly prohibits — treated as pre-existing infrastructure noise by inference, not independently re-confirmed byte-for-byte).
- **Live-render screenshot attempted, blocked by environment, not skipped:** started a worktree-local Vite dev server (port 3002 — port 3001 was already occupied by an unrelated `vite` process rooted at the *main* checkout, left running from a prior session, which does not reflect this worktree's merged tree). Used Playwright (`/opt/homebrew/bin/playwright screenshot`, then a small `sync_playwright` Python driver to capture console/page errors) against `http://localhost:3002/demo`. Every route — including `/demo`, which is supposed to have zero backend dependency — renders a blank white page because `lib/supabaseClient.js` calls `createClient()` at module-import time, which throws `supabaseUrl is required` before React ever mounts, since this fresh git worktree has no `.env` (gitignored, never copied into a new worktree checkout) and this agent's own permissions explicitly block reading/writing `.env*` files (documented in this project's own `CLAUDE.md`). This is a hard environment wall, not a code defect introduced by this phase — `lib/supabaseClient.js` is not among the 7 files this phase touched.
- **Code-level spacing check performed as a substitute (not a replacement) for the blocked visual check:** read `PipelineTab.jsx`'s actual JSX (switcher wrapped in `<div className="flex mb-4">`, matching the UI-SPEC's exact `mb-4` requirement) and both bodies' actual root elements — `ApplicationsView.jsx` returns `<div><DuplicatesPanel .../>` first; `JobBoardsView.jsx` returns `<div className="space-y-5"><TrackedBoardsPanel .../>` first. Neither renders a page-title/header before its first content block, confirming 05-RESEARCH.md's prediction ("lower collision risk than Grow's `ExploreTab` header-strip precedent") at the code level. **This does not substitute for the mandatory eyes-on render** — see the staged checklist below, which carries this item forward as an open human-verification step.
- **Staged the 10-row end-of-phase manual UAT checklist** (below), each row annotated with the requirement/success-criterion it evidences, plus a separated pre-existing-findings section.

## Task Commits

Each task was committed atomically:

1. **Task 1: Integrated gate re-run, changeset audit, and production build** — read-only verification, no source changes; no task commit (nothing to stage beyond this SUMMARY).
2. **Task 2: Stage the end-of-phase human verification pass** — read-only verification, no source changes; no task commit (nothing to stage beyond this SUMMARY).

_No plan-metadata commit in worktree mode — this SUMMARY.md is committed separately per the worktree protocol. Both of this plan's tasks were declared read-only (`<files>(read-only...)</files>`) in `05-02-PLAN.md`, so there is no source diff to commit per task — only this SUMMARY.md, committed once below._

## Task 1 — Full Gate Results

### Resolved base SHA

`5e6535d353138e5afc3a0b8847ae3d0f86dd8bc8` — cross-checked against `05-01-SUMMARY.md`'s recorded SHA, identical, no discrepancy.

### Changeset audit (reconciled)

```
$ git diff --stat -M 5e6535d..HEAD -- app/
 app/src/App.jsx                                    |   6 +-
 app/src/components/ApplicationsView.jsx            | 230 +++++++++++++++++++
 app/src/components/PipelineTab.jsx                 | 251 +------------------
 app/src/components/TodayTab.jsx                    |   4 +-
 .../jobBoards/{GitHubTab.jsx => JobBoardsView.jsx} |   2 +-
 app/src/components/layout/Sidebar.jsx              |   1 -
 6 files changed, 268 insertions(+), 226 deletions(-)

$ git diff --stat --no-renames 5e6535d..HEAD -- app/
 app/src/App.jsx                                |   6 +-
 app/src/components/ApplicationsView.jsx        | 230 ++++++++++++++++++++++
 app/src/components/PipelineTab.jsx             | 251 ++++---------------------
 app/src/components/TodayTab.jsx                |   4 +-
 app/src/components/jobBoards/GitHubTab.jsx     |  98 ----------
 app/src/components/jobBoards/JobBoardsView.jsx |  98 ++++++++++
 app/src/components/layout/Sidebar.jsx          |   1 -
 7 files changed, 365 insertions(+), 323 deletions(-)

$ git diff --name-status -M 5e6535d..HEAD -- app/
M	app/src/App.jsx
A	app/src/components/ApplicationsView.jsx
M	app/src/components/PipelineTab.jsx
M	app/src/components/TodayTab.jsx
R098	app/src/components/jobBoards/GitHubTab.jsx	app/src/components/jobBoards/JobBoardsView.jsx
M	app/src/components/layout/Sidebar.jsx
```

**Reconciliation:** the `-M` view collapses `GitHubTab.jsx`→`JobBoardsView.jsx` into one rename row (6 total rows); the `--no-renames` view expands it into a delete + add pair (7 total rows). Both agree on the same underlying set of 7 distinct file paths: `App.jsx`, `ApplicationsView.jsx` (added), `PipelineTab.jsx` (modified — the shell), `TodayTab.jsx`, `GitHubTab.jsx` (deleted), `JobBoardsView.jsx` (added), `Sidebar.jsx`. This is exactly the plan's declared expected set (2 renames + 1 rewrite + 3 edits, git's heuristics splitting the `PipelineTab.jsx`→`ApplicationsView.jsx` "rename" into an add/modify pair for the reason 05-01-SUMMARY already documented: the `PipelineTab.jsx` path is immediately reused by new shell content in the same task, so git's same-path-modify heuristic outranks the cross-path rename match). **Zero unexplained entries.**

### Preservation diffs (all four empty)

```
$ git diff 5e6535d..HEAD -- app/src/components/jobBoards/RepoJobsView.jsx app/src/components/jobBoards/TrackedBoardsPanel.jsx app/src/components/jobBoards/CalendarView.jsx app/src/components/jobBoards/RepoStats.jsx app/src/components/jobBoards/UserProfileView.jsx app/src/components/jobBoards/PreferencesPanel.jsx app/src/components/jobBoards/JobCard.jsx app/src/components/jobBoards/helpers.js app/src/components/jobBoards/boardsRegistry.js app/src/components/jobBoards/useJobDeadlines.js app/src/components/jobBoards/useJobBlurbs.js
(empty — 0 lines)

$ git diff 5e6535d..HEAD -- app/src/lib/attention.js app/src/db.js app/src/github.js
(empty — 0 lines)

$ git diff 5e6535d..HEAD -- app/src/components/ui/ app/src/components/panels/
(empty — 0 lines)

$ git diff 5e6535d..HEAD -- app/src/lib/icons.js app/src/components/SettingsTab.jsx app/src/index.css
(empty — 0 lines)
```

### Rename fidelity re-measurement

- `git show 5e6535d:app/src/components/jobBoards/GitHubTab.jsx | diff - app/src/components/jobBoards/JobBoardsView.jsx | grep -c '^[<>]'` → **2**
- `git show 5e6535d:app/src/components/PipelineTab.jsx | diff - app/src/components/ApplicationsView.jsx | grep -c '^[<>]'` → **4**

Both match the plan's declared exact counts.

### Deterministic gates (all 22 pass)

| # | Gate | Result |
|---|------|--------|
| 1 | `wc -l PipelineTab.jsx` < 65 | 45 — pass |
| 2 | `grep -c "useState" PipelineTab.jsx` == 2 | 2 — pass |
| 3 | `grep -c "views.length > 1" PipelineTab.jsx` == 1 | 1 — pass |
| 4 | `grep -c "flex border border-ink-200 rounded-full overflow-hidden text-xs font-medium"` == 1 | 1 — pass |
| 5 | `grep -c "bg-ink-900 text-white"` == 1 | 1 — pass |
| 6 | `grep -c "accent"` == 0 | 0 — pass |
| 7 | `grep -c "export const DEMO_PIPELINE_VIEWS"` == 1 | 1 — pass |
| 8 | `grep -c "ApplicationsView"` (in PipelineTab.jsx) == 2 | 2 — pass |
| 9 | `grep -c "JobBoardsView"` (in PipelineTab.jsx) == 2 | 2 — pass |
| 10 | `wc -l ApplicationsView.jsx` == 230 | 230 — pass |
| 11 | `wc -l jobBoards/JobBoardsView.jsx` == 98 | 98 — pass |
| 12 | `grep -c "onImported" ApplicationsView.jsx` == 0 | 0 — pass |
| 13 | `grep -c "JobBoardsView" App.jsx` == 0 | 0 — pass |
| 14 | `grep -c "DEMO_PIPELINE_VIEWS" App.jsx` == 2 | 2 — pass |
| 15 | `grep -c "<PipelineTab" App.jsx` == 2 | 2 — pass |
| 16 | `grep -c "pipeline: activeApps.length" App.jsx` == 2 | 2 — pass |
| 17 | `grep -c "id: '" Sidebar.jsx` == 7 | 7 — pass |
| 18 | `grep -c "github" Sidebar.jsx` == 0 | 0 — pass |
| 19 | `grep -c "id: 'github'" SettingsTab.jsx` == 1 | 1 — pass |
| 20 | `grep -c "ApplicationsView.jsx" TodayTab.jsx` == 2 | 2 — pass |
| 21 | `grep -rn "GitHubTab" app/src` == 0 | 0 — pass |
| 22 | `grep -rn "tab === 'github'" app/src` == 0 | 0 — pass |

### Dangling-route check (05-RESEARCH.md Pitfall 3)

**AppInner (7 `NAV_ITEMS` ids, all matched):**

| Nav id | Render branch (App.jsx line) | Matched |
|--------|------------------------------|---------|
| `today` | 323 | yes |
| `overview` | 305 | yes |
| `network` | 310 | yes |
| `grow` | 315 | yes |
| `pipeline` | 319 | yes |
| `calendar` | 324 | yes |
| `settings` | 325 | yes |

**DemoApp (4 `DEMO_NAV_ITEMS` ids, all matched):**

| Nav id | Render branch (App.jsx line) | Matched |
|--------|------------------------------|---------|
| `today` | 409 | yes |
| `overview` | 397 | yes |
| `network` | 401 | yes |
| `pipeline` | 405 | yes |

No orphan id on either side (every `NAV_ITEMS`/`DEMO_NAV_ITEMS` id has a render branch; every `tab ===` comparison in `App.jsx` names an id that still exists in its respective array). `'github'` is absent from both arrays and both branch lists (gates 18, 21, 22 above).

### Production build

```
$ cd app && npm run build
vite v5.4.21 building for production...
transforming...
✓ 3788 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.76 kB
dist/assets/index-DJRasluj.css     44.77 kB
dist/assets/index-DbIlBB6H.js   1,530.10 kB

(!) Some chunks are larger than 500 kB after minification...
✓ built in 2.76s
```

Exit 0. The chunk-size warning is Vite's generic bundle-size threshold notice, unrelated to any package this phase adds (zero new imports/dependencies) — treated as pre-existing, not phase-introduced.

## Task 2 — Staged Human Verification Pass

**Dev server:** started at `http://localhost:3002` (worktree-local; port 3001 was already occupied by a separate `vite` process rooted at the *main* checkout — `ps` confirmed PID 40069, `node .../app/node_modules/.bin/vite`, left running from a prior session, and killing another agent's/the user's live process was judged out of scope and risky). Compiled clean (`VITE v5.4.21 ready in 214 ms`). **Left running** per the plan's instruction, though see the credentials caveat below — this worktree-local instance cannot render anything past a blank page without Supabase credentials.

**Visual verdict on switcher-row spacing (05-RESEARCH.md Open Question 2): could not be captured as a live screenshot in this execution environment — hard blocker, documented, not silently skipped.**

Attempted with Playwright (`chromium`, both the CLI `playwright screenshot` subcommand and a `sync_playwright` Python driver script that also captures console/page errors) against `http://localhost:3002/demo` (chosen because `/demo` is documented as having zero backend dependency and needs no login). Result: a blank white page on every route, because `app/src/lib/supabaseClient.js` calls `createClient()` at module-import time (not lazily, not gated behind a demo-mode check), and this fresh git worktree checkout has no `.env` file — `.env` is gitignored and is never copied into a newly-created worktree, and this project's own `CLAUDE.md` documents that "Claude Code's own permission settings block reading/writing `.env*` files directly," which this agent's sandbox independently confirmed (`ls .env`/`cat app/.env` were both denied by the permission system before any content was read). The captured browser console error was:

```
[error] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — add them to your .env (repo root) and restart the dev server.
[pageerror] supabaseUrl is required.
```

**Verdict given the constraint: "no adjustment needed," based on direct code inspection, carried forward as an explicit open item for the human pass (not treated as equivalent to a real render).** Read `PipelineTab.jsx`'s actual JSX: the switcher is wrapped in `<div className="flex mb-4">`, exactly matching `05-UI-SPEC.md`'s specified `mb-4` bottom margin. Read both bodies' actual root return statements: `ApplicationsView.jsx` returns `<div><DuplicatesPanel apps={apps} onRefresh={onRefresh} />` as its very first child; `JobBoardsView.jsx` returns `<div className="space-y-5"><TrackedBoardsPanel .../>` as its very first child. Neither renders an `<h1>`/page-title before its first content block, so there is no doubled-chrome collision to correct — this confirms 05-RESEARCH.md's Open Question 2 prediction at the source level. **This is not a substitute for the mandatory render+screenshot check** (`frontend_aesthetics` directive) — it is carried forward as row 1 of the staged checklist below, to be completed by whoever runs the actual human UAT pass (recommended: against the main checkout's dev server at `localhost:3001`, which already has valid Supabase credentials, once this wave's commits are merged back — Vite's HMR should pick up the merged code automatically if that server is still running).

## Staged Manual Checklist

Each row is annotated with the requirement/success-criterion it evidences. None of these are marked passed on the strength of a build or grep alone — every row below is left open for the human pass, run against a session with valid Supabase credentials (this worktree's own dev server cannot get past the blank-page credential wall documented above).

| # | Checklist item | Evidences |
|---|-----------------|-----------|
| 1 | Live render + screenshot: switcher row spacing (05-RESEARCH.md Open Question 2) reads correctly against each body's first element, no doubled chrome, segment labels/icons legible at `size={13}`, active segment's solid `bg-ink-900` fill reads as current view | UI-SPEC Spacing Scale, project-level `frontend_aesthetics` render+screenshot directive |
| 2 | Pipeline opens on the Applications view every time, including after navigating away to another destination and back | PIPE-01, D-01 always-Applications default |
| 3 | The switcher moves between Applications and Job Boards, and the previously-active body unmounts (not just hides) — confirm via React DevTools or by checking that Job Boards' auto-import/deadline-fetch network activity stops when switched away | PIPE-01, 05-RESEARCH.md Anti-Pattern 1 |
| 4 | Job Boards is gone from the sidebar rail and the mobile bottom bar, with no dead nav button anywhere | 05-RESEARCH.md Pitfall 3 (silent dangling-route failure mode) |
| 5 | Inside Job Boards: pulling all tracked boards works; the collapsed single-repo/profile lookup works; deadline badges resolve on job cards; triage bucket changes stick; calendar and stats views render — one sub-check per capability so a partial failure is attributable | PIPE-02 |
| 6 | Auto-import round trip: pull a board with an unimported listing, switch to Applications *without reloading the page*, confirm the new row appears with Needs Review triage, then open Today and confirm it appears in the attention feed | PIPE-03, 05-RESEARCH.md Pitfall 1 (stale-props/no-local-copy discipline) |
| 7 | Clicking an application row (Applications view) and a job card (Job Boards view) each opens the shared `SidePanel`, and each panel's edit controls save | ROADMAP.md Phase 5 success criterion 4 |
| 8 | Adding a new application from the Applications view still works (exercises the panel's create branch) | PIPE-01/PIPE-02 regression check |
| 9 | Public `/demo` route: Pipeline is reachable, renders Applications only, shows zero switcher chrome (not a disabled control, not a single-segment pill) | D-03, ROADMAP.md NAV-04 precursor |
| 10 | Pipeline nav badge count is unchanged in meaning from before the merge; responsive check at mobile width — switcher row and bottom bar both render sanely with the reduced (7-item) nav | 05-RESEARCH.md Pitfall 4 (badge semantics unchanged), general mobile regression check |

## Pre-existing Findings — Not Fixed This Phase

Carried forward, referenced (not rediscovered), per the plan's instruction:

- **Stale-day-count and duplicates-panel colour literals** (flagged Phase 1) — `PipelineTab.jsx`'s (now `ApplicationsView.jsx`'s) `DuplicatesPanel`/stale-application indicator still uses `orange-*` literals outside the `@theme` token system. Unaffected by this phase's rename (verified: the preservation-diff-equivalent check — `ApplicationsView.jsx`'s content diff against the pre-phase `PipelineTab.jsx` body is exactly the declared 4 lines, export identifier + banner comment only, so these literals are untouched). Still a Phase 7 candidate.
- **Calendar feed's missing post-create refresh** (flagged Phase 2, `CR-02` in `02-REVIEW.md`) — `CalendarTab.jsx`'s Feed view still doesn't refresh after creating/deleting an event. Out of this phase's file boundary (`CalendarTab.jsx` is not among the 7 files this phase touched — confirmed by the changeset audit above).

**New finding this pass (architectural, not a regression — flagged for awareness, not this phase's scope to fix):** `lib/supabaseClient.js` constructs its Supabase client at module-import time with no lazy-init/error-boundary guard, so a missing `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` throws synchronously before React mounts — this crashes **every** route including `/demo`, undermining `/demo`'s documented "zero backend dependency" promise in the specific case where Supabase env vars are absent/misconfigured (as opposed to Supabase being merely unreachable at runtime, which `isDemoMode()`'s branch logic already handles gracefully). Not caused by this phase (`lib/supabaseClient.js` is untouched, confirmed via the preservation-diff-equivalent reasoning above — it isn't in Job Boards, `ui/`, `panels/`, or any of the 7 changed paths) and not something this phase's locked "rename + wrap, zero logic changes" scope authorizes fixing. Flagged as a candidate for Phase 6 (which already touches `App.jsx`'s demo-mode wiring for NAV-04) or a standalone follow-up. **Does not block this phase's own requirements** — PIPE-01/02/03 are proven structurally via the empty preservation diffs and passing build, independent of this unrelated pre-existing fragility.

## Threat Flags

None — this plan is read-only verification; no new network endpoints, auth paths, file access patterns, or schema changes were introduced.

## Known Stubs

None — no new UI surface with hardcoded/empty data was introduced by this plan.

## Decisions Made

- Decomposed the plan's single combined gate command into 22 individual grep/wc commands after the sandbox rejected multi-clause `&&` chains as "too complex to verify stays inside the worktree" — same class of harness friction 05-01-SUMMARY documented for a different command shape (`cd ... && ...` and `diff <(...)`). No effect on verification correctness; every gate the plan specified still ran and passed.
- Chose `/demo` as the screenshot target route (over the authenticated app) since it's documented as needing zero backend dependency — this choice is what surfaced the `supabaseClient.js` module-import-time crash as a genuine new finding, rather than just hitting an expected login-page redirect.
- Did not attempt to work around the missing `.env` by writing one — this agent's permissions explicitly deny reading/writing `.env*` files, and CLAUDE.md documents this as an intentional project-level guardrail, not an oversight to route around.
- Left the worktree-local dev server (port 3002) running per the plan's instruction, while explicitly recommending the actual human UAT pass use the main checkout's dev server (port 3001, already running with valid credentials) once this wave's commits merge back to `main`.

## Deviations from Plan

None — plan executed exactly as written (both tasks were read-only verification tasks; no source deviation was possible). The screenshot-capture blocker above is an environment limitation encountered while executing Task 2's verification step, not a deviation from what the plan specified — the plan itself anticipated this exact risk (05-01-SUMMARY's own "Next Phase Readiness" section explicitly flagged that no browser-automation tool was available in that plan's execution environment and recommended this sweep perform the live-render check). This plan went one step further than 05-01 (browser automation *was* available this time, via a local Playwright install) but hit a different, deeper blocker (missing Supabase credentials) that a browser tool alone cannot resolve.

## Issues Encountered

- Fresh worktree checkout had no `app/node_modules` — ran `npm install` (229 packages) before any gate/build command could run, same infrastructure-setup step 05-01 already needed.
- Port 3001 was already occupied by an unrelated `vite` process (PID 40069, rooted at the main checkout `/Users/ethansaba/code/recruiter/app`, not this worktree) — started this plan's dev server on port 3002 instead of killing another process this agent didn't start.
- Bash sandbox rejected several multi-clause `cd ... && ...` and compound commands as "too complex to verify stays inside the worktree" (same friction class 05-01-SUMMARY documented) — worked around by running every command as a single, simple statement from the worktree root (its default cwd).
- No `.env` file present in this fresh worktree and reading/writing `.env*` paths is denied by this agent's permission settings — this is the root cause of the blocked screenshot, detailed above. Not resolved (out of this agent's permission boundary to resolve), only documented and carried forward as an open checklist item.

## User Setup Required

None — no external service configuration required by this plan itself. (The Supabase credentials needed to complete the deferred visual checklist item are a pre-existing local-dev setup requirement of the app in general, documented in this project's own `CLAUDE.md` under "Pending Setup" — not something this plan introduces or is responsible for provisioning.)

## Next Phase Readiness

- PIPE-01/02/03 are proven structurally (22/22 deterministic gates green, 4/4 preservation diffs empty, exact 7-path changeset, clean production build) — the code-level half of Phase 5's verification is fully complete and green.
- **Not done, carried forward as an explicit open item:** the live-render + screenshot visual verification and the full 10-row manual checklist above both require a session with valid Supabase credentials, which this fresh worktree checkout does not have (and this agent cannot provision, by design). Recommend running the staged checklist against the main checkout's already-running dev server (`localhost:3001`) once this wave's commits merge to `main` — that server already has working `.env` credentials and, if left running through the merge, Vite's HMR should reflect the merged Phase 5 code without a manual restart. If it does need a restart, `cd app && npm run dev` from the main checkout (not this worktree) will pick up the merged tree.
- Phase 5's ROADMAP.md success criteria 1–3 (switcher, preserved Job Boards capabilities, auto-import→attention-feed) are structurally proven; success criterion 4 (shared side-panel from both views) is inherited unchanged from Phase 4 per the preservation diffs (`ui/`/`panels/` diff against base is empty) but still needs the same human click-through as everything else in the checklist above, since a side-panel *opening* correctly is a runtime/interaction fact, not a static one.
- Ready to close Phase 5 once the staged checklist above is run by a human (or an agent with real Supabase credentials) and any spacing/behavioral findings are resolved or explicitly deferred.

---
*Phase: 05-pipeline-job-boards-merge*
*Completed: 2026-08-20*
