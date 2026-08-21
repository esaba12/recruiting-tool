---
phase: 06-navigation-consolidation-complete
verified: 2026-08-21T01:39:54Z
status: human_needed
score: 8/10 must-haves verified
behavior_unverified: 1
overrides_applied: 0
gaps:

  - truth: "A signed-in user reaches Settings from a footer button on desktop and a floating-action button on mobile, not from a primary nav slot (NAV-02)"
    status: failed
    reason: "The mobile floating Settings button this phase added (`bottom-56`, Plan 06-02 Task 1) overlaps the pre-existing Quick Capture floating button (`bottom-52`) by 32 of its 48px height. Both are `right-4`, `w-12 h-12`, `z-30` fixed-position siblings; Quick Capture is later in DOM order (rendered second) and therefore paints on top of Settings in the overlapping band, intercepting pointer events there. Only a ~16px sliver at the top of the Settings button remains clickable — well under any reasonable mobile touch-target size. This is a real, code-provable regression introduced by this phase (the pre-phase floating stack had 3 buttons at bottom-52/36/20 with a clean 16-unit/64px step and zero overlap; adding the 4th at bottom-56 broke that spacing instead of continuing it at bottom-68). Already flagged in 06-REVIEW.md as WR-01 and independently re-confirmed against the current tree (commit c0f8275) — unfixed."
    artifacts:

      - path: "app/src/components/layout/Sidebar.jsx"
        issue: "Settings floating button (lines 108-110, `bottom-56`) visually/functionally overlaps the Quick Capture floating button (lines 112-115, `bottom-52`) by 32px; Quick Capture renders after Settings in the DOM at the same z-index, so it paints over and intercepts taps in the shared band."
    missing:

      - "Re-space the mobile floating-action stack so no two buttons overlap — e.g. move Settings to `bottom-68` to continue the existing 64px/16-unit step pattern (20, 36, 52, 68), or otherwise redesign the 4-button stack's offsets."

behavior_unverified_items:

  - truth: "A repeat click on 'Find people at <company>' for the same target company re-triggers Grow's People-section focus/highlight, without navigating away in between (NAV-03 dynamic behavior)"
    test: "Open an application record from Pipeline or Today, click the find-people shortcut, confirm Grow's People section focuses/highlights the company; without navigating away, close the panel and repeat the exact same click on the exact same company; confirm it re-triggers (re-focuses/re-highlights) rather than sitting inert; then navigate away and back and repeat once more."
    expected: "Every repeat click re-focuses and re-highlights the People section row for that company, on both the mount-seed hop (Today/Pipeline → Grow) and the direct state-set hop (inside Grow's own Companies/Coverage sections)."
    why_human: "This is a runtime state-transition/re-trigger invariant (a `ts: Date.now()`-keyed effect firing again on an unchanged company string). Byte-level diffs (Gates A-D in 06-03-SUMMARY.md) prove the relay's code is untouched by this phase, but this repo has no automated browser/test harness (06-RESEARCH.md constraint 4) to actually exercise the click sequence, so the dynamic behavior itself — as opposed to the code that implements it — is unexercised by any test."
