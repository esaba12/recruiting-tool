# Phase 3: Grow — Discovery Funnel Merge - Pattern Map

**Mapped:** 2026-08-18
**Files analyzed:** 9 (1 new, 8 modified)
**Analogs found:** 9 / 9 — every file being touched already has a byte-level analog in the same codebase (this phase is a relocation/extraction, not new-pattern work)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/src/components/GrowTab.jsx` (NEW) | page/component (tab-level container) | request-response (composes 3 child data-fetchers) | `app/src/components/TodayTab.jsx` | exact (same "stacked always-rendered Section page" shape) |
| `app/src/components/ui/Section.jsx` (NEW) | component (extracted UI primitive) | transform (pure render) | `app/src/components/TodayTab.jsx` lines 30-61 (itself, being extracted) | exact (verbatim extraction) |
| `app/src/components/ExploreTab.jsx` (EDITED) | component | CRUD + event-driven (AI refresh) | itself (pre-edit version) / `DiscoverTab.jsx` (sibling pattern) | exact |
| `app/src/components/ReferralCoverageTab.jsx` (EDITED) | component | CRUD (pure client derivation) | `app/src/components/DiscoverTab.jsx` (focus/highlight mechanic to port in) | role-match for the new focus prop; exact for its own existing shape |
| `app/src/components/DiscoverTab.jsx` (EDITED) | component | event-driven (Exa/Claude calls) | itself (pre-edit version) — the `focus`/`rowRefs` mechanic is the analog **other files copy from** | exact |
| `app/src/components/TodayTab.jsx` (EDITED) | component | transform (import swap only) | itself | exact |
| `app/src/App.jsx` (EDITED — `AppInner`, `NetworkTab`, `DemoApp`) | routing/controller | request-response (tab switch, deep-link state) | itself (pre-edit) | exact |
| `app/src/components/layout/Sidebar.jsx` (EDITED) | component (nav) | transform | itself | exact |
| `app/src/lib/icons.js` (EDITED) | config/lookup module | transform | itself | exact |

## Pattern Assignments

### `app/src/components/ui/Section.jsx` (NEW — extraction)

**Analog:** `app/src/components/TodayTab.jsx` lines 1-61 (the unexported `Section`/`RowCap`/`HEADING_COLOR`)

**Extract verbatim** (this is a mechanical move, not a rewrite):
```jsx
// Source: app/src/components/TodayTab.jsx:26-61
const HEADING_COLOR = { danger: 'text-danger-700', warning: 'text-warning-700', ink: 'text-ink-700', accent: 'text-accent-700' }

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

function RowCap({ items, cap = 5, tier, renderItem }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, cap)
  return (
    <div>
      <div className="divide-y divide-ink-100">{visible.map(renderItem)}</div>
      {items.length > cap && (
        <button onClick={() => setExpanded(e => !e)}
          className={`text-xs font-medium hover:underline pt-2 text-center w-full ${HEADING_COLOR[tier] || 'text-ink-700'}`}>
          {expanded ? 'Show fewer' : `+${items.length - cap} more — Show all`}
        </button>
      )}
    </div>
  )
}

