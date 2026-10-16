# Phase 3: Grow — Discovery Funnel Merge - Context

**Gathered:** 2026-08-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Company targeting (Explore), referral-gap analysis (Coverage), and people discovery (Discover) merge into one "Grow" destination — a new top-level nav item. Today these are 3 separate places: a top-level `Explore` tab, plus `Coverage` and `Discover` as sub-views buried inside Network's segmented control (alongside Table/Cards/Graph/Outbox). Once merged, the standalone `Explore` tab and the `Coverage`/`Discover` Network sub-views no longer exist as separate destinations (GROW-01 success criterion 3) — everything they do (company ranking, gap detection, people discovery, cold-outreach drafting) is preserved, just re-housed and visually connected under Grow (GROW-02).

This phase is a UI/IA merge only — no data-model or Supabase schema changes. `useTargetCompanies` (the shared target-company list already used by both Explore and Coverage) stays as-is; localStorage keys for Explore/Discover (11 total: `rec_company_*` × 5, `rec_discovered`/`rec_affinity_profile`/etc. × 6) are not migrated or consolidated — this is a presentation merge, not a state merge.

</domain>

<decisions>
## Implementation Decisions

### Page structure
- **D-01:** Grow renders as **one scrollable page with 3 always-present stacked sections** — Companies, Coverage, People — in that order, mirroring `TodayTab`'s proven Section pattern from Phase 2 (D-01 there: title + accent color + row list, sections always render their content, no accordion/collapse). This is the central decision satisfying "one connected flow ... without leaving the destination" (Phase 3 success criterion 1) — explicitly rejecting a step-by-step wizard (hides prior stages) and a relocated segmented control (same tab-switching Coverage/Discover already had inside Network, just moved up a level — doesn't actually change the interaction model).
- **D-02:** Each section is **capped to a top-N with a "+ show all N" expander** (not always-full, not collapsed-by-default). Keeps the page scannable when a section's underlying list is long (many ranked companies, many target-company rows, many discovered candidates) without reintroducing the accordion pattern Phase 2 deliberately removed from `TimelineFindsPanel`. Sections still always render their header + capped content — only the *tail* of a long list is hidden behind the expander, never the whole section.
- **D-03:** All 3 sections render unconditionally, even with zero data (**no target companies yet**: Companies section shows its normal empty/prompt state, Coverage and People sections still render with an `EmptyState` pointing up — e.g. "Add target companies above to see gaps"). Rejected hiding Coverage/People until ≥1 target exists, since that would make the page's shape change as the user progresses, undermining the "always 3 sections" mental model D-01 establishes. This also visually teaches the funnel order (Companies → Coverage → People) on a user's very first visit.

### Cross-section linking
- **D-04:** Actions that logically feed the next stage **auto-scroll to and highlight** the target section, rather than silently updating data in place or expanding an inline sub-panel. Concretely: `+ Add to targets` (Companies) → smooth-scroll to Coverage, briefly highlight the new row for that company. `🔍 Find people` (Coverage) → smooth-scroll to People, pre-filter/highlight that company. This reuses the existing `onFindPeople`/`focusCompany`-with-timestamp mechanic (already used for the Pipeline→Discover and Coverage→Discover deep-links) — scrolling replaces tab-switching as the transition, the underlying "focus company X" state/prop shape is unchanged. *Rationale: this is the one behavior that actually makes 3 stacked sections read as a connected flow instead of 3 unrelated lists on one page — explicitly the highest-value pick among the 3 options discussed.*
- **D-05 (inferred, not directly asked):** External deep-links into people discovery — Pipeline's `onFindPeople`/`goFindPeople` (`App.jsx`), currently routing to Network→Discover — must be re-pointed to land on **Grow with the People section auto-scrolled + highlighted for that company**, using the exact same D-04 mechanic rather than inventing a second entry path. `goFindPeople` in `App.jsx` needs its tab target changed from `'network'`+`networkInitialView='discover'` to `'grow'` (or equivalent), with the focus-company state threaded through to Grow's People section instead of `NetworkTab`'s `DiscoverTab`. Flag for research/planning to confirm — the STATE.md blocker about cross-tab deep-link relay being "easy to silently break during relocations" applies directly here.