human_verification:

  - test: "Desktop: sidebar rail lists exactly Today, Network, Grow, Pipeline, Calendar in that order; a Settings button sits in the footer group below \"+ Event\"; clicking it opens Settings and the button turns amber (active) while Settings is open."
    expected: "Five-item nav rail; Settings footer button works and shows correct active state."
    why_human: "Visual rendering and click-through confirmation; no dev server rendering performed during this verification pass."

  - test: "Mobile: bottom bar shows the same five destinations. The fourth floating gear button (Settings, `bottom-56`) and the Quick Capture button (`bottom-52`) are inspected for the overlap described in the gap above — confirm whether the top ~16px sliver of Settings is tappable at all on a real device/viewport, or whether Quick Capture's tap target fully swallows it."
    expected: "This item exists specifically to size the real-world severity of the recorded gap — expected outcome is TBD pending human confirmation, but the code-level evidence already shows a 32px overlap band."
    why_human: "Rendering/hit-testing behavior in a live browser cannot be fully confirmed by static analysis alone; needed to size the gap before deciding fix urgency."

  - test: "Hard-refresh the signed-in app at `/`. It lands on Today with content rendered — not a blank main area, not a spinner that never resolves."
    expected: "Today renders with its attention sections and the new Activity card (funnel/donut/trend charts) visible."
    why_human: "Live page-load/render behavior; not exercised by static grep/diff checks."

  - test: "Today's Activity card: with real data, confirm the Application Funnel, Network by Status donut, and Networking Activity trend chart show the same numbers the retired Overview tab used to show. Force (or find) a fully caught-up state and confirm the \"Nothing needs your attention\" line appears alongside the still-visible Activity card (not instead of it)."
    expected: "Charts render with correct data on both the has-work and all-caught-up paths; single white card with internal dividers, no double-bordering."
    why_human: "Visual/numeric correctness and empty-state layout; verifiable structurally (render site is outside the `allEmpty` gate) but the actual numbers and layout need eyes on a real render."

  - test: "Hard-refresh `/demo`. It lands on Today with demo (fictional) data rendered, nav shows exactly Today/Network/Pipeline, no Settings affordance and no floating action buttons anywhere, and nothing triggers a sign-in prompt or a 401."
    expected: "Demo route fully functional with zero backend/BYOK dependency, trimmed 3-item nav, no Settings anywhere."
    why_human: "Live render of the public route; structural filter/branch checks pass, but actual page behavior needs a real load."

  - test: "Deep-link repeat-click sequences (5 entry points, see NAV-03 behavior_unverified_items entry above and the full 17-item checklist already staged in 06-03-SUMMARY.md)."
    expected: "All five entry points land on and re-trigger Grow's People/Coverage section focus on repeat clicks, including after navigating away and back."
    why_human: "Runtime behavior, not statically verifiable; the full click sequence is pre-staged in 06-03-SUMMARY.md's Staged Manual Checklist."
---

# Phase 6: Navigation Consolidation Complete — Verification Report

**Phase Goal:** The primary nav is a persistent ~5-item destination list, Settings is demoted to a footer affordance, and every cross-tab deep link plus the public demo route survive the restructure.
**Verified:** 2026-08-21T01:39:54Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Persistent nav is exactly 5 destinations (Today, Network, Grow, Pipeline, Calendar) on both desktop rail and mobile bottom bar (NAV-01) | ✓ VERIFIED | `Sidebar.jsx`'s `NAV_ITEMS` array holds exactly 5 entries with those ids in that order; both `navItems.map` call sites (desktop rail line 26, mobile bottom bar line 92) read the same array |
| 2 | Today's Activity section (funnel/donut/trend charts) renders on every path, including the fully-caught-up path (D-01) | ✓ VERIFIED | `TodayTab.jsx` line 511: `<ActivitySection .../>` sits as a direct, unconditional child of the `space-y-4` wrapper — outside the `{allEmpty && <EmptyState/>}` conditional (line 442) and outside every attention-section guard |
| 3 | Settings reachable from a footer button on desktop (NAV-02) | ✓ VERIFIED | `Sidebar.jsx` line 65: footer button dispatches `onTabChange('settings')`, active-state ternary keys on `activeTab === 'settings'` resolving to the same amber fill every nav destination uses |
| 4 | Settings reachable from a floating-action button on mobile, without another control blocking its tap target (NAV-02) | ✗ FAILED | `Sidebar.jsx` lines 108-115: Settings (`bottom-56`, spans 224-272px from viewport bottom) overlaps Quick Capture (`bottom-52`, spans 208-256px) by a 32px band; Quick Capture renders later in the DOM at the same `z-30` and paints over that band. See gap record below (06-REVIEW.md WR-01, independently re-confirmed) |
| 5 | The cross-tab deep-link relay's code (7 relay files + App.jsx's relay lines) is untouched by this phase (NAV-03 static claim) | ✓ VERIFIED | Independently re-ran Gate A (`git diff --quiet` against base `0c19dac` on all 7 relay files — exit 0), Gate B (content diff of `goFindPeople`/`growFocusCompany`/`initialPeopleFocus` lines — zero output), Gate C (content diff of the Grow render branch + 2 lines — zero output) |
| 6 | A repeat click on the same target company re-triggers Grow's People-section focus, without navigating away (NAV-03 dynamic claim) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Code proves the mechanism is intact (`DiscoverTab.jsx` keys exactly one effect on `focus?.ts`, a timestamp that changes on every call — Gate D), but no automated test exercises an actual click sequence in this repo (no browser/test harness exists per `06-RESEARCH.md`) |
| 7 | Public `/demo` route shows a trimmed 3-item nav (Today, Network, Pipeline) with no Settings affordance (NAV-04) | ✓ VERIFIED | `App.jsx` line 352: `DEMO_NAV_ITEMS` filters to exactly `['today', 'network', 'pipeline']`; `tab === 'settings'` appears exactly once in the whole file (line 319, signed-in root only — no demo-root equivalent) |
| 8 | `/demo` continues to function with zero backend/BYOK dependency after the restructure (NAV-04) | ✓ VERIFIED | `db.js`'s `isDemoMode()` branches were not touched by any Phase 6 plan (changeset audit below lists only `App.jsx`, `TodayTab.jsx`, `Sidebar.jsx` modified + `OverviewTab.jsx` deleted); `DemoApp`'s render branches for today/network/pipeline are unchanged aside from dropping the retired branch |
| 9 | The retired destination (former Overview tab) no longer exists as a file, import, render branch, nav entry, or demo nav id | ✓ VERIFIED | `test -f app/src/components/OverviewTab.jsx` → absent; `grep -rn "OverviewTab" app/src` → 0 hits; both `'overview'` render branches removed (9 `tab === '...'` conditions remain, all matching the 6-destination whitelist incl. settings) |
| 10 | A fresh page load lands on Today with content rendered, not a blank main area (`06-RESEARCH.md` Pitfall 1) | ✓ VERIFIED | Both tab-state initializers (`AppInner` line 224, `DemoApp` line 355) now default to `'today'`, and a `tab === 'today'` render branch exists in both roots — no stale-default/missing-branch gap |

