---
phase: 03
status: issues
files_reviewed: 9
findings:
  critical: 1
  warning: 1
  info: 2
  total: 4
---

## Summary

Reviewed the 9 files changed by Phase 3's Grow merge (`GrowTab.jsx`, `ExploreTab.jsx`,
`ReferralCoverageTab.jsx`, `DiscoverTab.jsx`, `ui/Section.jsx`, `App.jsx`, `TodayTab.jsx`,
`Sidebar.jsx`, `lib/icons.js`) against `aa4cfc7`. `npx vite build` succeeds with no errors.
Cross-checked findings against `03-CONTEXT.md`/`03-RESEARCH.md`/`03-PATTERNS.md` to avoid
flagging intentional, documented behavior changes.

**Confirmed correct (no issue):**
- Both `goFindPeople` call sites (`PipelineTab` via `App.jsx:319`, `TodayTab` via `App.jsx:321`)
  were re-pointed to `tab='grow'` — verified by reading `goFindPeople`'s single shared body
  (`App.jsx:228-230`), which both call sites route through, plus each tab's own
  `onFindPeople={goFindPeople}` wiring.
- `App.jsx`'s old Coverage/Discover `NetworkTab` branches, `focusCompany`/`networkFocusCompany`
  state, and the `explore`/`coverage`/`discover` tab/view strings are fully removed — a repo-wide
  grep for those identifiers in `App.jsx` returns zero matches, no orphaned references.
  `Sidebar.jsx`'s `NAV_ITEMS` and `lib/icons.js`'s `NAV_ICON` both consistently swap
  `explore`→`grow` (`Sprout` icon), no stale `explore`/`Compass` entries left behind.
  `Section`/`RowCap`/`HEADING_COLOR` extraction into `ui/Section.jsx` is a clean, byte-identical
  move — `TodayTab.jsx`'s 8 existing call sites all correctly import from the new location.
- `ReferralCoverageTab.jsx` dropping `setEditingList(targets.length === 0)` (no longer
  auto-expanding the target-list textarea on empty state) is **intentional**, not a regression —
  explicitly required by `03-RESEARCH.md`'s "Pitfall 2" to avoid two competing empty-state CTAs.

---

### CR-01: `useTargetCompanies()` desyncs across Grow's three concurrently-mounted sections — can silently drop a just-added target company

**Files:** `app/src/components/GrowTab.jsx`, `app/src/components/ExploreTab.jsx`,
`app/src/components/ReferralCoverageTab.jsx`, `app/src/components/DiscoverTab.jsx`,
`app/src/lib/useTargetCompanies.js`

`useTargetCompanies()` (`lib/useTargetCompanies.js`) is a plain hook, not a shared store: every
call creates its **own** independent `useState`/`useEffect` pair that fetches the target-company
list from Supabase exactly once, on that component's mount (`useEffect(..., [])`). `ExploreTab`,
`ReferralCoverageTab`, and `DiscoverTab` each call it separately.

