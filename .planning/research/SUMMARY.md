# Project Research Summary

**Project:** Recruiting OS — UI/UX Overhaul Milestone
**Domain:** IA consolidation + full visual reskin of an existing, live, single-maintainer React/Vite recruiting CRM
**Researched:** 2026-08-15
**Confidence:** MEDIUM-HIGH

## Executive Summary

This milestone is not a rebuild — it's a strangler-style consolidation and reskin of an app whose data layer, auth, and AI proxies are already solid. Research converges on one clear approach: collapse the current 8 top-level tabs (plus Network's 7 buried sub-views) down to ~4-5 workflow-shaped destinations (Today, Network, Grow, Pipeline+Job Boards, Calendar, with Settings demoted to a footer affordance), using a shell-with-`views`-prop pattern the codebase already proves out via `NetworkTab`. The three headline merges — a unified "what needs attention" front door (replacing Overview nudges + Actions + Keep in Touch + Job Boards Needs Review + TimelineFindsPanel), a single Explore→Coverage→Discover funnel, and Pipeline absorbing Job Boards as a view — all reuse existing data-fetching and derivation logic (`db.js`, `lib/keepInTouch.js`, `shared.jsx#isUntriaged`, `lib/timelineFinder.js`) with zero new backend work. No client router is needed; the existing closure/prop-relay pattern (`goFindPeople`, lifted `{target, ts}` state) already scales to what's required, and introducing one would touch out-of-scope systems (`vercel.json`, `NotFoundPage.jsx`, demo-mode pathname branching) for no requirement that actually needs URL-addressability.

The visual reskin should commit to industrial/control-panel via **re-weighting the already-installed stack**, not new dependencies: promote IBM Plex Mono (currently "reserved, barely used") to the primary data/instrument typeface, keep Space Grotesk for display, restyle the 9 shared `ui/` primitives, apply tabular numerals and subtle 1px structural borders, and swap `@theme` token *values* under the same token *names* (near-zero-risk, compiles unchanged everywhere). The only new dependency worth adding is a mechanical rename from `framer-motion` to its successor package `motion` (identical API, import-path swap only) — no second animation library, no new font family, no Tailwind pattern plugin needed.

The dominant risk in this milestone isn't technical unfamiliarity — it's regression in things that don't fail loudly: the cross-tab deep-link relay (`onFindPeople`/`focusCompany`/the `ts: Date.now()` re-trigger trick) breaking silently when components are relocated; the public `/demo` route's parallel, string-matched nav allowlist drifting out of sync with real nav changes; 18 `rec_*` localStorage keys losing a season's worth of accumulated state if renamed without a migration step; and a half-reskinned product where high-traffic tabs look industrial but low-traffic modals (Job Boards' `RepoStats.jsx`, `UserProfileView.jsx`) still look like generic Tailwind SaaS. Because this is a solo maintainer's own live daily-use tool during their actual Fall 2026 recruiting season, sequencing matters as much as correctness: nav chrome and the content it points to must land together per surface (never chrome-first), and every phase should pass a literal "would I do my real CRM check right after this commit" gate.

## Key Findings

### Recommended Stack

The existing stack (React 18, Vite, Tailwind v4, framer-motion, recharts, lucide-react, hand-rolled shadcn-shaped `ui/` primitives, Space Grotesk/Public Sans/IBM Plex Mono) is already validated and should not be re-litigated. Only two additions are recommended, both low-risk and mechanical.

**Core technologies/changes:**
- `motion` (successor npm package to `framer-motion`, same maintainer/API/version line) — migrate import paths (`framer-motion` → `motion/react`) incrementally, file-by-file, at effectively zero cost; do not add a second animation library (GSAP, react-spring) alongside it.
- React Router in **declarative/library mode only** (`BrowserRouter`/`Routes`/`Link`, no `@react-router/dev`, no framework mode) — **recommended by STACK.md as a future option, but explicitly overridden by ARCHITECTURE.md's deeper analysis: do NOT introduce a router this milestone.** No requirement calls for URL-addressability, and adding one touches `vercel.json`'s rewrite ordering, `NotFoundPage.jsx`, and `DemoApp`'s pathname branch — systems this milestone should leave alone. Flag as a fast-follow candidate for a future milestone if bookmarkability becomes a real ask; the interim path is `history.pushState`/`popstate` synced to existing `tab`/`view` strings, not a full router.
- No new font family, no Tailwind background-pattern plugin — build instrument-panel textures with native Tailwind v4 `@theme` custom properties + arbitrary `bg-[image:...]` values.

