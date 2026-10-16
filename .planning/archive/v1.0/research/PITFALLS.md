# Pitfalls Research

**Domain:** Large-scope IA consolidation + full visual reskin of an existing, live, single-maintainer production dashboard/CRM
**Researched:** 2026-08-15
**Confidence:** MEDIUM — the process/pattern claims (strangler pattern, state colocation, token/contrast risk, Framer Motion perf) are corroborated by multiple independent web sources but are general web-development wisdom (LOW-confidence individual sources, cross-checked to MEDIUM); the codebase-specific pitfalls (deep-link mechanics, demo-mode drift, localStorage coupling) are HIGH confidence — verified directly against this repo's code (`App.jsx`, `Sidebar.jsx`, `db.js`), not inferred.

## Critical Pitfalls

### Pitfall 1: Breaking the cross-tab deep-link mechanism during nav consolidation

**What goes wrong:**
"Find people →" (and similar jumps like Coverage's per-row "find people" button) isn't a simple link — it's a two-tier lifted-state relay: `AppInner` owns `networkFocusCompany`/`networkInitialView`, passes them into `NetworkTab` as `initialFocusCompany`/`initialView`, which seeds `NetworkTab`'s *own* local `focusCompany` state; `onFindPeople` callbacks from `ExploreTab`, `PipelineTab`, `ApplicationDetailModal`, and `ReferralCoverageTab` all call the same `setFocusCompany({ company, ts: Date.now() })` + `setView('discover')` pair. The `ts: Date.now()` exists specifically so the *same* company clicked twice still re-triggers Discover's effect (object identity, not just value, changes). If the IA consolidation flattens `tab`/`view` into a different routing model (e.g. a single `route` string, a router library, or merges Network's views into a different tab structure), it's very easy to preserve the *visual* jump ("Explore → Discover shows the same list") while silently breaking the *re-trigger-on-repeat-click* behavior, or to drop the `focus` prop chain entirely when a component gets renamed/merged.

**Why it happens:**
Deep-links like this look like "just navigation" from the outside, but they're actually prop-drilled state contracts between specific components. A consolidation pass naturally focuses on the nav *chrome* (sidebar, tab list, segmented controls) and treats the content components as black boxes to be relocated — but relocating `ExploreTab` or `ReferralCoverageTab` without re-threading `onFindPeople` (and re-checking the receiving component still reads `focus`/`initialFocusCompany` correctly) breaks the jump silently, since nothing throws — the button just does nothing or opens the wrong view with no pre-fill.

**How to avoid:**
Before touching nav structure, grep for every `onFindPeople`/`focusCompany`/`initial*` cross-component prop and write down the full call graph (source component → prop → destination component → consumed prop) as a checklist. Treat each one as a "contract" that must have an equivalent path in the new IA, not just "the feature still exists somewhere." Prefer keeping the *shape* of this relay (a lifted `{target, ts}` object) even if it moves to a different state container (e.g. a single `navigate(destination, params)` function) — the `ts` re-trigger trick specifically needs to survive.

**Warning signs:**
Clicking "Find people →" from a merged/relocated Explore or Coverage surface lands on the right screen but with an empty/unfiltered list; clicking it twice for the same company only works the first time; console has no error (this fails silently, not loudly).

**Phase to address:**
Address during the nav/IA-restructure phase, before or alongside the visual reskin — verify every cross-surface jump end-to-end (not just "the destination view still renders") as an explicit acceptance check for that phase, not deferred to a later polish phase.

---

### Pitfall 2: Demo-route nav list drifts out of sync with the real nav during consolidation