Before this phase, that was safe: Explore was its own top-level tab and Coverage/Discover were
mutually-exclusive views inside `NetworkTab`'s ternary (`view === 'discover' ? <DiscoverTab/> :
view === 'coverage' ? <ReferralCoverageTab/> : ...`) — only one of the three was ever mounted at
once, so switching between them always remounted-and-refetched fresh data.

`GrowTab.jsx` changes this: per D-01/D-03 (`03-CONTEXT.md`), all three sections render
**unconditionally and simultaneously** on one scrollable page (`GrowTab.jsx:30-44`). Now all
three `useTargetCompanies()` instances are mounted at once, each holding its own stale copy:

1. User adds "Stripe" via Companies (`ExploreTab.addToTargets`) — this instance's local
   `targets` state updates optimistically and persists to Supabase, then fires
   `onTargetAdded?.(name)` → `GrowTab.goToCoverage` scrolls to Coverage and sets `coverageFocus`.
2. `ReferralCoverageTab`'s **own, separate** `useTargetCompanies()` instance still holds the
   `targets` array from its initial mount-time fetch — it has no idea "Stripe" was added. Its
   `rows` (built from `targets.map(...)`, `ReferralCoverageTab.jsx:56`) won't include "Stripe" at
   all, so `rowRefs.current.get(normalizeCompanyName('Stripe'))` is `undefined` and the deep-link
   scroll/highlight silently no-ops — the user is scrolled to the Coverage section but sees no
   highlighted (or even present) row for the company they just added.
3. Same failure mode one level deeper for People: if the user instead clicks "Find people →" on
   the now-`isAdded` Companies card, `GrowTab.goToPeople` scrolls to People and
   `DiscoverTab`'s deep-link effect (`DiscoverTab.jsx:167-175`) calls `findPeople(focus.company)`
   (which does work — it's a direct Exa search, not gated on `targets`) and stores results into
   `discovered[key]`. But the **row that would display those results** only renders if the company
   is in `DiscoverTab`'s own (separately stale) `rows = targets.map(...)` (`DiscoverTab.jsx:196-201`)
   for the `byCompany` view, which the deep-link effect force-switches to
   (`setView('byCompany')`). Net effect: people are found and cached in state, but no row exists
   to show them — the section renders as if nothing happened.
4. Worse than a UI-only staleness bug: if the user then opens Coverage's "🎯 Target companies"
   editor (`ReferralCoverageTab.jsx:76`, `onClick={() => { setDraft(targets.join('\n')); ... }}`)
   — using Coverage's own stale `targets`, which is missing "Stripe" — and clicks "Save target
   list" (even without editing anything), `saveTargets()` calls `setTargets(list)` with the
   incomplete list. This **overwrites the Supabase-persisted target list**, silently reverting
   the just-added company. This is a real, if narrow, data-loss path enabled by the merge, not
   just a stale-read UI glitch.

`03-RESEARCH.md` explicitly assumed away this class of bug ("the hook is already shared correctly
across all 3 components ... `GrowTab` should not read/write target companies directly") —
conflating "shared hook *implementation*" with "shared hook *state*". Since all three consumers
are now mounted together for the lifetime of a Grow visit, they need one shared source of truth
(lift `useTargetCompanies()` into `GrowTab` and pass `targets`/`setTargets` down as props, or
introduce a small shared cache/context) rather than three independent fetch-once copies.

**Fix suggestion:** call `useTargetCompanies()` once in `GrowTab.jsx` and thread `targets`/
`setTargets`/`loaded` down as props to `ExploreTab`, `ReferralCoverageTab`, and `DiscoverTab`
(all three already accept `contacts`/`apps`/etc. as props, so this is a consistent pattern) —
or, more minimally, add a lightweight module-level subscription so every `useTargetCompanies()`
instance re-syncs when any instance calls `setTargets`.

---

### WR-01: `ReferralCoverageTab`'s deep-link scroll/highlight silently fails once a Coverage row isn't in the visible `RowCap` slice

**File:** `app/src/components/ReferralCoverageTab.jsx` (lines 107-153)

`rows` is wrapped in `<RowCap items={rows} cap={5} .../>` (added this phase). `RowCap`
(`ui/Section.jsx:30-44`) only renders `items.slice(0, cap)` unless its own internal `expanded`
state is toggled by the user — and that state is private to `RowCap`, with no prop for a parent
to force it open. The row `ref` callback that populates `rowRefs` (`ReferralCoverageTab.jsx:109`)
only fires for rows that are actually rendered.

So the deep-link effect (`ReferralCoverageTab.jsx:40-46`) — `rowRefs.current.get(key)` — returns
`undefined`, and the `if (el) setTimeout(...)` guard silently no-ops, whenever the target company
is ranked 6th or later among the sorted rows (`gap` status first, then `weak`, then `strong`;
`ReferralCoverageTab.jsx:68`). This is a realistic scenario for any user actively tracking more
than 5 target companies (plausible for job-search users, and the whole point of the feature), not
an edge case. Unlike `DiscoverTab`'s analogous mechanic — which is safe because the deep-link
effect forces `view='byCompany'`, whose row list is **not** RowCap-wrapped and always renders
every target company — Coverage has no such "switch to an uncapped view" escape hatch; it has
only one view, permanently capped.

**Fix suggestion:** either have the deep-link effect force `RowCap`'s `expanded` state open (needs
a controlled/externally-triggerable expand, e.g. an `forceExpand` prop passed down when `focus`
targets a row beyond `cap`), or sort/filter `rows` so the focused company is always guaranteed to
land within the first `cap` entries when a scroll is pending.

---

### IN-01: `GrowTab`'s `initialPeopleFocus` is threaded as a `useState` initial value, not a live prop — fragile if a future call site renders `GrowTab` without a full unmount

**File:** `app/src/components/GrowTab.jsx` (line 15)

`const [peopleFocus, setPeopleFocus] = useState(initialPeopleFocus)` only reads the prop once, at
mount. This works correctly today only because `App.jsx` conditionally renders `GrowTab` — `{tab
=== 'grow' && <GrowTab .../>}` — so it fully unmounts/remounts every time `goFindPeople` navigates
into it from Pipeline or Today (the only two call sites), and `useState`'s initial-value read
happens fresh on each such mount. If a future change ever renders `GrowTab` persistently (e.g. a
shell/layout that keeps tabs mounted for animation, or a same-tab deep-link trigger from inside
Grow itself), a second `goFindPeople` call while already mounted would update the `growFocusCompany`
prop but never reach `peopleFocus`, silently breaking the deep-link. Not a live bug given current
usage, but worth a comment noting the unmount dependency, or switching to a `useEffect` on
`initialPeopleFocus` (mirroring the `focus?.ts`-keyed pattern already used one level down in
`DiscoverTab`/`ReferralCoverageTab`) so the component doesn't implicitly depend on the parent's
mount/unmount behavior for correctness.

### IN-02: `rowRefs` Map entries are never pruned on row removal (pre-existing pattern, now duplicated)

**Files:** `app/src/components/ReferralCoverageTab.jsx` (line 109), `app/src/components/DiscoverTab.jsx` (line 283)

`ref={el => { if (el) rowRefs.current.set(key, el) }}` only ever adds to the `Map`, never deletes
on unmount (`el === null`). Detached DOM nodes for companies that get dismissed/removed/reordered
stay referenced indefinitely for the life of the component. This is inherited from `DiscoverTab`'s
pre-existing "donor" pattern (`ReferralCoverageTab.jsx`'s comment: "mirrors DiscoverTab.jsx's donor
pattern exactly") rather than a new defect introduced this phase, and doesn't cause visible bugs
(entries for still-present companies are correctly overwritten on every render) — flagging as a
minor, low-priority cleanup opportunity now that the pattern is duplicated into a second file.
