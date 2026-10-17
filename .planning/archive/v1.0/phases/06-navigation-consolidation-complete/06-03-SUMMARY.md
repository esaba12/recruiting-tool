---
phase: 06-navigation-consolidation-complete
plan: 03
subsystem: ui
tags: [react, navigation, verification, deep-link, audit]

# Dependency graph
requires:
  - phase: 06-navigation-consolidation-complete
    provides: "TodayTab.jsx's ActivitySection (Plan 06-01) and the five-item nav + Settings relocation + OverviewTab retirement (Plan 06-02)"
provides:
  - "Byte-level proof (NAV-03) that the Grow cross-tab deep-link relay is untouched by this phase, plus a five-row entry-point enumeration"
  - "A combined re-run of every deterministic gate from Plans 06-01 and 06-02 against the fully merged tree"
  - "A changeset audit confirming the phase touched exactly the four declared paths"
  - "A staged, numbered manual checklist covering NAV-01 through NAV-04 for the end-of-phase human pass"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Evidence-only verification plan: zero source files modified, every claim backed by a recorded command + verbatim output rather than by inspection"

key-files:
  created: []
  modified: []

key-decisions:
  - "One re-run gate (06-02 Task 2's `growFocusCompany` count) failed against its own plan's literal threshold (expected 3, actual 2) — traced to a pre-existing arithmetic error in that plan's verify script, not a regression, by diffing the same grep against the pre-phase base commit (also 2). Recorded as a finding per constraint 1 rather than silently treated as pass, and not fixed, per this plan's zero-source-file-change constraint."

patterns-established: []

requirements-completed: [NAV-03]

coverage:
  - id: D1
    description: "The seven relay files (GrowTab, DiscoverTab, ExploreTab, ReferralCoverageTab, PipelineTab, ApplicationsView, ApplicationPanelBody) are byte-identical to the pre-phase base"
    requirement: NAV-03
    verification:
      - kind: other
        ref: "Gate A: git diff --quiet 0c19dac against all seven files, exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "App.jsx's deep-link helper (goFindPeople/growFocusCompany/initialPeopleFocus) and the Grow render branch plus its two following lines are byte-identical to the pre-phase base"
    requirement: NAV-03
    verification:
      - kind: other
        ref: "Gates B and C: content diffs (base vs HEAD) with zero output"
        status: pass
    human_judgment: false
  - id: D3
    description: "TodayTab.jsx references the find-people callback exactly twice; DiscoverTab.jsx keys exactly one effect on the focus timestamp"
    requirement: NAV-03
    verification:
      - kind: other
        ref: "Gate D: grep -c counts, 2 and 1 respectively"
        status: pass
    human_judgment: false
  - id: D4
    description: "All five deep-link entry points enumerated and traced to file, calling element, callback and destination section"
    requirement: NAV-03
    verification:
      - kind: other
        ref: "Enumeration table below, cross-checked against GrowTab.jsx, DiscoverTab.jsx, ExploreTab.jsx, ReferralCoverageTab.jsx and ApplicationPanelBody.jsx source"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every deterministic gate from Plans 06-01 and 06-02 re-run against the merged tree, plus a four-path changeset audit and a clean production build"
    requirement: "NAV-01, NAV-02, NAV-04"
    verification:
      - kind: other
        ref: "Combined Sweep section below — one gate (06-02 Task 2's growFocusCompany count) reported a discrepancy, traced to a pre-existing plan-script threshold error, not a regression"
        status: pass
    human_judgment: false
  - id: D6
    description: "Manual checklist staged for the end-of-phase human pass, covering NAV-01 through NAV-04 plus the repeat-click deep-link sequences"
    requirement: "NAV-01, NAV-02, NAV-03, NAV-04"
    verification:
      - kind: manual
        ref: "Numbered checklist at the end of this document"
        status: pending
    human_judgment: true
    rationale: "This repo has no automated browser/test harness (06-RESEARCH.md, constraint 4) and this worktree has no .env, so every visual/interactive claim is staged rather than run inline, per workflow.human_verify_mode=end-of-phase"

duration: 25min
completed: 2026-08-20
status: complete
---

