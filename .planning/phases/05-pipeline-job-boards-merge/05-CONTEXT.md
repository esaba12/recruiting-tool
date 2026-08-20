# Phase 5: Pipeline + Job Boards Merge - Context

**Gathered:** 2026-08-19
**Status:** Ready for planning
**Mode:** `--auto` (autonomous discussion — all gray areas resolved to their recommended option, logged below for review)

<domain>
## Phase Boundary

`Pipeline` (application tracker, `PipelineTab.jsx`) and `Job Boards` (GitHub README board aggregator, `jobBoards/GitHubTab.jsx`) are today two separate top-level nav entries (`NAV_ITEMS` ids `'pipeline'` and `'github'`). This phase merges them into one `Pipeline` destination with an in-page view switch between an **Applications** view and a **Job Boards** view, per PIPE-01. Every existing Job Boards capability (multi-board tracking/auto-import, real-deadline extraction, triage buckets, calendar/stats views, ad-hoc repo/profile lookup) must keep working unchanged inside the merged destination (PIPE-02), and jobs auto-imported from Job Boards must continue landing in the Applications table with `Triage='Needs Review'` and continue feeding Today's unified attention feed (PIPE-03) — this data flow already exists (`RepoJobsView.jsx`'s auto-import effect writes via `addApplication()`, `TodayTab.jsx`'s `needsReviewApps()` already reads the same `apps` table), so PIPE-03 is a **preserve, not build** — this phase must not break it, not construct it from scratch.

Both destinations already have their record-detail editing fully on the Phase 4 `SidePanel` (`PipelineTab.jsx` → `ApplicationPanelBody`, `RepoJobsView.jsx` → `JobPanelBody`) — PANEL-01/02 is complete and out of this phase's scope; this phase is pure navigation/IA restructuring of two already-modernized tabs, not a panel migration.

</domain>

<decisions>
## Implementation Decisions