### Expected Features (IA + Visual Patterns)

Cross-referenced against Huntr, Teal, Simplify (job-CRM competitors) and Linear, Attio, Raycast, Vercel, PostHog (industrial/precision dashboard references).

**Must have (table stakes):**
- Collapse to 4-5 top-level destinations mirroring workflow, not feature inventory
- Unified "what needs my attention" feed (direct analog to Linear Triage) replacing 5 fragmented surfaces — this is the single highest-value consolidation and is explicitly named in PROJECT.md
- Merge Explore→Coverage→Discover into one destination with internal filters/state (mirrors how Attio treats "views + filters over one object," and how no job-CRM competitor exposes gap-analysis/people-discovery as separate top-level nav)
- Shared record side-panel pattern (eventually consolidating ContactDetailModal/JobDetailModal/etc.) — sequenced as a P2, not required for the core nav-sprawl fix
- Near-invisible 1px structural borders (not heavy rules), tabular numerals, systematic mono-for-data application — all LOW complexity, all foundational

**Should have (differentiators):**
- Literal "instrument panel" Overview stat tiles (gauge-like mono readouts) — ownable visual identity vs. every job-CRM competitor's soft consumer card grids
- Global command bar (Cmd/Ctrl-K) extending the existing Quick Capture AI action router into a full navigate+act palette — differentiator since no competitor has an AI command bar
- "Panel light" square/LED status iconography replacing rounded pill badges

**Defer (v2+ / P3):**
- Pipeline Kanban+Table+Calendar view-switcher (depends on shared side-panel existing first)
- Configurable/user-defined saved views (Attio-style view builder) — explicitly out of scope, this is data-modeling-level work
- Ledger-style dense list rows as the app-wide default — highest surface area, sequence last

### Architecture Approach

The app already has the exact pattern needed: `NetworkTab` (inline in `App.jsx`) is a shell holding local `view` state + a segmented control + a `views` prop for demo-trimming — this shape should be replicated verbatim for the new `GrowTab` (Explore+Coverage+Discover shell) and for `PipelineTab` gaining a Job-Boards view, rather than inventing a new composition pattern. Because `App.jsx` already loads all 5 datasets once via `Promise.all` and holds them as flat state passed to every tab, new cross-cutting views (e.g. `TodayTab`) require **zero new data-fetching** — purely a new consumer of already-fetched props.

**Major components (target structure):**
1. `TodayTab.jsx` (NEW) — merges Overview KPIs/charts + Actions queues + summary cards for Keep in Touch/Job Boards-Needs-Review/TimelineFindsPanel, each with a "see all →" deep link; composes from a new `lib/attentionFeed.js` (extracted pure derivation) + existing `keepInTouchQueue()`/`isUntriaged()`/`timelineFinder.js` — never a 6th independent re-implementation of "what needs attention."
2. `GrowTab.jsx` (NEW) — thin shell wrapping `ExploreTab`/`ReferralCoverageTab`/`DiscoverTab` bodies unchanged, since their data layer (`useTargetCompanies()`, `onFindPeople`) is already unified; only navigation is duplicated today.
3. `PipelineTab.jsx` (extended) — gains a local `view` state (Applications | Job Boards) wrapping the existing `GitHubTab`, since both already write into the same `applications` table.
4. `attention/ActionRows.jsx` (NEW) — mechanical extraction of `ActionsTab.jsx`'s currently-private row components, exported for reuse by both the compact `TodayTab` card and the full Actions view.
5. `index.css` + `charts/theme.js` — token *value* changes only (same names), with `charts/theme.js`'s hand-synced hex mirror updated in the same commit every time (documented existing drift risk).

**Explicit non-decision:** no router this milestone (see Stack section above) — the existing lifted-closure deep-link pattern (`goFindPeople`) is sufficient and should simply be extended, not replaced.

### Critical Pitfalls

