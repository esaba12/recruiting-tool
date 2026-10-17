# Phase 5: Pipeline + Job Boards Merge - Research

**Researched:** 2026-08-19
**Domain:** React/Vite component restructuring (navigation/IA merge, zero backend change)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — View-switch UI & default view:** The merged Pipeline destination uses a segmented control (Applications | Job Boards) at the top of the page, styled to match the app's existing view-switcher convention (`NETWORK_VIEWS`-style pill/segmented control used by Network's Table/Cards/Graph/Outbox and Job Boards' own internal list/calendar toggle) rather than inventing a new nav pattern. Applications is the default view on landing.

**D-02 — Component architecture:** New top-level `PipelineTab.jsx` becomes a thin shell (view-switch chrome + which body to render), following this milestone's established shell-plus-body extraction precedent (Phase 3's `GrowTab` wrapping `ExploreTab`/`ReferralCoverageTab`/`DiscoverTab`; Phase 4's `SidePanel` wrapping per-type `*PanelBody` components). The current `PipelineTab.jsx` body (application list, filters, `DuplicatesPanel`, stats bar) is renamed/extracted to `ApplicationsView.jsx`; `jobBoards/GitHubTab.jsx`'s body is renamed to `jobBoards/JobBoardsView.jsx` (stays in the `jobBoards/` directory alongside its existing sub-components — none of which need to move or change). Neither existing body's internal logic changes — this is a rename + wrap, not a rewrite.

**D-03 — Demo-mode handling:** The Job Boards view-switch option is hidden entirely in demo mode (`isDemoMode` prop threaded down, same pattern as `DEMO_NETWORK_VIEWS` filtering `NETWORK_VIEWS`) — the merged Pipeline destination shows only the Applications view for anonymous `/demo` visitors, with no visible toggle. This is a direct continuation of current behavior (`'github'` is already absent from `DEMO_NAV_ITEMS` today). Rejected: showing the toggle with a locked/sign-up-prompt state.

**D-04 — Toolbar / filter bar:** Applications and Job Boards keep their own separate, self-contained toolbars (Applications: filter chips + search + "+ Add Application"; Job Boards: `TrackedBoardsPanel` pull-all controls, ad-hoc repo lookup, and `RepoJobsView`'s own search/location/quick-chip/closing-soon filter bar and stats bar) rather than merging into one shared filter/search control.

**D-05 (inferred) — Navigation cleanup:** `Sidebar.jsx`'s `NAV_ITEMS` loses its `'github'` entry entirely (not repointed — deleted); `'pipeline'` keeps the `Kanban` icon it already has (`lib/icons.js` `NAV_ICON`). The `'github'` entry's `GitFork` icon becomes available for reuse as the Job Boards view-switch segment's icon (planning's discretion whether to reuse it or pick a new one). `App.jsx`'s `tab === 'github'` branch is removed; `GitHubTab` import is replaced by the new `JobBoardsView` import inside the merged `PipelineTab.jsx` shell, not inside `App.jsx` directly.

### Claude's Discretion

- Exact segmented-control visual treatment (icon-only vs. icon+label, spacing) beyond "matches the existing Table/Cards/Graph convention" is implementation detail for planning.
- Whether `ApplicationsView.jsx`/`JobBoardsView.jsx` are the exact final filenames, or planning's pattern-mapper picks slightly different names, is a file-naming call — the constraint that matters is shell + renamed-unchanged-bodies, not the literal filenames.
- Whether the Job Boards view toggle reuses the existing `GitFork` icon or a different one is a visual-polish call for planning.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope (no scope-creep suggestions arose during the automated pass). Note: ROADMAP.md's Phase 5 goal text parenthetically mentions "Applications view (Kanban/Table)" — the current Applications view is a flat sorted list, not a Kanban board, and REQUIREMENTS.md's PIPE-01 does not require adding a Kanban view. This phase preserves the existing list view as-is; building an actual Kanban board is out of scope here and would be a future-phase idea if wanted.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PIPE-01 | User switches between an Applications view (Kanban/Table) and a Job Boards view within one Pipeline destination, instead of two separate top-level tabs | Architecture Patterns → Pattern 1 (segmented-control reuse of `NETWORK_VIEWS`/`DEMO_NETWORK_VIEWS`) gives the exact array shape, className, and default-view wiring; Code Examples section gives the literal current `App.jsx` render-branch diff needed to collapse `tab==='pipeline'`/`tab==='github'` into one branch |
| PIPE-02 | Existing Job Boards functionality (multi-board tracking, auto-import, real-deadline extraction, triage buckets, calendar/stats views) is fully preserved inside the merged Pipeline destination | Architecture Patterns → Pattern 3 (shell-wraps-renamed-bodies) plus Anti-Patterns and Common Pitfalls (1, 2, 4) establish the "zero logic changes to `JobBoardsView.jsx`/`RepoJobsView.jsx`, only rename + wrap" discipline and the exact prop-name traps that would silently break `onImported`/deadline-fetching/auto-import if not followed precisely |
| PIPE-03 | Job listings auto-imported from Job Boards continue to land in the Applications table with Triage='Needs Review' and continue feeding the unified Attention feed (ATTN-01) | Summary and System Architecture Diagram trace the confirmed-unmodified data path: `RepoJobsView.jsx`'s auto-import `useEffect` → `db.js`'s `addApplication()` (hardcoded `stage:'Wishlist', triage:'Needs Review'`) → `lib/attention.js`'s `needsReviewApps()` → `TodayTab.jsx`. Runtime State Inventory confirms no data-layer identifier this phase renames intersects this path. |

