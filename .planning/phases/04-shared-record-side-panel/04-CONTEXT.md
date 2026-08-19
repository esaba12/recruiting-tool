# Phase 4: Shared Record Side-Panel - Context

**Gathered:** 2026-08-19
**Status:** Ready for planning
**Mode:** `--auto` (autonomous discussion — all gray areas resolved to their recommended option, logged below for review)

<domain>
## Phase Boundary

Contact, application, and job records currently each open in their own hand-copied modal overlay (`ContactDetailModal.jsx`, `ApplicationDetailModal.jsx`, `jobBoards/JobDetailModal.jsx`) — three near-identical copies of the same bottom-sheet/centered-overlay markup, none of which actually use the existing shared `ui/Modal.jsx` primitive. This phase replaces all three with one shared side-panel component that every record type opens through, with zero feature regression on any of the edit/view capabilities the three modals currently support (PANEL-01/PANEL-02).

Smaller, non-"record" dialogs (`LogInteractionModal`, `QuickAddContactModal`, `AddToCalendarModal`, the `DraftPanel`/`NetworkAtCompany` sub-panels embedded inside the current modals) are explicitly **out of scope** — they keep using `Modal.jsx` or their current implementation unchanged. Only the 3 "big" record-editing surfaces named in PANEL-01 (contact, application, job) merge into the new component.

</domain>

<decisions>
## Implementation Decisions

