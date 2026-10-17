# Phase 6: Navigation Consolidation Complete - Research

**Researched:** 2026-08-20
**Domain:** React/Vite navigation restructuring — tab-id removal/relocation, cross-tab deep-link relay audit, zero backend/data-model change
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Overview → Today merge:** `OverviewTab.jsx`'s remaining content (Application Funnel bar chart, Network-by-Status donut, Networking Activity trend chart — the KPI-card row was already effectively superseded by Today's own sections in Phase 2) is ported into `TodayTab.jsx` as a new `Section`-wrapped block, appended after the existing attention sections, using the same `Section`/`RowCap`/`HEADING_COLOR` primitives Today already uses (`ui/Section.jsx`). `OverviewTab.jsx` is deleted; the `'overview'` entry is removed from `Sidebar.jsx`'s `NAV_ITEMS` and from `App.jsx`'s render branches (both `AppInner` and `DemoApp`). Charts have no AI/BYOK dependency (pure client-side aggregation over `contacts`/`apps`/`interactions` already in props), so they carry into demo mode with zero new exclusion needed.

**D-02 — Settings relocation:** Settings moves out of `NAV_ITEMS` into the sidebar footer, as a new button in the same footer button group that already holds Quick Capture / + Schedule / + Event / Refresh (desktop) and the mobile bottom-bar equivalent — not a dropdown, not a profile-avatar menu. It still just calls `onTabChange('settings')`; `SettingsTab.jsx` itself is untouched. This is the lowest-risk interpretation of "footer/profile affordance" — reuses an existing footer-button pattern instead of inventing a new menu component.

**D-03 — Deep-link audit (NAV-03):** Not a design decision — a verification task. Enumerate every `onFindPeople`/`goFindPeople`/`focusCompany` call site (`App.jsx`'s `goFindPeople`, `PipelineTab.jsx`→`ApplicationsView.jsx`, `TodayTab.jsx`, `GrowTab.jsx`'s People section) and confirm each still resolves to Grow's People section with the `{company, ts}` re-trigger shape intact after Overview's removal and Settings' relocation (neither of which should touch this relay, but must be spot-checked per STATE.md's standing blocker on this exact risk).

**D-04 — /demo route (NAV-04):** `DEMO_NAV_ITEMS` (`App.jsx`) drops `'overview'` (merged away) and keeps `['today', 'network', 'pipeline']` — unchanged otherwise (`'grow'` stays excluded, needs BYOK; `'settings'` was never in the demo list). `DemoApp`'s Today render should show the merged charts section same as authenticated Today, since it's demo-data-only with no proxy calls.

### Claude's Discretion

- Exact placement of the merged charts section within Today's section order (before/after existing attention sections) — implementation detail.
- Footer button icon/label for Settings — reuse `NAV_ICON.settings` (gear) already defined in `lib/icons.js`.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NAV-01 | User reaches Today, Network, Grow, Pipeline, Calendar from a ~5-item persistent nav, down from 8 top-level tabs | Architecture Patterns → Pattern 1 gives the exact `NAV_ITEMS` array diff (7→5 entries: drop `'overview'` per D-01, drop `'settings'` per D-02); Common Pitfalls #1 flags the `useState('overview')` default-tab bug that must be fixed in the same commit or the app renders blank on load |
| NAV-02 | User reaches Settings via a footer/profile affordance rather than a primary nav slot | Architecture Patterns → Pattern 2 gives the exact `Sidebar.jsx` footer-button-group insertion point (desktop `<aside>` footer + mobile floating-action stack) and the `hideQuickActions`/`demoMode` gating needed so the button doesn't appear where Settings isn't renderable; Common Pitfalls #2 flags the mobile-bottom-bar Settings-access gap this creates if the floating stack isn't also extended |
| NAV-03 | Every existing cross-tab deep link (e.g. "Find people →" from Pipeline/Grow into Discover) continues to work, including repeat-click re-triggering on the same target company | Architecture Patterns → System Architecture Diagram traces the full `goFindPeople`/`onFindPeople`/`focusCompany` relay end-to-end (5 entry points, 2 hop shapes); Common Pitfalls #3 explains the unmount/remount mechanism the repeat-click re-trigger structurally depends on and names the exact invariant this phase must not disturb |
| NAV-04 | The public `/demo` route continues to show its trimmed nav and function with zero backend/BYOK dependency | Architecture Patterns → Pattern 1 covers `DEMO_NAV_ITEMS`'s filter-list update; Runtime State Inventory confirms no `rec_*` localStorage key or demo-mode branch in `db.js` references the `'overview'`/`'settings'` tab ids, so no data-layer follow-up is needed beyond the two `App.jsx` id-string edits |

</phase_requirements>

## Summary

