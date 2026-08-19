# Phase 4: Shared Record Side-Panel - Research

**Researched:** 2026-08-18
**Domain:** React component consolidation (modal → slide-over panel refactor), framer-motion animation, prop-drilling/call-site migration
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (locked by phase name/goal):** The new shared component is a **slide-over side-panel** (desktop: fixed-width panel sliding in from the right edge with a backdrop), not a centered modal. Mobile keeps the existing bottom-sheet convention already shared by all 3 current modals (`items-end` / `rounded-t-2xl` / slide-up).
- **D-02:** Animation via `framer-motion` — `translate-x` transform + backdrop fade on desktop; existing slide-up-from-bottom on mobile. Same Escape-key and click-outside-to-close semantics as `ui/Modal.jsx`. This is a deliberate 4th entry in CLAUDE.md's "framer-motion powers exactly 3 moments" list.
- **D-03:** One shared **shell** component (`SidePanel.jsx`) wraps **type-specific body content** components (`ContactPanelBody`, `ApplicationPanelBody`, `JobPanelBody`) — not one monolithic component with type-conditional rendering. Mirrors the `Section`/`RowCap` extraction precedent from Phase 2/3.
- **D-04:** `ui/Modal.jsx` is left **untouched** and still used by out-of-scope dialogs (`LogInteractionModal`, `QuickAddContactModal`, `AddToCalendarModal`). `SidePanel.jsx` is a new sibling primitive in `ui/`, not a modification of `Modal.jsx`.
- **D-05:** Record→record navigation (e.g. `ApplicationDetailModal` opening a nested `ContactDetailModal` for a referrer) becomes an **in-place swap with a back button** inside the panel header — not a stacked second panel, not a dead-end replace. Opening a *non-record* dialog (`LogInteractionModal`, `DraftPanel`) still layers a normal `Modal.jsx` on top, unchanged.

### Claude's Discretion

- Exact panel width/breakpoints, header layout (title + close + optional back button placement), footer action-button placement — implementation detail for planning.
- Whether `ContactPanelBody`/`ApplicationPanelBody`/`JobPanelBody` are separate files or co-located sections within `SidePanel.jsx` — file-organization call based on final line-count.
- Order of migration (which record type is ported first, if plans are sequenced) — planning-wave decision.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope, no scope-creep suggestions arose.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PANEL-01 | User opens a contact, application, or job record in one consistent side-panel component instead of 3+ divergent modal implementations | Call-site enumeration below (9 render sites across 6 files) + `SidePanel.jsx` shell/body architecture pattern give the planner every location that must be re-pointed |
| PANEL-02 | The shared panel supports every view/edit capability the modals it replaces already had — no feature regression | Full field-by-field capability inventory of all 3 modals below (Component Responsibilities + Common Pitfalls) is the zero-regression checklist; nested-navigation and embedded-dialog behavior documented explicitly |
</phase_requirements>

## Summary

This phase is pure component-consolidation work inside an already-mapped codebase — no new libraries, no new backend surface, no new AI/data model work. All architectural decisions (shell+body split, slide-over transform, in-place-swap navigation, `Modal.jsx` left alone) are already locked in CONTEXT.md; what planning needs from this research is **exhaustive, verified enumeration**: every call site that renders one of the 3 modals today (9 render sites across 6 files, not the 3 the CONTEXT.md doc summarized at a glance), every field/capability each modal edits (so PANEL-02's zero-regression bar has a checklist), and a concrete, doc-verified framer-motion pattern for the slide-over transform that mirrors `ui/Modal.jsx`'s existing conventions closely enough to feel like the same design system.

The riskiest part of this phase is not the animation — it's **prop-shape drift across call sites**. The three modals are called with meaningfully different prop subsets at different sites (e.g. `CalendarTab.jsx`'s `ContactDetailModal` call omits `onRefreshRelationships` entirely, so the Relationships section will silently no-op there today — a **pre-existing bug**, not something to introduce). The planner must treat each of the 9 render sites as its own migration point with its own exact prop list, not assume one canonical call shape.

One correction to CONTEXT.md's canonical_refs: PROJECT.md's Compatibility constraint note ("none of the 3 record modals are reachable from `/demo` today") is **only true for Job**. Contact and Application records ARE reachable in `/demo` — via `NetworkTab` (Table/Cards) and `TodayTab` for Contact, and via `TodayTab`/`PipelineTab` for Application — since Today, Network, and Pipeline are all in `DEMO_NAV_ITEMS`. This means `SidePanel` must work correctly with zero backend dependency in demo mode for 2 of the 3 record types; only `JobDetailModal`'s call site (`RepoJobsView.jsx`, under the Job Boards tab) is genuinely unreachable from `/demo` today, since Job Boards isn't in `DEMO_NAV_ITEMS`.