1. **Cross-tab deep-link relay breaking silently during relocation** — `onFindPeople`/`focusCompany`/`initial*` prop chains (including the `ts: Date.now()` re-trigger trick for repeat clicks on the same target) are easy to drop when a component is moved into a new shell. Avoid by treating each jump as an explicit contract (source→prop→destination→consumed-prop) verified end-to-end, not just "the destination view still renders." Verify by clicking the same jump twice in a row.
2. **`/demo` route drift** — `DEMO_NAV_ITEMS` is a hardcoded id-string filter and `db.js` has 23 separate `isDemoMode()` branches; renaming a tab id or introducing a new merged data shape silently breaks or hides sections of `/demo`. Avoid by deriving demo-eligibility from a single shared config object with an explicit per-item flag (established in the first nav phase) and by actually loading `/demo` after every nav-touching phase, not grepping.
3. **Half-migrated nav confusing the one real daily user mid-milestone** — because this is a solo maintainer's live tool used during their actual recruiting season, shipping new nav chrome ahead of the content it points to breaks real usage, not just aesthetics. Avoid by sequencing chrome + content together per surface (never chrome-first), gated by "would I do my real daily CRM check right after this commit."
4. **Scope creep into the excluded backend/data-model layer** — UI consolidation will keep surfacing real seams (localStorage-backed Discover/Explore state sitting next to Postgres-backed data) that feel like "fix it while I'm in here." Avoid by logging seams as deferred future-milestone items and enforcing a files-touched boundary check (`app/src/components/`, `app/src/lib/` UI-adjacent, `App.jsx` routing state, `index.css`) at every phase's plan-review.
5. **Silent localStorage data loss on key rename/reshape** — 18 `rec_*` keys back merged features with no migration mechanism; renaming a key during a merge silently degrades to "as if first use," losing months of accumulated dismissed-candidates/cooldown state with no error. Avoid by requiring an explicit migrate-or-deliberately-drop decision per touched key in whichever phase merges that feature.
6. **Design tokens applied inconsistently ("half-reskinned")** and **contrast regressions from a dense/dark industrial palette** are the two big visual-reskin risks — mitigate with an end-of-reskin grep sweep for stock Tailwind color classes outside token names, and running new token pairs through the repo's existing `dataviz` skill contrast validator (already used once for chart colors, already found one contrast WARN under the current lighter palette).

## Implications for Roadmap