This is a pure component-tree/navigation-array reshuffle with zero new packages, zero data-model changes, and zero new external calls — every fact needed to plan it accurately comes from reading the actual current source (`App.jsx`, `layout/Sidebar.jsx`, `layout/AppShell.jsx`, `TodayTab.jsx`, `OverviewTab.jsx`, `GrowTab.jsx`, `ExploreTab.jsx`, `ReferralCoverageTab.jsx`, `DiscoverTab.jsx`, `ApplicationsView.jsx`, `panels/ApplicationPanelBody.jsx`, `lib/icons.js`, `db.js`), not framework documentation. The governing precedent for the chart-merge half of this phase is Phase 2's Today-tab build (Section-wrapped blocks over already-fetched props) and Phase 3's `GrowTab.jsx` (Section-per-child shell) — both already established; this phase adds one more Section to Today rather than inventing new UI. The governing precedent for the nav-shrink half is Phase 5's `NAV_ITEMS`/`DEMO_NAV_ITEMS` array-filter edit (removing `'github'`) — this phase repeats that exact pattern twice (`'overview'` removed entirely, `'settings'` moved out of the array into the footer).

Three findings from direct source inspection are **not explicitly stated in 06-CONTEXT.md** but are structurally required for the phase to work at all, and are the centerpiece of this research:

1. **`useState('overview')` is the initial-tab default in both `AppInner` (App.jsx:225) and `DemoApp` (App.jsx:361).** Once the `'overview'` render branch is deleted per D-01, this default must change to `'today'` in both places, or the app boots to a blank main content area on every fresh load — this is not an edge case, it's what a plan that literally only does "delete OverviewTab, remove nav entry" would ship broken.
2. **Removing `'settings'` from `NAV_ITEMS` also removes it from the mobile bottom nav bar** (`Sidebar.jsx`'s mobile `<nav>` at lines 86-99 maps the same `navItems` array the desktop `<aside>` does). D-02's footer-button plan only describes a desktop-`<aside>`-footer insertion; the existing "mobile bottom-bar equivalent" it references for Quick Capture/+Schedule/+Event is a **separate floating-button stack** (`md:hidden fixed ... bottom-{52,36,20}`), not the bottom nav bar itself. Without extending that floating stack, mobile users lose all access to Settings — including BYOK key management, which is load-bearing functionality (nothing AI-powered works without it) for a solo-maintainer who uses this app daily, per STATE.md's live-use blocker.
3. **The Grow deep-link repeat-click re-trigger depends on `GrowTab` being conditionally *unmounted*, not hidden, when `tab !== 'grow'`.** `GrowTab.jsx` seeds its `peopleFocus` state via `useState(initialPeopleFocus)` — a `useState` initializer only runs on mount. The only reason clicking "Find people →" on the same company twice in a row re-triggers `DiscoverTab`'s fetch is that `App.jsx`'s `{!loading && tab === 'grow' && <GrowTab .../>}` is a plain conditional (component unmounts fully when the tab changes away, remounts fresh with a new `ts` when it comes back). This phase's `App.jsx` edits (removing the `'overview'` branch, wiring the Settings footer button) must not change this render pattern to an always-mounted/CSS-hidden one, even as a "cleanup" — doing so would silently break NAV-03's repeat-click requirement with no visible symptom until a user clicks "Find people" on the same company twice.

**Primary recommendation:** Treat this phase as three independent, narrowly-scoped edits rather than one "navigation cleanup": (a) fold `OverviewTab.jsx`'s three charts into `TodayTab.jsx` as a new Section and fix both `useState('overview')` defaults to `'today'` in the same commit; (b) add a Settings button to both the desktop footer group and the mobile floating-action stack, gated the same way the existing quick actions already are (`!hideQuickActions`, which is 1:1 with `!demoMode` at the only call site); (c) run the NAV-03 deep-link audit as a pure verification pass — the relay code (`App.jsx`'s `goFindPeople`/`growFocusCompany`, `GrowTab.jsx`'s `goToPeople`, `ExploreTab.jsx`/`ReferralCoverageTab.jsx`'s direct calls, `DiscoverTab.jsx`'s `focus?.ts`-keyed effect) needs zero code changes, only confirmation that (a) and (b) didn't touch it.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Nav item list / active-tab state | Browser / Client | — | Pure `useState` in `App.jsx`, rendered by `Sidebar.jsx` — no server involvement, unchanged this phase |
| Settings footer/mobile-floating affordance | Browser / Client | — | New button, same `onTabChange('settings')` call the old nav item made — zero new data dependency |
| Merged Today charts (funnel/donut/trend) | Browser / Client | — | Pure client-side aggregation over already-fetched `contacts`/`apps`/`interactions` props — same tier `OverviewTab.jsx` already used, just re-homed |
| Cross-tab deep-link relay (`goFindPeople`/`focusCompany`) | Browser / Client | — | Entirely in-memory React state passed via props/callbacks — no persistence, no API call, unaffected by tier boundaries |
| `/demo` route nav trimming | Browser / Client | — | `DEMO_NAV_ITEMS` is a client-side array filter keyed on `window.location.pathname`; `db.js`'s `isDemoMode()` branches are separate and unaffected by nav-id changes |

## Standard Stack

No new libraries. This phase reuses only what's already imported project-wide.

### Core
| Library | Version (confirmed installed) | Purpose | Why no change needed |
|---------|------|---------|------|
| react | ^18.3.1 | Component tree, `useState` | Same primitive `TodayTab.jsx`/`GrowTab.jsx`/`Sidebar.jsx` already use |
| lucide-react | ^1.23.0 | Icons | `NAV_ICON.settings` (the `Settings` gear icon) already exists in `lib/icons.js` — reused verbatim per Claude's Discretion; `BarChart3`/`TrendingUp`/`Activity`/`PieChart` all confirmed present in the installed version if a new icon is wanted for the merged charts Section (none is required — see Code Examples) |
| framer-motion | ^12.42.2 | Tab-switch fade transition | Already wraps `{children}` in `AppShell.jsx`'s `AnimatePresence`/`motion.div` — no new motion code needed for a nav-array shrink |
| recharts | ^3.9.2 | `BarChartWrapper`/`DonutChart`/`TrendChart` | Already imported by `OverviewTab.jsx`; the merge only changes *which file* imports them (`./charts/BarChart.jsx` etc. — same relative path works unchanged since `TodayTab.jsx` and `OverviewTab.jsx` are siblings in `app/src/components/`) |

**Installation:** None — no `npm install` needed for this phase.

**Version verification:** Confirmed directly against `app/package.json` and `app/node_modules/` (react 18.3.1, lucide-react 1.23.0, framer-motion 12.42.2, recharts 3.9.2, all present on disk). No test framework is installed (`app/package.json` has only `dev`/`build` scripts); `.planning/config.json` has `nyquist_validation: false`, so no Validation Architecture section is required for this phase's research.

## Package Legitimacy Audit

Not applicable — this phase introduces zero new npm/pip/cargo packages. No registry check was needed or run.

## Architecture Patterns

### System Architecture Diagram

```
App.jsx (AppInner)
  │ useState('overview') ⚠ MUST become useState('today') — see Pitfall 1
  │ growFocusCompany state + goFindPeople(company) = setGrowFocusCompany({company, ts:Date.now()}); setTab('grow')
  ▼
Sidebar.jsx
  │ NAV_ITEMS: [today, overview, network, grow, pipeline, calendar, settings]  (7, current)
  │        →   [today, network, grow, pipeline, calendar]                     (5, this phase — NAV-01)
  │ NEW: footer button "Settings" → onTabChange('settings')  (desktop <aside> footer — NAV-02)
  │ NEW: mobile floating-action button "Settings" → onTabChange('settings')  (parity fix — see Pitfall 2)
  ▼
App.jsx render branches
  │ tab === 'overview'  ──DELETED (D-01)
  │ tab === 'today'     ──▶ TodayTab (gains merged charts Section — D-01)
  │ tab === 'network'   ──▶ NetworkTab (untouched)
  │ tab === 'grow'      ──▶ GrowTab   (untouched — DO NOT change conditional-render shape, see Pitfall 3)
  │ tab === 'pipeline'  ──▶ PipelineTab (untouched)
  │ tab === 'calendar'  ──▶ CalendarTab (untouched)
  │ tab === 'settings'  ──▶ SettingsTab (untouched — now reached only via footer button, not NAV_ITEMS)

─────────────────────────── NAV-03 deep-link relay (verify only, no code change) ───────────────────────────

Entry points that call the App.jsx-level goFindPeople(company):
  TodayTab.jsx ──onFindPeople prop──▶ ApplicationPanelBody.jsx's NetworkAtCompany "Find people at X" button
  PipelineTab.jsx ──onFindPeople prop──▶ ApplicationsView.jsx ──onFindPeople prop──▶ ApplicationPanelBody.jsx (same component, same button)
       │
       ▼
  goFindPeople(company): setGrowFocusCompany({company, ts:Date.now()}); setTab('grow')
       │
       ▼
  GrowTab.jsx mounts fresh (was unmounted while tab !== 'grow')
    useState(initialPeopleFocus)  ← seeds from growFocusCompany, fresh `ts` each remount
    peopleFocus ──focus prop──▶ DiscoverTab.jsx
                                   useEffect([focus?.ts]) → findPeople(focus.company) if not already discovered
                                   rowRefs Map + ring-2 ring-accent-300 highlight on the matching row

Entry points that call GrowTab's own goToPeople(company) directly (already inside Grow, no App.jsx hop):
  ExploreTab.jsx's CompanyCard "Find people →" button ──onFindPeople={goToPeople}
  ReferralCoverageTab.jsx's row "Find people" button   ──onFindPeople={goToPeople}
       │
       ▼
  goToPeople(company): peopleSectionRef.scrollIntoView(); setPeopleFocus({company, ts:Date.now()})
       │
       ▼
  DiscoverTab.jsx (same useEffect([focus?.ts]) as above — GrowTab is already mounted here, so the
  useState(initialPeopleFocus) mount-seed path is irrelevant; the setPeopleFocus call directly changes
  focus?.ts, which re-fires the effect even without an unmount/remount)
```

A reader can trace NAV-03's full requirement by following the two entry-point families down to `DiscoverTab.jsx`'s single `useEffect([focus?.ts])` — neither family passes through anything D-01/D-02 touch (`OverviewTab.jsx`, `Sidebar.jsx`'s `NAV_ITEMS` array, the Settings render branch), which is exactly why the audit should find zero regressions **if and only if** Pitfall 3 (below) is respected.

### Recommended Project Structure

No new files or directories. Deleted: `app/src/components/OverviewTab.jsx`. Modified: `app/src/App.jsx`, `app/src/components/layout/Sidebar.jsx`, `app/src/components/TodayTab.jsx`. Everything else (`GrowTab.jsx`, `ExploreTab.jsx`, `ReferralCoverageTab.jsx`, `DiscoverTab.jsx`, `PipelineTab.jsx`, `ApplicationsView.jsx`, `panels/ApplicationPanelBody.jsx`, `lib/icons.js`) is read-only context for the NAV-03 audit, not an edit target.

### Pattern 1: Nav-array shrink (`NAV_ITEMS` / `DEMO_NAV_ITEMS`)

**What:** Remove/relocate string ids from the two arrays that drive both the desktop sidebar and mobile bottom bar (`Sidebar.jsx`'s `NAV_ITEMS`) and the demo route's filtered subset (`App.jsx`'s `DEMO_NAV_ITEMS`).
**When to use:** Exactly this phase's D-01 (drop `'overview'`) and D-02 (drop `'settings'`) — this is the same pattern Phase 5 already used to drop `'github'`.
**Example (current state, for reference):**
```javascript
// app/src/components/layout/Sidebar.jsx — current (7 items)
const NAV_ITEMS = [
  { id: 'today', label: 'Today' },
  { id: 'overview', label: 'Overview' },   // ← DELETE (D-01)
  { id: 'network',  label: 'Network' },
  { id: 'grow',     label: 'Grow' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'settings', label: 'Settings' },   // ← DELETE from this array (D-02, moves to footer)
]

// app/src/App.jsx — current
const DEMO_NAV_ITEMS = NAV_ITEMS.filter(item => ['today', 'overview', 'network', 'pipeline'].includes(item.id))
// → becomes: ['today', 'network', 'pipeline'].includes(item.id)   (D-04 — 'grow'/'settings' were never in this list)
```
Result: `NAV_ITEMS` becomes exactly the 5 entries NAV-01 names (today, network, grow, pipeline, calendar) — both the desktop `<aside>` nav list and the mobile bottom `<nav>` bar read this same array (`Sidebar.jsx` lines 28 and 88), so both surfaces shrink together automatically with no separate mobile-specific edit needed for *this* part.

### Pattern 2: Footer-button affordance (Settings — NAV-02)

**What:** A plain button inside `Sidebar.jsx`'s existing footer button group(s) that calls the already-available `onTabChange('settings')` — no new prop needed on `Sidebar`/`AppShell`, since `onTabChange` is already threaded all the way through.
**When to use:** D-02, for both the desktop `<aside>` footer and — per this research's Pitfall 2 finding — the mobile floating-action stack, so Settings access has actual mobile parity rather than silently disappearing.
**Example:**
```javascript
// app/src/components/layout/Sidebar.jsx — desktop <aside> footer (lines 49-68 today)
// Insert alongside the existing !hideQuickActions-gated buttons — this reuses hideQuickActions
// (already 1:1 with demoMode at its only call site, AppShell.jsx line 19: hideQuickActions={demoMode})
// rather than inventing a new prop, and correctly hides Settings in demo mode where it's
// unreachable (DemoApp has no tab === 'settings' render branch).
{!hideQuickActions && (
  <>
    <button onClick={onQuickCapture} ...>Quick Capture</button>
    <button onClick={onAddSchedule} ...>+ Schedule</button>
    <button onClick={onAddEvent} ...>+ Event</button>
    <button onClick={() => onTabChange('settings')}
      className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
        ${activeTab === 'settings' ? 'bg-accent-500 text-white' : 'bg-ink-800 text-ink-100 hover:bg-ink-700'}`}>
      <NAV_ICON.settings size={13} />
      Settings
    </button>
  </>
)}

// Mobile floating-action stack (lines 101-117 today) — needs a 4th button at a new offset.
// Existing offsets step by -16 in Tailwind's spacing scale (52 → 36 → 20); the next standard
// scale value above 52 is 56 (14rem) — confirmed a default Tailwind spacing key, not arbitrary.
{!hideQuickActions && (
  <>
    <button onClick={() => onTabChange('settings')}
      className="md:hidden fixed right-4 bottom-56 z-30 w-12 h-12 rounded-full bg-ink-800 text-white shadow-lg flex items-center justify-center hover:bg-ink-700">
      <NAV_ICON.settings size={20} />
    </button>
    <button onClick={onQuickCapture} className="... bottom-52 ...">...</button>
    <button onClick={onAddSchedule} className="... bottom-36 ...">...</button>
    <button onClick={onAddEvent} className="... bottom-20 ...">...</button>
  </>
)}
```
`NAV_ICON.settings` already resolves to `lucide-react`'s `Settings` (gear) icon — no new import beyond what `Sidebar.jsx` needs to add (`import { NAV_ICON, ... } from '../../lib/icons.js'` already imports `NAV_ICON` as a whole object at line 1, so `NAV_ICON.settings` is already available, no new import statement required at all).

### Pattern 3: Section-merge for Today's new charts block (D-01)

**What:** Wrap `OverviewTab.jsx`'s three chart blocks (Application Funnel, Network by Status donut, Networking Activity trend) in a `Section` and append to `TodayTab.jsx`'s existing stack, reusing `contacts`/`apps`/`interactions` — all three are already props `TodayTab` receives (see its current signature, `TodayTab.jsx:306`), so **no new prop threading through `App.jsx` is needed** for this half of the phase.
**When to use:** D-01.
**Example:**
```javascript
// TodayTab.jsx — new imports (charts + theme, same relative paths OverviewTab.jsx used,
// since both files live in app/src/components/)
import BarChartWrapper from './charts/BarChart.jsx'
import DonutChart from './charts/DonutChart.jsx'
import TrendChart from './charts/TrendChart.jsx'
import { STATUS_CHART_COLORS } from './charts/theme.js'
import { STATUS_COLOR, TERMINAL_STAGES, INTERVIEW_STAGES, isUntriaged } from '../shared.jsx' // isUntriaged/TERMINAL/INTERVIEW not yet imported in TodayTab — STATUS_COLOR already is

// Inside TodayTab, before the allEmpty gate's early return (charts must render even when the
// attention-item lists above are all empty — this is Claude's Discretion territory, but note
// the current allEmpty early-return at line 351 would need to explicitly exclude the charts
// block from that gate, or the charts silently never render for a caught-up user, which is a
// worse regression than OverviewTab.jsx ever had (Overview always rendered its charts
// unconditionally, gated only on hasRecruitingActivity/hasInteractions/contacts.length, never
// on "nothing needs attention")

<Section title="Activity" accent="ink" icon={BarChart3 /* or TrendingUp/Activity — any confirmed-present lucide icon; LayoutDashboard was overview's icon and is now free but semantically tied to the deleted tab */}>
  {/* Application Funnel — funnelData/conversions computed exactly as OverviewTab.jsx did, ported verbatim */}
  {/* Network by Status donut — donutData computed exactly as OverviewTab.jsx did */}
  {/* Networking Activity trend — trendData computed exactly as OverviewTab.jsx did */}
</Section>
```
The "Your Network" preview card (`NetworkGraphView` + `onOpenGraph` deep-link into Network's Graph view) and the KPI-card row are **not** named in D-01's "remaining content" list — see Open Questions below for why this research recommends dropping both rather than porting them.

### Anti-Patterns to Avoid

- **Changing `GrowTab`'s conditional-render shape to always-mounted-hidden ("performance optimization"):** breaks the `useState(initialPeopleFocus)` mount-seed mechanism NAV-03's repeat-click requirement structurally depends on (Pitfall 3). Leave `{!loading && tab === 'grow' && <GrowTab .../>}` exactly as-is.
- **Adding a new `onSettingsClick` prop to `Sidebar`/`AppShell`:** unnecessary — `onTabChange` is already threaded all the way through both components; the footer button just needs to call `onTabChange('settings')` directly, matching how the old `NAV_ITEMS` entry's button worked.
- **Gating the Settings footer button on a brand-new `demoMode` check instead of reusing `hideQuickActions`:** creates two independent booleans that happen to correlate today but could silently drift if a future phase ever decouples them (e.g. showing Quick Capture but not Settings in some future demo variant). Reuse `hideQuickActions` since it's the existing, already-correct gate.
- **Leaving `useState('overview')` in place because "it'll just render nothing, not crash":** technically true (no error thrown), but ships a broken first-load experience that a smoke test would only catch by actually loading the app — flagged explicitly so it's caught in code review, not human UAT.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Section/RowCap chrome for the new charts block | A new bespoke card wrapper | `ui/Section.jsx`'s existing `Section`/`RowCap`/`HEADING_COLOR` exports | Already extracted in Phase 3 specifically so any future page (this one included) reuses the exact same shell — CONTEXT.md's canonical refs already point here |
| Settings active-state styling | A new color/variant | Copy the existing `NAV_ITEMS` button's active-state class logic (`active ? 'bg-accent-500 text-white' : 'text-ink-300 hover:bg-ink-800 hover:text-white'`), adapted to the footer button's existing base classes | Keeps one visual language for "this is the current destination" across both the nav list and the footer |
| Deep-link re-trigger mechanism | A new explicit "force refresh" flag/counter passed down | The existing `{company, ts: Date.now()}` shape + `useEffect([focus?.ts])` pattern, already implemented identically in `ReferralCoverageTab.jsx` and `DiscoverTab.jsx` | This phase doesn't need to touch this at all — it only needs to verify it's untouched. Inventing a parallel mechanism would be pure regression risk with zero benefit |

**Key insight:** every piece of UI chrome this phase needs (Section wrapper, active-nav-item styling, deep-link re-trigger) already exists in the codebase from Phases 2/3. This phase's actual work is subtractive (delete a file, shrink two arrays) and additive-by-composition (reuse `Section`, add one button using an existing icon and an existing callback) — there is no case here where a custom solution is even tempting.

## Runtime State Inventory

> This phase renames/removes UI tab-id strings (`'overview'`, and relocates `'settings'`'s reachability). It is not a data-model rename, but STATE.md's standing blocker ("`/demo` route drift risk... any phase that renames a tab id... must update these in the same commit") makes this inventory worth running explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — grepped all 29 distinct `rec_*` localStorage keys used app-wide (`rec_affinity_profile`, `rec_discovered*`, `rec_company_*`, `rec_target_companies`, `rec_tracked_boards`, `rec_job_blurbs`, `rec_job_deadlines`, `rec_posting_history`, `rec_timeline_*`, `rec_prefs`); none reference `'overview'` or `'settings'` as a value or key fragment — all are feature-domain keys, not nav-tab-id keys | None |
| Live service config | None — Supabase tables (`contacts`, `applications`, `calls`, `interactions`, `user_api_keys`, `google_calendar_tokens`) have no column storing a "last active tab" or "settings" identifier | None |
| OS-registered state | None applicable — this is a pure frontend nav change, no OS-level registration involved | None |
| Secrets/env vars | None — no env var or BYOK key name references `'overview'`/`'settings'` | None |
| Build artifacts | None — no build output embeds tab-id strings in a way a source rename wouldn't already fix (Vite bundles from source on every build) | None |
| In-memory tab-id references (not persisted, but must all move together) | `App.jsx:225` (`useState('overview')`), `App.jsx:305` (`tab === 'overview'` branch), `App.jsx:358` (`DEMO_NAV_ITEMS` filter), `App.jsx:361` (`useState('overview')`, DemoApp), `App.jsx:397` (`tab === 'overview'` branch, DemoApp), `Sidebar.jsx:5` (`NAV_ITEMS` entry) — 6 total references to `'overview'`, all in these two files | All 6 must change in the same commit — see Common Pitfalls #1 |

**Canonical answer:** after this phase's file edits, no runtime system anywhere (Supabase, localStorage, env vars, build output) still carries the `'overview'` tab id — it only ever existed as an in-memory React string, fully contained in `App.jsx` and `Sidebar.jsx`.

## Common Pitfalls

### Pitfall 1: Stale `useState('overview')` default leaves the app blank on load
**What goes wrong:** After D-01 deletes the `tab === 'overview'` render branch, `AppInner`'s and `DemoApp`'s `useState('overview')` initial tab value no longer matches any render branch — on first load (before the user clicks any nav item), the main content area renders nothing.
**Why it happens:** The initial-tab default and the render-branch list are two independently-editable pieces of code that must stay in sync; deleting one without checking the other is an easy oversight, especially since it produces no error, just a silent blank screen.
**How to avoid:** Change both `useState('overview')` calls (`App.jsx:225` and `App.jsx:361`) to `useState('today')` in the same commit that deletes the `'overview'` render branches.
**Warning signs:** Loading the app (or `/demo`) and seeing the sidebar/nav render correctly but the main content area empty with no error in the console.

### Pitfall 2: Settings becomes mobile-unreachable
**What goes wrong:** Removing `'settings'` from `NAV_ITEMS` removes it from both the desktop sidebar list *and* the mobile bottom nav bar (`Sidebar.jsx`'s mobile `<nav>` at lines 86-99 maps the same array). If only the desktop `<aside>` footer gains a new Settings button (the literal reading of D-02's "footer button" framing), mobile users lose all access to Settings — including BYOK key management, which every AI-powered feature in the app depends on.
**Why it happens:** D-02's context describes "the same footer button group that already holds Quick Capture / + Schedule / + Event / Refresh (desktop) and the mobile bottom-bar equivalent" — but the actual "mobile bottom-bar equivalent" of that footer group is the separate floating-action button stack (`md:hidden fixed ... bottom-{52,36,20}`), not the bottom nav bar itself (which just lost its Settings entry). It's easy to read D-02 as "add one button" when it structurally requires two (one per surface).
**How to avoid:** Add the Settings button to both the desktop `<aside>` footer *and* the mobile floating-action stack (see Pattern 2's code example), gated identically (`!hideQuickActions`).
**Warning signs:** Testing only in a desktop-width browser window during verification and never checking the mobile viewport / bottom-bar area.

### Pitfall 3: Breaking the Grow deep-link repeat-click mechanism via an unrelated App.jsx refactor
**What goes wrong:** If `App.jsx`'s tab-rendering pattern is changed from a set of independent `{tab === 'x' && <X/>}` conditionals to something that keeps components mounted across tab switches (e.g. CSS `display:none` toggling, or a single always-rendered router-like component), `GrowTab.jsx`'s `useState(initialPeopleFocus)` no longer re-seeds on a second "Find people →" click for the same company, because the component never remounts — `useState`'s initializer only runs once per mount.
**Why it happens:** This phase's App.jsx edits (removing the `'overview'` branch, wiring up Settings) touch the same function (`AppInner`) as the `tab === 'grow'` conditional sits in, creating a real temptation to "clean up while you're in there."
**How to avoid:** Touch only the `'overview'` branch (delete) and the tab-default `useState` value (Pitfall 1's fix) in `AppInner`/`DemoApp`. Leave every other conditional render branch, including `{!loading && tab === 'grow' && <GrowTab .../>}`, byte-for-byte unchanged.
**Warning signs:** A single "Find people →" click always works in manual testing (first click after any tab switch always re-triggers correctly by construction, mount or no mount) — the regression only shows up on the *second* click without navigating away in between. NAV-03's acceptance criterion explicitly calls out "repeat clicks re-triggering on the same target company," so this must be tested as click-click-click on the same company without switching tabs between clicks (which would mount/unmount, not reveal the bug) as well as switch-away-and-back-then-click (which would).

## Code Examples

### Fixing the stale default-tab bug (Pitfall 1)
```javascript
// app/src/App.jsx — AppInner (line 225) and DemoApp (line 361), both need this change:
- const [tab, setTab] = useState('overview')
+ const [tab, setTab] = useState('today')
```

### Removing the Overview render branches (D-01)
```javascript
// app/src/App.jsx — AppInner, delete lines 305-309:
- {!loading && tab === 'overview' && (
-   <OverviewTab contacts={contacts} apps={apps} interactions={interactions}
-     onOpenGraph={() => { setNetworkInitialView('graph'); setTab('network') }}
-     onOpenActions={() => setTab('today')} />
- )}

// app/src/App.jsx — DemoApp, delete lines 397-400:
- {!loading && tab === 'overview' && (
-   <OverviewTab contacts={contacts} apps={apps} interactions={interactions}
-     onOpenGraph={() => setTab('network')} onOpenActions={() => setTab('today')} />
- )}

// Also delete the now-unused import:
- import OverviewTab from './components/OverviewTab.jsx'
```
Note `onOpenActions` was already an unused/dead prop inside `OverviewTab.jsx` (never destructured in its function signature) — its removal here is pure cleanup, not a behavior change.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| 8 top-level tabs incl. separate Overview and Settings nav slots | 5-item persistent nav + Settings via footer affordance | This phase (NAV-01/NAV-02) | Matches the milestone's stated goal — "an information architecture the user doesn't have to relearn each session" |
| Overview's KPI/funnel/donut/trend charts as their own destination | Folded into Today's unified attention feed as a trailing Section | This phase (D-01), building on Phase 2's Section/RowCap primitives | Today becomes the single "start here" landing surface; no separate charts-only page to check |

**Deprecated/outdated:**
- `OverviewTab.jsx` as a standalone component/nav destination — deleted this phase, its useful content (3 charts) lives on in `TodayTab.jsx`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The "Your Network" graph-preview card and the KPI-card row inside `OverviewTab.jsx` are dropped entirely (not ported anywhere), since D-01's "remaining content" list names only the 3 charts | Architecture Patterns → Pattern 3, Open Questions #1 | If the user actually wanted the graph-preview card kept (e.g. re-homed into Today or Network), this phase would under-deliver against an implicit expectation not captured in NAV-01..04's literal text. Low risk: the KPI row's redundancy is explicitly confirmed by D-01 itself, and the graph preview duplicates one click into Network's own Graph view — but this is genuinely a gap in the locked decisions, not a research inference, so it's flagged rather than silently assumed away |
| A2 | `bottom-56` (14rem) is an available default Tailwind spacing scale class for the 4th mobile floating-action button's vertical offset | Architecture Patterns → Pattern 2 | Low risk — Tailwind v4's default spacing scale includes 56 as a standard key (confirmed against the standard scale: ...48,52,56,60,64,72,80,96); this project's `@theme` customization (per CLAUDE.md) only touches fonts/colors, not spacing, so the default scale should be intact. Worth a quick visual check during implementation rather than blind trust |

**If empty:** N/A — see table above.

## Open Questions

1. **Does the "Your Network" graph-preview card (NetworkGraphView + onOpenGraph deep-link) and/or the KPI-card row from `OverviewTab.jsx` need to be ported anywhere, or dropped?**
   - What we know: D-01 explicitly names only 3 chart blocks (Application Funnel, Network-by-Status donut, Networking Activity trend) as "remaining content" to port; it explicitly calls the KPI row "already effectively superseded." It says nothing about the graph-preview card (`OverviewTab.jsx` lines 112-129, a clickable mini force-graph that deep-links to Network's Graph view).
   - What's unclear: whether this omission from D-01 was a deliberate scoping choice (drop it — Network's own Graph view is one nav click away, one of the 5 remaining destinations) or an oversight in the discuss-phase pass.
   - Recommendation: treat it as dropped, matching the KPI row's precedent (superseded by an existing, one-click-away destination) — this keeps the merged Today Section scoped exactly to what D-01 names, avoids inventing a 4th chart element not asked for, and avoids threading a new `onOpenGraph`-equivalent prop through `App.jsx`→`TodayTab.jsx` that nothing else currently needs. If this reads as under-scoped once implemented, it's a one-Section addition to correct later, not a structural blocker.

2. **Should the merged charts Section respect the existing `allEmpty` early-return gate in `TodayTab.jsx` (line 351), or render unconditionally like `OverviewTab.jsx` always did?**
   - What we know: `OverviewTab.jsx` always rendered its charts (gated only on `hasRecruitingActivity`/`hasInteractions`/`contacts.length`, independent of whether anything needs "attention"). `TodayTab.jsx`'s current `allEmpty` check returns an `EmptyState` ("Nothing needs your attention") and renders *nothing else* when every attention list is empty.
   - What's unclear: if a user has zero overdue items (allEmpty === true) but does have contacts/applications/interactions worth charting, should they see the charts, or just the "you're on top of it" empty state (regressing what Overview always showed them)?
   - Recommendation: exclude the charts Section from the `allEmpty` gate — compute it and render it unconditionally below the gate (i.e., the `if (allEmpty) return <EmptyState/>` early-return should only short-circuit the attention-item Sections, not the charts), matching `OverviewTab.jsx`'s prior unconditional-modulo-data-presence behavior and avoiding a real regression (a fully-caught-up user losing all visibility into their funnel/network/activity charts, which is precisely when they're most likely to want a wider view rather than a `✓` message).

## Environment Availability

Skipped — this phase has no external dependencies beyond already-installed npm packages (react, lucide-react, framer-motion, recharts), all confirmed present in `app/node_modules/`. No new services, CLIs, or runtimes are introduced.

## Sources

### Primary (HIGH confidence)
- Direct source read: `app/src/App.jsx` (full file, 432 lines)
- Direct source read: `app/src/components/layout/Sidebar.jsx` (full file, 121 lines)
- Direct source read: `app/src/components/layout/AppShell.jsx` (full file, 55 lines)
- Direct source read: `app/src/components/TodayTab.jsx` (full file, 463 lines)
- Direct source read: `app/src/components/OverviewTab.jsx` (full file, 150 lines)
- Direct source read: `app/src/components/GrowTab.jsx` (full file, 61 lines)
- Direct source read: `app/src/lib/icons.js` (full file)
- Direct source read: `app/src/components/ui/Section.jsx` (full file)
- Repo-wide grep: `goFindPeople|onFindPeople|focusCompany|goToPeople|growFocusCompany` (all 21 matches reviewed)
- Repo-wide grep: `'overview'|"overview"` (all 6 matches reviewed)
- Repo-wide grep: `rec_[a-zA-Z_]*` localStorage key usage (29 distinct keys, all reviewed for tab-id collisions)
- `app/package.json` + `app/node_modules/` existence checks (react 18.3.1, lucide-react 1.23.0, framer-motion 12.42.2, recharts 3.9.2 confirmed installed)
- `.planning/config.json` (confirmed `nyquist_validation: false`, `security_enforcement: false` — both sections correctly omitted)
- `.planning/phases/05-pipeline-job-boards-merge/05-RESEARCH.md` (prior-phase precedent/style reference)

### Secondary (MEDIUM confidence)
None — all findings in this research were derived from direct source inspection of this repository, not external documentation (this phase involves no new libraries or frameworks).

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all versions confirmed installed on disk
- Architecture: HIGH — every pattern and pitfall traced against actual current source code, not inferred
- Pitfalls: HIGH — Pitfalls 1 and 2 are concrete bugs found by direct code inspection (stale default-tab state, mobile nav-bar Settings removal), not speculative; Pitfall 3 is a structural mechanism traced end-to-end through 3 files (`App.jsx`, `GrowTab.jsx`, `DiscoverTab.jsx`)

**Research date:** 2026-08-20
**Valid until:** No expiry concern — this research is tied to a specific commit-state of the repository, not to an external library's release cadence. Re-verify only if this phase's plan is deferred past a point where `App.jsx`/`Sidebar.jsx`/`TodayTab.jsx` are touched by other work first.