**Primary recommendation:** Build `SidePanel.jsx` as a thin chrome shell (backdrop + slide/sheet transform + Escape/click-outside + header slot with optional back button + close button), port each modal's JSX body verbatim (not rewritten) into its own `*PanelBody.jsx` file preserving every prop and handler, and re-point exactly 9 render sites (verified list below) from the old modal imports to `<SidePanel>` + the matching body. Do the port field-for-field, not a rewrite from memory — the existing forms are the spec.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Panel shell (slide/backdrop/Escape/click-outside animation) | Browser / Client | — | Pure client-side UI chrome, no data dependency; mirrors `ui/Modal.jsx`, which is 100% client-rendered |
| Record body content (form fields, save/delete actions) | Browser / Client | API / Backend (via `db.js`) | Rendering + local form state is client; every save/delete/update call routes through `db.js`'s existing `fetch*/add*/update*` functions (Supabase in prod, in-memory demo data on `/demo`) — this phase does not touch that data layer |
| Nested record navigation (in-place swap + back button) | Browser / Client | — | Pure local state (`recordStack`-shaped state or similar) inside `SidePanel`/its host; no new backend calls, reuses data already fetched by the parent tab |
| Embedded non-record dialogs (`LogInteractionModal`, `DraftPanel`) | Browser / Client | API / Backend (AI extraction, interaction writes) | Unchanged this phase — still `Modal.jsx` + `db.js`/`lib/ai.js`, just now rendered from inside a `SidePanel` body instead of a hand-rolled overlay `<div>` |

## Standard Stack

### Core

No new libraries required — this phase is a pure refactor of existing, already-installed dependencies.

| Library | Version (verified in `app/package.json`) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `framer-motion` | `^12.42.2` [VERIFIED: app/package.json] | Slide-over transform + backdrop fade animation, `AnimatePresence` for mount/unmount exit animation | Already the sole animation library in this codebase (`ui/Modal.jsx`, `AppShell.jsx` tab-switch fade) — CLAUDE.md documents its use is deliberately scoped to exactly a small named set of moments; this phase adds one more entry to that list, doesn't introduce a new tool |
| React (hooks: `useState`, `useEffect`) | already installed | Local panel state, record-stack for D-05's in-place swap, Escape-key listener | No change from current pattern in `ui/Modal.jsx` |
| Tailwind v4 (`@theme` tokens) | already installed | Panel width, `ink-*`/`accent-*` colors, `rounded-t-2xl`/`rounded-2xl` corner treatment | Locked token values from Phase 1's `01-UI-SPEC.md` — SidePanel must consume the same `ink`/`accent`/`danger`/`success`/`warning` families, no new colors |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | already installed | Optional: close (`X`) / back (`ArrowLeft` or `ChevronLeft`) icons for the panel header | Current modals use a plain `✕` text glyph for close, not a lucide icon (`AddToCalendarModal.jsx` is the one place that already imports `X` from `lucide-react` for this purpose) — using lucide's `X`/`ArrowLeft` in `SidePanel.jsx`'s header is a minor, in-scope consistency improvement, not required for PANEL-01/02 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| framer-motion `x` transform slide | CSS `transition: transform` + Tailwind `translate-x-full`/`translate-x-0` classes, no JS animation lib | Rejected — D-02 already locks framer-motion explicitly; also loses `AnimatePresence`'s automatic exit-animation-before-unmount behavior that `ui/Modal.jsx` already relies on, which a pure-CSS approach would need to hand-roll (timeout-based unmount) |
| One shared `SidePanel` handling all 3 types via `type` prop switch internally | Shell + type-specific body components (D-03, locked) | Rejected by user decision — not re-litigated here |

**Installation:**
No installation needed — zero new dependencies.

**Version verification:** `framer-motion` version confirmed directly from `app/package.json` (`^12.42.2`) — no registry lookup needed since it's already an installed, working dependency in this codebase; no version bump is implied by this phase.

## Package Legitimacy Audit

**Not applicable — this phase installs no new packages.** All work uses `framer-motion`, `lucide-react`, and Tailwind, all already present in `app/package.json` and already in production use elsewhere in this codebase.