</phase_requirements>

## Summary

This phase is a pure component-tree reshuffle with no new packages, no data-model change, and no new external calls — every fact needed to plan it accurately comes from reading the actual current source files, which this research did directly (`app/src/App.jsx`, `PipelineTab.jsx`, `jobBoards/GitHubTab.jsx`, `jobBoards/RepoJobsView.jsx`, `layout/Sidebar.jsx`, `lib/icons.js`, `lib/attention.js`, `db.js`), not framework documentation. The governing precedent is Phase 3's `GrowTab.jsx`, which already solved the identical "shell wraps N renamed-but-otherwise-untouched bodies, one owns shared state, demo-mode filters which children are visible" problem for Explore/Coverage/Discover — this phase applies the same shape to exactly 2 children instead of 3, with the added twist of reusing the `NETWORK_VIEWS` segmented-control pattern for the view switch itself (Grow used Sections stacked vertically, not a switcher, since all 3 of its children were meant to render simultaneously — Pipeline's two views are mutually exclusive, so the closer structural precedent for the *switcher UI* is `NetworkTab`'s `NETWORK_VIEWS`/`DEMO_NETWORK_VIEWS`, not `GrowTab`).

The data flow PIPE-03 requires already exists and needs zero changes: `RepoJobsView.jsx`'s auto-import `useEffect` (lines 41-67) calls `addApplication()` from `db.js`, which hardcodes `stage: 'Wishlist', triage: 'Needs Review'` on every insert (both the Supabase and demo-mode branches, `db.js` lines 235-260+); `lib/attention.js`'s `needsReviewApps(apps)` (line 59) filters on exactly `a.triage === 'Needs Review' && a.stage === 'Wishlist'`, which is what feeds Today's unified attention count in both `App.jsx`'s `AppInner` and `DemoApp`. This wiring is entirely independent of which tab/view `RepoJobsView` is rendered under — moving it into a Pipeline sub-view changes nothing about this flow, confirmed by reading the actual insert/filter code, not assumed.