**Score:** 8/10 truths verified (1 present-but-behavior-unverified, 1 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/components/TodayTab.jsx` | Gains `weekStart` helper + `ActivitySection` component; renders unconditionally | ✓ VERIFIED | Confirmed present, builds, matches all 06-01 plan assertions re-run independently |
| `app/src/components/layout/Sidebar.jsx` | 5-entry `NAV_ITEMS` + 2 Settings buttons | ✓ VERIFIED (with a functional defect) | Structure matches spec exactly; the mobile button's *position* is defective (see gap) |
| `app/src/App.jsx` | 2 retired render branches gone; 2 tab-state defaults corrected; demo filter shortened; import dropped | ✓ VERIFIED | All 4 edits confirmed present, `npm run build` exits 0 |
| deleted path `app/src/components/OverviewTab.jsx` | File removed | ✓ VERIFIED | Confirmed absent; `NetworkGraphView.jsx` (still needed by Network's Graph view) correctly retained |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| Both Settings buttons (`Sidebar.jsx`) | `App.jsx`'s tab state | `onTabChange('settings')` | ✓ WIRED | Confirmed 2 dispatch call sites; no new prop added, reuses existing `onTabChange` |
| `ActivitySection` | `TodayTab`'s own props | `contacts`/`apps`/`interactions` passed straight through | ✓ WIRED | Line 511 passes all three props unchanged |
| Today/Pipeline application panels | Grow's People section | `onFindPeople` → `App.jsx`'s `goFindPeople` → `setGrowFocusCompany` → `initialPeopleFocus` prop | ✓ WIRED (byte-identical to pre-phase base) | Independently re-confirmed via content diff against `0c19dac`, zero output |
| Grow-internal shortcuts (company card, coverage row, add-to-targets) | Grow's People/Coverage sections | `GrowTab.jsx`'s `goToPeople`/`goToCoverage` → `setPeopleFocus`/`setCoverageFocus` | ✓ WIRED | `GrowTab.jsx` confirmed byte-identical to pre-phase base (Gate A) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| NAV-01 | 06-01, 06-02, 06-03 | 5-item persistent nav from 8 top-level tabs | ✓ SATISFIED | Nav array + both render maps confirmed; content (Activity section) confirmed unconditional |
| NAV-02 | 06-02, 06-03 | Settings via footer/profile affordance, not primary nav slot | ⚠️ PARTIALLY SATISFIED | Desktop satisfied; mobile floating button exists but its tap target is compromised by an unfixed overlap bug (WR-01) |
| NAV-03 | 06-03 | Cross-tab deep links (incl. repeat-click re-trigger) still work | ✓ SATISFIED (code); dynamic click behavior staged for human pass | Byte-level diffs prove zero code change to the relay; the actual click-sequence UX is unexercised by any test in this repo |
| NAV-04 | 06-02, 06-03 | `/demo` shows trimmed nav, zero backend/BYOK dependency | ✓ SATISFIED | Demo filter, settings-branch absence, and `db.js` non-modification all confirmed |

No orphaned requirements found — REQUIREMENTS.md's NAV-01 through NAV-04 all map to at least one of this phase's 3 plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/src/components/layout/Sidebar.jsx` | 108-115 | Floating-button spacing collision (`bottom-56` vs `bottom-52`) | 🛑 Blocker (for NAV-02) | Mobile Settings button's tap target is largely obscured by the Quick Capture button — see gap record |
| `app/src/App.jsx:145`, `TodayTab.jsx:234,284-286` | — | Unvalidated URL scheme rendered as `<a href>` (potential `javascript:` XSS vector, 06-REVIEW.md CR-01) | ℹ️ Info (pre-existing, not introduced by this phase) | Confirmed via `git show 0c19dac` that these exact lines predate Phase 6 — out of this phase's scope, but a real, still-open security issue worth a standalone fix |
| `app/src/App.jsx` (`DemoApp.load`) | 364-369 | No try/catch around `Promise.all`, unlike `AppInner.load()` (06-REVIEW.md WR-02) | ℹ️ Info (pre-existing, not introduced by this phase) | Confirmed identical in base commit `0c19dac` — not a Phase 6 regression |
| `app/src/components/TodayTab.jsx` (several rows) | 38-52, 94-107, 265-277, 421-424 | Silent/absent error handling on triage/follow-up mutations (06-REVIEW.md WR-03) | ℹ️ Info (pre-existing, not introduced by this phase) | Confirmed identical in base commit `0c19dac` (ported from the former Actions tab in Phase 2) — not a Phase 6 regression |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in any of the 3 files this phase modified.

### Deferred Items

None. Phase 7's declared scope (full visual reskin, `motion` migration, instrument-panel stat tiles) does not mention the mobile floating-button spacing defect, so the WR-01 gap is not deferred by any later phase's stated goal — it is recorded as a live gap for this phase.

## Gaps Summary

One genuine, code-provable regression blocks a clean pass: the mobile Settings floating-action button this phase introduces (`bottom-56`) overlaps the pre-existing Quick Capture button (`bottom-52`) by 32 of 48 pixels, and — because Quick Capture is later in DOM order at the same z-index — visually and functionally sits on top of Settings in that band. This was already caught by `06-REVIEW.md` (WR-01) with the exact arithmetic and a one-line fix (`bottom-68`), and remains unfixed as of the latest commit (`c0f8275`, a docs-only commit adding the review report). Everything else — the 5-item nav, the desktop Settings affordance, the retired-destination cleanup, the demo route's trimmed nav and continued backend independence, and the deep-link relay's code-level preservation — checks out cleanly against independent re-verification. The one behavior-dependent claim this phase makes (repeat-click re-triggering) is backed by solid byte-level code evidence but, per this repo's lack of any automated browser/test harness, cannot be marked fully VERIFIED without a human running the staged click sequences in `06-03-SUMMARY.md`.

**Recommended next step:** a small, single-file gap-closure plan changing `Sidebar.jsx`'s Settings floating button from `bottom-56` to `bottom-68` (or an equivalent re-spacing of the 4-button stack), followed by the already-staged end-of-phase human UAT pass (which should explicitly confirm the fix resolves the overlap on a real mobile viewport).

---

_Verified: 2026-08-21T01:39:54Z_
_Verifier: Claude (gsd-verifier)_