export { Section, RowCap, HEADING_COLOR }
```

**Required extension (03-UI-SPEC.md):** add an optional `step` prop to `Section`, rendered via the existing `Mono` primitive (`app/src/components/ui/Mono.jsx`) before `Icon`, color `text-ink-500`:
```jsx
{step && <Mono className="text-ink-500">{step}</Mono>}
{Icon && <Icon size={16} strokeWidth={2} />} {title}
```

**Imports needed:** `import { useState } from 'react'` + `import Mono from './Mono.jsx'` (same-directory import since `Mono.jsx` already lives in `ui/`).

**Back-reference required (Pitfall 1):** `TodayTab.jsx` must replace its local `Section`/`RowCap`/`HEADING_COLOR` definitions with:
```jsx
import { Section, RowCap, HEADING_COLOR } from './ui/Section.jsx'
```
All 8 of `TodayTab.jsx`'s existing `<Section .../>`/`<RowCap .../>` call sites (lines ~392-450) are otherwise untouched.

---

### `app/src/components/GrowTab.jsx` (NEW)

**Analog:** `app/src/components/TodayTab.jsx` (the "many Sections, one always-rendered page" container shape) — TodayTab is a data-orchestration parent that renders several `<Section>`s each wrapping a computed list; GrowTab is the same shape but each Section wraps an existing full component instead of a computed list.

**Imports pattern** (mirrors `TodayTab.jsx:1-18`'s style — named lib imports, sibling component imports, icon imports last):
```jsx
import { useState, useRef } from 'react'
import { Section } from './ui/Section.jsx'
import ExploreTab from './ExploreTab.jsx'
import ReferralCoverageTab from './ReferralCoverageTab.jsx'
import DiscoverTab from './DiscoverTab.jsx'
import { Building2, Target, UserSearch } from 'lucide-react'
```

**Core pattern — page shell + two independent focus states** (per RESEARCH.md Pattern 3/5; mirrors the `{ company, ts: Date.now() }` shape already used in `App.jsx:238-240` and `App.jsx:122-123`):
```jsx
export default function GrowTab({ contacts, apps, interactions, contactRelationships, onRefresh, onRefreshRelationships, initialPeopleFocus = null }) {
  const [coverageFocus, setCoverageFocus] = useState(null) // { company, ts }
  const [peopleFocus, setPeopleFocus] = useState(initialPeopleFocus) // { company, ts }
  const coverageSectionRef = useRef(null)
  const peopleSectionRef = useRef(null)

  function goToCoverage(company) {
    coverageSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setCoverageFocus({ company, ts: Date.now() })
  }
  function goToPeople(company) {
    peopleSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setPeopleFocus({ company, ts: Date.now() })
  }

  return (
    <div className="space-y-4">
      <Section step="01" title="Companies" icon={Building2} accent="ink">
        <ExploreTab apps={apps} onTargetAdded={goToCoverage} onFindPeople={goToPeople} />
      </Section>
      <div ref={coverageSectionRef}>
        <Section step="02" title="Coverage" icon={Target} accent="ink">
          <ReferralCoverageTab contacts={contacts} apps={apps} interactions={interactions}
            contactRelationships={contactRelationships} onRefresh={onRefresh}
            focus={coverageFocus} onFindPeople={goToPeople} />
        </Section>
      </div>
      <div ref={peopleSectionRef}>
        <Section step="03" title="People" icon={UserSearch} accent="ink">
          <DiscoverTab contacts={contacts} apps={apps} interactions={interactions} onRefresh={onRefresh} focus={peopleFocus} />
        </Section>
      </div>
    </div>
  )
}
```
Note: `Section`'s own `<div>` wrapper (from `ui/Section.jsx`) is the *card*, not the scroll anchor — per RESEARCH.md Pattern 5, wrap each scroll-targeted Section in its own outer `<div ref=...>` so `scrollIntoView` targets the whole card, not just its inner content.

**Error handling:** none needed at this level — each child component (`ExploreTab`/`ReferralCoverageTab`/`DiscoverTab`) already owns its own try/catch + inline `danger`-toned error banner (see `ExploreTab.jsx:58-59`, `catch (e) { setError(e.message) }`). `GrowTab` is pure composition/state-relay, no new fetch/error surface.

---

### `app/src/components/ExploreTab.jsx` (EDITED)

**Analog:** itself (pre-edit) — `app/src/components/ExploreTab.jsx` lines 1-160 read in full.

**Header strip (delete these lines, `ExploreTab.jsx:119-124`):**
```jsx
// DELETE — Section now owns this:
<h2 className="font-heading text-lg font-semibold text-ink-900">Companies for you</h2>
<p className="text-[11px] text-ink-400">
  From YC's directory + Exa's public-web search, ranked for you. Add one and it flows into Coverage & Discover.
