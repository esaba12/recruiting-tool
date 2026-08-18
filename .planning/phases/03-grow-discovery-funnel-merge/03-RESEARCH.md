# Phase 3: Grow — Discovery Funnel Merge - Research

**Researched:** 2026-08-18
**Domain:** React component consolidation / information-architecture merge (no new libraries, no backend changes)
**Confidence:** HIGH

## Summary

This phase has almost no external-library risk — it installs nothing new and touches no data model. The entire risk surface is **internal**: safely merging three already-working, independently-mounted components (`ExploreTab.jsx`, `ReferralCoverageTab.jsx`, `DiscoverTab.jsx`) into one always-mounted `GrowTab.jsx`, without breaking the cross-tab deep-link relay that STATE.md's own Blockers section flags as "easy to silently break during relocations."

All 3 source components were read in full for this research (not just grepped), because 03-UI-SPEC.md's "wraps existing component" framing implies a black-box `<ExploreTab/>` drop-in, but it is not one: each component currently renders **its own header chrome** (h2 titles, refresh/edit buttons, onboarding gates) that conflicts with the `Section` wrapper 03-UI-SPEC.md requires around it. Real edits inside all three files are required, not just a new `GrowTab.jsx` that imports and stacks them.

The second major finding: `Section`/`RowCap` (the components D-01/D-02 says to reuse "exactly") are **private, unexported functions living inside `TodayTab.jsx`** — they must be extracted into a shared module before Grow can use them, mirroring the Phase 2 D-06 precedent (`attention.js` extraction) that CONTEXT.md itself cites as the applicable pattern.

Third: there are **two** existing consumers of the `goFindPeople` deep-link, not one — `PipelineTab` (via `ApplicationDetailModal`) and **`TodayTab`** (also via `ApplicationDetailModal`, passed through as `onFindPeople`). 03-CONTEXT.md's code_context section only names Pipeline; TodayTab's identical wiring (`App.jsx:330` → `TodayTab` → `ApplicationDetailModal`) must be re-pointed too or Today's "who could I meet here" panel will silently keep landing on dead Network→Discover routing after the merge.