**What goes wrong:**
`DEMO_NAV_ITEMS` in `App.jsx` is derived by filtering the real `NAV_ITEMS` array on hardcoded id strings (`['overview', 'network', 'pipeline', 'actions'].includes(item.id)`), and `db.js` has 23 separate `isDemoMode()` checks, one per exported function, each branching to `demoStore()`/`demoData.js` instead of Supabase. If the IA consolidation renames a tab id (e.g. `'actions'` → `'today'` as part of unifying the "what needs my attention" surfaces), the demo filter silently stops matching, and that section vanishes from `/demo` — or worse, a new merged tab id was never added to the allowlist so a whole new destination is simply never shown to demo visitors. Because `demoData.js`'s shapes must exactly match `db.js`'s real `fetch*` return shapes, merging feature surfaces (e.g. combining Overview nudges + Job Boards' Needs Review queue into one panel) can also introduce a new derived-data shape that demo mode was never taught to produce, breaking `/demo` at runtime instead of just cosmetically.

**Why it happens:**
The demo-mode guarantee is implemented as a *parallel, string-matched allowlist* plus a *scattered* set of per-function branches — not a single boundary that would fail loudly (e.g. a type check) if a new merged component expects a shape demo data doesn't have. It's easy to update the "real" nav and components thoroughly while forgetting `/demo` exists at all, since it's not on the developer's own daily-use path.

**How to avoid:**
Whenever a tab/view id changes or two features merge into one, immediately grep `DEMO_NAV_ITEMS`, `isDemoMode`, and `demoData.js` in the same commit — treat this as a mechanical checklist item on every IA-phase PR, not a separate cleanup pass. Since this milestone explicitly requires the demo route to keep working *throughout*, verify `/demo` after every phase (not just at the end) by actually loading it, not just grepping for the string.

**Warning signs:**
`/demo` renders fewer nav items than expected after a merge phase; a demo-mode console error referencing a field `demoData.js` doesn't produce; a nav item visible on the authenticated app but missing on `/demo` with no corresponding entry in the exclusion list's stated rationale (Explore/Discover/Outbox/Coverage/Job Boards/Calendar/Settings are deliberately excluded already — anything newly missing should be a deliberate decision, not a drift accident).

**Phase to address:**
Address as a standing verification step across every phase that touches nav/tab structure, not a single phase — but ensure the *first* nav-restructure phase establishes the pattern (e.g. deriving `DEMO_NAV_ITEMS` from a shared config object with an explicit `demo: true/false` flag per item, rather than a separately-maintained id array) so subsequent phases can't drift as easily.

---

### Pitfall 3: Half-migrated nav confuses the one active daily user mid-milestone

**What goes wrong:**
Unlike a multi-user product where a confusing intermediate state affects "some users, some of the time," this app has exactly one real daily user (the developer, running their own live internship search through it). A nav restructure that ships in a state where some flows use the new consolidated structure and others still point at the old tab layout (e.g. sidebar shows 5 new destinations but a modal's "back" affordance or a stale bookmark/mental model still assumes the old 8-tab structure) doesn't just look unfinished — it actively breaks the person's ability to do real recruiting work (log a call, check what's due today) during the exact season (Fall 2026 apps open) the tool exists to serve.

**Why it happens:**
Large IA consolidations are naturally done incrementally (tab-by-tab or view-by-view), and it's tempting to merge navigation chrome first (since it's the most visible "progress") before every destination it points to is actually ready — leaving dead-end or inconsistent intermediate states reachable during real usage sessions, not just during development.

