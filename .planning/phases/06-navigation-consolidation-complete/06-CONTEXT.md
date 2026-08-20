# Phase 6: Navigation Consolidation Complete - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning
**Mode:** `--auto`

<domain>
## Phase Boundary

Nav collapses from 7 top-level items (Today, Overview, Network, Grow, Pipeline, Calendar, Settings) to the literal 5 named in NAV-01 (Today, Network, Grow, Pipeline, Calendar). The math only works if **Overview folds into Today** (its own tab disappears) and **Settings relocates to a footer/profile affordance** (out of the primary `NAV_ITEMS` list, not deleted). NAV-03 requires auditing every existing cross-tab deep link (`goFindPeople`/`focusCompany` with `ts` re-trigger) still resolves correctly post-restructure. NAV-04 requires `/demo`'s trimmed nav and zero-BYOK guarantee to keep holding.

</domain>

<decisions>
## Implementation Decisions

### Overview → Today merge
- **D-01 [auto]:** `OverviewTab.jsx`'s remaining content (Application Funnel bar chart, Network-by-Status donut, Networking Activity trend chart — the KPI-card row was already effectively superseded by Today's own sections in Phase 2) is ported into `TodayTab.jsx` as a new `Section`-wrapped block, appended after the existing attention sections, using the same `Section`/`RowCap`/`HEADING_COLOR` primitives Today already uses (`ui/Section.jsx`). `OverviewTab.jsx` is deleted; the `'overview'` entry is removed from `Sidebar.jsx`'s `NAV_ITEMS` and from `App.jsx`'s render branches (both `AppInner` and `DemoApp`). Charts have no AI/BYOK dependency (pure client-side aggregation over `contacts`/`apps`/`interactions` already in props), so they carry into demo mode with zero new exclusion needed.
  - *[auto] Q: "Merge Overview's charts into Today as a new section, or drop them / relocate elsewhere?" → Selected: "Merge into Today" (recommended — it's the only way NAV-01's literal 5-item list is achievable, and matches the Section-append precedent already used for every other attention category)*

### Settings relocation
- **D-02 [auto]:** Settings moves out of `NAV_ITEMS` into the sidebar footer, as a new button in the same footer button group that already holds Quick Capture / + Schedule / + Event / Refresh (desktop) and the mobile bottom-bar equivalent — not a dropdown, not a profile-avatar menu. It still just calls `onTabChange('settings')`; `SettingsTab.jsx` itself is untouched. This is the lowest-risk interpretation of "footer/profile affordance" — reuses an existing footer-button pattern instead of inventing a new menu component.
  - *[auto] Q: "Footer button (reuse existing pattern) vs. new profile-avatar dropdown menu?" → Selected: "Footer button" (recommended — zero new UI pattern, matches NAV-02's literal wording, avoids scope creep into a menu component not asked for)*

### Deep-link audit (NAV-03)
- **D-03 [auto]:** Not a design decision — a verification task. Enumerate every `onFindPeople`/`goFindPeople`/`focusCompany` call site (`App.jsx`'s `goFindPeople`, `PipelineTab.jsx`→`ApplicationsView.jsx`, `TodayTab.jsx`, `GrowTab.jsx`'s People section) and confirm each still resolves to Grow's People section with the `{company, ts}` re-trigger shape intact after Overview's removal and Settings' relocation (neither of which should touch this relay, but must be spot-checked per STATE.md's standing blocker on this exact risk).

### /demo route (NAV-04)
- **D-04 [auto]:** `DEMO_NAV_ITEMS` (`App.jsx`) drops `'overview'` (merged away) and keeps `['today', 'network', 'pipeline']` — unchanged otherwise (`'grow'` stays excluded, needs BYOK; `'settings'` was never in the demo list). `DemoApp`'s Today render should show the merged charts section same as authenticated Today, since it's demo-data-only with no proxy calls.

### Claude's Discretion
- Exact placement of the merged charts section within Today's section order (before/after existing attention sections) — implementation detail.
- Footer button icon/label for Settings — reuse `NAV_ICON.settings` (gear) already defined in `lib/icons.js`.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` §"Navigation (NAV)" — NAV-01..04 acceptance criteria
- `.planning/ROADMAP.md` §"Phase 6: Navigation Consolidation Complete" — goal, success criteria, depends on Phases 2/3/5
- `.planning/PROJECT.md` — Compatibility constraint (`/demo` route), scope discipline
- `.planning/STATE.md` Blockers/Concerns — standing note that cross-tab deep-link relay is "easy to silently break during relocations," to be formally verified this phase (NAV-03)
- `app/src/components/ui/Section.jsx` — the Section/RowCap primitive Today's merged charts section must use
- `app/src/components/TodayTab.jsx` — target file for the Overview merge
- `app/src/components/OverviewTab.jsx` — source file being folded in and deleted

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/src/components/charts/{BarChart,DonutChart,TrendChart}.jsx` — unchanged, just re-imported into `TodayTab.jsx` instead of `OverviewTab.jsx`
- `app/src/components/layout/Sidebar.jsx` — `NAV_ITEMS` array (7→5) and footer button group (add Settings here)
- `app/src/App.jsx` — `goFindPeople` (line ~230), render branches for both `AppInner` (line ~305-325) and `DemoApp` (line ~397-409), `DEMO_NAV_ITEMS` (line 358)

### Integration Points
- `App.jsx`'s `tab === 'overview'` branches (both AppInner and DemoApp) removed; `TodayTab` gains the charts data props it needs (already receives `contacts`/`apps`/`interactions`, same data Overview used)
- `Sidebar.jsx` footer button group — insert Settings alongside Quick Capture/+Schedule/+Event/Refresh

</code_context>

<specifics>
No specific ideas beyond decisions above — fully autonomous `--auto` pass.
</specifics>

<deferred>
None — discussion stayed within phase scope.
</deferred>

---

*Phase: 6-navigation-consolidation-complete*
*Context gathered: 2026-08-20*