## Architecture Patterns

### System Architecture Diagram

```
User clicks a contact row / application row / job card
        │
        ▼
Parent tab component (NetworkTab / TodayTab / CalendarTab /
PipelineTab / ReferralCoverageTab / RepoJobsView)
        │  sets local state: selectedContactId / selectedAppId / editing / selectedJob
        ▼
<SidePanel open={...} onClose={...}>          ← new shared shell (ui/SidePanel.jsx)
   │  - renders backdrop (click-outside → onClose)
   │  - Escape key → onClose
   │  - framer-motion AnimatePresence: slide-in from right (desktop) / up from bottom (mobile)
   │  - header slot: title + optional "← Back" (D-05) + close "✕"
   ▼
<ContactPanelBody | ApplicationPanelBody | JobPanelBody ...props>
   │  - form state (useState), same field set as today's modal
   │  - save/delete/update calls → db.js (fetch*/add*/update*/archive*)
   │  - on "open a different record" (e.g. click a referrer name):
   │        parent pushes a new record ref onto a small stack,
   │        SidePanel re-renders the matching body in place,
   │        back button pops the stack → previous body re-renders
   │  - on "open a non-record dialog" (LogInteractionModal / DraftPanel):
   │        renders <Modal> (unchanged) layered on top, same as today
   ▼
db.js (Supabase in prod / in-memory demoData.js on /demo via isDemoMode())
        │
        ▼
onSaved() / onRefresh() callback → parent tab refetches → panel closes or stays open
```

### Recommended Project Structure

```
app/src/components/
├── ui/
│   └── SidePanel.jsx            # new shell primitive — sibling to Modal.jsx, not a variant of it (D-04)
├── panels/                      # new — houses the 3 type-specific bodies (or keep flat in components/, planner's call per D-03 discretion note)
│   ├── ContactPanelBody.jsx     # ported from ContactDetailModal.jsx's inner JSX + logic
│   ├── ApplicationPanelBody.jsx # ported from ApplicationDetailModal.jsx's inner JSX + logic
│   └── JobPanelBody.jsx         # ported from jobBoards/JobDetailModal.jsx's inner JSX + logic
├── ContactDetailModal.jsx       # DELETE once all 4 call sites are re-pointed
├── ApplicationDetailModal.jsx   # DELETE once all 4 call sites are re-pointed (incl. its own nested ContactDetailModal use)
└── jobBoards/
    └── JobDetailModal.jsx       # DELETE once its 1 call site is re-pointed
```

### Pattern 1: Slide-over shell with responsive transform axis

**What:** `SidePanel.jsx` mirrors `ui/Modal.jsx`'s exact Escape/click-outside/`AnimatePresence` structure, but swaps the `scale`+`y` entrance for an `x`-axis slide on desktop and keeps a `y`-axis slide-up on mobile (matching D-01's "mobile keeps the existing bottom-sheet convention").

**When to use:** Every one of the 3 record types (contact/application/job), replacing their current hand-copied overlay `<div>` markup.

**Example (framer-motion `AnimatePresence` + responsive transform, verified against `motion.dev`/framer-motion official docs pattern for exit animations):**
```jsx
// Source: pattern verified against motion.dev docs (AnimatePresence + initial/animate/exit)
// and this repo's own ui/Modal.jsx (Escape-key + click-outside-to-close conventions)
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../../lib/cn.js'

export default function SidePanel({ open = true, onClose, children, className }) {
  useEffect(() => {
    if (!onClose) return
    function onKeyDown(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 bg-ink-900/40 z-50 flex items-end md:items-stretch md:justify-end"
          onClick={e => e.target === e.currentTarget && onClose?.()}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            className={cn(
              'bg-white w-full md:w-[480px] md:max-w-[90vw] rounded-t-2xl md:rounded-none md:rounded-l-2xl shadow-2xl h-[90vh] md:h-full overflow-y-auto',
              className,
            )}
            // Mobile: slide up from bottom (matches today's bottom-sheet). Desktop: slide in from right (D-01/D-02).
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            className="md:hidden" // conceptual split — actual impl likely uses a single motion.div with responsive transition via CSS media query + JS matchMedia, or two motion.div variants gated by a `useMediaQuery`-style hook; exact mechanism is a planning-time implementation detail
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```
**Important implementation note for the planner:** framer-motion doesn't natively support "different `initial`/`animate`/`exit` values per breakpoint" in one `motion.div` — the cleanest approaches are (a) a small `useMediaQuery('(min-width: 768px)')` hook driving which `{x,y}` transform object is passed to the same `motion.div`, or (b) CSS-only positioning (`translate-x`/`translate-y` handled by Tailwind's responsive `md:` prefix on the *static* class, with framer-motion only animating `opacity`+one shared axis value that CSS repositions per breakpoint). Neither is currently proven in this codebase (no existing responsive-framer-motion precedent was found in `ui/Modal.jsx` or `AppShell.jsx` — both use axis-agnostic `opacity`+`scale`/`y` that reads fine at any width). This is a genuine **new pattern for this codebase**, not a copy of prior art — flag it as an open implementation question for the planner to resolve with a `useMediaQuery` hook (small, self-contained, no new dependency) rather than guessing.