**Primary recommendation:** Build a thin `PipelineTab.jsx` shell that owns a `PIPELINE_VIEWS` array (`{key, label, icon}`, mirroring `NETWORK_VIEWS`'s exact shape) and a `useState` for the active view; rename the current `PipelineTab.jsx` body to `ApplicationsView.jsx` and `jobBoards/GitHubTab.jsx` to `jobBoards/JobBoardsView.jsx` verbatim (imports/exports only — zero internal logic edits to either); wire demo-mode by filtering `PIPELINE_VIEWS` down to `['applications']` the same way `DEMO_NETWORK_VIEWS` filters `NETWORK_VIEWS`, passed in from `DemoApp`; delete the `'github'` `NAV_ITEMS` entry and its `App.jsx` render branch in the same commit as everything else, since a dangling nav id is one of STATE.md's documented drift risks.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| View-switch chrome (segmented control, active-view state) | Browser / Client | — | Pure client-side UI state, no data dependency — same tier as `NetworkTab`'s existing `view` `useState` |
| Applications list rendering/filtering | Browser / Client | — | Renders already-fetched `apps` array passed down from `App.jsx`'s `AppInner`/`DemoApp` load() |
| Job Boards multi-board fetch/parse (`github.js`, `boardsRegistry.js`) | Browser / Client | API / Backend (`/gh-api` proxy) | Client parses README content; `/gh-api` is a thin authenticated passthrough to api.github.com, unchanged by this phase |
| Auto-import → Applications table | API / Backend (Supabase via `db.js`) | Database / Storage | `addApplication()` writes directly to Postgres (or the in-memory demo store); this phase does not touch this path at all |
| Today's unified attention count | Browser / Client (`lib/attention.js`) | — | Pure derived computation over already-fetched `apps`; unaffected by where `RepoJobsView` is mounted |
| Record editing (side panel) | Browser / Client | — | `SidePanel` + `ApplicationPanelBody`/`JobPanelBody` already ship from Phase 4, entirely out of this phase's scope |

## Standard Stack

No new libraries. This phase is a rename + wrap of existing React components using only what's already imported project-wide:

| Library | Version (confirmed installed) | Purpose | Why no change needed |
|---------|------|---------|------|
| react | ^18.3.1 | Component tree | `useState` for view-switch state — same primitive `NetworkTab`/`GrowTab` already use |
| lucide-react | ^1.23.0 | Icons | `Kanban`/`GitFork` icons already imported in `lib/icons.js`; no new icon import required unless planning picks a different glyph (Claude's discretion per D-05) |
| framer-motion | ^12.42.2 | Modal/tab transitions | Already used by `ui/Modal.jsx`/`AppShell.jsx`; not required by this phase's view switch (`NETWORK_VIEWS`'s own switcher has no animation — matching it means no new motion code either) |

**Installation:** None — no `npm install` needed for this phase.

**Version verification:** Not applicable — no new package versions to pin. Confirmed via `app/package.json` read directly (react 18.3.1, lucide-react 1.23.0, framer-motion 12.42.2, no test framework, no `@tanstack/react-table`-relevant change here since `ApplicationsView.jsx` is a flat list, not `ContactsTable.jsx`'s table).

## Package Legitimacy Audit

Not applicable — this phase introduces zero new npm/pip/cargo packages. No `npm view`/registry check was needed or run.

## Architecture Patterns

### System Architecture Diagram

```
App.jsx (AppInner / DemoApp)
  │  apps, contacts, interactions, relationships  (already fetched via db.js)
  │  onRefresh, onFindPeople, onRefreshRelationships
  │  isDemoMode (new, threaded to the shell)
  ▼
PipelineTab.jsx  ── NEW thin shell ──────────────────────────────
  │  owns: PIPELINE_VIEWS array, `view` useState (default 'applications')
  │  renders: segmented control (Applications | Job Boards)
  │            — Job Boards option hidden entirely when isDemoMode
  │
  ├─ view === 'applications' ──▶ ApplicationsView.jsx  (renamed PipelineTab.jsx body)
  │                                 - filter chips, search, stats line
  │                                 - DuplicatesPanel
  │                                 - application list → click → SidePanel
  │                                     └─▶ ApplicationPanelBody (Phase 4, unchanged)
  │
  └─ view === 'jobBoards' ─────▶ JobBoardsView.jsx  (renamed jobBoards/GitHubTab.jsx)
                                    - TrackedBoardsPanel (pull-all boards)
                                    - ad-hoc repo/profile lookup
                                    - renders RepoJobsView.jsx (unchanged)
                                        - auto-import useEffect ──▶ db.js addApplication()
                                                                      (stage:'Wishlist', triage:'Needs Review')
                                        - own filter/search/calendar/stats bar
                                        - own SidePanel → JobPanelBody (Phase 4, unchanged)

                                              ▼ (independent of which view is active)
                                    lib/attention.js needsReviewApps(apps)
                                              ▼
                                    TodayTab.jsx unified attention feed (PIPE-03, already wired)
```

A reader can trace PIPE-03's full path by following the arrows from `JobBoardsView.jsx`'s auto-import straight down to `TodayTab.jsx` — that path never passes through `PipelineTab.jsx`'s new shell at all, which is exactly why the merge cannot regress it as long as `RepoJobsView.jsx`'s internals are untouched.

### Recommended Project Structure

```
app/src/components/
├── PipelineTab.jsx              # NEW shell: segmented control + view switch, ~40-60 lines
├── ApplicationsView.jsx         # renamed from PipelineTab.jsx body — same 230 lines, header stripped if shell adds its own
└── jobBoards/
    ├── JobBoardsView.jsx        # renamed from GitHubTab.jsx — same 98 lines, unchanged
    ├── RepoJobsView.jsx         # UNCHANGED — no edits needed
    ├── TrackedBoardsPanel.jsx   # UNCHANGED
    ├── CalendarView.jsx         # UNCHANGED
    ├── RepoStats.jsx            # UNCHANGED
    ├── UserProfileView.jsx      # UNCHANGED
    ├── PreferencesPanel.jsx     # UNCHANGED
    ├── JobCard.jsx              # UNCHANGED
    └── helpers.js                # UNCHANGED
```

### Pattern 1: Segmented-control view switch (reuse `NETWORK_VIEWS`)

**What:** An array of `{key, label, icon}` objects, a `useState` for the active key, a `views` prop (defaulting to the full array) that a demo-mode caller can override with a filtered subset.

**When to use:** Exactly this phase's D-01/D-03 — mutually-exclusive view switching within one destination, with a demo-mode-aware subset.

**Example (from the actual current codebase, `App.jsx` lines 35-52):**
```jsx
// Source: app/src/App.jsx (current, unmodified) — the exact template to mirror
const NETWORK_VIEWS = [
  { key: 'table',    label: 'Table',    icon: Table2 },
  { key: 'cards',    label: 'Cards',    icon: LayoutGrid },
  { key: 'graph',    label: 'Graph',    icon: Share2 },
  { key: 'outbox',   label: 'Outbox',   icon: Send },
]
const DEMO_NETWORK_VIEWS = NETWORK_VIEWS.filter(v => ['table', 'cards', 'graph'].includes(v.key))

function NetworkTab({ ..., initialView = 'table', views = NETWORK_VIEWS }) {
  const [view, setView] = useState(initialView)
  // ...
  <div className="flex border border-ink-200 rounded-full overflow-hidden text-xs font-medium">
    {views.map(v => (
      <button key={v.key} onClick={() => setView(v.key)}
        className={`px-3 py-1 flex items-center gap-1.5 transition-colors ${view === v.key ? 'bg-ink-900 text-white' : 'bg-white text-ink-500 hover:bg-ink-50'}`}>
        <v.icon size={13} strokeWidth={2.25} />
        {v.label}
      </button>
    ))}
  </div>
}
```

**Applied to Pipeline:** define `PIPELINE_VIEWS = [{key:'applications', label:'Applications', icon: Kanban}, {key:'jobBoards', label:'Job Boards', icon: GitFork}]` and `DEMO_PIPELINE_VIEWS = PIPELINE_VIEWS.filter(v => v.key === 'applications')` either inside `PipelineTab.jsx` itself (self-contained, no `App.jsx` edit needed beyond the render branch) or in `App.jsx` next to `NETWORK_VIEWS` (matches where `NETWORK_VIEWS` currently lives). **Recommendation: define both arrays inside `PipelineTab.jsx`** — `NETWORK_VIEWS` lives in `App.jsx` only because `NetworkTab` itself is still defined inline in `App.jsx` in the current codebase; `PipelineTab.jsx` is already its own file, so co-locating its views array there is more consistent with `GrowTab.jsx`'s pattern (which defines nothing view-related in `App.jsx` at all — it just receives props).

### Pattern 2: Demo-mode threading — two viable mechanisms exist in the current codebase, pick one deliberately

Two demo-mode patterns already coexist in the app and D-03's context text ("isDemoMode prop threaded down, same pattern as DEMO_NETWORK_VIEWS") straddles both:

**Mechanism A — `views` prop filtered by the caller (`NetworkTab`'s actual mechanism):** `App.jsx`'s `DemoApp` passes `views={DEMO_NETWORK_VIEWS}` as a prop; `AppInner` passes nothing and the component's own default (`views = NETWORK_VIEWS`) applies. `NetworkTab` itself never checks a demo flag — it just renders whatever `views` array it's given.

**Mechanism B — `isDemoMode` boolean prop, checked inside the component (`TodayTab`'s actual mechanism):** `TodayTab.jsx` (line 306) takes `isDemoMode = false` directly and uses it internally (`enabled: !isDemoMode` gating `useTimelineFinds`, line 322); `DemoApp` passes `isDemoMode` explicitly, `AppInner` doesn't pass it (defaults false).

**Recommendation for `PipelineTab.jsx`: use Mechanism A (views-prop filtering), matching `NetworkTab` exactly**, since D-01 already establishes the view-switch itself must mirror `NETWORK_VIEWS`/`DEMO_NETWORK_VIEWS` — using the same filtering mechanism for both the array *and* the demo behavior keeps one consistent pattern instead of introducing `TodayTab`'s separate boolean-prop convention into a component whose defining precedent is `NetworkTab`, not `TodayTab`. Concretely: `App.jsx`'s `DemoApp` passes `views={DEMO_PIPELINE_VIEWS}` to the merged shell; `AppInner` passes nothing (default applies). No `isDemoMode` prop needs to reach `PipelineTab.jsx` at all under this approach — only the pre-filtered array does, which is one prop instead of two and can't drift out of sync with the array it filters.

### Pattern 3: Shell-wraps-renamed-bodies (Phase 3 `GrowTab.jsx` precedent)

**What:** A new top-level component owns only chrome + switch state; each former top-level tab becomes a body component that receives the exact same props it always did, unwrapped except for potentially stripping its own now-redundant header.

**When to use:** D-02's explicit instruction — this is a rename + wrap, not a rewrite.

**Example (from `GrowTab.jsx`, the actual shipped Phase 3 file):**
```jsx
// Source: app/src/components/GrowTab.jsx (current, Phase 3 shipped)
export default function GrowTab({ contacts, apps, interactions, contactRelationships, onRefresh, onRefreshRelationships, initialPeopleFocus = null }) {
  // ... owns shared state (useTargetCompanies) that all children need — see caveat below
  return (
    <div className="space-y-4">
      <Section step="01" title="Companies" icon={Building2} accent="ink">
        <ExploreTab apps={apps} onTargetAdded={goToCoverage} onFindPeople={goToPeople} targets={targets} setTargets={setTargets} loaded={targetsLoaded} />
      </Section>
      {/* ... */}
    </div>
  )
}
```

**Key difference for Pipeline vs. Grow:** Grow's 3 children all render *simultaneously* on one scrolling page (hence `Section` wrappers + `useRef`-based scroll-to), and needed a *lifted shared hook* (`useTargetCompanies`) because 3 independent copies would desync (documented as `03-REVIEW.md` CR-01). **Pipeline's 2 children are mutually exclusive (only one is ever mounted at a time)** — there is no analogous shared-state-desync risk here, since `ApplicationsView.jsx` and `JobBoardsView.jsx` don't read from a common hook the way Explore/Coverage/Discover read from `useTargetCompanies`. Both already receive `apps` as a prop from `App.jsx` and both already call `onRefresh`/`onImported` (respectively) to trigger a fresh `load()` from `App.jsx` — that's the full extent of their data coupling, and it flows through `App.jsx`, not through `PipelineTab.jsx`'s new shell. **No new shared hook or lifted state is needed in the shell** beyond the view-switch `useState` itself.

### Anti-Patterns to Avoid

- **Rendering both views' subtrees at once and hiding one with CSS:** `RepoJobsView.jsx` has active `useEffect`s (auto-import, deadline fetching) that should not run when the user is looking at Applications — mount only the active view's component, matching `NetworkTab`'s existing `view === X ? <A/> : ...` conditional-render pattern (not both branches rendered + `display:none`).
- **Lifting `ApplicationsView`'s or `JobBoardsView`'s internal `useState` up into the shell "for consistency":** D-02 explicitly forbids logic changes to the wrapped bodies. Each keeps its own `filter`/`search`/`bucket`/etc. state exactly as today; the shell only owns which one is mounted.
- **Merging the two toolbars into one:** explicitly rejected by D-04 — do not build a unified filter bar as part of this phase.
- **Reintroducing `GitHubTab`'s own outer header/margin when nesting under the new shell without checking for double-chrome:** `GrowTab`'s precedent (per `03-PATTERNS.md`, referenced in CONTEXT.md) had to strip `ExploreTab`'s own header when nesting it under `Section`. Check whether `ApplicationsView.jsx`/`JobBoardsView.jsx` render anything that would visually duplicate the new shell's own segmented-control header area (from reading the current files: neither `PipelineTab.jsx` nor `GitHubTab.jsx` currently renders an `<h1>`/page-title — both start directly with content, `DuplicatesPanel`/`TrackedBoardsPanel` respectively — so this risk is lower here than it was for Grow's `ExploreTab`, but planning should still visually verify no doubled spacing/heading after wrapping).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Segmented view-switch control | A new pill/tab styling from scratch | Copy `NETWORK_VIEWS`'s exact className string (`flex border border-ink-200 rounded-full overflow-hidden text-xs font-medium`, active state `bg-ink-900 text-white`) | Byte-for-byte visual consistency with the app's one other view-switcher (and `RepoJobsView.jsx`'s own internal list/calendar toggle, which uses a near-identical pattern) — D-01 requires matching the existing convention, not inventing a second one |
| Demo-mode feature gating | A new `if (isDemoMode) return null` scattered inside the shell's JSX | The `views` prop filtering mechanism (Pattern 2 above) | Keeps demo-mode logic at the call site (`App.jsx`) the same way `NetworkTab` does it — no new demo-detection code path inside `PipelineTab.jsx` itself |
| Auto-import → attention-feed wiring | Any new "check if this app needs review" logic | `lib/attention.js`'s existing `needsReviewApps()` | Already correct and already the single source of truth Today reads from — re-deriving it anywhere would create the exact kind of duplicate-logic drift STATE.md's Phase 2 work explicitly consolidated away from |

**Key insight:** Every piece of "new" logic this phase would naively be tempted to write (a view switcher, a demo-mode gate, an attention-feed hookup) already exists verbatim elsewhere in the codebase. The entire implementation risk is in faithfully copying/renaming, not in designing anything novel.

## Runtime State Inventory

**Trigger check:** This phase renames 2 files (`PipelineTab.jsx`→shell+`ApplicationsView.jsx`, `GitHubTab.jsx`→`JobBoardsView.jsx`) and removes a nav entry (`'github'`). It does not rename any user-facing string, data field, table, or ID — only React component file names and one internal nav-id string that is never persisted.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `applications`/`contacts`/etc. Postgres tables, RLS policies, and `Triage`/`Stage` column values are completely untouched by this phase. Verified: `db.js`'s `addApplication()`/`updateApplicationTriage()` signatures are not being changed. | None |
| Live service config | None — no n8n/Datadog/Cloudflare-style external service config references any of the renamed identifiers. | None |
| OS-registered state | None — no OS-level task/process registration involved. | None |
| Secrets/env vars | None — no env var or secret name matches `'pipeline'`, `'github'` (the nav id), or any of the file names being renamed. (`GITHUB_TOKEN` exists as a BYOK key name in `user_api_keys` but is keyed on provider `'github'` as a *data value* inside the `getUserKey(userId, provider)` call in `api/gh-api.js` — that string is unrelated to `Sidebar.jsx`'s nav-id `'github'` and is NOT touched by this phase; confirmed by reading `api/gh-api.js`'s `requireUser`/`getUserKey` call, which references the provider name `'github'` independently of any nav/routing code.) | None |
| Build artifacts | None — pure `.jsx` source renames within `app/src/`, no build config, no package renames. | None — a rename does not require reinstalling anything, since nothing is published/installed under these names. |
| `rec_*` localStorage keys (job-boards-specific, flagged as a general risk in STATE.md) | `rec_tracked_boards` (`boardsRegistry.js`), `rec_prefs` (`RepoJobsView.jsx`'s `prefsKey`), `rec_job_deadlines` (`useJobDeadlines.js`), `rec_job_blurbs` (`useJobBlurbs.js`) — **none of these keys embed the component/file name** (`'github'`, `'GitHubTab'`, `'JobBoardsView'`), they're pipeline-feature-scoped constants unrelated to file/nav naming. Confirmed by reading each constant declaration directly. | None — these keys survive the rename completely unaffected; explicitly noted here per STATE.md's "18 `rec_*` keys, any merging phase must make an explicit migrate-or-drop call" concern, resolved as **no migration needed** since nothing about this phase touches key names or key contents. |

**Canonical-question answer:** After every file in this phase is renamed/moved, nothing at runtime (Postgres rows, localStorage, env vars, OS state) still references the old `PipelineTab`/`GitHubTab` *file* names or the `'github'` *nav id* — the only place `'github'` exists as meaningful runtime state is `Sidebar.jsx`'s `NAV_ITEMS` array (in-memory JS, not persisted anywhere) and the unrelated BYOK provider-name string in `api/gh-api.js`/`user_api_keys`, which this phase does not touch.

## Common Pitfalls

### Pitfall 1: Breaking the `apps` re-render loop for cross-view freshness

**What goes wrong:** `JobBoardsView.jsx`'s auto-import calls `onImported()` (today wired to `App.jsx`'s `load()`), which refreshes the top-level `apps` array. If the merged shell's props threading accidentally passes a *stale* `apps` snapshot to `ApplicationsView.jsx` (e.g. by capturing `apps` in shell-local state instead of forwarding the live prop straight through), a job auto-imported while the user is on the Job Boards view won't show up in Applications when they switch views without a full page reload.

**Why it happens:** Easy to introduce by accident when a shell "helpfully" destructures props into local `useState` for convenience.

**How to avoid:** The shell must forward `apps` (and every other prop) straight through as-received on every render — no local copying/memoizing of `apps` inside `PipelineTab.jsx`. `GrowTab.jsx` does exactly this already (passes `apps` straight through to all 3 children with no local copy) — mirror that.

**Warning signs:** If `PipelineTab.jsx`'s function signature has a `useState(apps)` or similar, that's the bug.

### Pitfall 2: `onImported`/`onRefresh` naming mismatch across the two bodies

**What goes wrong:** `PipelineTab.jsx` (current) takes `onRefresh`; `GitHubTab.jsx` (current) takes `onImported`. Both ultimately call the same `App.jsx` `load()` function, but under different prop names. If the shell blindly renames both to one shared name without checking each body's actual prop signature, one of the two bodies will silently receive `undefined` for its refresh callback.

**Why it happens:** Superficially they look like the same concept ("refresh after a data change") so it's tempting to unify the prop name during the wrap.

**How to avoid:** Keep each renamed body's exact existing prop name (`ApplicationsView` still expects `onRefresh`; `JobBoardsView` still expects `onImported`) — the shell can call both with the same underlying `onRefresh` function from `App.jsx`, just passed under each body's own expected prop name. This is a "zero logic changes" instruction (D-02) applied literally to prop *names*, not just prop *values*.

**Warning signs:** A body's refresh button/action silently does nothing after render — check whether the callback prop it destructures actually has a value.

### Pitfall 3: Forgetting the `DEMO_NAV_ITEMS`/`Sidebar.jsx` `NAV_ITEMS` dual removal

**What goes wrong:** `'github'` is already absent from `DEMO_NAV_ITEMS` (confirmed, `App.jsx` line 360) — but `Sidebar.jsx`'s `NAV_ITEMS` (line 3-12) still has it, and `App.jsx`'s render branch (line 326) still has `{tab === 'github' && <GitHubTab .../>}`. If only the render branch is removed but `NAV_ITEMS` keeps the `'github'` entry, the sidebar shows a dead nav button that renders nothing when clicked.

**Why it happens:** Three separate places reference the `'github'` id (`Sidebar.jsx` `NAV_ITEMS`, `App.jsx`'s `AppInner` render branch, and the now-unused `GitHubTab` import) — easy to update two of three in one pass.

**How to avoid:** Grep for the literal string `'github'` across `App.jsx` and `Sidebar.jsx` as a final verification step before considering this phase's nav cleanup complete (D-05 explicitly calls out this triad).

**Warning signs:** `npm run build` still succeeds even with a dangling nav id (React doesn't error on an unmatched `tab` value — it just renders nothing), so this bug is silent, not build-breaking. Manual click-through is the only reliable check.

### Pitfall 4: `counts.pipeline` badge semantics don't change but could be misread as needing an update

**What goes wrong:** `App.jsx`'s `counts.pipeline = activeApps.length` (line 288) feeds the sidebar's badge count next to "Pipeline." Someone planning this phase might assume the merged Pipeline nav badge should now also reflect Job Boards' "needs review" count, since Job Boards is now *inside* Pipeline.

**Why it happens:** Reasonable-sounding scope creep — "the nav item covers both views now, so its badge should reflect both."

**How to avoid:** Not requested by PIPE-01/02/03 or any `[auto]` decision in `05-CONTEXT.md` — `activeApps` (line 283, `!['Rejected','Accepted'].includes(a.stage)`) already includes untriaged/needs-review Wishlist-stage apps (those default to `stage: 'Wishlist'`, which is not in the exclusion list), so **the existing `counts.pipeline` value already implicitly includes newly-auto-imported jobs** — no change needed here at all. Flagged only so planning doesn't invent unrequested badge-recalculation work.

**Warning signs:** N/A — this is a "don't touch it" pitfall, not a detection one.

## Code Examples

### Segmented control — verbatim source to adapt (confirmed current file content)

```jsx
// Source: app/src/App.jsx lines 35-40, 94-103 (current, unmodified)
const NETWORK_VIEWS = [
  { key: 'table',    label: 'Table',    icon: Table2 },
  { key: 'cards',    label: 'Cards',    icon: LayoutGrid },
  { key: 'graph',    label: 'Graph',    icon: Share2 },
  { key: 'outbox',   label: 'Outbox',   icon: Send },
]
const DEMO_NETWORK_VIEWS = NETWORK_VIEWS.filter(v => ['table', 'cards', 'graph'].includes(v.key))

// ...inside the component, `views` prop defaults to the full array:
<div className="flex border border-ink-200 rounded-full overflow-hidden text-xs font-medium">
  {views.map(v => (
    <button key={v.key} onClick={() => setView(v.key)}
      className={`px-3 py-1 flex items-center gap-1.5 transition-colors ${view === v.key ? 'bg-ink-900 text-white' : 'bg-white text-ink-500 hover:bg-ink-50'}`}>
      <v.icon size={13} strokeWidth={2.25} />
      {v.label}
    </button>
  ))}
</div>
```

### Current `App.jsx` render branches this phase must collapse (lines 320-327, confirmed current content)

```jsx
// BEFORE (current, two separate branches):
{!loading && tab === 'pipeline' && (
  <PipelineTab apps={apps} contacts={contacts} interactions={interactions} relationships={contactRelationships} onRefresh={load}
    onFindPeople={goFindPeople} onRefreshRelationships={refreshContactRelationships} />
)}
{/* ... */}
{tab === 'github'   && <GitHubTab apps={apps} onImported={load} />}

// AFTER (one branch, merged shell receives the union of both bodies' current props):
{!loading && tab === 'pipeline' && (
  <PipelineTab apps={apps} contacts={contacts} interactions={interactions} relationships={contactRelationships}
    onRefresh={load} onImported={load} onFindPeople={goFindPeople} onRefreshRelationships={refreshContactRelationships} />
)}
```

Note `onRefresh={load}` and `onImported={load}` both point at the same `load` function from `App.jsx` — per Pitfall 2, the shell threads each through to its respective body under that body's own existing prop name, unmodified.

### Demo-mode wiring — `DemoApp`'s current Pipeline render (line 407-410, confirmed current content) plus the new `views` prop

```jsx
// Current (unmodified so far):
{!loading && tab === 'pipeline' && (
  <PipelineTab apps={apps} contacts={contacts} interactions={interactions} relationships={contactRelationships} onRefresh={load}
    onRefreshRelationships={refreshContactRelationships} />
)}

// This phase adds (mirroring NetworkTab's demo call one function down, line 403-406):
// <PipelineTab ... views={DEMO_PIPELINE_VIEWS} />
// where DEMO_PIPELINE_VIEWS = PIPELINE_VIEWS.filter(v => v.key === 'applications')
// Note DemoApp has no onImported/onFindPeople today (GitHubTab was never rendered in demo) —
// once Job Boards is hidden via the views filter, JobBoardsView never mounts in demo, so
// onImported never needs to be passed for the demo path at all (avoids wiring an unused prop).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| 8 top-level `NAV_ITEMS` (`today, overview, network, grow, pipeline, calendar, github, settings`) | 7 after this phase (`'github'` removed) | This phase | Sidebar/mobile-bar shrink by one entry; NAV-01's "~5 items" target (Phase 6) gets one step closer |
| `PipelineTab.jsx` = Applications only | `PipelineTab.jsx` = shell over Applications + Job Boards | This phase | Matches Phase 3's Grow precedent — third of the milestone's planned tab-count reductions (Grow merged 3→1, this merges 2→1, Phase 6 does the final NAV-01 pass) |

**Deprecated/outdated:** None — no library or API deprecation involved in this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommendation to use Mechanism A (`views`-prop filtering) rather than Mechanism B (`isDemoMode` boolean, `TodayTab`'s pattern) for demo-mode Job Boards hiding | Architecture Patterns → Pattern 2 | Low — both mechanisms are real, already-shipped precedents in this exact codebase (confirmed by reading both `NetworkTab` and `TodayTab`); this is a stylistic recommendation for consistency with D-01's explicit `NETWORK_VIEWS`-mirroring instruction, not a correctness call. If planning instead threads `isDemoMode` as a boolean (matching `TodayTab`), that also satisfies D-03's literal wording ("isDemoMode prop threaded down") and would work equally correctly — flag for a quick confirm during planning rather than treating this recommendation as locked. |
| A2 | Co-locating `PIPELINE_VIEWS`/`DEMO_PIPELINE_VIEWS` inside `PipelineTab.jsx` rather than in `App.jsx` alongside `NETWORK_VIEWS` | Architecture Patterns → Pattern 1 | Low — purely a file-organization preference reasoned from `GrowTab.jsx` not defining any view-related constants in `App.jsx`; either location works functionally. |

**If this table is empty:** N/A — 2 low-risk stylistic assumptions logged above; nothing here is a factual/compliance/security claim requiring user confirmation before locking.

## Open Questions

1. **Exact segmented-control icon for the Job Boards view segment**
   - What we know: D-05 leaves this to planning's discretion; `GitFork` (currently `NAV_ICON.github`) is available for reuse and is semantically apt (job boards = GitHub repos).
   - What's unclear: Whether reusing `GitFork` (consistent with the removed nav icon) or picking a different lucide icon (e.g. `Briefcase`, `ListChecks`) reads better next to `Kanban` (Applications' icon) at the small `size={13}` segmented-control scale.
   - Recommendation: Default to reusing `GitFork` — zero new import, semantically consistent with 15+ months of the icon meaning "Job Boards" in this app already, and D-05 explicitly flags it as available for this exact reuse.

2. **Whether `ApplicationsView.jsx`'s and `JobBoardsView.jsx`'s outer wrapper `<div>` needs a top-margin/spacing adjustment once nested under the shell's new segmented-control header**
   - What we know: Neither current file renders its own page-title/header (both start directly at content) — lower collision risk than Grow's `ExploreTab` header-strip precedent.
   - What's unclear: Whether the shell's segmented control plus each body's own top element (e.g. `ApplicationsView`'s `DuplicatesPanel`, `JobBoardsView`'s `TrackedBoardsPanel`) will have visually appropriate spacing without a small margin tweak — this is a visual-polish call, not a structural one.
   - Recommendation: Build first, then visually verify per this project's mandatory render+screenshot check (CLAUDE.md's `frontend_aesthetics` directive) before considering the phase done; adjust spacing only if the screenshot shows a problem.

## Environment Availability

Skipped — this phase has no external tool/service/runtime dependencies beyond the already-configured local dev stack (`npm run dev`, existing Supabase project, existing `/gh-api` proxy). Nothing new to provision.

## Validation Architecture

Skipped — `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json`.

## Security Domain

Skipped — `workflow.security_enforcement` is explicitly `false` in `.planning/config.json`. (For context, not as a requirement: this phase touches zero auth/RLS/BYOK/proxy code — `RepoJobsView.jsx`'s `/gh-api` calls and `db.js`'s `addApplication()`/RLS scoping are completely unmodified, confirmed by reading both files' current content.)

## Sources

### Primary (HIGH confidence — direct repo reads this session)
- `app/src/App.jsx` (full read) — `NETWORK_VIEWS`/`DEMO_NETWORK_VIEWS`, `NAV_ITEMS`/`DEMO_NAV_ITEMS`, current `tab==='pipeline'`/`tab==='github'` render branches, `AppInner`/`DemoApp` prop shapes
- `app/src/components/PipelineTab.jsx` (full read) — current Applications view body, `DuplicatesPanel`, `SidePanel`/`ApplicationPanelBody` wiring
- `app/src/components/jobBoards/GitHubTab.jsx` (full read) — current Job Boards top-level body
- `app/src/components/jobBoards/RepoJobsView.jsx` (full read) — auto-import `useEffect`, `SidePanel`/`JobPanelBody` wiring, own filter/toolbar/calendar state
- `app/src/components/layout/Sidebar.jsx` (full read) — `NAV_ITEMS` array, `NAV_ICON` render usage
- `app/src/lib/icons.js` (full read) — `NAV_ICON.pipeline`/`NAV_ICON.github` current mapping
- `app/src/lib/attention.js` (targeted read) — `needsReviewApps()` exact filter logic
- `app/src/db.js` (targeted read) — `addApplication()`'s hardcoded `stage`/`triage` defaults, both Supabase and demo-mode branches
- `app/src/components/GrowTab.jsx` (full read) — Phase 3 shell-wraps-bodies precedent, `Section` usage, shared-hook-lifting rationale
- `app/src/components/ui/Section.jsx` (full read) — confirms `Section`/`RowCap` shape, not required by this phase's mutually-exclusive view switch but read to rule out needing it
- `app/src/components/jobBoards/helpers.js` (targeted read) — `BUCKET_CONFIG`, confirms no naming collision with this phase's rename
- `app/src/components/jobBoards/TrackedBoardsPanel.jsx` (targeted read) — confirms `rec_tracked_boards` key, no name coupling to file names
- `app/package.json` (targeted read) — confirmed react 18.3.1, lucide-react 1.23.0, framer-motion 12.42.2, no test framework installed
- `.planning/config.json` (full read) — confirmed `nyquist_validation: false`, `security_enforcement: false`

### Secondary (MEDIUM confidence)
- `.planning/phases/05-pipeline-job-boards-merge/05-CONTEXT.md` — user/discuss-phase decisions D-01 through D-05, treated as locked per the `<user_constraints>` contract
- `.planning/REQUIREMENTS.md` — PIPE-01/02/03 acceptance criteria
- `.planning/STATE.md` — cross-phase risk log (deep-link relay, `/demo` drift, `rec_*` key migration risk), all checked against this phase's actual scope and found not applicable (no deep-link relay touched, `/demo` handled via D-03, no `rec_*` key renamed)

### Tertiary (LOW confidence)
- None — no WebSearch/external documentation was needed for this phase; it is entirely internal-codebase research.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, versions confirmed directly from `package.json`
- Architecture: HIGH — every pattern cited was read directly from the actual current source files this session, not recalled from training data
- Pitfalls: HIGH — each pitfall is derived from an actual prop-name/behavior discrepancy found by reading the current `PipelineTab.jsx`/`GitHubTab.jsx`/`App.jsx` signatures side by side, not speculative

**Research date:** 2026-08-19
**Valid until:** Effectively indefinite for the structural findings (this is a same-session code read, not a fast-moving external API) — re-verify only if another phase touches `App.jsx`, `PipelineTab.jsx`, `GitHubTab.jsx`, `Sidebar.jsx`, or `lib/attention.js` before Phase 5 executes.