**Primary recommendation:** Extract `Section`/`RowCap` out of `TodayTab.jsx` into `components/ui/Section.jsx` first (small, mechanical, zero behavior change), add a `step` prop to `Section` for the new Mono index badge, then edit each of the three source files in place (strip their own header JSX, add the two new props they're each missing — see Architecture Patterns below) before writing `GrowTab.jsx` itself.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Company ranking (Companies section) | Frontend (React component state + `lib/companyFinder.js`) | API proxy (`/exa`, `/claude-api` or `/openai-api`) | Ranking logic and localStorage cache live client-side; the AI call itself proxies server-side per BYOK model — unchanged by this phase |
| Referral gap detection (Coverage section) | Frontend (`lib/networkCoverage.js`, `lib/warmIntro.js`) | — | Pure client-side derivation over already-fetched `contacts`/`apps`/`interactions` — no network call at all |
| People discovery (People section) | Frontend (React component state + `lib/discovery.js`) | API proxy (`/exa`, `/claude-api`/`/openai-api`) | Same proxy pattern as Companies |
| Cold-outreach drafting | Frontend (`lib/drafting.js`) | API proxy (`/claude-api`/`/openai-api`) | Unchanged, reused verbatim inside the People section |
| Shared target-company list | Frontend hook (`useTargetCompanies`) | API/DB (`db.js`'s `fetchTargetCompanies`/`saveTargetCompanies` → Supabase `user_settings`) | Already Supabase-backed (not localStorage) — confirmed via direct read, contradicts nothing in CONTEXT.md, just clarifies it for planning |
| Nav/routing (tab switching, deep-link relay) | Frontend (`App.jsx`'s `AppInner`, `Sidebar.jsx`) | — | No router library — single-page tab-state switching, unchanged pattern this phase must extend, not replace |
| Cross-section scroll/highlight (D-04) | Frontend (new `GrowTab.jsx` local state + refs) | — | Pure client-side DOM interaction (`scrollIntoView`), no new infra |

This phase makes **zero changes** to any Browser↔API↔Database boundary — every capability listed above already sits in the tier it needs to; the merge only changes which React component tree renders them.

## Standard Stack

No new packages. This phase reuses exactly what's already installed and already used by the 3 components being merged:

| Library | Version (confirmed in `app/package.json`) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^18.3.1 | Component tree | Already the app's runtime |
| lucide-react | ^1.23.0 | `Building2`, `Target`, `UserSearch` section icons (already used elsewhere for `Target`/`UserSearch` in `App.jsx`'s old `NETWORK_VIEWS`) | Matches 03-UI-SPEC.md's Design System table |
| framer-motion | ^12.42.2 | Tab-switch fade (`AppShell.jsx`) — unaffected by this phase, no per-section motion is introduced | VIS-04's `motion` package migration is explicitly Phase 7 scope, not this phase's |

**Installation:** none required.

**Version verification:** `[VERIFIED: app/package.json]` — read directly from the repo's own lockfile-adjacent manifest, not the registry (no registry check needed since nothing new is installed).

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.** No `npm install` step exists in any plan this research informs. Skip the Package Legitimacy Gate entirely; there is nothing to audit.

## Architecture Patterns

### System Architecture Diagram

```
User clicks "Grow" in Sidebar
        │
        ▼
App.jsx (AppInner) sets tab='grow'
        │
        ▼
GrowTab.jsx mounts (NEW FILE) — receives: contacts, apps, interactions,
contactRelationships, onRefresh, onRefreshRelationships, initialPeopleFocus
        │
        ├─► Section "Companies" (step 01) ──wraps──► ExploreTab.jsx (edited: header stripped,
        │        │                                    new onTargetAdded prop added)
        │        │  useTargetCompanies() ──reads/writes──► Supabase user_settings (via db.js)
        │        │
        │        └─ "+ Add to targets" click
        │              │
        │              ▼
        │        GrowTab's setCoverageFocus({company, ts}) ──┐
        │                                                      │
        ├─► Section "Coverage" (step 02) ──wraps──► ReferralCoverageTab.jsx (edited: header
        │        │  <───────────────────────────────────────┘  stripped, NEW focus prop +
        │        │  companyCoverage() / warmPathsToCompany()      row-ring highlight added,
        │        │  (pure client derivation, no network call)     auto-expand-textarea removed)
        │        │
        │        └─ "🔍 Find people" click
        │              │
        │              ▼
        │        GrowTab's setPeopleFocus({company, ts: Date.now()}) ──┐
        │                                                                │
        └─► Section "People" (step 03) ──wraps──► DiscoverTab.jsx (edited: header    │
                 │  <─────────────────────────────────────────────────────────────────┘
                 │  focus prop (UNCHANGED shape/mechanic, already supports this)
                 │  discoverPeople() ──► /exa proxy ──► Exa API
                 │  rankCandidates() ──► /claude-api or /openai-api proxy ──► LLM
                 │
                 └─ "+ Add to Contacts" ──► db.js addContact/updateContact ──► Supabase

External entry point (unchanged mechanic, new destination):
Pipeline's ApplicationDetailModal "who could I meet here"  ─┐
Today's ApplicationDetailModal "who could I meet here"     ─┤─► App.jsx's goFindPeople(company)
                                                              │       │
                                                              │       ▼
                                                              │  setGrowFocusCompany({company, ts})
                                                              │  setTab('grow')
                                                              └───────┘
                                                                      │
                                                                      ▼
                                                    GrowTab mounts fresh, useState(initialPeopleFocus)
                                                    seeds internal peopleFocus state → passed to
                                                    DiscoverTab's `focus` prop, same as today
```

### Recommended Project Structure

```
app/src/components/
├── GrowTab.jsx              # NEW — owns coverageFocus/peopleFocus state + 2 section refs, renders 3 Sections
├── ExploreTab.jsx           # EDITED — header stripped, new onTargetAdded prop, RowCap applied to `shown`
├── ReferralCoverageTab.jsx  # EDITED — header stripped, new focus prop + ring highlight, RowCap applied to `rows`,
│                             #          auto-expand-on-empty textarea removed, new EmptyState copy
├── DiscoverTab.jsx          # EDITED — header stripped, RowCap applied to `recommended` only, stale copy fixed
├── TodayTab.jsx             # EDITED — Section/RowCap extracted OUT (import from ui/Section.jsx instead)
├── ui/
│   └── Section.jsx           # NEW — Section + RowCap extracted from TodayTab.jsx, Section gains a `step` prop
└── layout/
    └── Sidebar.jsx           # EDITED — NAV_ITEMS 'explore'→'grow', NAV_ICON needs a new 'grow' entry (lib/icons.js)
```

### Pattern 1: Extract shared `Section`/`RowCap` before building Grow

**What:** `TodayTab.jsx` currently declares `Section` and `RowCap` as plain module-scope functions with no `export`. 03-UI-SPEC.md requires Grow's 3 sections to "reuse `TodayTab.jsx`'s `Section` component shape exactly" — that's impossible to do by importing from `TodayTab.jsx` cleanly (importing a non-exported name is a build error; exporting it out of a page-level component file just to reuse it elsewhere is exactly the kind of duplication Phase 2's D-06 precedent (`attention.js`) was created to avoid).

**When to use:** Any time a second consumer needs a component that currently lives unexported inside a page-level file — extract to `components/ui/` first, update the original consumer to import it back, per Phase 2's own established precedent.

**Example (current, unexported):**
```jsx
// Source: app/src/components/TodayTab.jsx:30-61 (verified by direct read)
function Section({ title, subtitle, accent, icon: Icon, children }) {
  const border = { danger: 'border-danger-200', warning: 'border-warning-200', ink: 'border-ink-200', accent: 'border-accent-200' }[accent] || 'border-ink-200'
  const heading = HEADING_COLOR[accent] || 'text-ink-700'
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border ${border}`}>
      <h2 className={`text-sm font-semibold ${heading} mb-1 flex items-center gap-1.5`}>
        {Icon && <Icon size={16} strokeWidth={2} />} {title}
      </h2>
      {subtitle && <p className="text-xs text-ink-400 mb-3">{subtitle}</p>}
      <div className="divide-y divide-ink-100">{children}</div>
    </div>
  )
}
```

**Required extension when extracted:** 03-UI-SPEC.md's "New this phase — a small Mono step index" (`[01] [icon] Title`) has no home in the current `Section` signature — it needs a new optional `step` prop (e.g. `step="01"`) rendered before `Icon` in the heading row, using the `Mono` primitive (`ui/Mono.jsx`, already built in Phase 1) with `text-ink-500`. `HEADING_COLOR` and `RowCap` move alongside `Section` unchanged (RowCap's `tier="ink"` branch already exists and needs no new color).

### Pattern 2: The 3 source components each own header chrome that must be stripped

**What:** None of `ExploreTab.jsx`/`ReferralCoverageTab.jsx`/`DiscoverTab.jsx` is a "body only" component today — each renders its own `<h2>`/toggle-header/profile-panel as the first thing inside its returned JSX, which duplicates the new `Section` wrapper's own header row.

**Verified current headers (each is a real edit target, not a passthrough):**
- `ExploreTab.jsx:120-134` — `<h2>Companies for you</h2>` + subtitle + Refresh/Edit-interests buttons.
- `ReferralCoverageTab.jsx:63-82` — the accent-gradient "🎯 Target companies" toggle box acts as this component's header-equivalent; per 03-UI-SPEC.md this stays but **no longer auto-expands** (see Pitfall 2 below).
- `DiscoverTab.jsx:212-247` — `ProfilePanel` + compliance note + view-switch/refresh header row.

**When to use:** Keep each component's own action controls (Refresh, Edit interests, view switch, Settings gear) — they're per-section actions, not page chrome — but remove any element that duplicates what `Section`'s own title/icon/step-index row now owns (i.e., delete `ExploreTab.jsx`'s literal `<h2>Companies for you</h2>`, since `Section title="Companies"` now renders that).

**Recommendation:** Do NOT try to make `Section` "headless-aware" via a prop toggle inside each of the 3 files — that adds a conditional branch to files with a lot of AI-integration state and raises regression risk on capabilities GROW-02 requires stay working. Instead, delete the duplicate header line directly from each file (small, targeted diff) and keep everything below it (buttons, panels, lists) exactly as it renders today.

### Pattern 3: Two independent focus mechanisms are needed, not one

**What:** D-04/D-05's two triggers land on *different kinds of targets* and must not be conflated into a single `focus` object:

1. **Coverage highlight** (triggered by Companies' "+ Add to targets"): scrolls to the **Coverage section**, highlights **one row inside `ReferralCoverageTab`**. `ReferralCoverageTab.jsx` has **no existing `focus` prop or ring-highlight rendering at all** — verified by direct read, its rows (`ReferralCoverageTab.jsx:96-142`) render no ref, no conditional ring class. This capability must be **added**, not just re-wired — mirror `DiscoverTab.jsx`'s existing pattern exactly (see Pattern 4).
2. **People highlight** (triggered by Coverage's "🔍 Find people", or the external `goFindPeople` deep-link): scrolls to the **People section**, pre-searches + highlights a row inside `DiscoverTab`. `DiscoverTab.jsx` **already has this** — `focus` prop, `rowRefs` Map, `ring-2 ring-accent-300` (`DiscoverTab.jsx:166-174, 282-283`) — completely unchanged, just re-triggered from a new caller (`GrowTab` instead of `NetworkTab`).

**Recommendation:** `GrowTab.jsx` owns two independent pieces of state, `coverageFocus` and `peopleFocus`, both shaped `{ company, ts: Date.now() }`. Do not try to unify these into one "focus" concept passed to both children — Companies never needs to read Coverage's focus state and vice versa, and conflating them risks one section's highlight bleeding into the other on an unrelated click.

### Pattern 4: Porting the highlight-ring mechanic to `ReferralCoverageTab`

**Example — the exact pattern already proven in `DiscoverTab.jsx`, to be ported into `ReferralCoverageTab.jsx`:**
```jsx
// Source: app/src/components/DiscoverTab.jsx:60, 166-174, 282-283 (verified by direct read)
const rowRefs = useRef(new Map()) // company key → row DOM node

useEffect(() => {
  if (!focus) return
  const key = normalizeCompanyName(focus.company)
  const el = rowRefs.current.get(key)
  if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [focus?.ts])   // ts (not just company) forces re-trigger on a repeat click — NAV-03's requirement

// row render:
<div ref={el => { if (el) rowRefs.current.set(normalizeCompanyName(r.company), el) }}
  className={`... ${focus && normalizeCompanyName(focus.company) === normalizeCompanyName(r.company) ? 'ring-2 ring-accent-300' : ''} ...`}>
```
`ReferralCoverageTab.jsx` needs the identical `rowRefs`/`useEffect`/ring-class trio added to its existing `rows.map(...)` block (`ReferralCoverageTab.jsx:96-142`), taking a new `focus` prop from `GrowTab`. **No new invention required** — this is a direct, byte-level port of an already-shipped, already-proven pattern in the same codebase.

### Pattern 5: Section-level scroll target (new, one level up from Pattern 4)

D-04 additionally requires scrolling the whole **Section** into view (not just the row within it) before the row-level ring highlight becomes visible — e.g. Coverage's section could be off-screen entirely when "+ Add to targets" fires. `GrowTab.jsx` needs its own refs on the Coverage and People `Section` wrapper `<div>`s (a `useRef` per section, or a `Map` keyed by section id), calling `sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })` **before** (or in the same tick as) the row-level scroll inside the child component. Recommended sequencing: fire the section-level scroll from `GrowTab` immediately on click, and let the child's own row-level effect (Pattern 4) run on its own `focus?.ts` change — both scrolls target roughly the same viewport area so a race between "scroll to section" and "scroll to row within section" is low-risk, but sequencing the section-level scroll first (synchronously on click, not inside an effect) avoids the row-level `scrollIntoView` fighting a still-in-flight section-level scroll animation.

### Pattern 6: New prop needed on `ExploreTab.jsx` — `addToTargets` has no callback today

**What:** `ExploreTab.jsx:89-94`'s `addToTargets(name)` function only touches local state (`setTargetCompanies`, `setAdded`) — it does not invoke any prop callback on success. Verified by direct read: `ExploreTab`'s current prop signature is `{ apps = [], onFindPeople }` — no `onAdd`/`onTargetAdded` prop exists.

**When to use:** `GrowTab` needs to know the instant a company is added to targets, to fire `setCoverageFocus({company, ts: Date.now()})` (Pattern 3). Add a new optional prop, e.g. `onTargetAdded`, invoked at the end of `addToTargets()` right after `setTargetCompanies(...)`.

**Note on the *existing* `onFindPeople` prop on `ExploreTab`:** `CompanyCard`'s button already toggles between "❤ Add to targets" (calls `onAdd`) and "Find people →" (calls `onFindPeople(c.name)`, shown only `isAdded`). Under the merge, the "Find people →" post-add button's existing direct-to-People behavior should be **preserved as-is** (wire it to `GrowTab`'s `setPeopleFocus`, mirroring today's `goFindPeople`) — D-04's "scroll to Coverage" instruction is specifically about the *initial* `+ Add to targets` click (`onAdd`/new `onTargetAdded`), not the already-added state's `Find people →` button, which has always been a direct shortcut into People/Discover and isn't described anywhere in 03-CONTEXT.md as changing. Flagged in Open Questions below for a planner/human confirmation pass since 03-UI-SPEC.md's interaction table doesn't explicitly address this second button.

### Anti-Patterns to Avoid
- **Wrapping the 3 components as opaque black boxes with `Section` around the outside:** produces a double-header (the component's own `<h2>`/toggle-box AND `Section`'s title row) — violates 03-UI-SPEC.md's single-header contract per section. Must edit inside each file.
- **Conflating `coverageFocus` and `peopleFocus` into one shared focus object:** causes a highlight event meant for Coverage to also (incorrectly) attempt to match a row inside People, or vice versa, since both children would receive the same object shape and one would silently no-op (harmless) but the intent split becomes implicit rather than explicit, harder to reason about during future changes.
- **Auto-fading the highlight ring with a new `setTimeout` clear:** 03-UI-SPEC.md explicitly says match `DiscoverTab.jsx`'s existing non-fading behavior — introducing a fade is scope creep beyond D-04, not a bug fix.
- **Re-deriving `useTargetCompanies` or company-list logic inside `GrowTab.jsx`:** the hook is already shared correctly across all 3 components (Supabase-backed, `db.js`) — `GrowTab` should not read/write target companies directly, only the 3 children should, exactly as today.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll-to-and-highlight a specific row | A new scroll/highlight library or IntersectionObserver-based system | The existing `rowRefs` Map + `scrollIntoView` + `ring-2` pattern already shipped in `DiscoverTab.jsx` | Zero new code needed for the row-level half of D-04 — literally copy the proven pattern (Pattern 4 above) |
| Section card chrome (title/icon/border/padding) | A new `Section`-like component from scratch | Extract `TodayTab.jsx`'s existing `Section`/`RowCap` into `ui/Section.jsx` | Byte-identical visual contract already validated by Phase 2's checker; re-deriving risks drift |
| Capped "show top N, expand" lists | A new pagination/virtualization component | `RowCap` (same extraction) | Already handles the exact cap=5/"+N more"/"Show fewer" UX 03-UI-SPEC.md asks for |
| Repeat-click re-triggering on the same target | A key-prop remount trick or manual force-update | The `{ company, ts: Date.now() }` shape, keyed in `useEffect`'s dependency array on `focus?.ts` | Already the app's established idiom for this exact problem (NAV-03), reused unchanged in 3+ places already |

**Key insight:** every piece of interaction machinery this phase needs (scroll+highlight, capped lists, repeat-click re-trigger) **already exists and already works** somewhere in this codebase. The entire implementation risk is in correctly relocating/extracting/wiring these existing pieces — not in building anything new.

## Common Pitfalls

### Pitfall 1: TodayTab's own Section usage breaks if extraction is done carelessly
**What goes wrong:** Extracting `Section`/`RowCap` out of `TodayTab.jsx` without updating `TodayTab.jsx`'s own 8 call sites (`TodayTab.jsx:392-450`) to import from the new location leaves `TodayTab.jsx` broken (referencing now-undefined names).
**Why it happens:** Easy to extract-and-forget the original consumer when the motivating need is a *new* consumer (Grow).
**How to avoid:** Same commit/task does both: create `ui/Section.jsx` with the extracted code, then edit `TodayTab.jsx`'s import line to pull `Section`/`RowCap`/`HEADING_COLOR` back in. Run the existing Today-tab UAT flow (or at minimum a build + visual smoke check on `/` → Today) as part of verification, not just Grow's own checks.
**Warning signs:** Build error referencing `Section is not defined` in `TodayTab.jsx`, or Today's attention feed rendering unstyled/missing cards.

### Pitfall 2: Coverage's auto-expanding textarea silently reappearing
**What goes wrong:** `ReferralCoverageTab.jsx:29-34`'s existing `useEffect` sets `setEditingList(targets.length === 0)` on load — meaning every time this component mounts with zero targets, its manual-entry textarea auto-opens. 03-UI-SPEC.md requires this **not** to happen anymore (conflicts with the new EmptyState "point up to Companies" message). If this line is left unedited, Grow's Coverage section will render BOTH the new EmptyState AND the auto-expanded textarea simultaneously the first time a user with zero targets visits Grow — two competing calls-to-action, exactly what 03-UI-SPEC.md's "Coverage's manual target-list textarea — preserved, not promoted" section says to avoid.
**Why it happens:** This is a single-line, easy-to-overlook behavior change buried inside a `useEffect` that looks purely like a data-sync effect (`if (!loaded) return; setDraft(...); setEditingList(...)`) — not obviously "UI open/closed state," but it is.
**How to avoid:** Change `setEditingList(targets.length === 0)` to `setEditingList(false)` (or drop the second `setEditingList` call from this effect entirely, since D-03 wants it to always start collapsed regardless of target count).
**Warning signs:** Visual check on a zero-targets account shows the raw textarea editor open by default inside the Coverage section.

### Pitfall 3: All 3 sections' daily background AI refreshes now fire simultaneously on first Grow visit
**What goes wrong:** Today, `ExploreTab`'s `runFind` daily gate and `DiscoverTab`'s `runScheduler` daily gate each fire independently, staggered across whenever a user happens to visit the Explore tab vs. the Network→Discover view (could be minutes or hours apart, or never on the same day). After the merge, since D-01/D-03 require all 3 sections to always render simultaneously, both gated effects fire on the **same** first-visit-of-the-day to Grow — two sets of Exa+Claude/OpenAI calls kick off back-to-back instead of on separate visits.
**Why it happens:** Direct, expected consequence of "always render all 3 sections" (D-01) — not a bug, but a real behavior change worth flagging since it changes the app's AI-spend timing pattern (still bounded by the existing per-day/per-company cooldown+budget logic in `lib/discoveryScheduler.js`, so total daily spend is unchanged — only the *timing* clusters differently).
**How to avoid:** No code fix needed (GROW-02 only requires functionality preservation, not timing preservation) — but flag for a human-verify checkpoint during execution ("does landing on Grow with 0 cached data feel slow/janky with 2 concurrent AI-backed sections loading at once?") since 03-UI-SPEC.md's empty-state copy ("Searching…"/"Finding companies you'll like…") will now show in 2 sections at once on a cold Grow visit, which is a new-but-benign UX moment worth a deliberate look rather than an accidental one.
**Warning signs:** None functionally — this is a UX-polish watch-item, not a correctness bug.

### Pitfall 4: TodayTab is a second, easy-to-miss consumer of `goFindPeople`
**What goes wrong:** 03-CONTEXT.md's `code_context` section names only `App.jsx`'s `goFindPeople` and Pipeline as needing D-05's re-pointing. Verified by direct read: `TodayTab.jsx:343` accepts `onFindPeople` as a prop and passes it straight through to `ApplicationDetailModal` at `TodayTab.jsx:489` (identical wiring to `PipelineTab.jsx:219`) — and `App.jsx:330` passes `onFindPeople={goFindPeople}` into `TodayTab` (`AppInner`'s JSX for `tab === 'today'`). If only Pipeline's call site is checked during verification, Today's "who could I meet here" panel (inside `ApplicationDetailModal`, opened from Today's Stale-Applications/Overdue rows) will keep silently routing to the now-nonexistent Network→Discover after this phase ships.
**Why it happens:** `goFindPeople` is a single shared function in `App.jsx` — fixing its *body* (target/tab it sets) automatically fixes both call sites, so this specific pitfall is actually **self-resolving** once `goFindPeople` itself is correctly re-pointed to `tab='grow'`. The risk is not in the fix but in **verification scope**: a plan/checker that only manually re-tests Pipeline's deep-link (because that's the only one 03-CONTEXT.md named) could ship without ever confirming Today's identical path still works.
**How to avoid:** Explicitly include a Today-tab-originated "who could I meet here" click in this phase's verification steps, not just Pipeline's.
**Warning signs:** None until manually tested — this is a verification-coverage gap, not a code gap.

### Pitfall 5: `NetworkTab`'s dead imports/state after `coverage`/`discover` views are removed
**What goes wrong:** `App.jsx`'s `NetworkTab` (defined inline in `App.jsx`, not a separate file) currently imports `ReferralCoverageTab`/`DiscoverTab` at the top of `App.jsx` and holds local `focusCompany` state (`App.jsx:59`) purely to support the `coverage`→`discover` in-tab jump (`App.jsx:119-123`). Once those two `NETWORK_VIEWS` entries are removed, this import and state become dead code if not cleaned up in the same pass — `App.jsx` also imports `Target`/`UserSearch` from `lucide-react` (`App.jsx:32`) solely for the old `NETWORK_VIEWS` icons.
**Why it happens:** `NetworkTab` and `AppInner`/`DemoApp` all live in the single `App.jsx` file — easy to touch the `NETWORK_VIEWS` array and the `tab === 'grow'` branch without noticing `NetworkTab`'s own render ternary (`App.jsx:119-127`) still references `view === 'discover'`/`view === 'coverage'`.
**How to avoid:** Grep `App.jsx` for `ReferralCoverageTab`, `DiscoverTab`, `focusCompany`, `'coverage'`, `'discover'` after editing `NETWORK_VIEWS`, and remove every now-unreachable branch/import/state variable in the same commit — not left as unused-but-harmless code.
**Warning signs:** ESLint/build warnings for unused imports; `NetworkTab`'s segmented control still visually showing Coverage/Discover chips if `NETWORK_VIEWS` itself wasn't actually trimmed.

### Pitfall 6: `Sidebar.jsx`'s `NAV_ICON` map has no `'grow'` entry
**What goes wrong:** `lib/icons.js`'s `NAV_ICON` object (`icons.js:36-45`) is keyed by tab id; it currently has `explore: Compass` and no `grow` key. If `NAV_ITEMS` is updated to `{ id: 'grow', label: 'Grow' }` without adding a matching `NAV_ICON.grow` entry, `Sidebar.jsx`'s `const Icon = NAV_ICON[item.id]` (`Sidebar.jsx:30`) resolves to `undefined`, and the nav item silently renders with **no icon** (the JSX already guards `{Icon && <Icon .../>}`, so this fails soft — no crash, just a visually broken nav row).
**Why it happens:** `NAV_ICON` isn't mentioned anywhere in 03-CONTEXT.md or 03-UI-SPEC.md — both documents specify the *section* icons (`Building2`/`Target`/`UserSearch`) but never the top-level nav icon for "Grow" itself.
**How to avoid:** Add a `grow` key to `NAV_ICON` in the same commit as the `NAV_ITEMS` rename. **[ASSUMED, needs a quick human pick]:** no icon choice is specified anywhere upstream — a reasonable candidate consistent with "company targeting → referral gaps → people discovery" is `TrendingUp` or `Sprout` (both exist in `lucide-react`'s already-installed version); this is a genuinely open, undecided visual choice, not a research-derived fact.
**Warning signs:** Sidebar nav shows a label-only row with no icon glyph next to "Grow."

## Code Examples

### The existing focus/scroll/highlight mechanic (verbatim, to be ported to Coverage)
```jsx
// Source: app/src/components/DiscoverTab.jsx (verified by direct file read, 2026-08-18)
const rowRefs = useRef(new Map())

