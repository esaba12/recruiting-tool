---
phase: 03
fixed_at: 2026-08-18T00:00:00Z
review_path: .planning/phases/03-grow-discovery-funnel-merge/03-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-08-18
**Source review:** .planning/phases/03-grow-discovery-funnel-merge/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (CR-01 critical, WR-01 warning — fix_scope: critical_warning; IN-01/IN-02 left untouched per instruction)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### CR-01: `useTargetCompanies()` desyncs across Grow's three concurrently-mounted sections

**Files modified:** `app/src/components/GrowTab.jsx`, `app/src/components/ExploreTab.jsx`, `app/src/components/ReferralCoverageTab.jsx`, `app/src/components/DiscoverTab.jsx`
**Commit:** `adf0ef0`
**Applied fix:** Lifted the single `useTargetCompanies()` call into `GrowTab.jsx` and threaded `targets`/`setTargets`/`loaded` down as props to all three children, replacing each component's own internal call to the hook:
- `ExploreTab.jsx`: dropped the `useTargetCompanies` import and internal hook call; now destructures `targets`, `setTargets: setTargetCompanies`, `loaded: targetsLoaded` from props (kept the local alias so the rest of the file's usages — `addToTargets`, `excludeNames`, the daily-refresh gate — needed no further changes).
- `ReferralCoverageTab.jsx`: dropped the `useTargetCompanies` import and internal hook call; now accepts `targets`, `setTargets`, `loaded` directly as props.
- `DiscoverTab.jsx`: dropped the `useTargetCompanies` import and internal hook call; now accepts `targets`, `loaded: targetsLoaded` as props (this component never writes targets, so no `setTargets` prop was added — matches its pre-fix usage, which only ever read `targets`/`loaded`).
- `GrowTab.jsx`: imports and calls `useTargetCompanies()` once, passes `targets`/`setTargets`/`loaded` (aliased `targetsLoaded` at the call site) into all three `<ExploreTab>`/`<ReferralCoverageTab>`/`<DiscoverTab>` elements.

**Required vs. optional props — investigated and confirmed required:** grepped the whole `app/src` tree for `ExploreTab`, `ReferralCoverageTab`, and `DiscoverTab` usage. The only render sites for all three are inside `GrowTab.jsx` itself; every other hit is a comment, a shared-constant reference (`localStorage` key comments, `PROFILE_KEY` shared-with note), or a shared-pattern reference in `QuickAddContactModal.jsx`/`discoveryScheduler.js`/`networkGraph.js` — none of those actually render the components. This confirms Plan 03-07's SUMMARY claim that the old standalone Explore tab and Network's Coverage/Discover views were fully removed. Since `GrowTab.jsx` is the sole render site, `targets`/`setTargets`/`loaded` were made **required** props (no internal-hook fallback) rather than optional — a fallback would have silently reintroduced the exact desync bug this fix closes if any future call site forgot to pass them, whereas a missing required prop fails loudly (undefined `.length`/`.map` crashes) during development.

**Net effect:** all three Grow sections now observe the same live target-company list for the lifetime of one page visit — adding a company in Companies is immediately visible to Coverage's `rows` and People's `rows`/`excludeNames` without a remount, and Coverage's "Save target list" can no longer revert a company added elsewhere on the same visit, since `setTargets` now mutates the one shared `targets` state instead of a stale local copy.

### WR-01: `ReferralCoverageTab`'s deep-link scroll/highlight silently fails once a Coverage row isn't in the visible `RowCap` slice

**Files modified:** `app/src/components/ReferralCoverageTab.jsx`
**Commit:** `e7b2034`
**Applied fix:** Chose the review's alternative fix (b) — reorder `rows` so a focus-targeted row is always guaranteed to land within the first `cap` entries — over (a) adding a controlled/`forceExpand` mechanism to the shared `RowCap` component.

**Reasoning for choosing (b) over (a):** `RowCap` (`app/src/components/ui/Section.jsx`) is a shared primitive with 8 existing call sites in `TodayTab.jsx` plus 2 new ones from this same phase (`ExploreTab.jsx`, `DiscoverTab.jsx`'s recommended view) — none of them pass or need an expand-control prop today. Adding a controlled/`forceExpand` API to `RowCap` would touch a widely-reused component to solve a problem local to exactly one call site (`ReferralCoverageTab`'s single permanently-capped view), which is higher blast radius for no shared benefit — `DiscoverTab`'s own deep-link is already safe today (`byCompany` view force-switches to a row list that isn't `RowCap`-wrapped), so there is no second consumer that would benefit from a controlled `RowCap`. A targeted reorder confined entirely to `ReferralCoverageTab.jsx` is simpler, lower-risk, and does not touch a component 10 other call sites depend on.

**Implementation:** introduced a `ROW_CAP = 5` constant (shared between the `rows` computation and the `<RowCap cap={ROW_CAP}>` prop, replacing a previously-duplicated magic number). After building and status-sorting `rows`, if `focus` is set and the focused company's index is `>= ROW_CAP`, it's spliced out and unshifted to the front — a targeted move, not a permanent re-sort, so status ordering (`gap` → `weak` → `strong`) is left untouched whenever the focused company is already within the cap or there's no pending focus. This guarantees `rowRefs.current.get(key)` is always populated for the focused company (since it's now always rendered in `RowCap`'s visible slice), so the deep-link `scrollIntoView`/highlight effect never silently no-ops regardless of how many target companies the user tracks.

## Skipped Issues

None — both in-scope findings (CR-01, WR-01) were fixed. IN-01 and IN-02 were explicitly excluded from scope per instruction (info-level, non-blocking) and left untouched.

---

_Fixed: 2026-08-18_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