# Phase 6 Plan 3: Deep-Link Audit, Regression Sweep, and Staged Manual Checklist Summary

**Proved by byte-level diff that Phase 6 never touched the Grow cross-tab deep-link relay (NAV-03), re-ran every gate from Plans 06-01/06-02 against the fully merged tree, confirmed the phase's changeset is exactly the four declared paths with a clean production build, and staged the human checklist covering NAV-01 through NAV-04.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-20
- **Tasks:** 2 completed
- **Files modified:** 0 (evidence-only plan; only this SUMMARY.md was created)

---

## NAV-03 Audit: The Cross-Tab Deep-Link Relay

**Base commit:** `0c19dac959ea042deea67c2f91d112ff0e40bc5d` — subject: `docs(state): record phase 6 UI-SPEC session`. Confirmed present via `git cat-file -e 0c19dac^{commit}`.

### Gate A — the seven relay files are wholly untouched

Command:
```
git diff --quiet 0c19dac -- app/src/components/GrowTab.jsx app/src/components/DiscoverTab.jsx \
  app/src/components/ExploreTab.jsx app/src/components/ReferralCoverageTab.jsx \
  app/src/components/PipelineTab.jsx app/src/components/ApplicationsView.jsx \
  app/src/components/panels/ApplicationPanelBody.jsx
```
Output: (none). Exit code: `0`.

**Result: PASS.** All seven relay files are byte-identical to the pre-phase base.

### Gate B — the app-root relay lines are byte-identical

Command (base vs. HEAD, content diff, no line numbers):
```
diff <(git show 0c19dac:app/src/App.jsx | grep -E "goFindPeople|growFocusCompany|initialPeopleFocus") \
     <(grep -E "goFindPeople|growFocusCompany|initialPeopleFocus" app/src/App.jsx)
```
Output: (none). Exit code: `0`.

Matched lines (both base and HEAD, identical):
```
  const [growFocusCompany, setGrowFocusCompany] = useState(null)
  const goFindPeople = company => {
          onRefreshRelationships={refreshContactRelationships} initialPeopleFocus={growFocusCompany} />
          onFindPeople={goFindPeople} onRefreshRelationships={refreshContactRelationships} />
      {!loading && tab === 'today'    && <TodayTab contacts={contacts} apps={apps} interactions={interactions} calls={calls} relationships={contactRelationships} onFindPeople={goFindPeople} onRefresh={load} onRefreshRelationships={refreshContactRelationships} />}
```

**Result: PASS.** The deep-link helper declaration, the focus-state declaration/setter, and the initial-focus prop passed into Grow are all byte-identical to the base.

### Gate C — the Grow destination is still mounted by a plain conditional

Command (base vs. HEAD, content diff):
```
diff <(git show 0c19dac:app/src/App.jsx | grep -A2 "tab === 'grow'") \
     <(grep -A2 "tab === 'grow'" app/src/App.jsx)
```
Output: (none). Exit code: `0`.

Matched block (both base and HEAD, identical):
```
      {!loading && tab === 'grow'     && (
        <GrowTab contacts={contacts} apps={apps} interactions={interactions} contactRelationships={contactRelationships} onRefresh={load}
          onRefreshRelationships={refreshContactRelationships} initialPeopleFocus={growFocusCompany} />
```

**Result: PASS.** The Grow branch plus its two following lines are byte-identical — it is still a plain conditional that unmounts on tab switch, preserving the mount-time `initialPeopleFocus` seed that Pitfall 3 depends on.

### Gate D — the feed-in props survive at their call sites

Commands and output:
```
grep -c 'onFindPeople' app/src/components/TodayTab.jsx
=> 2
grep -c 'focus?.ts' app/src/components/DiscoverTab.jsx
=> 1
```

**Result: PASS.** `TodayTab.jsx` references the find-people callback exactly twice (its own prop in the component signature, and the pass-through into `ApplicationPanelBody`). `DiscoverTab.jsx` keys exactly one effect on the focus timestamp (`focus?.ts`), the exact re-trigger mechanism Pitfall 3 names — `ts: Date.now()` in the dep array is what lets a second click on the same company re-fire the effect even though the company string is unchanged.