### View-switch UI & default view
- **D-01 [auto]:** The merged Pipeline destination uses a **segmented control** (Applications | Job Boards) at the top of the page, styled to match the app's existing view-switcher convention (`NETWORK_VIEWS`-style pill/segmented control used by Network's Table/Cards/Graph/Outbox and Job Boards' own internal list/calendar toggle) rather than inventing a new nav pattern. **Applications is the default view** on landing — it's the higher-traffic daily-use surface (existing applications, stage tracking) versus Job Boards' more occasional "go find new postings" use.
  - *[auto] Area: View-switch pattern & default — Q: "Segmented control matching the existing Table/Cards/Graph convention, or a distinct sub-tab style? Which view loads first?" → Selected: "Segmented control (existing convention), Applications default" (recommended default — reuses an established, already-styled pattern instead of inventing a second one, and matches PROJECT.md's "fast/cohesive daily use" core value by prioritizing the view used every day)*

### Component architecture
- **D-02 [auto]:** New top-level `PipelineTab.jsx` becomes a **thin shell** (view-switch chrome + which body to render), following this milestone's established shell-plus-body extraction precedent (Phase 3's `GrowTab` wrapping `ExploreTab`/`ReferralCoverageTab`/`DiscoverTab`; Phase 4's `SidePanel` wrapping per-type `*PanelBody` components). The current `PipelineTab.jsx` body (application list, filters, `DuplicatesPanel`, stats bar) is renamed/extracted to `ApplicationsView.jsx`; `jobBoards/GitHubTab.jsx`'s body is renamed to `jobBoards/JobBoardsView.jsx` (stays in the `jobBoards/` directory alongside its existing sub-components — `RepoJobsView`, `TrackedBoardsPanel`, `CalendarView`, `RepoStats`, `UserProfileView`, `PreferencesPanel`, `JobCard`, `helpers.js` — none of which need to move or change). Neither existing body's internal logic changes — this is a rename + wrap, not a rewrite.
  - *[auto] Area: Shell vs. rewrite — Q: "New shell wrapping renamed existing bodies (matching Phase 3/4 precedent), or merge the two tabs' logic into one combined component?" → Selected: "Shell + renamed existing bodies, zero logic changes" (recommended default — lowest regression risk for PIPE-02's "fully preserved" requirement; matches the milestone's two prior successful merge phases)*

### Demo-mode handling
- **D-03 [auto]:** The Job Boards view-switch option is **hidden entirely in demo mode** (`isDemoMode` prop threaded down, same pattern as `DEMO_NETWORK_VIEWS` filtering `NETWORK_VIEWS`) — the merged Pipeline destination shows only the Applications view for anonymous `/demo` visitors, with no visible toggle. This is a direct continuation of current behavior (`'github'` is already absent from `DEMO_NAV_ITEMS` today) rather than a new gap: Job Boards' `/gh-api` proxy calls `requireUser()` like every other proxy, so an anonymous demo visitor would only ever see a 401 if the toggle were shown — hiding it avoids introducing a new broken-feeling UI state in the portfolio demo. Rejected showing the toggle with a locked/sign-up-prompt state, since none of this milestone's other merges (Grow's Explore/Coverage/Discover) introduced a locked-state pattern either — omission is the established precedent.
  - *[auto] Area: Demo-mode Job Boards visibility — Q: "Hide the Job Boards toggle in demo mode (matches current tab-omission behavior), or show it with a locked/sign-up-prompt state?" → Selected: "Hide entirely" (recommended default — matches existing demo-exclusion precedent for every other BYOK-gated feature, avoids a net-new UI state)*

### Toolbar / filter bar
- **D-04 [auto]:** Applications and Job Boards **keep their own separate, self-contained toolbars** (Applications: filter chips + search + "+ Add Application"; Job Boards: `TrackedBoardsPanel` pull-all controls, ad-hoc repo lookup, and — once results load — `RepoJobsView`'s own search/location/quick-chip/closing-soon filter bar and stats bar) rather than merging into one shared filter/search control. The two use materially different filter vocabularies (application `stage`/`triage` vs. job `bucket`/`location`/deadline-urgency) and forcing a shared toolbar would either lose filter options or bloat one control with conditionally-shown fields for no functional gain — not required by PIPE-01/02, and Grow (Phase 3) set the precedent of each section keeping its own internal controls rather than a shared cross-section toolbar.
  - *[auto] Area: Toolbar unification — Q: "Merge Applications' and Job Boards' filter/search bars into one shared toolbar, or keep each view's toolbar fully separate?" → Selected: "Keep separate, self-contained toolbars per view" (recommended default — different filter vocabularies, matches Grow's per-section-controls precedent, avoids scope creep into a new unified-filter feature not asked for by PIPE-01/02)*

### Navigation cleanup
- **D-05 (inferred, not directly asked):** `Sidebar.jsx`'s `NAV_ITEMS` loses its `'github'` entry entirely (not repointed — deleted); `'pipeline'` keeps the `Kanban` icon it already has (`lib/icons.js` `NAV_ICON`). The `'github'` entry's `GitFork` icon becomes available for reuse as the Job Boards view-switch segment's icon (planning's discretion whether to reuse it or pick a new one). `App.jsx`'s `tab === 'github'` branch is removed; `GitHubTab` import is replaced by the new `JobBoardsView` import inside the merged `PipelineTab.jsx` shell, not inside `App.jsx` directly.

### Claude's Discretion
- Exact segmented-control visual treatment (icon-only vs. icon+label, spacing) beyond "matches the existing Table/Cards/Graph convention" is implementation detail for planning.
- Whether `ApplicationsView.jsx`/`JobBoardsView.jsx` are the exact final filenames, or planning's pattern-mapper picks slightly different names, is a file-naming call — the constraint that matters is shell + renamed-unchanged-bodies, not the literal filenames.
- Whether the Job Boards view toggle reuses the existing `GitFork` icon or a different one is a visual-polish call for planning.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone-level requirements and roadmap
- `.planning/REQUIREMENTS.md` §"Pipeline + Job Boards Merge (PIPE)" — PIPE-01/02/03 acceptance criteria
- `.planning/ROADMAP.md` §"Phase 5: Pipeline + Job Boards Merge" — goal, success criteria, dependency on Phase 4
- `.planning/PROJECT.md` — Core Value (daily-use speed/cohesion), Constraints (scope discipline: `app/src/components/`, `app/src/lib/`, `App.jsx` nav/routing, `index.css` tokens only), Compatibility constraint (public `/demo` route — Pipeline IS in `DEMO_NAV_ITEMS` today, unlike Grow/Job Boards, so this phase's demo-mode handling (D-03) is directly load-bearing, not inherited-for-free like Phase 3's was)

### Phase 1 deliverables this phase builds on
- `.planning/phases/01-visual-foundation-industrial-design-tokens-primitives/01-UI-SPEC.md` — locked token values/typography (industrial palette, `Mono` primitive for dense data — already used throughout `PipelineTab.jsx` and `jobBoards/*` per Phase 1)

### Precedent this phase's shell/rename structure is modeled on
- `.planning/phases/03-grow-discovery-funnel-merge/03-CONTEXT.md` — the shell-wraps-existing-bodies merge precedent (D-01/D-02, `GrowTab` wrapping `ExploreTab`/`ReferralCoverageTab`/`DiscoverTab`) this phase's D-02 explicitly follows, including its "no logic changes to the wrapped bodies" discipline
- `.planning/phases/04-shared-record-side-panel/04-CONTEXT.md` — confirms PANEL-01/02 (`SidePanel`, `ApplicationPanelBody`, `JobPanelBody`) already shipped and is out of this phase's scope; this phase inherits that infrastructure as-is
- `app/src/App.jsx` `NETWORK_VIEWS`/`DEMO_NETWORK_VIEWS` — the exact demo-mode view-filtering pattern D-03 reuses (a `views` prop filtered by an `isDemoMode`-aware array, not a per-render conditional)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/src/components/PipelineTab.jsx` (230 lines) — current Applications view: filter chips (Active/Needs Review/All), search, stats line (planning/active/offers counts), `DuplicatesPanel`, application list, already wired to `SidePanel` + `ApplicationPanelBody` (Phase 4). Becomes (or is renamed to) the Applications view body.
- `app/src/components/jobBoards/GitHubTab.jsx` (98 lines) — current Job Boards top-level component: `TrackedBoardsPanel` (pull-all-tracked-boards, the primary flow) + collapsed ad-hoc single-repo/profile lookup, renders `RepoJobsView` (board results, bucket system, auto-import, calendar/stats/filter bar, already wired to `SidePanel` + `JobPanelBody`) or `UserProfileView`. Becomes (or is renamed to) the Job Boards view body — no sub-component under `jobBoards/` needs to change.
- `app/src/components/layout/Sidebar.jsx` `NAV_ITEMS` (line 3-12) — currently 8 entries including separate `'pipeline'` and `'github'`; this phase removes `'github'`.
- `app/src/lib/icons.js` `NAV_ICON` — `pipeline: Kanban`, `github: GitFork` — the icon-reuse question in D-05.
- `app/src/App.jsx` lines 316-327 — current tab-render branches for `tab === 'pipeline'` (renders `PipelineTab`) and `tab === 'github'` (renders `GitHubTab`); these collapse into one `tab === 'pipeline'` branch rendering the new shell.
- `app/src/App.jsx` line 360, `DEMO_NAV_ITEMS` — already filters `NAV_ITEMS` to `['today','overview','network','pipeline']`; `'github'` was never in the demo list, confirming D-03's continuation-not-new-gap framing.

### Established Patterns
- `NETWORK_VIEWS`/`DEMO_NETWORK_VIEWS` (`App.jsx` lines ~32-40) — the exact segmented-control + demo-filtered-views pattern D-01/D-03 reuse: an array of `{key, label, icon}`, a `views` prop with a demo-filtered default, `useState` for the active view. This is the direct implementation template for planning.
- `GrowTab.jsx` (Phase 3) — the direct shell-wraps-renamed-bodies precedent for D-02; worth reading alongside its `03-CONTEXT.md`/`03-PATTERNS.md` for the exact extraction mechanics used there (e.g. how `ExploreTab` had its own header stripped when wrapped — same kind of adjustment may apply to `PipelineTab.jsx`'s/`GitHubTab.jsx`'s current top-level headers once nested under a shared shell).
- `RepoJobsView.jsx`'s auto-import `useEffect` (lines ~35-60) — already writes directly to the same `apps`/`addApplication()` data source `PipelineTab.jsx` reads from; this is the existing PIPE-03 wiring that must survive the merge untouched.

### Integration Points
- `App.jsx` — imports of `PipelineTab` and `GitHubTab` (jobBoards) are replaced by one import of the new merged shell; the `tab === 'pipeline'` render branch's props (`apps, contacts, interactions, relationships, onRefresh, onFindPeople, onRefreshRelationships`) need to also carry whatever `GitHubTab` currently receives (`apps, onImported`) plus an `isDemoMode` flag for D-03.
- `Sidebar.jsx` `NAV_ITEMS` and `App.jsx` `DEMO_NAV_ITEMS` — both need the `'github'` entry removed in the same commit (no dangling nav id).

</code_context>

<specifics>
## Specific Ideas

No specific ideas beyond what's captured in `decisions` above — this was a fully autonomous (`--auto`) discussion; all gray areas were resolved to their recommended/lowest-risk option based on the phase's own goal, existing app-wide conventions (`NETWORK_VIEWS` segmented control, demo-mode view filtering), and this milestone's established shell/rename merge precedent from Phase 3. Flag any of the `[auto]`-tagged decisions above for a quick override before planning if a different call is preferred.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope (no scope-creep suggestions arose during the automated pass). Note: ROADMAP.md's Phase 5 goal text parenthetically mentions "Applications view (Kanban/Table)" — the current Applications view is a flat sorted list, not a Kanban board, and REQUIREMENTS.md's PIPE-01 does not require adding a Kanban view. This phase preserves the existing list view as-is; building an actual Kanban board is out of scope here (not requested by any locked requirement) and would be a future-phase idea if wanted.

</deferred>

---

*Phase: 5-pipeline-job-boards-merge*
*Context gathered: 2026-08-19*