**How to avoid:**
Sequence phases so navigation *chrome* changes land together with the content they route to, not ahead of it (i.e. don't ship a new 5-item sidebar that still points at old components with old prop shapes) — prefer the "strangler" ordering: build and verify each new consolidated destination fully behind its *final* nav slot before flipping the nav to point at it, so at every commit boundary the whole app is coherently either "old IA" or "new IA" for a given surface, never a mix within one surface. Since this is genuinely a solo maintainer using their own tool, treat "would I want to do my daily CRM check right after this commit" as a literal go/no-go gate per phase.

**Warning signs:**
A phase's plan describes moving nav labels/order before the underlying views are refactored; testing a phase means clicking through only the *new* nav, not also checking old muscle-memory paths (typed URLs, keyboard habits, "I know Pipeline was the 4th tab") still land somewhere sensible.

**Phase to address:**
This is a sequencing/roadmap-level pitfall, not a single phase's job — the roadmap should interleave "restructure destination X's content" and "point nav at X" within the same phase rather than doing all nav chrome first, all content merges second.

---

### Pitfall 4: "While I'm in here" scope creep into the excluded backend/data-model layer

**What goes wrong:**
PROJECT.md explicitly excludes backend/data-model restructuring (e.g. folding Job Boards' import mechanics into Pipeline's Postgres schema) from this milestone, but the actual consolidation work — merging Explore→Coverage→Discover into one funnel, unifying "what needs attention" across Overview/Actions/Keep in Touch/Job Boards/TimelineFindsPanel — will repeatedly surface real awkwardness in the underlying data shapes (e.g. `rec_target_companies` and `rec_discovered` living in localStorage while `applications`/`contacts` live in Postgres; Job Boards' Triage field vs. a hypothetical unified "attention" status). Each of these is a legitimate opportunity to "fix it properly while touching the code anyway" — and each one, taken, expands this milestone's blast radius into RLS/schema territory that was deliberately ruled out, risking exactly the kind of regression risk (data migration bugs, RLS gaps) the milestone was scoped to avoid.

**Why it happens:**
UI/IA work and data-model work are genuinely coupled in this codebase (localStorage-backed features like Discover/Explore sit awkwardly next to Postgres-backed ones), so touching the UI layer keeps exposing real seams in the data layer. For a solo developer without a second person to say "no, stay in scope," each individual expansion feels small and well-justified in isolation.

**How to avoid:**
When a UI consolidation reveals a genuine data-model seam, write it down as a *deferred* item (future milestone) rather than fixing it inline — the fix here is a discipline/logging habit, not a technical one. Prefer UI-layer workarounds that don't touch schema (e.g. a client-side "unified attention" view that merges data from multiple existing fetch calls, rather than a new database column) even if less elegant, since PROJECT.md's constraint is explicit that `app/src/lib/` changes should be "UI-adjacent logic only."

**Warning signs:**
A phase's plan or diff touches `supabase/migrations/`, `api/_lib/`, or RLS policy files; a phase takes noticeably longer than scoped because "while fixing the Explore/Discover merge I also refactored how target companies are stored."

**Phase to address:**
Enforce at roadmap-creation and at every phase's plan-review — each phase plan should have an explicit "files touched" boundary check against PROJECT.md's stated constraint (`app/src/components/`, `app/src/lib/` UI-adjacent only, `App.jsx` routing state, `index.css` tokens) before execution starts.

---

### Pitfall 5: Design tokens applied inconsistently across dozens of files, leaving a "half-reskinned" product

**What goes wrong:**
`app/src/components/` has 29+ top-level files plus a 13-file `jobBoards/` sub-app; a full reskin touching color/typography/spacing tokens risks landing thoroughly in some files (the ones actively being worked on) and only partially in others (older, less-visited files like Job Boards' `RepoStats.jsx` or `UserProfileView.jsx`), leaving a visually inconsistent product where some screens read as "industrial/control-panel" and others still look like the old generic-Tailwind-SaaS baseline — worse for user trust than not having reskinned at all, since inconsistency reads as unfinished/broken rather than "in progress."

**Why it happens:**
Design tokens only enforce consistency where they're actually *used* — nothing stops old hardcoded utility classes (`bg-gray-50`, `text-blue-600`, the pre-token `ink`/`accent` mappings) from coexisting silently alongside new token usage, and a component-by-component reskin naturally proceeds by visibility/traffic rather than completeness.

**How to avoid:**
Before starting the visual reskin, grep for hardcoded stock-Tailwind color classes (`gray-`, `blue-`, `green-`, `red-`, `yellow-` outside the already-established `success`/`warning`/`danger` tokens) across `app/src/components/` to produce a completeness checklist, and treat the reskin as "done" only when that grep returns zero matches outside token-defined names — not when the visibly-important tabs look right. Do the sweep in a dedicated final pass across *all* files, not just the ones touched by feature work, since Job Boards' sub-app and less-visited detail modals are exactly where drift hides.

**Warning signs:**
A grep for `text-gray-`, `bg-blue-`, etc. still returns hits after a reskin phase is marked done; screenshots of high-traffic tabs (Overview, Network) look cohesive but a screenshot of a rarely-opened modal (e.g. `RepoStats`, `UserProfileView`) doesn't match.

**Phase to address:**
Address as an explicit sweep/verification step at the *end* of the visual-reskin phase(s) — plan a dedicated "token completeness audit" checkpoint rather than assuming file-by-file reskin work naturally reaches 100% coverage.

---

### Pitfall 6: Contrast regressions from committing to a bold, dense industrial palette

**What goes wrong:**
An "industrial/control-panel" aesthetic (dense data, sharp edges, mono accents) tends toward darker canvases, tighter text/background contrast, and small monospace data type — exactly the combination most prone to failing WCAG contrast thresholds. The existing token system already had at least one documented contrast tradeoff (the donut chart's `STATUS_CHART_COLORS` needed a visible legend as "required relief for a contrast WARN the validator flagged on two of the five status colors"), meaning this codebase has already brushed up against this exact failure mode once under a *lighter* palette — a denser, darker reskin raises the risk further.

**Why it happens:**
Bold aesthetic directions are chosen for visual distinctiveness, and distinctiveness often trades against the "safe," high-contrast defaults (black-on-white, saturated-on-neutral) that pass contrast checks trivially. Nobody notices a contrast regression while designing on a bright monitor at full attention — it surfaces later, in real daily use, in different lighting.
Multiple color values changing at once during a full reskin also means a token edit that quietly drops below threshold can land in the same commit as dozens of unrelated changes, making it hard to isolate later.

**How to avoid:**
Run every new token combination (text/background pairs actually used, not just the raw palette swatches) through this repo's own `dataviz` skill contrast validator (already used for chart colors) before finalizing the token set — extend that same discipline from charts to the whole UI token system. Treat "visually verify + screenshot before calling any UI phase done" (already a standing project directive) as including an explicit contrast pass, not just an aesthetic gut-check.

**Warning signs:**
Mono-accent data type (IBM Plex Mono, per the stated design intent) rendered small on a dark/dense background; any new token pairing not run through a contrast checker; squinting at the dashboard-instrument aesthetic under normal daylight screen brightness.

**Phase to address:**
Address during the design-token-definition phase (before per-component reskin work begins), with a second, final check at the end-of-reskin token-completeness sweep (Pitfall 5) to catch pairings introduced later.

---

### Pitfall 7: Expanding motion beyond its current 3 scoped usages causes real perf regressions

**What goes wrong:**
`framer-motion` currently touches exactly 3 places (`ui/Modal.jsx` open/close, `AppShell.jsx` tab-switch fade, `NotFoundPage.jsx`) — deliberately not scattered across hover states, per the existing CLAUDE.md documentation. A "control-panel" aesthetic with "motion for micro-interactions" easily tempts adding animation broadly: hover states on dense data rows, live-updating KPI tiles, animated transitions on the `@tanstack/react-table`-backed Network table, the Recharts-based charts, and `NetworkGraphTab`'s `react-force-graph-2d` canvas. These are exactly the surfaces web research flags as risk zones — motion running alongside frequent state updates, virtualized/large tables, and chart re-renders causes frame drops on scroll/filter/pagination, and a canvas-based force-directed graph is already its own rendering-cost surface without added DOM-level motion competing for frame budget.

**Why it happens:**
"Add motion for micro-interactions" is a directionally-correct instruction from the user's own global aesthetic standard, but it doesn't specify *where* — and a dense, data-heavy dashboard is precisely the context where naive motion (animating layout properties, or animating list items that also virtualize/re-render on data changes) compounds badly, unlike a marketing site with static content.

**How to avoid:**
Keep new motion additions to `transform`/`opacity` only (never `width`/`height`/`top`/`left`), scope any new motion to per-item enter/exit (not continuous or scroll-linked effects) on the table/list surfaces, and explicitly exclude `NetworkGraphTab`'s canvas and Recharts' own rendering from added framer-motion wrapping — their existing render costs are the budget, don't add to it. Gate any new broadly-applied motion behind `useReducedMotion` from the start, both for accessibility and as a built-in kill switch if a specific surface turns out to regress.

**Warning signs:**
Scroll or filter interactions on the Network table or Job Boards card grid feel laggy after a reskin phase that added motion; the force-directed graph's frame rate visibly drops when combined with new animated UI chrome around it; DevTools Performance panel shows layout thrashing (not just compositing) during a filter/sort action.

**Phase to address:**
Address during the motion/micro-interaction phase (likely a late phase, after static visual tokens are settled) — explicitly scope which surfaces get new motion in that phase's plan, rather than "add motion throughout" as an open-ended instruction, and spot-check performance on the table and graph views specifically before marking it done.

---

### Pitfall 8: State-colocation mistakes when merging fragmented "needs attention" surfaces into one destination

**What goes wrong:**
The milestone explicitly targets unifying Overview nudges, the Actions tab, Keep in Touch's queue, Job Boards' "Needs Review" bucket, and `TimelineFindsPanel` into a single front door. Each of these currently computes its own slice from its own data source (contacts, applications, interactions, localStorage-backed job board state) independently, at the point where it's rendered. The naive way to merge them is to lift *all* of their underlying fetches and derived-state computation up into one big parent component that then passes slices down to sub-panels — which reintroduces exactly the prop-drilling problem this milestone is trying to reduce, and additionally means any single data source updating (e.g. a new interaction logged) re-renders the entire unified panel, including sub-sections whose data didn't change (e.g. Job Boards' Needs Review count re-rendering when a Keep-in-Touch interaction is logged).

**Why it happens:**
"Merge these into one view" is naturally interpreted as "one component," and the fastest way to get one component working is to centralize all its inputs at the top — but that's the opposite of the state-colocation fix for prop-drilling (push state down to where it's consumed, not up to a shared parent). It's an easy trap specifically *because* the milestone's own goal (fewer top-level state containers) makes "just lift everything" feel aligned with the goal, when it's actually the anti-pattern version of it.

**How to avoid:**
Keep each source's data-fetching/derivation logic where it already lives (or in its own small hook/module — several already exist as separate `lib/` modules like `hiringVelocity.js`, `networkCoverage.js`, `timelineFinder.js`), and have the new unified "front door" component compose *already-computed* summaries from each source (e.g. via independent hooks called at the composite level, each memoized/independent) rather than becoming the single owner of all underlying state. Use React DevTools' render highlighting (or a manual "add a console.log render count per sub-section") to verify that logging one interaction doesn't re-render the Job Boards sub-panel.

**Warning signs:**
The new unified panel's top-level component has a long list of `useState`/`useEffect` calls fetching from every domain (contacts, applications, job boards) directly, rather than delegating to smaller hooks; React DevTools shows the whole panel highlighting on every unrelated data change.

**Phase to address:**
Address during the "unify what needs attention" consolidation phase specifically — since this is the single feature-merge in this milestone with the most independent data sources being combined, budget explicit design/discussion time on the composition approach before implementation, rather than treating it as a routine merge.

---

### Pitfall 9: localStorage key churn silently loses the one user's settings/queues when features merge

**What goes wrong:**
18 separate `rec_*` localStorage keys back individual features being consolidated (`rec_discovered`, `rec_discovered_dismissed`, `rec_discovered_added`, `rec_discovery_meta`, `rec_discovery_settings`, `rec_affinity_profile`, `rec_company_prefs`, `rec_company_results`, `rec_company_meta`, `rec_company_added`, `rec_company_dismissed`, `rec_target_companies`, `rec_tracked_boards`, `rec_job_deadlines`, `rec_job_blurbs`, `rec_prefs`, `rec_posting_history`, `rec_timeline_meta`, plus `scopedStorage.js`'s per-user namespacing prefix on top). PROJECT.md explicitly allows *not* eliminating all of these, but as features get merged (e.g. Explore→Coverage→Discover into one funnel), it's natural for a developer to rename or restructure the underlying state shape to fit the new merged component — and unlike a database migration, there is no migration path for localStorage: renaming a key or changing its shape means the previously-stored data (the user's real, months-accumulated dismissed candidates, tracked boards, discovery cooldown state) simply vanishes on first load post-merge, silently, with no error and no data-loss warning, since `lsGet`/`lsSet` degrade cleanly to "as if first-time use."

**Why it happens:**
localStorage-backed features degrade gracefully by design (missing key = empty/default state), which is a feature for *new* users but a silent trap for the *existing* user's accumulated state when a key gets renamed or reshaped during a refactor — there's no schema/type error to catch it, the app just quietly starts fresh.

**How to avoid:**
Any time a phase renames or restructures a `rec_*` key as part of merging its feature into a new component, write a one-time client-side migration (read the old key, transform, write the new key, delete the old key) rather than just switching the read/write key name in code — even though this is "just a solo dev's own browser," the cost of losing months of dismissed-candidates/discovery-cooldown state is real lost context for the active job search this tool exists to support. If a key's *feature* is deprecated entirely (not merged, actually removed), that's fine to just leave orphaned (no migration needed) — the risk is specifically renaming/reshaping while claiming to preserve the same underlying feature.

**Warning signs:**
A phase's diff changes a `lsGet('rec_x', ...)` call to `lsGet('rec_y', ...)` (or changes the shape read/written under the same key) without an accompanying one-time read-old-write-new step; after a merge phase, previously-dismissed Discover candidates or Job Boards triage state reappears as if new.

**Phase to address:**
Address within whichever phase actually merges each specific localStorage-backed feature (Explore/Coverage/Discover merge phase; "what needs attention" unification phase) — call out affected `rec_*` keys explicitly in that phase's plan and require an explicit migrate-or-deliberately-drop decision per key, not a default "just rename in code."

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Merging nav chrome (sidebar labels/order) before the destination components are actually refactored | Visible "progress" early, feels like momentum | Live half-migrated state confuses the single daily user (Pitfall 3) mid-milestone | Never for this milestone — sequence chrome + content together per surface |
| Reskinning high-traffic tabs first, leaving low-traffic modals/detail views for "later" | Faster perceived visual progress | Inconsistent product (Pitfall 5); "later" sweeps are easy to skip once the visible parts look done | Acceptable only if a dedicated final completeness-sweep phase is explicitly planned, not assumed |
| Renaming a `rec_*` localStorage key inline as part of a component merge, without migration | Simpler diff, less code | Silent loss of the real user's accumulated state (Pitfall 9) | Only when the underlying feature is being fully removed, not merged/renamed |
| Lifting all "needs attention" data-fetching into one big parent component during the unification merge | Fastest way to get one visual component working | Re-introduces prop-drilling/over-broad re-renders in a new shape (Pitfall 8) | Never — use composed independent hooks instead |
| Skipping contrast validation on new industrial-palette token pairs to move faster on the aesthetic | Faster visual iteration | Accessibility regression that's expensive to trace once spread across dozens of files (Pitfall 6) | Only for early throwaway exploration/sketches, never for tokens that ship into `index.css` |

## Component/State Integration Gotchas

Common mistakes when consolidating existing React components/state during this kind of restructure.

| Integration Point | Common Mistake | Correct Approach |
|---|---|---|
| Cross-tab deep-links (`onFindPeople` and similar) | Treating the jump as "just make the button visible on the new nav" and dropping the underlying `{target, ts}` state relay | Re-thread the full prop chain explicitly; preserve the `ts`/identity-change trick that allows re-triggering on repeat clicks |
| `DEMO_NAV_ITEMS` id-string filter | Renaming a tab id in the real nav without updating the matching filter list | Derive demo-eligibility from a single shared config object with an explicit per-item flag, not a separately maintained id array |
| `db.js`'s 23 per-function `isDemoMode()` branches | Adding a new merged/derived data shape to a component without teaching `demoData.js`/`db.js`'s demo branch to produce it | Update `demoData.js` in the same commit as any new fetch shape a merged component depends on; load `/demo` to verify, don't just grep |
| `framer-motion` scope (currently 3 files) | Wrapping newly-merged composite components in motion by default because "the new aesthetic has motion" | Scope motion additions per-surface deliberately; explicitly exclude canvas/chart-heavy surfaces from added DOM-level motion |
| `lib/` modules power features that are "UI-scattered" (`hiringVelocity.js`, `networkCoverage.js`, `warmIntro.js`, `timelineFinder.js`) | Assuming a UI merge can just import all four into one component without checking for redundant/conflicting derived computations | Audit what each module already computes before merging their consuming UI, so the "unified" surface doesn't run overlapping logic twice |

## Performance Traps

Patterns that work at small scale but fail as usage grows within this specific merge.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Motion wrapping every row of the `@tanstack/react-table` Network table or Job Boards card grid | Frame drops on scroll/filter/sort, especially after adding hover/enter animations across a reskin | Keep animated elements to `transform`/`opacity`, scope per-item motion to enter/exit only, gate via `useReducedMotion` | Noticeable once the table/grid holds the kind of row count this app already has after a full Job Boards board-pull (dozens–hundreds of rows) |
| A single "unified attention" component owning fetch/derive logic for 5 merged sources | Any single interaction (e.g. logging one call) re-renders the entire merged panel including unrelated sub-sections | Compose independent per-source hooks at the top, memoize each slice, verify via React DevTools render highlighting | Becomes visible as soon as the merge phase ships — not a scale threshold, a design mistake that's present from day one |
| `NetworkGraphTab`'s `react-force-graph-2d` canvas plus new surrounding DOM motion | Combined frame budget competition between canvas simulation and CSS/JS-driven UI chrome animating nearby | Treat the canvas's existing render cost as the frame budget; don't add framer-motion wrapping directly around/inside the graph surface | Most visible on larger contact graphs (more nodes/edges) — worse as the real contact count grows over the recruiting season |

## Security Mistakes

Out of scope for the most part (this milestone explicitly excludes auth/BYOK/RLS changes), but two IA-adjacent risks are worth flagging.

| Mistake | Risk | Prevention |
|---------|------|------------|
| A consolidated nav accidentally exposing an authenticated-only view/route to the `/demo` (unauthenticated) surface during a merge | Anonymous demo visitors reaching a component that still expects `requireUser()`-gated data, producing a confusing 401 error surface (already an accepted known edge case for `DraftPanel`, but should not silently grow to more surfaces) | Explicitly re-check `DEMO_NAV_ITEMS`/`DEMO_NETWORK_VIEWS` membership any time a component gets relocated or merged into a newly-included nav destination |
| Reskin work touching `vercel.json`'s existing security headers or the SPA catch-all rewrite ordering while adjusting routing for the new IA | Could reintroduce the clickjacking gap the project already closed, or break the `/demo` hard-refresh 404 fix (rewrite order matters — `/demo`'s catch-all must stay last) | Treat `vercel.json`'s rewrite/header block as untouchable unless a phase explicitly calls for a routing change there, and if it must change, re-verify rewrite order and headers are intact afterward |

## UX Pitfalls

Common user-experience mistakes specific to this domain (dense recruiting CRM, daily-use, single power user).

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Merging "what needs my attention" surfaces without preserving each source's original urgency signal (deadline proximity, overdue days, stale-contact decay) | The unified front door becomes a flat list that's actually *less* scannable than the fragmented-but-purpose-built originals it replaced | Preserve each source's existing sort/urgency logic (`urgencyComparator`, `keepInTouchQueue`'s overdue calc, etc.) as sub-groupings within the unified view, not a single re-sorted flat list |
| Committing to a dense "industrial/control-panel" aesthetic without re-testing information density against the actual daily workflow (quick daily check-in vs. deep session) | A genuinely denser UI can slow down the exact "quick check what's due today" use case this milestone's Core Value statement calls out | Explicitly verify the unified front door against a "30-second daily check" scenario, not just visual review, before calling the phase done |
| Losing the mobile bottom-bar/FAB patterns' current placement consistency (Quick Capture, +Schedule, +Event) during nav restructure | Breaks an existing, already-working mobile muscle-memory pattern the milestone says should "carry forward, adapted" | Treat the mobile FAB positions as their own explicit checklist item per phase, verified on a real mobile viewport, not just desktop |

## "Looks Done But Isn't" Checklist

Things that appear complete after this kind of milestone but are missing critical pieces.

- [ ] **Nav consolidation:** Often missing an updated `DEMO_NAV_ITEMS`/`DEMO_NETWORK_VIEWS` — verify by actually loading `/demo` after every nav-touching phase, not just grepping component names.
- [ ] **Cross-tab deep-links:** Often missing re-verification of the *repeat-click* re-trigger behavior (the `ts: Date.now()` pattern), not just "does clicking it once land on the right screen" — verify by clicking "Find people →" for the same company twice in a row.
- [ ] **Visual reskin:** Often missing a sweep of low-traffic files (detail modals, Job Boards sub-app) — verify with a project-wide grep for stock Tailwind color utility classes outside the token system, and screenshot at least one rarely-opened surface, not just the main tabs.
- [ ] **Contrast on new tokens:** Often missing validation of *actually-used* text/background pairs (not just the raw palette swatches) — verify by running new pairings through the project's `dataviz` skill contrast validator, the same discipline already applied to chart colors.
- [ ] **localStorage key merges:** Often missing a migration step for renamed/reshaped `rec_*` keys — verify by checking whether a merge phase's diff includes a one-time read-old/write-new migration, or confirm the key is being intentionally dropped, not silently orphaned.
- [ ] **Motion additions:** Often missing a check that new animations are scoped away from canvas/chart-heavy surfaces (`NetworkGraphTab`, Recharts) — verify by confirming no new framer-motion wrapper sits directly around/inside those components.
- [ ] **Unified "attention" surface:** Often missing re-render isolation between merged sub-sections — verify with React DevTools render highlighting while triggering an update in only one underlying data source.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Broken cross-tab deep-link (Pitfall 1) | LOW | Re-trace the specific prop chain for that one jump; usually a single missing prop-thread, not a structural problem — fixable in one focused pass |
| Demo route drift (Pitfall 2) | LOW | Diff `NAV_ITEMS` against `DEMO_NAV_ITEMS`/`demoData.js` shapes; small, mechanical fix once identified |
| Half-migrated nav shipped and actively confusing daily use (Pitfall 3) | MEDIUM | Revert the nav-chrome change specifically (keep underlying refactored components) until the destination content catches up, rather than reverting the whole phase |
| Scope creep into backend/data model (Pitfall 4) | MEDIUM–HIGH | Isolate the out-of-scope changes into their own follow-up branch/backlog item rather than folding them into this milestone's history; revert if not yet merged |
| Inconsistent partial reskin (Pitfall 5) | MEDIUM | Run the stock-Tailwind-class grep, batch-fix remaining files in one dedicated sweep phase rather than trickling fixes in over time |
| Contrast regression discovered post-ship (Pitfall 6) | LOW–MEDIUM | Re-run affected token pairs through the contrast validator, adjust the specific token (not the whole palette) |
| Motion-induced perf regression (Pitfall 7) | LOW | Strip motion from the specific offending surface (table rows, graph-adjacent chrome) — motion was scoped to 3 files before, reverting to a similarly narrow scope is safe |
| State-colocation re-render regression (Pitfall 8) | MEDIUM | Split the over-centralized parent's fetch logic back into independent hooks per source; React DevTools Profiler pinpoints which sub-section over-renders |
| Silent localStorage data loss (Pitfall 9) | HIGH (data is genuinely gone, no backend copy) | No true recovery once overwritten — best available step is checking browser dev tools' Application storage snapshot/backup if one was taken, otherwise accept the loss and rebuild the queue/state going forward; this is why prevention (Pitfall 9's migration step) matters more than recovery here |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Broken cross-tab deep-links (1) | Nav/IA-restructure phase | Manually click every `onFindPeople`-style jump twice in a row post-refactor; confirm pre-filled state appears both times |
| Demo-route nav drift (2) | Every phase touching nav/tab ids (standing check, established in the first nav phase) | Load `/demo` after each such phase and diff its visible nav against intent |
| Half-migrated nav confusing daily use (3) | Roadmap sequencing itself (interleave chrome + content per surface, not chrome-first) | "Would I want to do my real daily CRM check right after this commit" gate per phase |
| Backend/data-model scope creep (4) | Every phase's plan-review step | Diff phase's touched files against PROJECT.md's stated file-boundary constraint before execution |
| Inconsistent token application (5) | End of visual-reskin phase(s), dedicated sweep | Grep for stock Tailwind color classes outside token names; screenshot a low-traffic surface |
| Contrast regressions (6) | Design-token-definition phase, re-checked at reskin-sweep | Run new token text/background pairs through the `dataviz` skill's contrast validator |
| Motion/perf regressions (7) | Motion/micro-interaction phase (scoped explicitly, likely late) | Spot-check scroll/filter perf on Network table and Job Boards grid; confirm no motion wraps `NetworkGraphTab`/Recharts internals |
| State-colocation re-render regressions (8) | "Unify what needs attention" consolidation phase | React DevTools render highlighting while updating only one underlying data source |
| localStorage key/data loss (9) | Whichever phase merges each specific `rec_*`-backed feature | Confirm migrate-or-intentionally-drop decision is explicit in that phase's plan for every touched key |

## Sources

- [Information Architecture for SaaS Dashboards: Ship Clarity, Not Chaos (Medium)](https://medium.com/@brandon.mccrae/information-architecture-for-saas-dashboards-ship-clarity-not-chaos-da5295cb8e82)
- [SaaS Navigation: Designing a Menu That Accelerates Adoption (Edana)](https://edana.ch/en/2026/04/26/saas-navigation-how-to-design-a-menu-that-accelerates-adoption-reduces-friction-and-supports-product-growth/)
- [Scaling Information Architecture Across Technology Service Organizations](https://informationarchitectureauthority.com/ia-scalability-technology-services)
- [Design Tokens & Theming: How to Build Scalable UI Systems in 2025](https://materialui.co/blog/design-tokens-and-theming-scalable-ui-2025)
- [Accessibility as Design System Policy: Tokens, Patterns, and Guardrails (TestParty)](https://testparty.ai/blog/accessibility-as-design-system-policy)
- [Visual Regression Testing for Design Systems: The 2026 Guide](https://lastest.cloud/blog/visual-regression-testing-design-systems-2026)
- [PLM Migration: A Guide to Best Practices & Strategies (context for phased/feature-flagged rollout patterns)](https://www.centricsoftware.com/blog/plm-migration)
- [A better way of solving prop drilling in React apps (LogRocket)](https://blog.logrocket.com/solving-prop-drilling-react-apps/)
- [Prop Drilling (Kent C. Dodds)](https://kentcdodds.com/blog/prop-drilling)
- [Framer Motion React Animations: Complete Guide (Refine)](https://refine.dev/blog/framer-motion/)
- [Choosing a React Animation Library: Performance Trade-Offs in Real Apps (Medium/Syncfusion)](https://medium.com/syncfusion/choosing-a-react-animation-library-performance-trade-offs-in-real-apps-5f9d6f5fa7ed)
- [The Strangler Fig Pattern — Azure Architecture Center (Microsoft Learn)](https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig)
- [The Strangler Fig Pattern and Microfrontends (Leander Hoedt)](https://www.leanderhoedt.dev/blog/strangler-fig)
- [Use the Strangler Fig Pattern to Modernize Your Web App Without Downtime (Dualboot Partners)](https://www.dualbootpartners.com/insights/strangler-fig-pattern/)
- Direct codebase verification (`app/src/App.jsx`, `app/src/components/layout/Sidebar.jsx`, `app/src/db.js`, `app/src/components/ExploreTab.jsx`, `app/src/components/ReferralCoverageTab.jsx`, `app/src/components/PipelineTab.jsx`, `app/src/components/ApplicationDetailModal.jsx`) — HIGH confidence, primary source, 2026-08-15

---
*Pitfalls research for: IA consolidation + visual reskin of an existing live single-maintainer recruiting CRM dashboard*
*Researched: 2026-08-15*