### Claude's Discretion
- Exact visual treatment within each section (card layout, spacing, highlight animation style/duration for D-04's scroll-to-and-highlight) is left to planning/implementation — presentation detail, not a decision that changes what the feature does.
- Section internal sort/filter behavior (e.g. Coverage's gap→weak→strong sort, Discover's `discoveryScore` ranking) carries forward unchanged from the existing components — not re-litigated here.
- Whether "Companies," "Coverage," and "People" are the exact section header labels, or slightly different wording, is a copy decision for planning.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone-level requirements and roadmap
- `.planning/REQUIREMENTS.md` §"Grow — Discovery Funnel Merge (GROW)" — GROW-01/02 acceptance criteria
- `.planning/ROADMAP.md` §"Phase 3: Grow — Discovery Funnel Merge" — goal, success criteria, dependency on Phase 1
- `.planning/PROJECT.md` — Core Value, Constraints (scope discipline: `app/src/components/`, `app/src/lib/`, `App.jsx` nav/routing, `index.css` tokens only), Compatibility constraint (public `/demo` route)

### Phase 1 deliverables this phase builds on
- `.planning/phases/01-visual-foundation-industrial-design-tokens-primitives/01-UI-SPEC.md` — locked token values/typography Grow's sections must use (industrial palette, `Mono` primitive for dense data)

### Phase 2 precedent this phase's structure is explicitly modeled on
- `.planning/phases/02-unified-attention-feed-today/02-CONTEXT.md` — D-01 (Section pattern, no-accordion precedent), D-04/D-04b (deep-link mechanics), D-06 (shared-derivation-module precedent)
- `app/src/components/TodayTab.jsx` and `app/src/lib/attention.js` — the actual implementation of the Section-based stacked-page pattern D-01/D-02/D-03 above are modeled on

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/src/components/ExploreTab.jsx` (295 lines) — company targeting UI. `CompanyCard` (fit score, why-fit, add/dismiss/expand actions), `runFind`/`runFindWith` (Exa+Claude ranking), `useTargetCompanies` for the shared target list, `CompanyOnboarding.jsx` gate when no prefs saved yet. This whole component becomes (or is wrapped by) Grow's Companies section.
- `app/src/components/ReferralCoverageTab.jsx` (159 lines) — gap analysis. Reads the same `useTargetCompanies` list, cross-references `contacts`/`apps` via `companyCoverage()` (`lib/networkCoverage.js`) and `warmPathsToCompany()` (`lib/warmIntro.js`). Has its own `onFindPeople` prop already wired for the deep-link into Discover — this becomes Grow's Coverage section.
- `app/src/components/DiscoverTab.jsx` (521 lines) — people discovery. Takes a `focus` prop (`{company, ts}`) already used for scroll/pre-filter-style targeting from Coverage's "Find people" today (via `NetworkTab`'s `focusCompany` state) — this is the exact mechanic D-04/D-05 above reuse, just re-pointed from a tab-switch to a same-page scroll. Becomes Grow's People section.
- `app/src/App.jsx`'s `goFindPeople` (`AppInner`, line ~238) — the shared cross-tab deep-link helper Pipeline and (formerly) Explore both call; needs its target updated per D-05.

### Established Patterns
- `TodayTab.jsx` / `app/src/lib/attention.js` (Phase 2) — the Section-based "many categories, one page, always-rendered" pattern this phase's D-01/D-02/D-03 explicitly reuse. `attention.js` is also a precedent for extracting shared derivation logic into a `lib/` module when a phase consolidates duplicated UI (D-06 in Phase 2) — may be relevant if Grow needs its own coordinating logic beyond what Explore/Coverage/Discover already compute individually.
- `focusCompany`/`onFindPeople` with a `{ company, ts: Date.now() }` shape — the existing repeat-click-safe deep-link pattern (the `ts` timestamp forces re-triggering even when the same company is clicked twice in a row). Used today by both Explore→Discover (via `App.jsx`'s `goFindPeople`) and Coverage→Discover (via `NetworkTab`'s local `focusCompany` state). D-04/D-05 keep this exact shape, just change what consumes it (a scroll target instead of a tab/view switch).

### Integration Points
- `app/src/components/layout/Sidebar.jsx`'s `NAV_ITEMS` — `'explore'` entry gets replaced by `'grow'`.
- `App.jsx`'s `AppInner` — `tab === 'explore'` branch (renders `ExploreTab`) is replaced by a new `tab === 'grow'` branch rendering the merged component; `NetworkTab`'s `NETWORK_VIEWS` array loses its `'coverage'` and `'discover'` entries (and the `view === 'discover'`/`view === 'coverage'` branches in `NetworkTab`'s render), since those sub-views move to Grow.
- `/demo` route (`DemoApp`, `App.jsx`) — none of Explore/Coverage/Discover are in `DEMO_NAV_ITEMS`/`DEMO_NETWORK_VIEWS` today (all three need Exa/Claude/OpenAI proxies that 401 without a signed-in BYOK session). Grow inherits this exclusion — it should NOT be added to `DEMO_NAV_ITEMS`, consistent with current behavior, so no `/demo` regression risk from this merge.

</code_context>

<specifics>
## Specific Ideas

No specific ideas beyond what's captured in `decisions` above — discussion focused entirely on the "Flow structure" gray area (page structure, section density, cross-section linking, empty state), which the user selected as the one area worth discussing for this phase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-grow-discovery-funnel-merge*
*Context gathered: 2026-08-17*