### Pattern 2: Shell + type-specific body (D-03)

**What:** `SidePanel` owns zero record-type knowledge. It receives `children` (the body) and a `header` (title text, optional back handler). The parent tab decides which body component to render based on which `selected*Id` state is set.

**Example:**
```jsx
// Illustrative call-site shape (NOT literal — planner determines exact header API)
{selectedContactId && (
  <SidePanel open onClose={() => setSelectedContactId(null)}>
    <ContactPanelBody
      contact={contacts.find(c => c.id === selectedContactId)}
      contacts={contacts}
      interactions={interactions}
      contactRelationships={relationships}
      onClose={() => setSelectedContactId(null)}
      onSaved={() => { setSelectedContactId(null); onRefresh?.() }}
      onRefreshRelationships={onRefreshRelationships}
      onOpenContact={(id) => setSelectedContactId(id)} // for D-05 in-place swap when relevant
    />
  </SidePanel>
)}
```

### Pattern 3: In-place swap with back button (D-05)

**What:** Today, `ApplicationDetailModal` holds local `openContactId` state and renders a **second, stacked** `<ContactDetailModal>` when a referrer/warm-path contact is clicked (see `ApplicationDetailModal.jsx` lines 125-126, 486-496). Per D-05, this becomes: the panel's content swaps in-place to the contact's body, with a back button that returns to the application body — no second panel instance.

**Concrete mechanism to implement:** a small navigation stack, e.g. `const [stack, setStack] = useState([{ type: 'application', id: app.id }])`, where opening a nested record does `setStack(s => [...s, { type: 'contact', id }])` and the back button does `setStack(s => s.slice(0, -1))`. `SidePanel`'s body renders based on `stack[stack.length - 1]`. This state can live either in `SidePanel` itself (if it owns record-type dispatch, which D-03 says it explicitly should NOT — shell stays type-agnostic) or, more consistently with D-03, in a small wrapper/host component one level above `SidePanel` (e.g. a `RecordPanelHost` in each parent tab, or a single shared hook `useRecordPanel()`) that owns the stack and picks which `*PanelBody` to render as `SidePanel`'s children, passing a `onBack` handler into the header only when `stack.length > 1`.

**Existing precedent for the specific "warm-path contact click" trigger** (do not lose this capability): `ApplicationDetailModal`'s `NetworkAtCompany` sub-component (lines 36-98) renders clickable contact rows (`onOpenContact={setOpenContactId}`) inside the "N people you know at {company}" dossier panel — this is the concrete UI element that must call the new "push a contact onto the stack" handler instead of `setOpenContactId`.

### Anti-Patterns to Avoid

