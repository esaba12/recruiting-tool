# Architecture Research

**Domain:** IA consolidation + visual reskin of an existing prop-drilled, router-less React SPA (Recruiting OS dashboard)
**Researched:** 2026-08-15
**Confidence:** HIGH (grounded directly in this repo's actual files — `App.jsx`, `Sidebar.jsx`, `AppShell.jsx`, `index.css`, `db.js`, `ActionsTab.jsx`, `ExploreTab.jsx`, `ReferralCoverageTab.jsx`, `DiscoverTab.jsx`, `charts/theme.js`, `shared.jsx` — read in full or in relevant part before writing this doc) for the codebase-specific recommendations; MEDIUM for the general refactor-sequencing/router-tradeoff claims, which are corroborated by current (2026) industry writing on the Strangler Fig pattern and Tailwind v4 token migration but are otherwise standard engineering judgment, not something requiring a citation to be true.

## Standard Architecture (current state, as-is)

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│  App.jsx (root)                                                          │
│  window.location.pathname branch: '/demo' → DemoApp, '/' → AuthGate,     │
│  anything else → NotFoundPage. NOT a router — a one-time string check.   │
├──────────────────────────────────────────────────────────────────────────┤
│  AppInner()  [authenticated]         │  DemoApp()  [public, no auth]     │
│  useState('overview') tab state      │  useState('overview') tab state   │
│  load() → Promise.all(fetch*) once   │  load() → same fetch* fns, but    │
│  on mount, all 5 datasets held as    │  db.js's isDemoMode() branch      │
│  module-level React state, passed    │  redirects every one to an        │
│  down as props to whichever tab is   │  in-memory seeded clone           │
│  active                              │                                    │
├───────────────┬───────────────────────────────────┬──────────────────────┤
│  AppShell.jsx  (shared by both AppInner & DemoApp)                       │
│  Sidebar.jsx — NAV_ITEMS-driven, takes `navItems` prop override for demo │
├──────────────────────────────────────────────────────────────────────────┤
│  8 top-level tabs, rendered via {tab === 'x' && <XTab .../>} branches:   │
│  Overview · Network(7 sub-views) · Explore · Pipeline · Actions ·        │
│  Calendar · Job Boards(github) · Settings                                │
├──────────────────────────────────────────────────────────────────────────┤
│  db.js  — Supabase client, RLS-scoped fetch*/add*/update*, with an       │
│  isDemoMode() branch at the top of EVERY exported function               │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities (current)

| Component | Responsibility | File | Lines |
|-----------|-----------------|------|-------|
| `App.jsx` | Root routing (pathname string check), `AppInner`/`DemoApp` top-level state, data load, `NetworkTab` (inline) | `app/src/App.jsx` | ~454 |
| `Sidebar.jsx` | `NAV_ITEMS` source of truth, desktop rail + mobile bottom bar, quick-action buttons | `app/src/components/layout/Sidebar.jsx` | 121 |
| `AppShell.jsx` | Shell layout, tab-switch fade (`framer-motion`), demo banner, error banner | `app/src/components/layout/AppShell.jsx` | 54 |
| `OverviewTab.jsx` | KPI cards, funnel/donut/trend charts, one of 5 "needs attention" surfaces (nudges) | `app/src/components/OverviewTab.jsx` | 196 |
| `ActionsTab.jsx` | Overdue follow-ups, stale apps, OA due dates, schedule queue, high-urgency contacts — derivation + row rendering are NOT separated (inline in the same file) | `app/src/components/ActionsTab.jsx` | 293 |
| `ExploreTab.jsx` | Company discovery (Exa+YC+Claude ranking), target-company add | `app/src/components/ExploreTab.jsx` | 295 |
| `ReferralCoverageTab.jsx` | Target-company × contacts gap analysis, `onFindPeople` deep-link | `app/src/components/ReferralCoverageTab.jsx` | 159 |
| `DiscoverTab.jsx` | People discovery (Exa+Claude), `focus` prop for company-scoped search | `app/src/components/DiscoverTab.jsx` | 521 |
| `KeepInTouchTab.jsx` | Reconnect-cadence queue (own attention surface) | `app/src/components/KeepInTouchTab.jsx` | 93 |
| `PipelineTab.jsx` | Application funnel, `DuplicatesPanel` | `app/src/components/PipelineTab.jsx` | 226 |
| `jobBoards/GitHubTab.jsx` + `jobBoards/RepoJobsView.jsx` | Board tracking, auto-import, Needs-Review bucket (own attention surface) | `app/src/components/jobBoards/*.jsx` | 98 + 342 |
| `CalendarTab.jsx` + `TimelineFindsPanel.jsx` | Calendar views, timeline-scan-for-events panel (own attention surface, buried) | `app/src/components/CalendarTab.jsx` / `TimelineFindsPanel.jsx` | 375 + 151 |
| `SettingsTab.jsx` | BYOK keys, profile, Calendar connect | `app/src/components/SettingsTab.jsx` | 291 |
| `db.js` | Supabase RLS-scoped CRUD + `isDemoMode()` branch on every export | `app/src/db.js` | — |
| `shared.jsx` | Cross-cutting derivation (`isUntriaged`, `isOverdue`, `isStaleApplication`, `findDuplicateGroups`) + `Badge`/`EmptyState` re-exports | `app/src/shared.jsx` | — |
| `charts/theme.js` | Hand-maintained hex-string mirror of `index.css`'s `@theme` tokens, because Recharts needs real hex, not Tailwind classes | `app/src/components/charts/theme.js` | 49 |

**Key existing pattern worth preserving:** `NetworkTab` (inline in `App.jsx`) already IS the pattern the roadmap needs for `Grow` and `Pipeline+JobBoards` — a shell component holding local `view` state, a segmented control, `{view === 'x' && <XBody/>}` branches, and a `views` prop (defaulting to the full list, overridable by `DemoApp` to a trimmed list). This exact shape should be reused, not reinvented, for every merge in this milestone.

## Recommended Target Structure

```
app/src/
├── App.jsx                      # root routing (unchanged: pathname check), AppInner/DemoApp,
│                                 # NAV_ITEMS wiring — tab count drops from 8 to 5
├── components/
│   ├── TodayTab.jsx              # NEW — merges OverviewTab (KPIs/charts) + ActionsTab (queues)
│   │                             #   + summary cards for KeepInTouch/JobBoards-NeedsReview/
│   │                             #   TimelineFindsPanel, each "see all →" deep-linking out
│   ├── attention/                # NEW subfolder — presentational row components extracted
│   │   ├── ActionRows.jsx        #   from ActionsTab.jsx (OverdueContactRow, ScheduleQueueRow,
│   │   │                         #   OaRow, ActionRow, Section) — reused by both TodayTab
│   │   │                         #   (compact) and the full Actions view reached via "see all"
│   │   └── ActionsTab.jsx        #   kept as the "full list" destination TodayTab links to —
│   │                             #   NOT deleted, just no longer a top-level nav tab
│   ├── GrowTab.jsx                # NEW — shell around existing ExploreTab/ReferralCoverageTab/
│   │                             #   DiscoverTab bodies behind local `view` state, mirroring
│   │                             #   NetworkTab's exact shape (segmented control + `views` prop)
│   ├── ExploreTab.jsx             # UNCHANGED internals — becomes Grow's "Companies" view body
│   ├── ReferralCoverageTab.jsx    # UNCHANGED internals — becomes Grow's "Coverage" view body
│   ├── DiscoverTab.jsx            # UNCHANGED internals — becomes Grow's "People" view body
│   ├── PipelineTab.jsx            # gains a local `view` state (Applications | Job Boards),
│   │                             #   mirroring NetworkTab; Job Boards body = existing GitHubTab
│   ├── jobBoards/GitHubTab.jsx    # UNCHANGED internals — becomes Pipeline's "Job Boards" view
│   ├── CalendarTab.jsx            # unchanged as a top-level destination
│   ├── SettingsTab.jsx            # unchanged internals — reached via footer/profile affordance,
│   │                             #   not primary NAV_ITEMS (see Router/Nav section below)
│   └── layout/
│       ├── Sidebar.jsx            # NAV_ITEMS trimmed to 5; Settings link moves to footer block
│       └── AppShell.jsx           # unchanged structurally
├── lib/
│   ├── attentionFeed.js           # NEW — pure derivation extracted from ActionsTab.jsx's inline
│   │                             #   filters (oaDueApps, scheduleContacts, overdueContacts,
│   │                             #   staleApps, highUrgencyContacts) as one exported function,
│   │                             #   so TodayTab and the full Actions view never compute this
│   │                             #   twice or drift
│   ├── keepInTouch.js             # UNCHANGED — already a pure derivation module; TodayTab just
│   │                             #   imports keepInTouchQueue() the same way KeepInTouchTab does
│   ├── timelineFinder.js          # UNCHANGED — already separates find-logic from the
│   │                             #   write-to-Calendar UI in TimelineFindsPanel.jsx; TodayTab
│   │                             #   imports the same pure function for a count/preview only
│   └── (isUntriaged in shared.jsx)# UNCHANGED — TodayTab's Job-Boards-Needs-Review card is just
│                                 #   `apps.filter(isUntriaged)` — no jobBoards/ import needed
├── index.css                      # @theme token VALUES change (industrial palette); token
│                                 #   NAMES (ink-*, accent-*, success/warning/danger-*) unchanged
└── components/charts/theme.js     # hex literals MUST be updated in lockstep with index.css —
                                  #   this file is a manually-synced mirror, not derived at
                                  #   build time (Recharts needs real hex strings)
```

### Structure Rationale

- **`attention/` subfolder, not a rewrite of `ActionsTab.jsx`:** the row-rendering components (`OverdueContactRow`, `ScheduleQueueRow`, `OaRow`, `ActionRow`, `Section`) are currently private (unexported) functions inside `ActionsTab.jsx`. Extracting them to `attention/ActionRows.jsx` and exporting them is a mechanical, low-risk move — no logic changes, just moving function declarations and adding `export`. This is what makes `TodayTab.jsx` possible without duplicating ~150 lines of row-rendering JSX.
- **`lib/attentionFeed.js` for derivation, separate from the row components:** `ActionsTab.jsx` currently interleaves "which items qualify" (filter/sort logic) with "how to render one item" (JSX) in the same file. Splitting these means `TodayTab.jsx` can request just the *counts* and a *slice* (e.g. top 3 overdue) for a compact card, while the full Actions view requests the complete lists — both from one source of truth, avoiding the classic "attention feed says 5 but Actions tab shows 4" bug class merges like this are prone to.
- **`GrowTab.jsx` as a thin shell, not a merge of the 3 components' internals:** `ExploreTab.jsx`, `ReferralCoverageTab.jsx`, and `DiscoverTab.jsx` already share `useTargetCompanies()` and already pass `onFindPeople` callbacks between each other via `App.jsx`'s `goFindPeople` — the data layer is already unified. The only thing actually duplicated today is *navigation* (3 separate top-level/sub-view destinations for what's conceptually one funnel). A shell-only merge captures 100% of the requested UX win with near-zero regression risk, because none of the 3 components' internal logic changes.
- **Pipeline + Job Boards as a `view` switch inside `PipelineTab.jsx`, not a data merge:** `RepoJobsView.jsx` already writes into the same `applications` table via `updateApplicationTriage`/`addApplication` that `PipelineTab.jsx` reads. The two are not overlapping *data* (that would be out of scope per PROJECT.md), they're overlapping *destinations* for the same underlying rows — exactly the kind of merge this milestone is for.

## Architectural Patterns

### Pattern 1: Shell-with-`views`-prop (existing pattern, reuse it)

**What:** A top-level tab component holds its own `useState` for which internal sub-view is active, renders a segmented control, and accepts a `views` prop (defaulting to the full list) so callers can render a trimmed subset.
**When to use:** Any time 2+ formerly-separate destinations are merged into one nav item (Grow, Pipeline+JobBoards).
**Trade-offs:** Zero new abstractions to learn (already proven by `NetworkTab`); the cost is that the merged component's local state can't be deep-linked via URL (no router) — cross-tab links must go through parent-owned state like `App.jsx`'s `networkInitialView`/`networkFocusCompany` today.

**Example (from the actual codebase — this is the pattern to replicate for `GrowTab`):**
```jsx
// App.jsx already does this for Network; PipelineTab/GrowTab should copy it exactly
function NetworkTab({ ..., initialView = 'table', views = NETWORK_VIEWS }) {
  const [view, setView] = useState(initialView)
  return (
    <div>
      <SegmentedControl views={views} value={view} onChange={setView} />
      {view === 'discover' ? <DiscoverTab .../> : view === 'coverage' ? <ReferralCoverageTab .../> : ...}
    </div>
  )
}
```

### Pattern 2: Extract-derivation-before-merging-UI

**What:** Before building a component that needs to summarize data another component already derives (e.g. `TodayTab` needing `ActionsTab`'s overdue/stale/OA logic), pull the derivation into a pure `lib/*.js` function first, as its own commit/phase, with the existing component's rendering unchanged and verified identical.
**When to use:** Any "unify N attention surfaces into one" merge — this repo already has 2 good examples to follow: `shared.jsx`'s `isUntriaged`/`isOverdue`/`isStaleApplication` and `lib/keepInTouch.js`'s `keepInTouchQueue()` are both already pure, prop-in/array-out functions consumed by multiple components.
**Trade-offs:** Adds one extra phase/commit vs. directly building the merged UI, but makes the merge phase itself nearly risk-free (pure UI composition over already-tested derivation) and prevents logic drift between the compact and full views of the same data.

### Pattern 3: Token-value-only reskin vs. token-schema reskin (Tailwind v4 `@theme`)

**What:** Tailwind v4's `@theme` block in `index.css` defines CSS custom properties (`--color-ink-500: #64646d`) that utility classes (`text-ink-500`) resolve against at build time. Two very different kinds of "reskin" are possible:
1. **Value-only** — keep the exact same token *names* (`ink-50`...`ink-900`, `accent-50`...`accent-900`, `success/warning/danger-*`) but change their hex values. Every one of the ~50 files using `ink-500`/`accent-600` etc. directly needs **zero edits** — they keep compiling, just render new colors.
2. **Schema change** — add/rename/remove token families (e.g. introducing a new `mono`/`signal` accent scale for the industrial look, or renaming `ink` → `panel`). This *does* require touching every call site, because Tailwind v4 has no aliasing mechanism for renamed custom theme keys.
**When to use:** Default to (1) for anything that can be expressed as "same slots, new colors" — this is the 90% case for a palette/mood change. Reserve (2) for genuinely new visual primitives the industrial aesthetic needs (e.g. a dedicated data/mono accent), and do it in one dedicated late-stage phase after the IA merge, not per-screen as you go.
**Trade-offs:** (1) is nearly risk-free and can land anytime, independent of the IA work. (2) is the expensive, high-file-count work — sequencing it last (Phase C below) means you touch the final merged component tree once, not the pre-merge tree and then the post-merge tree again.

**Example:**
```css
/* index.css — value-only change, zero call-site edits needed anywhere in app/src */
@theme {
  --color-ink-900: #16171d;   /* was warm charcoal → e.g. becomes near-black w/ green tint for control-panel look */
  --color-accent-500: #f2994a; /* was warm amber → e.g. becomes signal-amber or phosphor-green */
}
```

## Data Flow

### Request Flow (unchanged by this milestone — confirm, don't touch)

```
App.jsx mount
    ↓
load() → Promise.all([fetchContacts, fetchApplications, fetchInteractions, fetchCalls, fetchContactRelationships])
    ↓                                              ↓ (isDemoMode() branch inside EVERY db.js export)
db.js → Supabase (RLS-scoped)          OR          in-memory demoData.js clone
    ↓
AppInner/DemoApp module state (contacts, apps, interactions, calls, contactRelationships)
    ↓ (props, all datasets, to every active tab — no per-route fetching)
Whichever tab is active — including the NEW TodayTab/GrowTab shells, which need no new fetches
```

**This is the most important data-flow fact for this milestone:** because `App.jsx` already loads all 5 datasets once and holds them as flat state passed to *every* tab, a cross-cutting view like `TodayTab` (which needs contacts + apps + interactions + calls simultaneously) requires **zero new data-fetching code** — it's strictly a new consumer of props that already exist at the call site in `App.jsx`. This is unlike a typical router-based app where a new merged route would need its own data-loading boundary.

### State Management

```
App.jsx: useState('overview')                    [tab — becomes 5-way instead of 8-way]
  + useState for cross-tab deep-link hints        [networkInitialView, networkFocusCompany —
                                                     same pattern extends to Grow's initial view]
    ↓ (props: activeTab, onTabChange=setTab)
AppShell → Sidebar                                [renders NAV_ITEMS, calls onTabChange]
    ↓ ({tab === 'x' && <XTab/>} branch in AppInner/DemoApp)
XTab (e.g. GrowTab, PipelineTab)                  [owns its OWN local `view` state — not lifted
                                                     to App.jsx, exactly like NetworkTab today]
```

### Key Data Flows

1. **Cross-tab deep-link (existing, extend don't replace):** `App.jsx`'s `goFindPeople(company)` sets 2-3 pieces of parent state (`networkFocusCompany`, `networkInitialView`, `tab`) in one call, then `NetworkTab` reads `initialFocusCompany`/`initialView` as its `useState` initializers. For `GrowTab`, the same pattern applies: a `goToGrowView(view, params)` helper in `App.jsx` sets `tab='grow'` plus whatever `GrowTab` needs as initial props (e.g. `initialView='discover'`, `initialFocusCompany`).
2. **Attention-feed summarization (new):** `TodayTab` calls the same `lib/attentionFeed.js`, `lib/keepInTouch.js`, `shared.jsx#isUntriaged`, and `lib/timelineFinder.js` functions that their respective full-detail destinations (`ActionsTab`/reachable-from-Today, `KeepInTouchTab` inside Network, Pipeline's Job-Boards view, `CalendarTab`) already call — one derivation, two consumers (compact card + full list), never two derivations.
3. **Demo-mode parity (existing, must extend correctly):** `DemoApp` and `AppInner` both branch on the exact same `tab === 'x'` strings and the exact same imported components — `DemoApp` never forks a separate copy. Every new shell component (`TodayTab`, `GrowTab`, restructured `PipelineTab`) must accept a `views`/`navItems`-style trimming prop so `DemoApp` can exclude AI/BYOK-dependent sub-views without forking the component, exactly as `NetworkTab`'s `views` prop does today.

## Scaling Considerations

Not a traditional "users/load" scaling question (this is a solo/personal-scale CRM) — scaling here means **file-count / change-surface-area** scaling for the reskin and merge, which is the real risk in this milestone.

| Concern | Value-only token reskin | IA merge (shells) | Full per-screen reskin |
|---------|--------------------------|---------------------|--------------------------|
| Files touched | 1 (`index.css`) + 1 (`charts/theme.js`, hand-synced) | ~5-8 new/changed shell + routing files | ~50+ files (every `ink-*`/`accent-*` call site) |
| Risk of regression | Very low (compiles unchanged) | Low-medium (pure composition, but must preserve demo-mode `views` prop pattern everywhere) | Medium (large diff surface, but mechanical find/replace-shaped) |
| Recommended sequencing | First (or in parallel) | Second | Last |

### Sequencing Priorities

1. **First risk to retire: `charts/theme.js` hex drift.** This file is a manually-maintained hex mirror of `index.css`'s tokens (Recharts can't consume CSS custom properties for series colors reliably across all its internals). Any token-value reskin phase must include updating this file's literals in the same commit, and re-running the repo's `dataviz` skill's six-check palette validator against the new values (the file's own comments document prior contrast/CVD-failure history — a new palette needs the same audit, not just an eyeball check).
2. **Second risk to retire: demo-route drift.** Every merge phase must update `DemoApp`'s trimming props (`DEMO_NAV_ITEMS`, and the new `views`-prop equivalents for `GrowTab`/restructured `PipelineTab`) in the *same* commit as the merge itself — not a follow-up — because a stale trimming list either silently 401s a demo visitor (AI-dependent sub-view exposed) or silently hides a now-safe sub-view (over-trimmed).

## Anti-Patterns

### Anti-Pattern 1: Reskinning per-screen before the IA merge lands

**What people do:** Start the visual reskin by going file-by-file through `ActionsTab.jsx`, `ExploreTab.jsx`, `ReferralCoverageTab.jsx`, `DiscoverTab.jsx` etc. applying the new industrial look, then separately do the IA merge.
**Why it's wrong:** Several of those files are about to be deleted as top-level destinations (`ActionsTab.jsx`'s rows move into `attention/`, `ExploreTab`/`ReferralCoverageTab`/`DiscoverTab` become sub-views of `GrowTab`) or restructured (`PipelineTab.jsx` gains a view switch). Reskinning them first means re-doing the same visual work again on whatever shell/wrapper JSX gets added during the merge, and risks losing reskin work in the diff noise of a structural move.
**Do this instead:** Value-only token change first (near-zero per-file cost, see Pattern 3), then the structural merge, then one full per-screen reskin pass over the *final* component tree.

### Anti-Pattern 2: Duplicating attention-derivation logic into the new Today view

**What people do:** Write fresh filter/sort logic inside `TodayTab.jsx` for "what's overdue," "what's stale," "what needs review" instead of importing the existing functions.
**Why it's wrong:** This repo already has 5 different places computing overlapping "needs attention" conditions (`OverviewTab`'s nudges, `ActionsTab`'s 5 inline filters, `KeepInTouchTab`'s queue, Job Boards' Triage bucket counts, `TimelineFindsPanel`'s scan) — that fragmentation is the exact problem PROJECT.md calls out. Writing a 6th independent implementation inside `TodayTab` doesn't fix the fragmentation, it adds to it, and creates a new class of bug (Today disagrees with the full-detail view it links to).
**Do this instead:** Extract once (`lib/attentionFeed.js`, reuse `lib/keepInTouch.js`, reuse `shared.jsx#isUntriaged`, reuse `lib/timelineFinder.js`), consume from both the compact and full views.

### Anti-Pattern 3: Forking demo-specific component variants

**What people do:** When a merged component (`GrowTab`, restructured `PipelineTab`) has sub-views that aren't demo-safe, build a `GrowTabDemo.jsx` or add `if (isDemo)` branches inside the component itself.
**Why it's wrong:** This is exactly what the existing architecture deliberately avoids — `db.js`'s `isDemoMode()` branch and `NetworkTab`'s `views` prop already solve "same component, different exposed surface" without forking or branching on demo-ness inside business components. PROJECT.md's compatibility constraint explicitly requires keeping this pattern.
**Do this instead:** Every new shell gets a `views`/`navItems`-shaped prop with a full default; `DemoApp` passes a trimmed list. No component should ever import or check `isDemoMode()` itself outside of `db.js`.

## Integration Points

### External Services (unchanged by this milestone — listed for completeness/blast-radius awareness)

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Postgres (`db.js`) | RLS-scoped fetch/write, `isDemoMode()` branch per export | Not touched this milestone — every merge is a pure consumer of existing `fetch*` shapes |
| Recharts (`charts/*.jsx` + `charts/theme.js`) | Hand-synced hex mirror of `@theme` tokens | Must be updated in the same commit as any token-value reskin (see Sequencing Priorities #1) |
| Google Calendar API (`CalendarTab`, `TimelineFindsPanel`) | Per-user OAuth, requires `requireUser()` | Not demo-safe; Calendar stays excluded from `/demo` regardless of IA changes |
| Exa / Claude / OpenAI (Grow's 3 merged sub-views) | BYOK, `requireUser()`-gated proxies | Not demo-safe; `GrowTab` must be fully excluded from `DEMO_NAV_ITEMS`, same as `Explore`/`Discover` are today |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `App.jsx` ↔ `TodayTab`/`GrowTab`/`PipelineTab` (merged shells) | Props down (data) + closure callbacks down (deep-link hints: `initialView`, `initialFocusCompany`) | Same mechanism as today's `goFindPeople`/`onOpenGraph`/`onOpenActions` — extend, don't replace |
| `GrowTab` ↔ its 3 sub-view bodies (`ExploreTab`/`ReferralCoverageTab`/`DiscoverTab`) | Local `view` useState + `views` prop, mirroring `NetworkTab` | No new prop-drilling depth — these 3 already receive `apps`/`contacts`/`interactions` from the same level `NetworkTab`'s sub-views do today |
| `PipelineTab` ↔ `jobBoards/GitHubTab` (as a new sub-view) | Same `apps` prop, same `onImported`/`onRefresh` callback shape already used at the top level | `GitHubTab`'s internals (`RepoJobsView`, auto-import) are untouched; only its mount point moves |
| `index.css` (`@theme`) ↔ `charts/theme.js` | Manual hex-value sync, NOT automatic | Documented risk — flag in every reskin-phase plan/checklist |
| `App.jsx` ↔ `DemoApp` | Structural duplication of the `{tab === 'x' && <X/>}` render branches, kept intentionally in sync by convention (not shared code) | Every new/renamed tab requires editing both `AppInner`'s and `DemoApp`'s render blocks — this is already true today (`NetworkGraphTab`, `PipelineTab`, `ActionsTab` all appear in both) and isn't made worse by this milestone, but is worth calling out explicitly in phase plans as a "don't forget to update DemoApp too" checklist item |

## Router Decision (explicit answer to the milestone's open question)

**Verdict: do not introduce a client router this milestone.**

**Reasoning:**
1. **Scope fit.** PROJECT.md scopes this milestone to IA + visual layer and explicitly excludes "backend/data-model restructuring" and unrelated architecture changes. A router isn't backend, but it touches the same category of risk PROJECT.md is protecting against: it would require changes to `App.jsx`'s pathname check, `NotFoundPage.jsx`'s "any non-`/` path is unknown" behavior, `vercel.json`'s catch-all SPA rewrite (already order-sensitive against the `/claude-api`, `/exa`, etc. proxy rewrites), and `DemoApp`'s `pathname.startsWith('/demo')` branch — four systems outside `components/`/`index.css` that this milestone's constraints say should stay untouched.
2. **The existing pattern already scales to what's needed.** `goFindPeople`/`onOpenGraph`/`onOpenActions` prove that "component A needs to jump to a specific sub-view of component B" already works cleanly via closures + `useState` initializers, with zero routing library. `GrowTab` and the merged `PipelineTab` need exactly this same capability, at the same scale (a handful of cross-tab links), not a new capability class.
3. **Nothing in the requirements asks for URL-addressability.** PROJECT.md's Active requirements are entirely about consolidation and visual identity — no requirement mentions bookmarkable/shareable links, browser back/forward between tabs, or SEO. Introducing a router to solve a problem that isn't in scope is speculative complexity, not a fix for anything broken today.
4. **Cost is asymmetric.** The router migration would touch routing config, deploy config, demo-mode branching, and every tab-switch call site — a large, cross-cutting change — in exchange for a capability nobody asked for this cycle.

**If URL-addressability becomes a real ask in a future milestone**, the lower-risk path is not `react-router` but manually syncing the existing flat `tab`/`view` string state to `history.pushState`/`location.hash` (or `URLSearchParams`) via one `useEffect` + one `popstate` listener in `App.jsx` — additive to the current `{tab === 'x' && <X/>}` branching rather than a replacement of it, and doesn't require touching `vercel.json`, `NotFoundPage.jsx`, or the demo-mode pathname check. Flag this as a fast-follow candidate for a later milestone, not now.

## Suggested Build Order (roadmap-facing)

**Reskin-vs-restructure sequencing answer: token *values* first, structural IA merge second, full per-screen reskin last.** Rationale is in Pattern 3 and Anti-Pattern 1 above — token-value changes are nearly free and orthogonal to structure, so there's no reason to gate them behind the merge; but the expensive, high-file-count part of the reskin (new token families, per-screen application of the industrial look) should happen once, against the final merged tree, not twice.

1. **Phase: Token-value reskin + `ui/` primitives pass.** Change `@theme` hex values under existing token names (`ink-*`, `accent-*`, `success/warning/danger-*`) to the industrial/control-panel palette; update `charts/theme.js` hex literals in the same phase and re-run the `dataviz` palette validator; restyle the 9 `ui/` primitives (`Button`, `Badge`, `Card`, `Tabs`, `Input`, `Select`, `Modal`, `EmptyState`, `ChipToggleGroup`) since every screen already composes from these. Verify via render+screenshot per the user's global aesthetic standard. Zero IA risk — can run independent of/before anything else.
2. **Phase: Extract attention-derivation logic.** Pull `ActionsTab.jsx`'s 5 inline filter/sort blocks into `lib/attentionFeed.js`; extract its row components into `attention/ActionRows.jsx`. No visible UI change — this phase is a refactor with a "renders identically" verification gate, done before building `TodayTab` so the merge phase itself is pure composition.
3. **Phase: Build `TodayTab` (Overview + Actions merge).** Compose KPI/chart section (from `OverviewTab`) + attention cards (from Phase 2's extracted logic, plus `keepInTouchQueue()`, `isUntriaged(apps)`, and `timelineFinder.js`'s find-count) with "see all →" links. Update `App.jsx`'s `NAV_ITEMS`/`tab` wiring and `DemoApp`'s `DEMO_NAV_ITEMS` in the same phase.
4. **Phase: Build `GrowTab` (Explore + Coverage + Discover merge).** Shell with local `view` state wrapping the 3 existing component bodies unchanged; repoint `goFindPeople`-style callbacks; remove `coverage`/`discover` from `NETWORK_VIEWS`. `GrowTab` stays fully excluded from `DEMO_NAV_ITEMS`.
5. **Phase: Fold Job Boards into Pipeline as a `view` switch.** Mirrors Phase 4's shell pattern exactly. Update `NAV_ITEMS`, thread a `views` prop through for future demo-safety even though Job Boards stays demo-excluded today.
6. **Phase: Move Settings out of primary `NAV_ITEMS`** into the sidebar footer/profile affordance (small, mechanical — `SettingsTab.jsx` itself is untouched). This is what gets the nav count from 6 down to the target ~5: **Today, Network, Grow, Pipeline (incl. Job Boards), Calendar.**
7. **Phase: Full per-screen reskin pass.** Now that the component tree is final, go through the ~50 files with direct `ink-*`/`accent-*` usage (`QuickCaptureModal.jsx`, `ApplicationDetailModal.jsx`, `ContactDetailModal.jsx`, `LogInteractionModal.jsx`, `AddToCalendarModal.jsx`, etc.) and apply the deeper industrial treatment — new token families if needed (e.g. a dedicated mono/data-accent scale), sharper borders/radii, the motion system. This is the expensive, high-file-count phase; doing it last means it's applied once.
8. **Deferred, not this milestone:** URL-sync fast-follow (see Router Decision above), if bookmarkability becomes a real requirement later.

**Fallback if Phase 5 (Job Boards→Pipeline) is judged too disruptive for one cycle:** skip it and keep Job Boards as its own top-level tab. Combined with Phase 6 (Settings out of primary nav), that still lands at 6 primary destinations — down from 8, a smaller but still real win, with Job Boards' merge deferred to a later milestone.

## Sources

- This repository: `app/src/App.jsx`, `app/src/components/layout/Sidebar.jsx`, `app/src/components/layout/AppShell.jsx`, `app/src/index.css`, `app/src/db.js`, `app/src/components/ActionsTab.jsx`, `app/src/components/OverviewTab.jsx`, `app/src/components/ExploreTab.jsx`, `app/src/components/ReferralCoverageTab.jsx`, `app/src/components/DiscoverTab.jsx`, `app/src/components/charts/theme.js`, `app/src/shared.jsx`, `app/src/components/jobBoards/RepoJobsView.jsx` (read directly for this research)
- `/Users/ethansaba/code/recruiter/.planning/PROJECT.md` (milestone scope, constraints, key decisions)
- `/Users/ethansaba/code/recruiter/CLAUDE.md` (project architecture reference, treated as authoritative per PROJECT.md's Context section)
- [Strangler Fig Pattern (Martin Fowler)](https://martinfowler.com/articles/strangler-fig-mobile-apps.html) and current (2026) industry write-ups on incremental frontend modernization — general corroboration for "extract-before-merge," "shell around unchanged internals," and "avoid big-bang rewrites" sequencing: [The Strangler Architecture Pattern for Modernization](https://vfunction.com/blog/strangler-architecture-pattern-for-modernization/), [How Teams Incrementally Modernize Large Frontend Codebases](https://altersquare.io/how-teams-incrementally-modernize-large-frontend-codebases/)
- Current (2026) Tailwind v4 `@theme`/design-token migration guidance — corroboration for "token-value changes require zero call-site edits, token-schema/rename changes require touching every call site": [Tailwind CSS v4 Migration Guide: What Changed and How to Upgrade](https://dev.to/umesh_malik/tailwindcss-v4-migration-guide-what-changed-and-how-to-upgrade-525g), [Tailwind v4 Design Tokens Migration Guide 2026](https://www.oneminutebranding.com/blog/tailwind-v4-design-tokens)

---
*Architecture research for: IA consolidation + visual reskin, Recruiting OS dashboard*
*Researched: 2026-08-15*