</p>
```
Keep the Refresh/Edit-interests buttons (`ExploreTab.jsx:125-133`) — they're per-section actions, not page chrome (RESEARCH.md Pattern 2).

**New prop — `onTargetAdded` callback** (Pattern 6), added at the end of `addToTargets()`:
```jsx
// Current (ExploreTab.jsx:89-94):
function addToTargets(name) {
  if (!targets.some(t => normalizeCompanyName(t) === normalizeCompanyName(name))) {
    setTargetCompanies([...targets, name])
  }
  const next = new Set(added); next.add(name); setAdded(next); lsSet(ADDED_KEY, [...next])
}
// AFTER — add onTargetAdded?.(name) as the last line, and thread the new prop through the
// function signature: export default function ExploreTab({ apps = [], onFindPeople, onTargetAdded })
```

**RowCap application:** replace `companies.filter(...)` render (`shown` at line 114) with `<RowCap items={shown} cap={5} tier="ink" renderItem={c => <CompanyCard key={c.name} .../>} />`, importing `RowCap` from `./ui/Section.jsx`.

**Preserve unchanged (Assumption A1):** `CompanyCard`'s post-add "Find people →" button still calls `onFindPeople(c.name)` directly — do not route it through `onTargetAdded`/Coverage.

---

### `app/src/components/ReferralCoverageTab.jsx` (EDITED)

**Analog for the new `focus` mechanic:** `app/src/components/DiscoverTab.jsx` lines 39, 60, 166-174, 282-283 — port verbatim, adapted to this file's row shape.

**Full current file read** (`app/src/components/ReferralCoverageTab.jsx`, 159 lines) — key edit points:

1. **Pitfall 2 fix — stop auto-expanding the textarea** (`ReferralCoverageTab.jsx:29-34`):
```jsx
// BEFORE:
useEffect(() => {
  if (!loaded) return
  setDraft(targets.join('\n'))
  setEditingList(targets.length === 0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [loaded])
// AFTER — drop the auto-open:
useEffect(() => {
  if (!loaded) return
  setDraft(targets.join('\n'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [loaded])
```

2. **New EmptyState copy** (replaces `ReferralCoverageTab.jsx:85`):
```jsx
<EmptyState msg="Add target companies above to see referral gaps." />
```

3. **Port the focus/highlight mechanic** (new prop `focus`, adapted from `DiscoverTab.jsx`):
```jsx
// Analog source: app/src/components/DiscoverTab.jsx:60, 166-174
const rowRefs = useRef(new Map())

useEffect(() => {
  if (!focus) return
  const key = normalizeCompanyName(focus.company)
  const el = rowRefs.current.get(key)
  if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [focus?.ts])
```
Row render (`ReferralCoverageTab.jsx:97-98` currently has no ref/ring — add both, mirroring `DiscoverTab.jsx:282-283`):
```jsx
<div key={r.company} ref={el => { if (el) rowRefs.current.set(normalizeCompanyName(r.company), el) }}
  className={`bg-white rounded-xl p-4 shadow-sm border flex items-start justify-between gap-3
    ${focus && normalizeCompanyName(focus.company) === normalizeCompanyName(r.company) ? 'ring-2 ring-accent-300' : ''}
    ${r.status === 'gap' ? 'border-danger-200' : r.status === 'weak' ? 'border-warning-200' : 'border-ink-100'}`}>
```
Add `useRef` to the existing `import { useState, useEffect } from 'react'` line, and add `focus` to the component's prop destructure (`export default function ReferralCoverageTab({ contacts, apps, interactions, contactRelationships = [], onRefresh, onFindPeople, focus })`).

4. **RowCap application:** wrap the `rows.map(...)` block (`ReferralCoverageTab.jsx:96-142`) in `<RowCap items={rows} cap={5} tier="ink" renderItem={r => (...)} />`.

**Preserve unchanged:** the target-company textarea toggle box (`ReferralCoverageTab.jsx:63-82`), `warmPathsToCompany`/`companyCoverage` derivation logic, `DraftPanel` cold-outreach integration, `ContactDetailModal` "+ Add contact" flow — none of these need edits, per RESEARCH.md's anti-pattern warning against over-touching working AI/data logic.

---

### `app/src/components/DiscoverTab.jsx` (EDITED — minimal)

**Analog:** itself — this file is the **source** analog other files copy the focus mechanic from; it needs only 2 small edits.

**Stale copy fix (required, not optional — 03-UI-SPEC.md Copywriting Contract):**
```jsx
// BEFORE (DiscoverTab.jsx:223):
<EmptyState msg="Add a target-company list in Network → Coverage first — Discover uses the same list." />
// AFTER:
<EmptyState msg="Add target companies above to see people to reach out to — People uses the same list." />
```

**Header strip:** per Pattern 2, `ProfilePanel`/compliance-note/view-switch header block (`DiscoverTab.jsx:210-247`) stays — it's per-section controls (view switch, refresh, settings gear), not a duplicate page title (`DiscoverTab.jsx` never had an `<h2>` title the way `ExploreTab.jsx` did — verify no `<h2>` needs removal here; RESEARCH.md's Pattern 2 list only cites lines 212-247 for context, not necessarily all deletable).

**RowCap application:** wrap `recommended.map(...)` (`DiscoverTab.jsx:275`) in `<RowCap items={recommended} cap={5} tier="ink" renderItem={c => <CandidateCard .../>} />` — **only** the Recommended list, not the By-company nested lists (03-UI-SPEC.md "Out of cap scope").

**No changes needed** to the `focus`/`rowRefs`/ring-highlight mechanic itself (`DiscoverTab.jsx:60, 166-174, 282-283`) — `GrowTab` becomes a new caller of the same unchanged `focus` prop shape.

---

### `app/src/App.jsx` (EDITED)

**Analog:** itself (pre-edit) — `AppInner`, `NetworkTab`, `DemoApp` all read in full.

**`goFindPeople` re-point (D-05, required in both call sites per Pitfall 4):**
```jsx
// BEFORE (App.jsx:236-240):
// Deep-link into Network → Discover, pre-searching one company — shared by Explore's
// "Find people →" and Pipeline's "who could I meet here" panel so both land in the same place.
const goFindPeople = company => {
  setNetworkFocusCompany({ company, ts: Date.now() }); setNetworkInitialView('discover'); setTab('network')
}
// AFTER:
// Deep-link into Grow's People section, pre-searching one company — shared by Pipeline's and
// Today's "who could I meet here" panels so both land in the same place.
const goFindPeople = company => {
  setGrowFocusCompany({ company, ts: Date.now() }); setTab('grow')
}
```
Requires a new `const [growFocusCompany, setGrowFocusCompany] = useState(null)` state (replacing `networkFocusCompany`/`networkInitialView` if those become dead — see Pitfall 5) and threading `initialPeopleFocus={growFocusCompany}` into the new `<GrowTab .../>` render.

**Tab branch swap** (`App.jsx:323-325`):
```jsx
// BEFORE:
{!loading && tab === 'explore'  && (
  <ExploreTab apps={apps} onFindPeople={goFindPeople} />
)}
// AFTER:
{!loading && tab === 'grow' && (
  <GrowTab contacts={contacts} apps={apps} interactions={interactions} contactRelationships={contactRelationships}
    onRefresh={load} onRefreshRelationships={refreshContactRelationships}
    initialPeopleFocus={growFocusCompany} />
)}
```
Add `import GrowTab from './components/GrowTab.jsx'` alongside the existing `import ExploreTab from './components/ExploreTab.jsx'` (App.jsx:28) — `ExploreTab` import stays (GrowTab imports it internally), but the direct `<ExploreTab .../>` App.jsx render site goes away.

**`NetworkTab`'s dead-code cleanup (Pitfall 5)** — after removing `coverage`/`discover` from `NETWORK_VIEWS` (`App.jsx:36-43`), also remove:
- `import ReferralCoverageTab from './components/ReferralCoverageTab.jsx'` and `import DiscoverTab from './components/DiscoverTab.jsx'` (App.jsx:25, 27) — **unless** `GrowTab.jsx` re-imports them itself, in which case these two `App.jsx` top-level imports become genuinely dead and should be deleted from `App.jsx` specifically (they were only ever used by `NetworkTab`'s ternary, not elsewhere in `App.jsx`).
- `Target`, `UserSearch` from the `lucide-react` import line (`App.jsx:32`) — only used for `NETWORK_VIEWS`' now-removed icons (confirm not reused by `GrowTab.jsx`'s own new `Target`/`UserSearch` icon imports — those are a **separate** import in the new file, not a shared one, so `App.jsx`'s copy is safe to delete).
- `NetworkTab`'s local `focusCompany` state (`App.jsx:59`) and the `view === 'discover'`/`view === 'coverage'` render branches (`App.jsx:119-123`) — both become unreachable once `NETWORK_VIEWS` no longer contains those keys.

**Demo route — do NOT add:** `DEMO_NAV_ITEMS` (`App.jsx:366`) filters `NAV_ITEMS` down to `['today', 'overview', 'network', 'pipeline']` — `'grow'` must **not** be added to this list (mirrors `'explore'`'s existing absence), since Grow's 3 sections all call `requireUser()`-gated proxies that would 401 for an anonymous `/demo` visitor.

---

### `app/src/components/layout/Sidebar.jsx` (EDITED)

**Analog:** itself — `NAV_ITEMS` array, lines 3-12.

```jsx
// BEFORE (Sidebar.jsx:3-12):
const NAV_ITEMS = [
  { id: 'today', label: 'Today' },
  { id: 'overview', label: 'Overview' },
  { id: 'network',  label: 'Network' },
  { id: 'explore',  label: 'Explore' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'github',   label: 'Job Boards' },
  { id: 'settings', label: 'Settings' },
]
// AFTER — replace the 'explore' row, keep every other row and array position identical:
const NAV_ITEMS = [
  { id: 'today', label: 'Today' },
  { id: 'overview', label: 'Overview' },
  { id: 'network',  label: 'Network' },
  { id: 'grow',     label: 'Grow' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'github',   label: 'Job Boards' },
  { id: 'settings', label: 'Settings' },
]
```
No other edits needed in this file — `Icon = NAV_ICON[item.id]` (line 30, 90) already resolves dynamically once `icons.js` gets a `grow` key (see below); the `{Icon && <Icon .../>}` guard already fails soft if it's ever missing.

---

### `app/src/lib/icons.js` (EDITED)

**Analog:** itself — `NAV_ICON` map, lines 36-45.

```jsx
// BEFORE:
export const NAV_ICON = {
  today: Gauge,
  overview: LayoutDashboard,
  network: Users,
  explore: Compass,
  pipeline: Kanban,
  calendar: CalendarDays,
  github: GitFork,
  settings: Settings,
}
// AFTER — swap the explore key for grow, pick a lucide icon consistent with the funnel theme
// (RESEARCH.md Assumption A2 — TrendingUp recommended, low-risk/easily revisited):
export const NAV_ICON = {
  today: Gauge,
  overview: LayoutDashboard,
  network: Users,
  grow: TrendingUp,
  pipeline: Kanban,
  calendar: CalendarDays,
  github: GitFork,
  settings: Settings,
}
```
Requires adding `TrendingUp` to the existing `lucide-react` import block (`icons.js:1-7`), and removing `Compass` from that same import if it becomes unused elsewhere in the file (grep-check before deleting — `Compass` may be re-exported or used by another lookup).

---

## Shared Patterns

### The `{ company, ts: Date.now() }` deep-link/focus shape
**Source:** `app/src/App.jsx:238-240` (`goFindPeople`), `app/src/components/DiscoverTab.jsx:166-174` (consumer), `App.jsx:122-123` (`NetworkTab`'s local version, being retired)
**Apply to:** `GrowTab.jsx`'s `coverageFocus`/`peopleFocus` state, `ReferralCoverageTab.jsx`'s new `focus` prop, `App.jsx`'s re-pointed `goFindPeople`.
**Rule:** always include `ts: Date.now()`, never just `{ company }` — the timestamp is what makes a repeat click on the same company re-trigger the effect (dependency array keys on `focus?.ts`, not `focus?.company`).

### Scroll-and-highlight (row-level)
**Source:** `app/src/components/DiscoverTab.jsx:60, 166-174, 282-283` — `useRef(new Map())` for row DOM nodes, `useEffect` on `[focus?.ts]`, `ring-2 ring-accent-300` conditional class.
**Apply to:** `ReferralCoverageTab.jsx` (new), unchanged in `DiscoverTab.jsx` itself.
**Rule:** no auto-fade timer — the ring persists until the next `focus` change targets a different row (matches existing, non-fading behavior; introducing a fade would be scope creep per 03-UI-SPEC.md).

### Section-level scroll (page-level, new this phase)
**Source:** no direct existing analog (new pattern) — closest precedent is the row-level `scrollIntoView` call above, applied one level up.
**Apply to:** `GrowTab.jsx` only — `sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })`, fired synchronously on click, before the child's own row-level effect runs.

### Daily-gated background AI refresh
**Source:** `app/src/components/ExploreTab.jsx:44-73` (`runFind`/`ranRef`/`todayStr()` gate), mirrored in `DiscoverTab.jsx`'s `runScheduler`.
**Apply to:** unchanged — both `ExploreTab.jsx` and `DiscoverTab.jsx` keep their own independent gates; per Pitfall 3 no code fix is required, this is a flagged-but-accepted UX timing change (both may now fire on the same first Grow visit).

### Error handling (inline banner)
**Source:** `app/src/components/ExploreTab.jsx:58-59` — `catch (e) { setError(e.message) }` + `{error && <div className="p-2 bg-danger-50 border border-danger-200 rounded-lg text-xs text-danger-700">{error}</div>}` (`ExploreTab.jsx:136`)
**Apply to:** No new error surfaces introduced by this phase — `GrowTab.jsx` itself needs no try/catch since it does no fetching; each wrapped child keeps its own existing banner unchanged.

### `lsGet`/`lsSet` localStorage helper convention
**Source:** `app/src/components/jobBoards/helpers.js` (imported by both `ExploreTab.jsx:2` and `DiscoverTab.jsx:2`)
**Apply to:** unchanged — CONTEXT.md explicitly states the 11 `rec_company_*`/`rec_discovered*` localStorage keys are NOT migrated or consolidated by this phase; `GrowTab.jsx` introduces no new localStorage keys of its own.

## No Analog Found

None — every file this phase touches has a direct, verified analog already in the codebase (either its own pre-edit self, or `DiscoverTab.jsx`'s focus mechanic / `TodayTab.jsx`'s Section pattern as the donor). This is the expected shape for a pure IA-merge phase with zero new libraries and zero new data-flow types.

## Metadata

**Analog search scope:** `app/src/components/`, `app/src/components/ui/`, `app/src/components/layout/`, `app/src/lib/icons.js`, `app/src/App.jsx` — full-file reads of `TodayTab.jsx`, `ExploreTab.jsx`, `ReferralCoverageTab.jsx`, `DiscoverTab.jsx` (relevant sections), `Sidebar.jsx`, `icons.js`, `App.jsx` (relevant sections)
**Files scanned:** 9 target files + 3 analog-only reads (all already covered by the target list — this phase's analogs are the files themselves pre-edit)
**Pattern extraction date:** 2026-08-18