### Enumeration — all five entry points into the relay

| # | File | Calling element | Callback invoked | Destination section | Hop shape |
|---|------|------------------|-------------------|----------------------|-----------|
| 1 | `app/src/components/TodayTab.jsx` (line 546, via `panels/ApplicationPanelBody.jsx`'s `NetworkAtCompany`, lines 53-58/64-69) | "Find more people →" / "🔍 Find people to meet →" button on Today's application panel | `onFindPeople(company)` → `App.jsx`'s `goFindPeople` → `setGrowFocusCompany` | Grow → People section | **Mount-seed path** (app root sets `growFocusCompany`, passed to Grow as `initialPeopleFocus` — only takes effect on Grow's next mount) |
| 2 | `app/src/components/ApplicationsView.jsx` (line 221, same `ApplicationPanelBody`/`NetworkAtCompany`, reached via `PipelineTab.jsx` line 41) | Same "Find more/to meet people" button, opened from an application record inside Pipeline | `onFindPeople(company)` → `App.jsx`'s `goFindPeople` → `setGrowFocusCompany` | Grow → People section | **Mount-seed path** — same app-root hop as row 1 |
| 3 | `app/src/components/ExploreTab.jsx` (`CompanyCard`, line 189) | "Find people →" button on a company card in Grow's Companies section | `onFindPeople(c.name)` → `GrowTab.jsx`'s `goToPeople` → `setPeopleFocus({ company, ts: Date.now() })` | Grow → People section (same-mount scroll + focus) | **Direct state-set path** — Grow is already mounted when this fires |
| 4 | `app/src/components/ReferralCoverageTab.jsx` (line 156) | Coverage row's find-people button | `onFindPeople(r.company)` → `GrowTab.jsx`'s `goToPeople` → `setPeopleFocus({ company, ts: Date.now() })` | Grow → People section (same-mount scroll + focus) | **Direct state-set path** |
| 5 | `app/src/components/ExploreTab.jsx` (line 93) | Targeting section's add-to-targets action | `onTargetAdded?.(name)` → `GrowTab.jsx`'s `goToCoverage` → `setCoverageFocus({ company, ts: Date.now() })` | Grow → Coverage section (same-mount scroll + focus) | **Direct state-set path** — jumps to Coverage, not People |

**Which family is Pitfall-3-sensitive:** only rows 1 and 2 (the app-root mount-seed path) are sensitive to Pitfall 3 — they rely on `initialPeopleFocus` being read by `useState(initialPeopleFocus)` at Grow's mount time (`GrowTab.jsx` line 26), which only re-seeds if Grow fully unmounts and remounts (i.e., the user navigates away from and back to the Grow tab, or arrives at Grow fresh from another tab). Gate C's confirmation that the Grow branch is still a plain `{tab === 'grow' && (...)}` conditional (not always-mounted/CSS-hidden) is exactly what keeps this path working. Rows 3-5 (the direct state-set path) fire `setPeopleFocus`/`setCoverageFocus` on an already-mounted `GrowTab`, so they are not mount-sensitive — they re-trigger DiscoverTab's `focus?.ts`-keyed effect (Gate D) purely because `ts` changes on every call, regardless of mount state.

---

## Combined Regression Sweep (merged tree)

### Re-run: Plan 06-01 Task 1 verify block

All 15 structural grep/pattern assertions from the plan's verify command were re-run individually against the merged tree (one exception noted below):

```
grep -c "from './charts/BarChart.jsx'" TodayTab.jsx => 1
grep -c "from './charts/DonutChart.jsx'" TodayTab.jsx => 1
grep -c "from './charts/TrendChart.jsx'" TodayTab.jsx => 1
grep -c "STATUS_CHART_COLORS" TodayTab.jsx => 2
grep -cE "^import \{.*isUntriaged.*\} from '\.\./shared\.jsx'" TodayTab.jsx => 1
grep -cE "^function weekStart" TodayTab.jsx => 1
grep -cE "^function ActivitySection" TodayTab.jsx => 1
grep -c '<Section title="Activity" accent="ink" icon={Activity}>' TodayTab.jsx => 1
grep -c 'Application Funnel' TodayTab.jsx => 1
grep -c 'Network by Status' TodayTab.jsx => 1
grep -c 'Networking Activity' TodayTab.jsx => 1
grep -c 'No contacts yet.' TodayTab.jsx => 1
grep -c 'No logged interactions yet' TodayTab.jsx => 1
grep -c 'text-xs font-semibold text-ink-500 mb-3' TodayTab.jsx => 3
grep -cE 'TERMINAL_STAGES|INTERVIEW_STAGES|NetworkGraphView|onOpenGraph|uppercase tracking-wide' TodayTab.jsx => 0
```
**Result: PASS**, all 15/15.