### Visual pattern
- **D-01 (locked by phase name/goal, not discussed):** The new shared component is a **slide-over side-panel** (desktop: fixed-width panel sliding in from the right edge with a backdrop), not a centered modal — this is the literal deliverable named in the phase title and ROADMAP goal ("one consistent side-panel component"). Mobile keeps the existing bottom-sheet convention already shared by all 3 current modals (`items-end` / `rounded-t-2xl` / slide-up) rather than a horizontal slide, since bottom-sheet-on-mobile already works and a right-edge slide-over is awkward on narrow viewports.
- **D-02 [auto]:** Animation — slide-in/out via `framer-motion` (`translate-x` transform + backdrop fade on desktop; existing slide-up-from-bottom on mobile), same Escape-key and click-outside-to-close semantics as `ui/Modal.jsx`. This is a deliberate 4th entry in CLAUDE.md's "framer-motion powers exactly 3 moments" list (modal open/close, tab-switch fade, and now record-panel open/close) — not scope creep, since it replaces the 3 modals' existing (inconsistent, unanimated) open/close behavior with one consistent animated one.
  - *[auto] Area: Animation/entrance style — Q: "Slide-over transform vs reuse Modal.jsx's scale/fade entrance?" → Selected: "New slide-over transform, matching the phase's literal side-panel deliverable" (recommended default — a centered scale/fade modal doesn't match "side-panel")*

### Component architecture
- **D-03 [auto]:** One shared **shell** component (`SidePanel.jsx` or similar — chrome: slide/backdrop/animation/mobile-sheet behavior/close button/Escape+click-outside handling) wraps **type-specific body content** components (e.g. `ContactPanelBody`, `ApplicationPanelBody`, `JobPanelBody`) ported from each existing modal's internals — not one monolithic component with type-conditional rendering scattered throughout. This mirrors this milestone's established extraction precedent (`Section`/`RowCap` pulled out of `TodayTab.jsx` in Phase 2/3) and is necessary because PANEL-02 requires zero feature regression across 3 genuinely different field sets (contact: status/urgency/referred-by/relationships; application: stage/dates/triage/warm-path dossier; job: read-only blurb/deadline/triage-only) — a single conditional component would get unwieldy and risk exactly the kind of dropped-capability regression PANEL-02 forbids.
  - *[auto] Area: Component architecture — Q: "One monolithic panel with type-conditional rendering, or a shared shell + type-specific body components?" → Selected: "Shared shell + type-specific bodies" (recommended default — matches Phase 2/3's established extraction pattern and reduces regression risk on 3 divergent field sets)*
- **D-04 [auto]:** `ui/Modal.jsx` is left untouched and still used by the smaller out-of-scope dialogs (`LogInteractionModal`, `QuickAddContactModal`, `AddToCalendarModal`). The new `SidePanel.jsx` is a sibling primitive in `ui/`, not a modification of `Modal.jsx` — the two need genuinely different transform/animation behavior (slide vs scale-fade), so extending `Modal.jsx` with a `variant="slide-over"` branch would add more conditional complexity than it saves.
  - *[auto] Area: Modal.jsx disposition — Q: "Extend Modal.jsx with a slide-over variant, or add a new sibling primitive?" → Selected: "New sibling primitive (SidePanel.jsx), Modal.jsx untouched" (recommended default — avoids conditional bloat in a primitive still used elsewhere)*

### Nested / cross-record navigation
- **D-05 [auto]:** Today, `ApplicationDetailModal` can open a nested `ContactDetailModal` (for a referrer/warm-path contact), and `ContactDetailModal` opens `LogInteractionModal`. For the new shared panel, opening a *different record* (e.g. clicking a referrer's name inside the Application panel) **swaps the panel's content in place with a back affordance** (breadcrumb/back-button inside the panel header), rather than stacking a second panel instance or losing the ability to return. Opening a *non-record* dialog (`LogInteractionModal`, the `DraftPanel`) still layers a normal `Modal.jsx` on top, unchanged from today — only record→record navigation gets the in-place swap.
  - *[auto] Area: Nested record navigation — Q: "Stack a second panel, replace-with-no-way-back, or in-place swap with a back button?" → Selected: "In-place swap with back button" (recommended default — avoids z-index/stacking complexity of multiple panel instances while preserving the existing ability to jump to a referrer and return, matching how Linear/Notion-style side panels typically handle cross-record navigation)*

### Claude's Discretion
- Exact panel width/breakpoints, header layout (title + close button + optional back button placement), and footer action-button placement are implementation detail for planning, not decided here.
- Whether `ContactPanelBody`/`ApplicationPanelBody`/`JobPanelBody` are separate files or co-located sections within `SidePanel.jsx` is a file-organization call for planning/pattern-mapping to make based on final line-count.
- Order of migration (which of the 3 record types gets ported to the new shell first, if plans are sequenced) is a planning-wave decision, not a user preference captured here.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone-level requirements and roadmap
- `.planning/REQUIREMENTS.md` §"Shared Record Side-Panel (PANEL)" — PANEL-01/02 acceptance criteria
- `.planning/ROADMAP.md` §"Phase 4: Shared Record Side-Panel" — goal, success criteria, dependency on Phase 1
- `.planning/PROJECT.md` — Core Value, Constraints (scope discipline: `app/src/components/`, `app/src/lib/`, `index.css` tokens only), Compatibility constraint (public `/demo` route — none of the 3 record modals are reachable from `/demo` today per Phase 3's DEMO_NAV_ITEMS scoping, so this phase should not introduce a `/demo` regression)

### Phase 1 deliverables this phase builds on
- `.planning/phases/01-visual-foundation-industrial-design-tokens-primitives/01-UI-SPEC.md` — locked token values/typography the new SidePanel must use (industrial palette, `Mono` primitive for dense data fields like dates/stage codes)

### Precedent this phase's shell/body split is modeled on
- `.planning/phases/02-unified-attention-feed-today/02-CONTEXT.md` D-06 — the shared-derivation/extraction precedent (`Section`/`RowCap` pulled out of `TodayTab.jsx`) that D-03 above explicitly follows
- `app/src/components/ui/Section.jsx` — the actual prior extraction, useful as a structural analog (shell component + slot-style children) even though its domain (page sections) differs from this phase's domain (record editing panel)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/src/components/ui/Modal.jsx` (44 lines) — the existing shared modal primitive (`open`/`onClose`/`size`/`className`/`children` props, `framer-motion` `AnimatePresence` fade+scale entrance, Escape-key + click-outside-to-close). Not extended by this phase (see D-04) but its close/backdrop-click/Escape-handling *logic* is the direct reference for `SidePanel.jsx`'s own equivalent handlers.
- `app/src/components/ContactDetailModal.jsx` (376 lines) — richest of the 3 current modals: edits name/company/role/email/linkedin/source/status/urgency/referredById/referralStatus/followUpDate/isUMichAlum/affinity[]/lifeDomain[]/wantsToSchedule+scheduleBy+scheduleNote/whatTheyDid/notes; manages contact relationships (add/remove) inline; embeds interaction history, a "Met" quick-log button, `LogInteractionModal`, and `DraftPanel`. Props: `contact, contacts, interactions, contactRelationships, onClose, onSaved, onRefreshRelationships, initial`.
- `app/src/components/ApplicationDetailModal.jsx` — used by `PipelineTab.jsx` (rendered as `{(selectedApp || addingNew) && <ApplicationDetailModal .../>}`, a full modal, not an inline row-expand). Edits: company/role/location/jdLink/referredById (new-application form) or stage/appliedDate/closedDate/referredById (existing application) plus status/triage buckets while untriaged. Embeds a `NetworkAtCompany` warm-path dossier panel and can open a nested `ContactDetailModal` via local `openContactId` state — this is D-05's concrete existing example. Props: `app, contacts, apps, interactions, relationships, onStatusChange, onClose, onDelete, onSaved, onFindPeople, onRefresh, onRefreshRelationships`.
- `app/src/components/jobBoards/JobDetailModal.jsx` (195 lines) — thinnest of the 3: no persisted edits except triage/status via `onStatusChange(bucketKey)`; also triggers `onRecheckDeadline` and on-demand AI fit analysis (`generateJobAnalysis`), otherwise read-only display of job/deadline/blurb data. Props: `job, status, blurb, deadline, onRecheckDeadline, onStatusChange, onClose, prefs`.

### Established Patterns
- All 3 current modals independently hand-copy the same overlay/sheet Tailwind markup (`fixed inset-0 bg-ink-900/40 z-50 flex items-end md:items-center`, `bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto`) rather than using `ui/Modal.jsx` — confirming this phase isn't just a visual unification, it's retiring 3 copy-pasted implementations for 1 real shared component.
- No slide-over/drawer pattern exists anywhere in the codebase today (confirmed via grep for `translate-x-full`, `inset-y-0 right-0`, `<aside`, `drawer` — zero matches; components named `*Panel.jsx` like `DuplicatesPanel`/`PreferencesPanel`/`TrackedBoardsPanel` are inline-expanding page sections, not drawers). This is genuinely new UI, not an extension of prior art — the UI-phase researcher should not assume an existing slide-over convention to reuse.
- Nested modal composition already works today (`ApplicationDetailModal` → `ContactDetailModal` → `LogInteractionModal`) — any new architecture must support at least the same depth of composition, per D-05.

### Integration Points
- `PipelineTab.jsx` — currently renders `ApplicationDetailModal` conditionally on `selectedApp`/`addingNew` state; will render the new `SidePanel` (with an `application` record type) instead.
- Wherever `ContactDetailModal` is currently opened from (Network tab, Grow's Coverage/People sections' "+ Add contact" flows per Phase 3, `QuickCaptureModal`, etc.) — all call sites need to be found and re-pointed during planning; this phase's research step should enumerate them (not fully captured here, this is a planning/research task, not a discussion-time decision).
- `jobBoards/RepoJobsView.jsx` (or wherever `JobDetailModal` is currently opened from within Job Boards) — same re-pointing need.

</code_context>

<specifics>
## Specific Ideas

No specific ideas beyond what's captured in `decisions` above — this was a fully autonomous (`--auto`) discussion; all gray areas were resolved to their recommended/lowest-risk option based on the phase's own name/goal, the existing codebase's established extraction precedent from Phase 2/3, and REQUIREMENTS.md's PANEL-02 zero-regression constraint. Flag any of the `[auto]`-tagged decisions above for a quick override before planning if a different call is preferred.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope (no scope-creep suggestions arose during the automated pass).

</deferred>

---

*Phase: 4-shared-record-side-panel*
*Context gathered: 2026-08-19*
