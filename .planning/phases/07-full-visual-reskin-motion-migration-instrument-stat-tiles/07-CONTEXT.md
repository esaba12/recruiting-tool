# Phase 7: Full Visual Reskin + Motion Migration + Instrument Stat Tiles - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning
**Mode:** `--auto` (autonomous discussion — all gray areas resolved to their recommended option, logged below for review)

<domain>
## Phase Boundary

Phase 1 (2026-08-16) locked new industrial token *values* (cool gunmetal `ink` scale, safety-orange `accent`, WCAG-validated `success`/`warning`/`danger` ramps) with a deliberate "same names, zero call-site edits" constraint, and explicitly deferred everything about *shape* (border-radius, shadow, border-weight) and app-wide *coverage* — only 10 high-traffic files got touched. Six phases of IA consolidation since then (Today, Grow, SidePanel, Pipeline+Job Boards merge, Nav consolidation) landed the final, stable component tree this phase now sweeps in full. Phase 7 is the last phase of the milestone and covers three distinct deliverables (VIS-01, VIS-04, STAT-01):

1. **Full app-wide industrial sweep** — every screen, including low-traffic ones (Job Boards' `RepoStats`/`UserProfileView`, `CalendarTab`, `ExploreTab`, `ReferralCoverageTab`, `TimelineFindsPanel`), must visibly commit to the industrial/control-panel direction — not just color tokens (already done for 10 files in Phase 1) but genuine "sharp edges, dense data, dashboard-instrument feel" per PROJECT.md's Active requirement, which Phase 1 explicitly did not attempt (Card's shape was left untouched on purpose — see `01-UI-SPEC.md` line 108).
2. **Motion migration** — `framer-motion` → the `motion` package (its official successor, same team/API), a mechanical import-path swap across the 5 files that currently import it, plus new staggered-reveal motion added where VIS-04 asks for it. Explicitly excludes `NetworkGraphTab.jsx`'s force-directed canvas and Recharts' internal chart animation.
3. **Instrument-panel stat tiles (STAT-01)** — Today's activity/funnel display becomes gauge-like Mono readouts (funnel counts, days-to-deadline countdown, activity sparkline) instead of a generic card grid, built on the existing Recharts wiring (BarChart/DonutChart/TrendChart), not a rewrite into literal SVG dial gauges.

Out of scope (per PROJECT.md/REQUIREMENTS.md, unchanged this phase): backend/data-model changes, auth/BYOK/multi-tenant changes, new AI capabilities, a client-side router, mobile-native.

</domain>

<decisions>
## Implementation Decisions

### Shape system — the "sharp edges" commitment
- **D-01 [auto]:** Phase 7 introduces a real shape-system tightening, not just a color sweep: reduce the app's default corner radius from the current `rounded-xl`/`rounded-2xl` (generic-SaaS softness) down to `rounded-md` for panels/cards/tiles and `rounded-sm` for small chips/pills, reserving `rounded-full` only for genuinely circular elements (avatars, status dots). Pair this with a **flatter depth cue**: replace ambient `shadow-sm`/`shadow-2xl` soft shadows with a visible 1px `border-ink-200` (or `border-ink-300` for a stronger "bezel" read on primary panels) — a bordered flat panel reads as instrument-panel; a soft-shadowed rounded card reads as generic SaaS. This is the single highest-leverage visual change in the phase and should be defined once as new `ui/` primitive defaults (`Card`, `SidePanel`, `Modal`, `Section` panel styling) so every consumer picks it up for free, matching Phase 1's "primitives change once, most call sites get it free" pattern (only 3 of 8 primitives needed JSX diffs in Phase 1).
  - *[auto] Area: Shape system — Q: "Tighten radius + swap soft shadows for borders as a new primitive default (the literal 'sharp edges' ask), or leave shape alone and treat this phase as color/typography sweep only?" → Selected: "Tighten shape as new primitive defaults" (recommended — PROJECT.md's Active requirement explicitly names "sharp edges" as part of the aesthetic, and the user's global frontend-aesthetics directive calls out "uniform border radius everywhere" as a slop signal to avoid; Phase 1 deliberately left this for later, and this is that later)*

### App-wide sweep — method and known seed list
- **D-02 [auto]:** The sweep is systematic (grep-audit every remaining non-token hardcoded Tailwind color class and every remaining `shadow-sm`+`rounded-xl`/`2xl`+`bg-white` generic-card pattern across `app/src/components/`), not a fixed pre-enumerated file list — REQUIREMENTS.md's VIS-01 explicitly says "not just the high-traffic tabs." The following are already-confirmed hits from a light scout this session and should seed the audit (research should still re-run the grep fresh, this list is a floor, not a ceiling):
  - `charts/theme.js`'s `STATUS_CHART_COLORS`/`CHART_GRID`/`CHART_AXIS_TEXT` hex mirror is stale against Phase 1's actual token values (e.g. `ink-900` is `#16171d` in theme.js vs. the real `#101215` in `index.css`; `accent-500`/`600`, `success-500`, `warning-500`, `danger-500` are all off too) — re-derive and re-validate via the `dataviz` skill, per Phase 1's explicitly-deferred item (`PROJECT.md` Key Decisions table).
  - `ApplicationsView.jsx`'s inline `DuplicatesPanel` (renamed from a standalone file in Phase 5) hardcodes `orange-*` classes instead of `warning-*`/`accent-*` tokens.
  - `panels/JobPanelBody.jsx` and `panels/ApplicationPanelBody.jsx`'s "Analyze →" AI-fit button hardcodes `indigo-*`.
  - `CalendarTab.jsx` (follow-up event dot/chip), `ExploreTab.jsx` (domain badge), `ReferralCoverageTab.jsx` (referral-chain text), `TimelineFindsPanel.jsx` (source badge) all hardcode `indigo-*` instead of a token color.
  - `jobBoards/RepoJobsView.jsx`'s "Hide stale" toggle (`bg-warning-500 text-white`, 2.45:1) is a pre-existing WCAG contrast failure flagged in Phase 1 and explicitly deferred to this phase (`STATE.md` Blockers/Concerns) — fix to ≥4.5:1 alongside the rest of the warning ramp.
  - `jobBoards/RepoStats.jsx` and `jobBoards/UserProfileView.jsx` are the literal low-traffic examples named in ROADMAP's Phase 7 success criteria #1 — both still use the pre-Phase-1 `bg-white rounded-xl shadow-sm border-ink-100` generic-card pattern for their stat pills/profile card and need the same shape-system + token treatment as every other screen.
  - *[auto] Area: Sweep method — Q: "Systematic grep-based audit across the whole component tree, or a curated fixed file list?" → Selected: "Systematic audit, seeded with known hits" (recommended — matches VIS-01's explicit "every screen" wording; a fixed list risks under-covering exactly the low-traffic screens this requirement calls out by name)*

### Motion migration mechanics
- **D-03 [auto]:** Swap the npm dependency `framer-motion` (`^12.42.2`) for `motion`, and update the import in all 5 current call sites (`components/layout/AppShell.jsx`, `components/NotFoundPage.jsx`, `components/ui/Modal.jsx`, `components/ui/SidePanel.jsx`, `lib/useMediaQuery.js`) from `framer-motion` to `motion/react` — mechanical, since Motion is Framer Motion's own successor package with an API-compatible React import (`AnimatePresence`/`motion` export names unchanged). No new animation *behavior* is required for existing call sites, only the import swap.
- **D-04 [auto]:** New staggered-reveal motion (VIS-04's "new motion... implemented via the `motion` package") gets added specifically to: Today's `Section` list (staggered mount per section, matching the pattern already used for Today's KPI-card reveal per `app/src/components/OverviewTab.jsx`'s original mount animation before its Phase 6 merge) and the new STAT-01 tile row. Both use `motion/react`, never the old `framer-motion` import.
- **D-05 [auto]:** Explicit exclusions (per VIS-04, already true of the current code and must stay true): `NetworkGraphTab.jsx`'s `react-force-graph-2d` canvas gets no `motion` wrapper (it already has zero `framer-motion` usage — a canvas-rendered force graph isn't DOM-animatable the same way and re-confirms the existing scout finding). Recharts internals (`charts/BarChart.jsx`/`DonutChart.jsx`/`TrendChart.jsx`) keep Recharts' own internal transition/animation behavior as-is — do not wrap individual bars/slices/lines in `motion` components to add a second animation layer on top of Recharts' own.
  - *[auto] Area: Motion migration — Q: "Mechanical package+import swap only, or also take this as an opportunity to add motion to more surfaces than VIS-04 strictly requires?" → Selected: "Mechanical swap + the two VIS-04-named additions (Section stagger, stat tiles), nothing beyond" (recommended — avoids scope creep into a broader animation redesign not asked for; matches CLAUDE.md's existing discipline of "3 deliberate moments, not scattered micro-interactions")*

### Instrument-panel stat tiles (STAT-01)
- **D-06 [auto]:** The 3 named readouts (funnel counts, days-to-deadline countdown, activity sparkline) become a new **tile row** inserted at the top of `TodayTab.jsx`'s existing `ActivitySection` (line ~356, the `Section` already housing the ported-from-Overview funnel bar chart / status donut / trend chart per Phase 6's D-01) — not a replacement of those charts. The tile row is the "instrument gauge" summary; the existing full charts stay underneath as the detailed view, matching STAT-01's literal "reusing the existing Recharts wiring" constraint (a full SVG radial-dial gauge rewrite is explicitly not required and would conflict with that constraint). Tiles use the `Mono` primitive for their numeral readouts, the new bordered-flat shape system from D-01 (not `bg-white`/`shadow-sm`), and a tick-mark/segmented visual motif (e.g. a thin bottom border with small tick divisions, or a horizontal fill bar) rather than a literal circular gauge — full radial dial rendering is real added complexity STAT-01's wording doesn't require ("gauge-*like*", "instead of generic card grids" — the contrast being drawn is against soft rounded cards, not against non-radial layouts).
- **D-07 [auto]:** Days-to-deadline countdown data source: cross-reference Pipeline's `apps` (specifically Needs-Review/Applying-stage applications carrying a `Source Repo`/Company+Role match) against the `rec_job_deadlines` localStorage cache already populated by Job Boards' `useJobDeadlines` hook (`lib/deadlines.js` + `jobBoards/useJobDeadlines.js`), surfacing the single soonest confirmed deadline (or the top 2-3) — never inventing a date for rolling postings, matching `lib/deadlines.js`'s existing "only if the page actually states one" discipline. If no confirmed deadline exists in the cache, the tile fails soft (shows "No known deadlines" or is omitted), not a placeholder/fake countdown.
- **D-08 [auto]:** Activity sparkline reuses `TrendChart`'s existing trailing-10-week interaction data (already computed in `ActivitySection`) compressed into a compact inline sparkline form for the tile, rather than sourcing new data — the full-size `TrendChart` chart below stays as today's detailed view of the same signal.
  - *[auto] Area: Stat tile design — Q: "Tile row above/alongside the existing Activity charts (additive), or replace the charts entirely with tiles-only?" → Selected: "Additive tile row above existing charts" (recommended — STAT-01 says 'built on the existing Recharts wiring,' which reads as augmenting, not discarding, the Phase 6-ported Overview charts; a full replacement risks losing signal PROJECT.md's Charts section already validated through the `dataviz` skill)*

### Claude's Discretion
- Exact tile count/grid arrangement (3 vs. 4 tiles, single row vs. wrap), exact radius values (`rounded-md` vs `rounded-lg` — pick whichever full-app grep shows already has the least existing usage collision) and exact border-width/color pairing for the new flat-panel look are implementation detail for the UI-SPEC/planning stage (this phase has `UI hint: yes` in ROADMAP — a `/gsd-ui-phase` pass is expected before/alongside planning).
- Whether the tick-mark/segmented visual motif on stat tiles is a bottom border with divisions, a background gradient fill, or a thin progress bar is a visual-design call for the UI-spec stage, not locked here.
- Whether `motion`'s stagger on Today's `Section` list re-triggers on every navigation to Today or only on first mount is an implementation detail.
- Which exact `motion` package version to pin is a research-stage lookup, not a discussion decision.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone-level requirements and roadmap
- `.planning/REQUIREMENTS.md` §"Visual Reskin — Industrial / Control-Panel (VIS)" and §"Instrument-Panel Stat Tiles (STAT)" — VIS-01/02/03/04, STAT-01 acceptance criteria (VIS-02/03 already complete from Phase 1; only VIS-01/VIS-04/STAT-01 are this phase's work)
- `.planning/ROADMAP.md` §"Phase 7: Full Visual Reskin + Motion Migration + Instrument Stat Tiles" — goal, 3 success criteria, depends on Phase 6
- `.planning/PROJECT.md` — Core Value, Active requirement (industrial reskin wording, "sharp edges" literal quote), Constraints (Aesthetic standard: visually verify via render+screenshot before done; scope discipline: `app/src/components/`, `app/src/lib/`, `index.css` only), Key Decisions table (`charts/theme.js` hex-mirror sync explicitly deferred to Phase 7)
- `.planning/STATE.md` Blockers/Concerns — flags this phase must resolve: `RepoJobsView.jsx`'s WCAG-failing toggle, `ApplicationsView.jsx`/`JobPanelBody.jsx` hardcoded non-token colors, `charts/theme.js` stale hex mirror

### Phase 1 foundation this phase builds on and extends
- `.planning/phases/01-visual-foundation-industrial-design-tokens-primitives/01-UI-SPEC.md` — locked token *values* (aesthetic direction statement, color ramps, typography weights) this phase's shape-system work (D-01) extends but does not contradict; note line 108's explicit "Card shape unchanged this phase" scoping that Phase 7 is now free to revisit
- `app/src/index.css` `@theme` block — source of truth for current token hex values (used to re-derive `charts/theme.js`, D-02)

### Recent phases' precedent this phase's own extraction/shell decisions should follow
- `.planning/phases/06-navigation-consolidation-complete/06-CONTEXT.md` D-01 — confirms `ActivitySection`'s charts are the Phase-6-ported former-Overview content that D-06's tile row extends
- `.planning/phases/05-pipeline-job-boards-merge/05-CONTEXT.md` — confirms `DuplicatesPanel` now lives inline inside `ApplicationsView.jsx` (renamed from the old `PipelineTab.jsx`), relevant to D-02's seed list
- `app/CLAUDE.md` §"Design System (shipped July 2026)" and §"Charts (shipped July 2026)" — current baseline: fonts (Space Grotesk/Public Sans/IBM Plex Mono), the "framer-motion powers exactly 3 moments" discipline D-04 extends to a 5th (Today Section stagger + stat tiles), Recharts' `dataviz`-skill-validated color choices D-02's `charts/theme.js` resync must preserve

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/src/components/ui/Section.jsx` (`Section`/`RowCap`/`HEADING_COLOR`) — the shared section-chrome primitive already used by every Today block; D-06's tile row nests inside the existing `ActivitySection`'s `<Section title="Activity" accent="ink" icon={Activity}>` wrapper.
- `app/src/components/ui/Mono.jsx` — the dense-data typography primitive (IBM Plex Mono, `tabular-nums`, `tracking-wide`) already used across Network/Pipeline/Job Boards; D-06's tile numerals reuse this directly.
- `app/src/components/charts/{BarChart,DonutChart,TrendChart}.jsx` + `charts/theme.js` — existing Recharts wrappers STAT-01 explicitly must reuse, not replace.
- `app/src/lib/deadlines.js` (`daysUntil`, `extractDeadlines`) + `app/src/components/jobBoards/useJobDeadlines.js` (`rec_job_deadlines` cache) — existing deadline-extraction pipeline D-07's countdown tile sources from.
- 5 files currently importing `framer-motion` (exact D-03 edit list): `app/src/components/layout/AppShell.jsx`, `app/src/components/NotFoundPage.jsx`, `app/src/components/ui/Modal.jsx`, `app/src/components/ui/SidePanel.jsx`, `app/src/lib/useMediaQuery.js`.

### Established Patterns
- Phase 1's "primitives change once, most call sites get it free" precedent (`PROJECT.md` Key Decisions: only 3 of 8 `ui/` primitives needed JSX diffs when tokens changed) — D-01's shape-system change should follow the same playbook: touch `Card`/`SidePanel`/`Modal`/`Section` panel styling once, let most consumers inherit for free.
- `app/src/components/TodayTab.jsx`'s `ActivitySection` function (lines 319-393) — current full implementation of the funnel/donut/trend charts D-06's tile row sits above; `ActivitySection` is called once at line 511, the last section in `TodayTab`'s render.
- Confirmed via this session's scout: `NetworkGraphTab.jsx` has zero `framer-motion` imports today (grep returned no matches) — D-05's exclusion is already the status quo, this phase must not introduce a first one.

### Integration Points
- `app/package.json` — `framer-motion: ^12.42.2` dependency swap to `motion` (D-03).
- `app/src/components/TodayTab.jsx` line ~356-393 (`ActivitySection`) — insertion point for the new stat-tile row (D-06).
- Every file identified in D-02's seed list is an independent, isolated edit (no shared state) — safe to parallelize across planning waves the way Phase 1's token sweep was.

</code_context>

<specifics>
## Specific Ideas

No specific ideas beyond what's captured in `decisions` above — this was a fully autonomous (`--auto`) discussion; all gray areas were resolved to their recommended/lowest-risk option based on this phase's own ROADMAP goal/success-criteria wording, REQUIREMENTS.md's locked VIS/STAT acceptance criteria, the user's global frontend-aesthetics directive (quoted in PROJECT.md's Constraints), and this milestone's established "primitives change once" and "shell-wraps-existing-body" precedents from Phases 1/3/4/5. Flag any of the `[auto]`-tagged decisions above for a quick override before planning if a different call is preferred — in particular D-01 (the shape-system tightening) is the single decision most worth a human second look before research/planning proceeds, since it's the most visually consequential call in this phase and the most different from anything auto-selected in prior phases.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope (no scope-creep suggestions arose during the automated pass). Two related non-blocking items from `STATE.md` are explicitly folded INTO this phase's D-02 sweep rather than deferred further, since Phase 7 is the last phase of the milestone and the natural place to close them: the `RepoJobsView.jsx` WCAG contrast failure and the `charts/theme.js` stale hex mirror.

</deferred>

---

*Phase: 7-full-visual-reskin-motion-migration-instrument-stat-tiles*
*Context gathered: 2026-08-20*