Research (especially ARCHITECTURE.md's explicit "Suggested Build Order") converges on a clear phase sequence. This should be the starting point for roadmap creation, adjusted only if PROJECT.md's phasing preferences differ.

### Phase 1: Token-value reskin + shared `ui/` primitives pass
**Rationale:** Nearly risk-free (same token names, new hex values — zero call-site edits needed anywhere in `app/src`), fully independent of the IA restructure, and establishes the visual system every later shell/merge should be built against once, not twice.
**Delivers:** New `@theme` industrial palette under existing token names; `charts/theme.js` hex literals updated in lockstep + re-validated via the `dataviz` skill; restyled `Button`/`Badge`/`Card`/`Tabs`/`Input`/`Select`/`Modal`/`EmptyState`/`ChipToggleGroup`; IBM Plex Mono promoted to first-class instrument-panel typeface for numerics/timestamps/status.
**Addresses:** FEATURES.md's table-stakes typography/border/mono patterns.
**Avoids:** Pitfall 5 (inconsistent token application) and Pitfall 6 (contrast regressions) by establishing the contrast-validated token set before any component work begins.

### Phase 2: Extract attention-derivation logic
**Rationale:** A pure refactor (no visible UI change) that de-risks the highest-complexity merge before it's attempted — must precede Phase 3 per ARCHITECTURE.md's "extract-before-merge" pattern.
**Delivers:** `lib/attentionFeed.js` (pulled from `ActionsTab.jsx`'s 5 inline filter/sort blocks) and `attention/ActionRows.jsx` (exported row components), with a "renders identically" verification gate against the current `ActionsTab`.
**Implements:** ARCHITECTURE.md Pattern 2 (extract-derivation-before-merging-UI).
**Avoids:** Pitfall 8 (state-colocation mistakes / over-centralized re-renders) by establishing independent, composable derivation before the merge UI is built.

### Phase 3: Build `TodayTab` (unified attention front door)
**Rationale:** The single highest-value consolidation named directly in PROJECT.md; now safe to build since Phase 2 provides pure, reusable derivation.
**Delivers:** Merged Overview KPIs/charts + attention cards (Actions, Keep in Touch, Job Boards Needs Review, TimelineFindsPanel) each with "see all →" deep links; `NAV_ITEMS`/`DEMO_NAV_ITEMS` updated in the same commit.
**Addresses:** FEATURES.md's P1 "Unified Attention/Triage feed."
**Avoids:** Pitfall 2 (demo drift — updated in same commit), Pitfall 8 (re-render isolation, verified via React DevTools).

### Phase 4: Build `GrowTab` (Explore + Coverage + Discover merge)
**Rationale:** Independent of Phase 3 per FEATURES.md's dependency graph; low regression risk since it's a shell wrapping unchanged internals (`useTargetCompanies()` and `onFindPeople` already unify the data layer).
**Delivers:** `GrowTab.jsx` shell with local `view` state mirroring `NetworkTab`'s exact pattern; `coverage`/`discover` removed from `NETWORK_VIEWS`; stays fully excluded from `DEMO_NAV_ITEMS` (BYOK/AI-dependent).
**Uses:** ARCHITECTURE.md Pattern 1 (shell-with-views-prop).
**Avoids:** Pitfall 1 (cross-tab deep-link breakage) — explicit checklist verification of every `onFindPeople` jump, including the repeat-click re-trigger behavior.

### Phase 5: Fold Job Boards into Pipeline as a view switch
**Rationale:** Mirrors Phase 4's shell pattern; lowest-risk of the three structural merges since `RepoJobsView.jsx` already writes into the same `applications` table `PipelineTab` reads.
**Delivers:** `PipelineTab.jsx` gains Applications/Job Boards view toggle; `NAV_ITEMS` updated.
**Uses:** Same shell pattern as Phase 4.
**Fallback:** If judged too disruptive for one cycle, this phase can be skipped/deferred — Phase 6 alone still lands at 6 primary destinations (down from 8), a smaller but real win.

### Phase 6: Move Settings out of primary nav
**Rationale:** Small, mechanical — gets the nav count to the target ~5 (Today, Network, Grow, Pipeline, Calendar).
**Delivers:** `SettingsTab.jsx` internals untouched; entry point moves to sidebar footer/profile affordance.

### Phase 7: Full per-screen reskin pass
**Rationale:** Must happen last, against the *final* merged component tree — reskinning before the merge means redoing visual work on shells that get restructured (ARCHITECTURE.md's Anti-Pattern 1).
**Delivers:** ~50 files with direct `ink-*`/`accent-*` usage updated to the deeper industrial treatment (new token families if needed, sharper borders/radii, motion system); dedicated grep sweep for stock Tailwind color classes to confirm 100% coverage, including low-traffic files (`RepoStats.jsx`, `UserProfileView.jsx`).
**Avoids:** Pitfall 5 (inconsistent partial reskin), Pitfall 7 (motion perf regressions — scope new motion to `transform`/`opacity` only, explicitly exclude `NetworkGraphTab`'s canvas and Recharts internals).

### Phase Ordering Rationale

- **Token values before structure before deep reskin:** value-only token changes are near-zero-risk and orthogonal to IA work, so there's no reason to gate them behind the merge — but the expensive, high-file-count reskin work should happen once, against the final tree, not twice (pre- and post-merge).
- **Extraction before merge, for the highest-complexity consolidation specifically:** the attention-feed unification touches the most independent data sources (5) of any merge in this milestone — de-risk it with a pure-refactor phase first.
- **Chrome and content land together, per surface:** PITFALLS.md's Pitfall 3 is a hard sequencing constraint specific to this app's single-daily-user context — no phase should update `Sidebar.jsx`'s `NAV_ITEMS` ahead of the destination it points to being ready.
- **Router deliberately excluded from all phases:** confirmed by ARCHITECTURE.md's explicit analysis — no requirement needs URL-addressability, and the existing closure/prop-relay pattern already covers what's needed.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (`TodayTab`):** the state-colocation/composition approach for 5 merged data sources is the single most architecturally subtle piece of this milestone (Pitfall 8) — worth a `--research-phase` or at minimum explicit design discussion before implementation, not treated as a routine merge.
- **Phase 7 (full per-screen reskin):** if new token *families* (not just values) are introduced (e.g. a dedicated mono/data-accent scale), that's a schema change touching every call site — worth confirming scope before starting.

Phases with standard patterns (skip research-phase):
- **Phase 1 (token-value reskin):** mechanical, well-precedented by Tailwind v4's own `@theme` model — no research needed.
- **Phase 4 & 5 (`GrowTab`, Pipeline+Job Boards merges):** directly copy the already-proven `NetworkTab` shell pattern in this same codebase — implementation reference already exists in-repo.
- **Phase 6 (Settings relocation):** trivial, mechanical.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Context7-sourced docs + live `npm view` registry data (HIGH for version facts), but font-pairing and background-pattern guidance is SEO-content-sourced (LOW), treated as directional only |
| Features | MEDIUM | Cross-corroborated across multiple independent competitor/design-system sources (Attio, Linear, Raycast, Vercel, Huntr, Teal); individual CSS/token values should be spot-verified, not copied literally |
| Architecture | HIGH | Grounded directly in this repo's actual files (`App.jsx`, `Sidebar.jsx`, `db.js`, etc.) read in full before writing — the codebase-specific recommendations are primary-source; general refactor-sequencing claims (Strangler Fig, token migration) are MEDIUM, standard engineering judgment corroborated by current industry writing |
| Pitfalls | MEDIUM-HIGH | Codebase-specific pitfalls (deep-link mechanics, demo-mode drift, localStorage coupling) are HIGH — verified directly against `App.jsx`/`Sidebar.jsx`/`db.js`; general process claims (state colocation, contrast risk, motion perf) are MEDIUM, corroborated by multiple independent but individually LOW-confidence web sources |

**Overall confidence:** MEDIUM-HIGH — this is an unusually well-grounded research pass because 3 of 4 files draw directly on the live codebase rather than external analogues; the genuinely uncertain areas are narrow (specific font/color aesthetic judgments, which are inherently subjective and will be settled by the mandated screenshot-verification step, not by research).

### Gaps to Address

- **Exact new token values/hex codes for the industrial palette** are not prescribed by research (correctly — this is a design decision, not a research question) — resolve during the Phase 1 token-definition step itself, using the `dataviz` skill's contrast validator as the acceptance gate, not during roadmap creation.
- **Whether Phase 5 (Job Boards→Pipeline) ships this cycle or is deferred** is explicitly left as a judgment call in ARCHITECTURE.md's "Suggested Build Order" (with a stated fallback) — resolve during roadmap creation based on appetite/timeline, not a research gap per se.
- **Whether `TodayTab`'s composition approach needs a dedicated research-phase or just a discussion** (see Research Flags above) — resolve at the point that phase is planned, informed by how Phase 2's extraction actually lands.
- **motion vs. framer-motion migration timing** — STACK.md recommends it as "zero cost, do it whenever" but doesn't assign it a phase; fold into Phase 7 (motion/micro-interaction scoping) rather than treating as a separate phase, since PITFALLS.md's Pitfall 7 already flags that phase as needing explicit motion-scope discussion.

## Sources

### Primary (HIGH confidence)
- Direct codebase reads: `app/src/App.jsx`, `app/src/components/layout/Sidebar.jsx`, `app/src/components/layout/AppShell.jsx`, `app/src/index.css`, `app/src/db.js`, `app/src/components/ActionsTab.jsx`, `app/src/components/OverviewTab.jsx`, `app/src/components/ExploreTab.jsx`, `app/src/components/ReferralCoverageTab.jsx`, `app/src/components/DiscoverTab.jsx`, `app/src/components/charts/theme.js`, `app/src/shared.jsx`, `app/src/components/jobBoards/RepoJobsView.jsx`, `app/src/components/PipelineTab.jsx`, `app/src/components/ApplicationDetailModal.jsx`
- `npm view` live registry query (2026-08-15) — current package versions for `framer-motion`, `motion`, `tailwindcss`, `react-router`, `@tanstack/react-router`, `wouter`, `recharts`, `lucide-react`
- Context7 `/websites/motion_dev`, `/websites/tailwindcss`, `/websites/reactrouter` — API/config documentation

### Secondary (MEDIUM confidence)
- SaaS/CRM IA and command-palette pattern research (Attio, Linear, Raycast, Vercel, Superhuman, Retool) — cross-corroborated across multiple independent sources
- Job-search CRM competitor analysis (Huntr, Teal, Simplify Copilot) — official product pages/help centers
- Strangler Fig pattern and incremental frontend modernization guidance (Microsoft Learn, Martin Fowler, industry write-ups)
- Tailwind v4 `@theme`/design-token migration guidance (2026 dev community sources)

### Tertiary (LOW confidence, treat as directional)
- Font-pairing SEO-content sources (madegooddesigns.com, diversekit.com, fontfinds.com) for Space Grotesk/IBM Plex Mono characterization
- Tailwind background-pattern plugin landscape (community plugin/component library search)
- Framer Motion → Motion rebrand timeline (aggregated web search, cross-checked against Context7 and npm data)

---
*Research completed: 2026-08-15*
*Ready for roadmap: yes*