useEffect(() => {
  if (!focus) return
  setView('byCompany')
  const key = normalizeCompanyName(focus.company)
  if (!discovered[key]) findPeople(focus.company)
  const el = rowRefs.current.get(key)
  if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [focus?.ts])
```

### The existing external deep-link entry point (to be re-pointed, not rewritten)
```jsx
// Source: app/src/App.jsx:236-240 (verified by direct file read)
// Deep-link into Network → Discover, pre-searching one company — shared by Explore's
// "Find people →" and Pipeline's "who could I meet here" panel so both land in the same place.
const goFindPeople = company => {
  setNetworkFocusCompany({ company, ts: Date.now() }); setNetworkInitialView('discover'); setTab('network')
}
// AFTER this phase, becomes (illustrative — exact naming is a planning decision):
const goFindPeople = company => {
  setGrowFocusCompany({ company, ts: Date.now() }); setTab('grow')
}
```
Note: the code comment itself ("Deep-link into Network → Discover...") is stale after this edit and must be updated in the same commit — 03-UI-SPEC.md's Copywriting Contract explicitly calls this out as a required fix, not optional polish.

## State of the Art

Not applicable in the conventional sense (no external library/API to be "current" against) — the only relevant "old vs. new" is internal:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| 3 separate destinations (top-level Explore tab + Network's Coverage/Discover sub-views) | 1 always-visible 3-section Grow page | This phase | GROW-01/GROW-02 |
| `NetworkTab`-local `focusCompany` state drives Coverage→Discover jump | `GrowTab`-local `coverageFocus`/`peopleFocus` state drives both jumps | This phase | Same mechanic, new owner, split into 2 independent objects |
| `Section`/`RowCap` private to `TodayTab.jsx` | `Section`/`RowCap` in shared `ui/Section.jsx`, imported by both `TodayTab.jsx` and `GrowTab.jsx` | This phase | Required infra extraction, zero visual change |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The post-add "Find people →" button on `CompanyCard` (Companies section) should keep jumping straight to People, not scroll to Coverage first, since D-04's "scroll to Coverage" instruction is specifically about the initial `+ Add to targets` click | Architecture Patterns, Pattern 6 | Low — if wrong, a one-line prop/handler swap fixes it; doesn't affect data or other sections. Flagged for planner/human confirmation since 03-UI-SPEC.md's interaction table doesn't explicitly disambiguate this second button. |
| A2 | `NAV_ICON.grow` should be a new lucide icon (e.g. `TrendingUp` or `Sprout`) not specified anywhere upstream | Pitfall 6 | Low — cosmetic only, easy to swap later, doesn't block any functional requirement |
| A3 | Section-level scroll (`GrowTab`'s own `scrollIntoView` on the section wrapper) should fire synchronously on click, ahead of the child's row-level effect-driven scroll, to avoid two competing scroll animations | Pattern 5 | Low-medium — if sequencing is wrong, worst case is a visually janky double-scroll on the first click of a session; not a data-correctness issue, easy to spot and fix during human-verify |

**If this table is empty:** N/A — see above, 3 low-risk items, none touching data integrity or requirement satisfaction.

## Open Questions

1. **Does the post-add "Find people →" button (Companies section, already-added state) scroll to Coverage first, or jump straight to People as it does today?**
   - What we know: 03-UI-SPEC.md's Interaction Contract table only describes the initial `+ Add to targets` click → Coverage. The already-added "Find people →" button is a pre-existing, separate control that today calls `onFindPeople` directly (bypassing Coverage entirely).
   - What's unclear: whether the merge should change this second button's behavior to also route through Coverage first (for consistency with D-04's "connected flow" framing) or preserve it as a direct shortcut (since GROW-02 requires no functional regression, and this exact button's exact behavior — "you've added this company, want to jump straight to finding people at it" — is arguably a deliberate power-user shortcut, not an oversight).
   - Recommendation: preserve as a direct-to-People jump (lowest-risk, matches GROW-02's "preserve existing functionality" literally) unless a human reviewer during 03-UI-SPEC.md's pending checker sign-off says otherwise.

2. **What icon represents "Grow" in the sidebar nav?**
   - What we know: 03-UI-SPEC.md fully specifies the 3 in-page section icons (`Building2`/`Target`/`UserSearch`) but never addresses the top-level `NAV_ICON.grow` entry `Sidebar.jsx` needs.
   - What's unclear: no design intent was captured anywhere upstream for this specific glyph.
   - Recommendation: pick any semantically-reasonable already-available `lucide-react` icon (`TrendingUp`, `Sprout`, `Rocket`) during planning/implementation — this is a zero-risk, easily-revisited choice, not worth a discuss-phase round-trip.

## Environment Availability

Skipped — this phase is a pure frontend code/config change with no new external dependencies. Every service this phase's merged components call (Exa, Claude/OpenAI via BYOK proxies, Supabase) is already live and already exercised by the existing, unmerged versions of these same 3 components — nothing new to provision.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None found — no `pytest`/`jest`/`vitest` config, no `test`/`tests`/`__tests__` directory under `app/` `[VERIFIED: repo structure, no test runner in app/package.json]` |
| Config file | none |
| Quick run command | n/a — no automated test suite exists in this repo today |
| Full suite command | n/a |

**This repo has no automated test infrastructure at all** (confirmed consistent with Phase 1/Phase 2's own SUMMARY notes, which describe "human-check visual-verification procedure" as the actual verification mechanism, not automated tests). This phase should follow the same precedent: manual/conversational UAT via `/gsd-verify-work`, not a new test-writing task.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Manual Verification Steps | File Exists? |
|--------|----------|-----------|---------------------------|-------------|
| GROW-01 | User moves Companies→Coverage→People without leaving Grow | manual-only | Land on Grow with ≥1 target company; click "+ Add to targets" on a new company card → confirm smooth-scroll to Coverage + row highlight; click "🔍 Find people" on a Coverage row → confirm smooth-scroll to People + row highlight/pre-search, all without a tab switch | N/A — no test file, this repo has no automated test suite |
| GROW-01 (cont'd) | External deep-links land on Grow, not dead Network routing | manual-only | From Pipeline, open an application, click "who could I meet here" → confirm it lands on Grow/People, not a blank Network tab. Repeat identically from **Today**'s equivalent panel (Pitfall 4) | N/A |
| GROW-02 | All 4 capabilities (ranking, gap detection, discovery, drafting) still work | manual-only | Run one full pass of each: refresh Companies ranking, view a Coverage gap row, run/re-run a People search, generate + copy a cold-outreach draft | N/A |
| GROW-01 success criterion 3 | Old destinations gone | manual-only (+ grep) | Confirm Sidebar has no "Explore" item; Network's segmented control has no Coverage/Discover chips; `grep -rn "'explore'\|NETWORK_VIEWS.*coverage\|NETWORK_VIEWS.*discover" app/src` returns nothing live | N/A |

### Sampling Rate
- **Per task commit:** visual smoke check of the specific section edited (no automated quick-run exists)
- **Per wave merge:** full manual pass of all 4 checklist rows above
- **Phase gate:** the 4-row manual checklist above, green, before `/gsd-verify-work`

### Wave 0 Gaps
None — this repo has never had an automated test framework; introducing one is out of this phase's scope (would be a cross-cutting infra decision, not something GROW-01/GROW-02 requires). Consistent with Phase 1/Phase 2's own precedent of relying entirely on staged human-verification passes.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | This phase touches zero auth code — `requireUser()` gates on `/exa`/`/claude-api`/`/openai-api` are unchanged, still enforced server-side regardless of which React component initiates the call |
| V3 Session Management | No | Unchanged |
| V4 Access Control | No | RLS policies on `contacts`/`applications`/`interactions`/`user_settings` (target companies) are unaffected — this phase only changes which component renders already-fetched, already-scoped data |
| V5 Input Validation | No new surface | The Coverage textarea (freeform company list) already exists today and is unchanged by this phase beyond its default-open state (Pitfall 2) — no new input field is introduced |
| V6 Cryptography | No | Unaffected — no BYOK key or token handling touched |

### Known Threat Patterns for this stack

No new threat surface. This phase is a pure client-side component reorganization; it does not add, remove, or modify any server-side endpoint, RLS policy, or credential-handling code. The one thing worth a deliberate (not required, but cheap) sanity check during implementation: confirm the new `GrowTab.jsx` does not accidentally get added to `DEMO_NAV_ITEMS` (`App.jsx:366`) — per CONTEXT.md's own Integration Points note, Grow inherits Explore/Coverage/Discover's existing `/demo`-exclusion (all three call `requireUser()`-gated proxies that would 401 for an anonymous visitor) and must **not** be added to the demo nav, exactly as `'explore'` was never in `DEMO_NAV_ITEMS` today `[VERIFIED: App.jsx:366]`.

## Sources

### Primary (HIGH confidence — direct codebase reads, verified 2026-08-18)
- `app/src/App.jsx` — full read; `AppInner`, `NetworkTab`, `DemoApp`, `goFindPeople`, `NAV_ITEMS`/`NETWORK_VIEWS`/`DEMO_NAV_ITEMS` usage
- `app/src/components/ExploreTab.jsx` — full read; header structure, `addToTargets`, `CompanyCard`
- `app/src/components/ReferralCoverageTab.jsx` — full read; header/toggle-box, row rendering, no existing focus mechanic
- `app/src/components/DiscoverTab.jsx` — full read; existing `focus`/`rowRefs`/ring-highlight mechanic, stale empty-state copy
- `app/src/components/TodayTab.jsx` — full read; `Section`/`RowCap` (unexported), 8 existing call sites, `onFindPeople` threading to `ApplicationDetailModal`
- `app/src/components/layout/Sidebar.jsx` — full read; `NAV_ITEMS`, icon lookup
- `app/src/components/layout/AppShell.jsx` — full read; tab-switch motion, demo banner
- `app/src/lib/icons.js` — full read; `NAV_ICON` map, missing `grow` key
- `app/src/lib/useTargetCompanies.js` — full read; confirms Supabase-backed (not localStorage)
- `app/src/components/ui/Mono.jsx` — full read; primitive to reuse for the step-index badge
- `app/src/shared.jsx`, `app/src/components/jobBoards/helpers.js` — grep-verified `Badge`/`EmptyState`/`lsGet`/`lsSet` exports
- `app/package.json` — grep-verified installed versions (react, framer-motion, lucide-react, recharts)
- `PipelineTab.jsx`/`ApplicationDetailModal.jsx` — grep-verified `onFindPeople` call sites (confirms Pitfall 4's TodayTab finding)
- `.planning/phases/03-grow-discovery-funnel-merge/03-CONTEXT.md`, `03-UI-SPEC.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — full reads

### Secondary (MEDIUM confidence)
None used — no web/docs lookups were needed for this phase (zero new libraries, zero external API changes).

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, versions read directly from `package.json`
- Architecture: HIGH — every pattern cited was read directly from the actual source files being merged, not inferred
- Pitfalls: HIGH — each pitfall traces to a specific verified line range in the actual codebase, not a hypothetical

**Research date:** 2026-08-18
**Valid until:** effectively indefinite for the architectural findings (internal codebase facts don't go stale like external API docs) — re-verify only if another phase touches `TodayTab.jsx`, `App.jsx`, or the 3 merged components before Phase 3 executes