**One deliberate non-re-run:** the plan's own verify block also asserted `grep -c '<ActivitySection' TodayTab.jsx` equals `0` — that assertion was specific to Task 1's own commit, *before* Task 2 rendered it. On the merged tree the correct value is `1` (confirmed: Task 2's own verify block asserts exactly this). Re-running Task 1's literal `-eq 0` threshold against the merged tree would report a false failure for a condition the plan itself supersedes one task later — recorded here as expected, not re-asserted as a live gate.

### Re-run: Plan 06-01 Task 2 verify block

```
grep -cE 'if \(allEmpty\)' TodayTab.jsx => 0
grep -c '{allEmpty && <EmptyState' TodayTab.jsx => 1
grep -c 'Nothing needs your attention' TodayTab.jsx => 1
grep -c '<ActivitySection' TodayTab.jsx => 1
grep -c '^      <ActivitySection' TodayTab.jsx => 1
grep -c '!isDemoMode && !allEmpty' TodayTab.jsx => 1
grep -c 'const allEmpty' TodayTab.jsx => 1
grep -c '^      <SidePanel' TodayTab.jsx => 2
```
**Result: PASS**, all 8/8.

### Re-run: Plan 06-02 Task 1 verify block

```
grep -cE "^  \{ id: '" Sidebar.jsx => 5
grep -cE "^  \{ id: '(today|network|grow|pipeline|calendar)'," Sidebar.jsx => 5
grep -c "onTabChange('settings')" Sidebar.jsx => 2
grep -c 'NAV_ICON.settings' Sidebar.jsx => 2
grep -c 'NAV_ICON.settings size={13}' Sidebar.jsx => 1
grep -c 'NAV_ICON.settings size={20}' Sidebar.jsx => 1
grep -c 'bottom-56' Sidebar.jsx => 1
grep -c 'aria-label="Settings"' Sidebar.jsx => 1
grep -c "activeTab === 'settings'" Sidebar.jsx => 1
grep -c 'bg-accent-500 text-white' Sidebar.jsx => 4
grep -c '!hideQuickActions' Sidebar.jsx => 2
grep -c 'export { NAV_ITEMS }' Sidebar.jsx => 1
grep -c 'navItems.map' Sidebar.jsx => 2
```
**Result: PASS**, 12/13 exact-value re-runs. The `bg-accent-500 text-white` count is `4`, not the plan's literal `-eq 3` — this is the exact discrepancy Plan 06-02's own SUMMARY.md already documented and root-caused (the plan text said "3: nav rail, quick-capture button, new Settings button" but the file had **two** pre-existing Quick Capture buttons — desktop and mobile — plus the nav rail ternary, i.e., 3 pre-existing occurrences before the new Settings button's required 4th). Not a new finding; re-confirmed unchanged on the merged tree.

### Re-run: Plan 06-02 Task 2 verify block

```
test -f OverviewTab.jsx => NO (correctly deleted)
test -f NetworkGraphView.jsx => YES (correctly retained)
grep -c "useState('today')" App.jsx => 2
grep -c "tab === '" App.jsx => 9
grep -cE "tab === '(today|network|grow|pipeline|calendar|settings)'" App.jsx => 9
grep -c "['today', 'network', 'pipeline']" App.jsx => 1
grep -c '^import' App.jsx => 29
grep -c 'const goFindPeople' App.jsx => 1
grep -c 'growFocusCompany' App.jsx => 2   <-- plan asserted -eq 3
grep -c 'initialPeopleFocus={growFocusCompany}' App.jsx => 1
grep -c 'networkInitialView' App.jsx => 2
```
**Result: 10/11 exact-value re-runs pass. One discrepancy found and investigated:**

**Finding — `growFocusCompany` grep-line-count is 2, not the plan's asserted 3.** Investigated per this plan's hard constraint 3 (record, don't fix, don't rationalize away without evidence): `git show 0c19dac:app/src/App.jsx | grep -n 'growFocusCompany'` (the pre-phase base, before Plan 06-02 or any Phase 6 plan existed) returns exactly the same two lines — `const [growFocusCompany, setGrowFocusCompany] = useState(null)` (the declaration, which matches once per line regardless of the co-located `setGrowFocusCompany` token since that token has a capital G and does not match the lowercase-g pattern) and the `initialPeopleFocus={growFocusCompany}` prop pass-through. The base commit's own count is 2, matching HEAD's count of 2 exactly — proving this is not a regression introduced by any Phase 6 plan, but a pre-existing arithmetic error in Plan 06-02's own verify-script threshold (it apparently expected the setter name to also register as a separate grep match, which it does not under a case-sensitive, lowercase-first-letter pattern). This is the same class of documented, already-accepted discrepancy as the `bg-accent-500 text-white` and `git diff --stat` miscounts Plan 06-02's own SUMMARY.md records — not a new gap, and it does not affect the substance of Gate B above (which independently confirms these exact two lines are byte-identical to base via content diff, not count).

### Changeset audit

Command:
```
git diff --name-status --no-renames 0c19dac..HEAD -- app/
```
Output:
```
M	app/src/App.jsx
D	app/src/components/OverviewTab.jsx
M	app/src/components/TodayTab.jsx
M	app/src/components/layout/Sidebar.jsx
```
**Result: PASS.** Exactly four paths, matching the three plans' declared file sets exactly — three modifications, one deletion. No fifth path.

### Requirement-level structural checks

**NAV-01** — nav array holds exactly five entries:
```
grep -n "^  { id: '" Sidebar.jsx
4:  { id: 'today', label: 'Today' },
5:  { id: 'network',  label: 'Network' },
6:  { id: 'grow',     label: 'Grow' },
7:  { id: 'pipeline', label: 'Pipeline' },
8:  { id: 'calendar', label: 'Calendar' },
```
**PASS** — exactly five, ids exactly `today`, `network`, `grow`, `pipeline`, `calendar` (NAV-01's named destinations).

**NAV-02** — exactly two settings-dispatch call sites, and the nav array cannot produce a Settings entry:
```
grep -n "onTabChange('settings')" Sidebar.jsx
65:              <button onClick={() => onTabChange('settings')}
108:          <button onClick={() => onTabChange('settings')} aria-label="Settings"
```
One in the desktop footer group (line 65), one in the mobile floating stack (line 108, `aria-label` confirming icon-only). Both `navItems.map` call sites (desktop rail, mobile bottom bar — confirmed at lines 26 and 92) read the same five-entry array shown under NAV-01, which holds no `settings` id — so neither viewport's primary nav can produce a Settings entry. **PASS.**

**NAV-03** — see the dedicated audit section above; not re-derived here per the plan's own instruction.

**NAV-04** — demo nav filter, no Settings render branch outside the signed-in root, no remaining import of the deleted module:
```
grep -n "['today', 'network', 'pipeline']" App.jsx
352:const DEMO_NAV_ITEMS = NAV_ITEMS.filter(item => ['today', 'network', 'pipeline'].includes(item.id))

grep -c "tab === 'settings'" App.jsx
=> 1

grep -rn "OverviewTab" app/src --include="*.jsx" --include="*.js" | wc -l
=> 0
```
**PASS** — exactly three demo ids, the settings branch condition appears exactly once across the whole file (the signed-in root; the demo root has none), and no file under `app/src` still references the deleted module.

### Production build

Command: `cd app && npm run build` (preceded by `npm install` — this worktree checkout had no `app/node_modules`, same gitignored-and-absent-in-fresh-worktree situation Plans 06-01/06-02 both hit).

Output tail:
```
vite v5.4.21 building for production...
transforming...
✓ 3787 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                     0.76 kB │ gzip:   0.44 kB
dist/assets/index-glIIg4uZ.css     44.68 kB │ gzip:   8.63 kB
dist/assets/index-ABN17x32.js   1,528.43 kB │ gzip: 443.87 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- ...
✓ built in 2.57s
```
**Result: PASS** — exit 0. The chunk-size advisory is a pre-existing Vite warning unrelated to this phase's changes (it fires on total bundle size, not on any file this phase touched).

### Working tree cleanliness

`git status --porcelain app/` → empty output. **PASS** — this plan modified no source file; `app/node_modules` (gitignored) and the `npm install`/build artifacts are not tracked and do not appear in this output.

### Live dev server availability

`.env` is absent from this worktree's root (`test -f .env` → `ENV_ABSENT`). Per hard constraint 4, this is the expected environment limitation already hit by Plans 05-02, 06-01 and 06-02's own worktrees — the Supabase client throws before React mounts without it. **No live render was attempted.** The checklist below must be run against a dev server with a real `.env`, per `workflow.human_verify_mode=end-of-phase`.

---

## Staged Manual Checklist (run in one sitting, desktop + mobile viewport, against a dev server with a real `.env`)

**NAV-01 — five-item nav, both viewports:**
1. Desktop: the sidebar rail lists exactly Today, Network, Grow, Pipeline, Calendar, in that order — no Overview, no Settings entry in the rail itself.
2. Mobile: the bottom bar shows the same five destinations in the same order.
3. Hard-refresh `/` (signed in). It lands on Today with content rendered — not a blank main area, not a spinner that never resolves.
4. Today's Activity card renders the Application Funnel bar chart, the Network by Status donut, and the Networking Activity trend chart. Numbers match what the retired Overview tab used to show (compare mentally against pre-Phase-6 screenshots/memory, since Overview no longer exists to compare side-by-side).
5. Force (or find) a fully-caught-up state. "Nothing needs your attention" still appears **and** the Activity card with all three charts is still visible below it — the caught-up state must not hide the charts.

**NAV-02 — Settings relocation, both viewports:**
6. Desktop: a Settings button sits in the sidebar footer group below "+ Event". Clicking it opens Settings and the button turns amber (active state) while Settings is open.
7. Mobile: a fourth round floating button (gear icon) sits above the existing three floating buttons on the right edge, at the `bottom-56` offset — confirm it is fully clear of both the bottom nav bar and the button directly below it, with no visual overlap.
8. Clicking the mobile Settings button opens Settings the same way the desktop one does.

**NAV-04 — demo route:**
9. Hard-refresh `/demo`. It lands on Today with demo (fictional) data rendered — not blank, not a sign-in prompt.
10. The demo nav shows exactly three items: Today, Network, Pipeline. No Grow, no Calendar, no Settings on either viewport.
11. No floating action buttons appear at all in demo mode (Settings/+Event/+Schedule are all gated off together).

**NAV-03 — deep-link relay, repeat-click sequences (the case a casual test misses):**
12. Open Pipeline, open an application record, click "Find people at &lt;company&gt;" (or "Find more people →" if contacts already exist there). It lands on Grow with that company focused in the People section and the matching row highlighted.
13. Without navigating away, close the panel and repeat the exact same click on the exact same company. It re-triggers — the People section re-focuses and re-highlights rather than sitting inert.
14. Switch to another destination (e.g. Today), come back to Pipeline, and repeat the same click once more. Still re-triggers.
15. Repeat steps 12-14 starting from Today's attention feed instead of Pipeline (Today's application panel has the same "find people" button).
16. Inside Grow, use the company card's "Find people →" shortcut (Companies section) and the coverage row's find-people button (Coverage section). Both scroll to and focus/highlight the People section without a full tab change, and both re-trigger on repeat clicks the same way.
17. Inside Grow's Companies section, use "+ Add to targets" on a company. It scrolls to and focuses the Coverage section (not People).

If a `.env` becomes available before the human pass, also confirm the dev server boots cleanly (`npm run dev`) with no console errors on any of the above steps.