- **Rewriting form field logic from memory instead of porting verbatim:** All 3 modals have real, non-obvious business logic in their state (e.g. `ContactDetailModal`'s `toggleUMichAlum`/`toggleAffinity` two-way sync between a checkbox and a chip array, `ApplicationDetailModal`'s `changeStage` auto-filling `closedDate` on terminal-stage transitions). PANEL-02's zero-regression bar means every one of these functions must be ported byte-for-byte into the new body components, not reimplemented from a general understanding of "what a contact form does."
- **Giving `SidePanel` itself knowledge of record types:** D-03 explicitly rejects a monolithic type-conditional component. If `SidePanel.jsx` grows a `type` prop with internal `if (type === 'contact')` branches, that's the exact anti-pattern the user decision ruled out.
- **Missing a call site:** 4 files render `ContactDetailModal` as a "record detail" use (not counting `ApplicationDetailModal`'s internal nested use, which becomes the D-05 swap): `App.jsx`'s `NetworkTab`, `TodayTab.jsx`, `CalendarTab.jsx`, `ReferralCoverageTab.jsx`. 3 files render `ApplicationDetailModal`: `TodayTab.jsx`, `CalendarTab.jsx`, `PipelineTab.jsx`. 1 file renders `JobDetailModal`: `jobBoards/RepoJobsView.jsx`. See Component Responsibilities table below for the complete, verified list — CONTEXT.md's "Integration Points" section only names 2 of these 8 non-nested sites explicitly ("PipelineTab.jsx", "wherever ContactDetailModal is currently opened from... not fully captured here").
- **Assuming every call site passes the same props:** `CalendarTab.jsx`'s `ContactDetailModal` call (line 269-275) does NOT pass `contactRelationships` or `onRefreshRelationships` — meaning the Relationships section of that modal silently renders "No tagged relationships yet" / a no-op add button when opened from Calendar today. This is a **pre-existing gap**, not a regression to introduce, but also not one to accidentally "fix" as a silent scope-creep side effect — flag it for the planner to explicitly decide (carry the gap forward unchanged, matching current behavior exactly, vs. threading the missing props through as a bonus fix). Likewise `CalendarTab.jsx`'s `ApplicationDetailModal` call passes only `app`/`onStatusChange`/`onClose`/`onDelete` — no `contacts`, `apps`, `interactions`, `relationships`, `onSaved`, `onFindPeople`, `onRefresh`, `onRefreshRelationships` — meaning `NetworkAtCompany`, the AI Fit Analysis, and Stage/Date editing behave differently (many with empty/undefined arrays) when opened from Calendar vs. Pipeline/Today.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Escape-key + click-outside-to-close | A new custom event listener pattern | Port `ui/Modal.jsx`'s existing `useEffect`-based `onKeyDown` handler + `onClick={e => e.target === e.currentTarget && onClose?.()}` pattern verbatim into `SidePanel.jsx` | Already proven, already accessible-enough for this app's bar, zero reason to diverge |
| Exit-before-unmount animation | Manual `setTimeout` + conditional render delay | `framer-motion`'s `AnimatePresence` (already the pattern in `ui/Modal.jsx` and `AppShell.jsx`) | This is precisely the problem `AnimatePresence` solves; a manual timeout duplicates it worse |
| Form field markup (`<input>`/`<select>` + label) | New one-off `field()`/`select()` local helper functions per body component (as today's 3 modals each independently define their own near-identical `field`/`select` closures) | Reuse the existing `ui/Input.jsx`/`ui/Select.jsx` primitives, which already implement the same visual contract (label + input + focus ring) — note today's modals actually hand-roll a *slightly different* border color (`border-ink-200`, no focus ring) than `ui/Input.jsx`/`ui/Select.jsx` (`border-ink-100` + `focus:ring-1 focus:ring-accent-200`) | Not required for PANEL-02 (zero-regression is about capability, not exact pixel styling), but adopting the shared primitives during this unavoidable rewrite is close to free and removes 3 more copy-pasted implementations — flag as a **discretionary improvement**, not a requirement; if adopted, verify visually it doesn't regress the `border-ink-200` vs `border-ink-100` intentional-or-accidental difference |
| Responsive breakpoint detection for the dual-axis slide (Pattern 1) | A raw `window.innerWidth` check with manual `resize` listener | A small `useMediaQuery(query)` hook (a handful of lines, `window.matchMedia` + `addEventListener('change', ...)`) — does not exist in this codebase yet, needs to be added once | `window.innerWidth` checked once on mount won't react to viewport resize/dev-tools device toggle during a live session; `matchMedia`'s `change` event does |

**Key insight:** every one of this phase's "don't hand-roll" items is really "don't re-hand-roll something this codebase already hand-rolled correctly once" — the risk here is regression through incomplete porting, not through reaching for the wrong external tool.

## Common Pitfalls

### Pitfall 1: Dropping the demo-mode compatibility for Contact/Application panels
**What goes wrong:** A planner or executor assumes (per CONTEXT.md's canonical_refs summary) that none of the 3 record panels are reachable from `/demo`, and therefore doesn't verify the new `SidePanel`/body components behave correctly against `demoData.js`'s in-memory `db.js` branch.
**Why it happens:** CONTEXT.md's canonical_refs section states this as fact, but it's a mis-generalization from Phase 3's Explore/Coverage/Discover scoping — it wasn't independently re-verified for Contact/Application.
**How to avoid:** Verified this session: `NetworkTab` (Table/Cards views, both call `ContactDetailModal`) and `TodayTab`/`PipelineTab` (both call `ApplicationDetailModal`) are all reachable from `/demo` (`DEMO_NAV_ITEMS = ['today', 'overview', 'network', 'pipeline']` in `App.jsx`). The new panel must be smoke-tested against `/demo` for Contact and Application record types specifically. Only `JobDetailModal`'s sole call site (`RepoJobsView.jsx`, under Job Boards) is genuinely `/demo`-unreachable, since Job Boards isn't in `DEMO_NAV_ITEMS`.
**Warning signs:** A `/demo`-mode contact or application click renders a blank/erroring panel, or a save action throws because it assumes a Supabase-only code path.

### Pitfall 2: Losing the "New Contact" / "New Application" (isNew) mode
**What goes wrong:** Both `ContactDetailModal` and `ApplicationDetailModal` double as **creation** forms — `contact === null` / `app === null` triggers an `isNew` branch with a materially different field set (fewer fields, different button copy "+ Add Contact"/"+ Add Application" instead of "Save Changes", the paste-URL auto-fill import flow in `ApplicationDetailModal`'s `isNew` branch, duplicate-detection warning, coverage badge). This is easy to lose if the port focuses only on the "editing an existing record" happy path.
**Why it happens:** The "New X" flows are visually and functionally the least similar part of the 3 bodies (Job has no "New Job" mode at all — jobs only ever come from board import) — a planner mentally modeling "3 detail panels" can under-scope the create flows as a footnote.
**How to avoid:** Explicitly enumerate both branches (`isNew`/edit) as separate acceptance-criteria rows for `ContactPanelBody` and `ApplicationPanelBody`. `ReferralCoverageTab.jsx`'s `addingFor` state and `PipelineTab.jsx`'s `addingNew` state are the two call sites exercising the create path today — both must be re-verified post-port.
**Warning signs:** "+ Add Contact"/"+ Add Application" buttons in the UI stop opening a panel, or open one missing the paste-URL import box / duplicate warning.

### Pitfall 3: Breaking the `openContact`/nested-modal chain's data threading
**What goes wrong:** `ApplicationDetailModal`'s nested `ContactDetailModal` (becoming D-05's in-place swap) is passed `contacts`, `interactions`, `contactRelationships={relationships}`, `onRefreshRelationships` — sourced from the **parent Application panel's own props**, not refetched independently. If the swap mechanism (Pattern 3 above) doesn't carry these same props through to the swapped-in `ContactPanelBody`, editing the nested contact will silently operate on stale or missing data.
**Why it happens:** The swap makes it tempting to have the "record stack" host component fetch fresh data per swapped record, which is a bigger change (new fetch calls) than this phase's scope requires — the existing pattern is prop-threading, not fetching.
**How to avoid:** The record-stack host (wherever it lives — see Pattern 3) must have access to the full `contacts`/`apps`/`interactions`/`relationships` arrays already loaded by whichever parent tab opened the panel, and pass the correct slice into whichever body is on top of the stack, exactly as `ApplicationDetailModal` does today for its nested contact.
**Warning signs:** Opening a referrer from inside an Application panel and going "back" shows different/incomplete history or relationship data than opening that same contact directly from Network.

### Pitfall 4: Silently changing behavior at inconsistent-prop call sites while fixing the port
**What goes wrong:** As documented in Anti-Patterns above, `CalendarTab.jsx`'s two modal calls already omit several props other call sites pass. A well-intentioned executor "fixing" this during the port (by threading the missing props through) is doing more than PANEL-01/02 asks for and risks behavior the user didn't request or verify (e.g. suddenly showing Relationships/AI Fit Analysis from Calendar for the first time, which changes what's rendered there).
**Why it happens:** Porting code naturally surfaces every inconsistency; the instinct to "fix while you're in there" is strong but out of scope for a stated zero-regression consolidation phase (regression-avoidance, not behavior-expansion).
**How to avoid:** Preserve each call site's exact current prop list unless the planner explicitly decides (and documents) that closing a specific gap is in scope. Default: carry every existing prop-omission forward unchanged.
**Warning signs:** A code review flags "why does the Calendar-opened application panel now show a Fit Analysis section it didn't before" as an unplanned behavior change.

### Pitfall 5: Z-index/stacking collision between `SidePanel` and layered `Modal.jsx` instances
**What goes wrong:** Every existing overlay in this codebase (`Modal.jsx`, `AddEventModal.jsx`, `EventDetailModal.jsx`, and all 3 modals being replaced) uses `z-50`. If `SidePanel.jsx` also uses `z-50` (recommended, for consistency — see Pattern 1's example) and a `LogInteractionModal`/`DraftPanel`-triggering `Modal` is opened from inside a panel body, both share the same z-index; correct stacking then depends entirely on DOM paint order (later-mounted element on top within the same stacking context), which is what already happens today with `ApplicationDetailModal`→`ContactDetailModal`→`LogInteractionModal`'s triple nesting.
**Why it happens:** Introducing a *new* z-index value (e.g. `z-40` for the panel, reserving `z-50` for "true" modals) seems like a defensive improvement but actually breaks the working pattern, since `SidePanel` itself needs to be able to host a `Modal` on top of it (LogInteractionModal case) — a lower z-index for the panel would still work for that specific case (Modal at z-50 > Panel at z-40), but would also visually place the panel *beneath* any other current z-50 element unexpectedly (e.g. if a toast/banner system is ever added at z-50).
**How to avoid:** Keep `SidePanel.jsx` at `z-50`, matching every other overlay in the app — same as `Modal.jsx`. Verify (during implementation, via a quick manual check) that `LogInteractionModal` opened from within a `SidePanel` still renders visually on top, which it already does in `ContactDetailModal` today at identical z-index due to DOM nesting order.
**Warning signs:** A `Modal` opened from inside a `SidePanel` renders behind the panel instead of on top.

## Code Examples

### Escape-key + click-outside-to-close (verbatim port target from `ui/Modal.jsx`)
```jsx
// Source: app/src/components/ui/Modal.jsx (this repo, verified by direct read)
useEffect(() => {
  if (!onClose) return
  function onKeyDown(e) { if (e.key === 'Escape') onClose() }
  window.addEventListener('keydown', onKeyDown)
  return () => window.removeEventListener('keydown', onKeyDown)
}, [onClose])
```

### AnimatePresence exit-animation pattern (framer-motion, official docs shape)
```jsx
// Source: motion.dev docs (https://motion.dev/docs/react-animation) — verified via context7,
// same API surface framer-motion (already installed, ^12.42.2) exposes
<AnimatePresence>
  {isVisible && (
    <motion.div
      key="panel"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    />
  )}
</AnimatePresence>
```

### Stage-change auto-fill sync pattern (must be ported verbatim into ApplicationPanelBody)
```jsx
// Source: app/src/components/ApplicationDetailModal.jsx lines 133-138 (this repo, verified by direct read)
// Moving into a terminal stage auto-fills today's date as Closed Date (if not already
// set); moving back out of one clears it.
function changeStage(stage) {
  setDates(d => ({
    ...d, stage,
    closedDate: TERMINAL_STAGES.includes(stage) ? (d.closedDate || new Date().toISOString().split('T')[0]) : '',
  }))
}
```

## State of the Art

Not applicable in the traditional sense — this phase doesn't touch a fast-moving external ecosystem. The one relevant "state of the art" note: `framer-motion` is being renamed/succeeded by the `motion` package (per CLAUDE.md's VIS-04, already planned as a Phase 7 mechanical import-path migration). This phase should **not** preempt that migration — continue importing from `framer-motion` (matching every existing call site: `ui/Modal.jsx`, `AppShell.jsx`), not `motion`, so Phase 7's find-and-replace migration covers `SidePanel.jsx` too, consistently with everything else.

**Deprecated/outdated:** N/A this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact mechanism for a responsive (mobile-vs-desktop) different transform axis within one `AnimatePresence`/`motion.div` isn't proven anywhere in this codebase; a `useMediaQuery` hook is the recommended approach but is untested here | Architecture Patterns → Pattern 1 | If the planner locks a specific low-level implementation instead of treating this as an open technical decision for the executor, and that approach doesn't cleanly support framer-motion's `initial`/`animate`/`exit` per breakpoint, a plan task could stall mid-execution requiring a design pivot |
| A2 | Adopting `ui/Input.jsx`/`ui/Select.jsx` primitives instead of the current hand-rolled `field()`/`select()` closures is safe and low-risk | Don't Hand-Roll table | Low risk (purely additive/discretionary, explicitly marked so), but if adopted without checking, the `border-ink-200` (current) vs `border-ink-100` (primitive) visual difference could read as an unintended styling drift in review |

**If this table is empty:** N/A — 2 assumptions logged above; both are low-severity implementation-detail risks, not decisions that need user reconfirmation before planning proceeds.

## Open Questions

1. **Where does the "in-place swap" record stack live — inside `SidePanel.jsx`, or in a host component/hook one level above it?**
   - What we know: D-03 says `SidePanel` (the shell) should stay type-agnostic; D-05 requires in-place swap + back button. These two constraints together imply the stack-tracking logic belongs in something other than the shell itself.
   - What's unclear: Whether that "something" is (a) a per-tab local state pattern replicated at each of the 4 `ContactDetailModal`-opening / 3 `ApplicationDetailModal`-opening call sites, or (b) a single shared hook/host component (e.g. `useRecordPanel()`) that all 6 non-Job call sites import, reducing duplication.
   - Recommendation: Planner should default to (b) — a shared hook/host — since duplicating the stack logic at 6+ call sites is exactly the kind of copy-paste this phase is trying to eliminate elsewhere. Only Contact/Application need the stack (Job never opens another record); a hook usable from any tab that currently manages `selectedContactId`/`selectedAppId`-style state is the natural fit.

2. **Does `JobDetailModal`'s port also need a "New Job" isNew-style branch?**
   - What we know: Unlike Contact/Application, `JobDetailModal` has no creation mode — jobs only enter the system via board auto-import (`RepoJobsView.jsx`'s import logic, not the modal).
   - What's unclear: Nothing, actually — this is confirmed via direct read of `JobDetailModal.jsx` (195 lines, no `isNew`/`app === null` branch anywhere). Included here as an explicit "verified, no gap" note so the planner doesn't spend time re-checking it.
   - Recommendation: `JobPanelBody` should be scoped as edit/view-only, matching current behavior exactly — no new create-mode work needed.

## Environment Availability

Skipped — this phase has no external dependencies (no new packages, no new services, no CLI tools). All work is a refactor of already-installed, already-running code (`framer-motion`, React, Tailwind, `db.js`'s existing Supabase/demo-data client).

## Validation Architecture

Skipped — `.planning/config.json` has `workflow.nyquist_validation: false` explicitly set.

## Security Domain

Skipped — `.planning/config.json` has `security_enforcement: false` explicitly set. (Note for completeness: this phase touches zero auth/data-access-control surface — all data still flows through the same `db.js`/RLS-scoped Supabase calls, only the presentational component changes.)

## Sources

### Primary (HIGH confidence)
- Direct reads of `app/src/components/ContactDetailModal.jsx`, `ApplicationDetailModal.jsx`, `jobBoards/JobDetailModal.jsx`, `ui/Modal.jsx`, `layout/AppShell.jsx`, `ui/Section.jsx`, `ui/Button.jsx`, `ui/Card.jsx`, `ui/Input.jsx`, `ui/Select.jsx`, `ui/Tabs.jsx`, `ui/EmptyState.jsx`, `ui/Badge.jsx`, `LogInteractionModal.jsx`, `DraftPanel.jsx`, `App.jsx` (full `NetworkTab`/`DemoApp` sections), `TodayTab.jsx`, `CalendarTab.jsx`, `ReferralCoverageTab.jsx`, `PipelineTab.jsx`, `jobBoards/RepoJobsView.jsx` — all call sites, prop shapes, and business logic cited above are verified against this session's direct file reads, not inferred.
- `grep`-verified: every `ContactDetailModal`/`ApplicationDetailModal`/`JobDetailModal` import and render call site across `app/src`, plus `z-50` usage across every overlay component in the codebase, plus `framer-motion` version in `app/package.json`.
- Context7 (`/websites/motion_dev`) — `AnimatePresence`/exit-animation API shape, confirming the `initial`/`animate`/`exit` object pattern already used by `ui/Modal.jsx` is the currently-documented, non-deprecated framer-motion/motion.dev API.

### Secondary (MEDIUM confidence)
- None — no external web sources were needed beyond the Context7 API-shape check; this phase is entirely internal-codebase research.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all verified directly from `package.json` and existing working code.
- Architecture: HIGH — shell/body split and slide-over mechanics are directly specified by locked CONTEXT.md decisions; the one genuinely open technical question (responsive dual-axis animation) is flagged explicitly as Assumption A1 / Open Question, not glossed over.
- Pitfalls: HIGH — every pitfall is grounded in a specific, verified line-range read of the actual current modal implementations and their actual call sites, not speculative.

**Research date:** 2026-08-18
**Valid until:** 30 days (internal-codebase research tied to files that could change if another phase lands first; re-verify call sites if Phase 5/6 land before this phase executes, since PIPE/NAV work could move some of these render sites)
