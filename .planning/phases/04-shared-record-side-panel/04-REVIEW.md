---
phase: 04
status: issues
files_reviewed: 11
findings:
  critical: 0
  warning: 2
  info: 6
  total: 8
---

## Summary

Reviewed the 11 surviving files of the shared record side-panel port (`SidePanel.jsx`, `useMediaQuery.js`, the three panel bodies, and the 6 re-pointed call-site files) against the pre-phase base `b690ab9`. Diffed every ported body (`ApplicationPanelBody`, `ContactPanelBody`, `JobPanelBody`) line-for-line against its legacy modal predecessor, and diffed every call site against its pre-phase version.

The two risk areas flagged as most likely to hide a real bug — the D-05 in-place-swap and the "shared resource fetched by 3 simultaneously-mounted components" desync class from Phase 3 — check out clean: none of the three panel bodies fetch their own data independently, everything flows through props from the single call-site load, and the swap correctly threads `contacts`/`interactions`/`relationships` without a stale closure (verified against live prop reads, not captured copies). The documented CalendarTab/ReferralCoverageTab prop omissions are genuinely unchanged (byte-identical gap, confirmed against `04-RESEARCH.md`'s own callout and re-verified by diff) and degrade gracefully via existing default parameters — no crash risk.

What the diff-level comparison did surface, that the phase's own deterministic-gate sweep (04-05-SUMMARY.md) wouldn't have caught because its gates are structural/grep-based rather than behavioral: the new `SidePanel` shell's exit animation is very likely dead code at all 9 real call sites (see WR-01), and the `createPortal`-wrapped interaction dialog introduces a new Escape-key double-close interaction that didn't exist pre-phase (WR-02). Both are UI/interaction-only — no data-loss-on-persist, no security-boundary changes, no crashes — so neither blocks the phase, but both are worth a fix or an explicit accept before the pending human UAT sign-off (04-05-SUMMARY.md's 12-step checklist, items 1–3 and 9, are exactly the steps that would empirically confirm or refute WR-01/WR-02 — this review's findings are static-analysis-derived and should be cross-checked against that live pass).

### WR-01: SidePanel's exit animation is very likely dead code at every one of its 9 call sites

`SidePanel.jsx` wraps its content in `AnimatePresence` and conditions the slide-in/out on its own `open` prop:

```jsx
// app/src/components/ui/SidePanel.jsx
return (
  <AnimatePresence>
    {open && (
      <motion.div ... {...transform} transition={{ duration: 0.22, ease: 'easeOut' }}>
        {children}
      </motion.div>
    )}
  </AnimatePresence>
)
```

For `AnimatePresence` to play a child's `exit` animation, `AnimatePresence` itself must remain mounted across the render in which the child is removed — only the *child* should toggle out of the tree, not `AnimatePresence`'s own parent. But every one of the 9 render sites (verified by direct read, all 9: `App.jsx`'s `NetworkTab`, `CalendarTab.jsx` ×2, `RepoJobsView.jsx`, `PipelineTab.jsx`, `ReferralCoverageTab.jsx`, `TodayTab.jsx` ×2) gates the entire `<SidePanel>` behind a truthy check at the *parent* level, not by toggling `SidePanel`'s own `open` prop:

```jsx
// every call site, e.g. App.jsx's NetworkTab
{editing && (
  <SidePanel open onClose={() => setEditing(null)}>
    <ContactPanelBody ... />
  </SidePanel>
)}
```

`open` is always passed as the literal `true` shorthand and is never actually flipped to `false` by any caller — closing always works by nulling out the parent's own state (`editing`, `selectedApp`, `selectedJob`, `addingFor`, etc.), which removes `<SidePanel>` — and therefore its internal `AnimatePresence` — from the tree in the same commit. React unmounts the whole subtree synchronously; `AnimatePresence` has no opportunity to intercept that removal and hold the child mounted for its `exit: { x: '100%' }` / `exit: { y: '100%' }` transition to play. The practical effect: opening a panel animates in correctly (entrance animations run on mount regardless of `AnimatePresence`), but every close path — the "✕" button, Escape, and the backdrop click, which all ultimately just null out the parent's state — makes the panel disappear with a hard instant cut instead of the intended slide-out.

This is worth noting as **newly surfaced by this phase**, not merely inherited: the three legacy modals this phase replaced (`ApplicationDetailModal.jsx`, `ContactDetailModal.jsx`, `jobBoards/JobDetailModal.jsx`) used a plain `<div className="fixed inset-0...">` with **no** `framer-motion`/`AnimatePresence` at all — so previously these three record types had no animation in either direction (consistent, if plain). Post-phase, they animate in but not out — a newly-introduced open/close asymmetry, not a pre-existing gap being carried forward. (The *pattern* itself — `AnimatePresence` whose parent is conditionally unmounted by the caller rather than the component's own `open` prop being toggled — does already exist in `ui/Modal.jsx` and every one of its 5 existing callers (`LogInteractionModal`, `QuickAddContactModal`, `QuickScheduleModal`, `QuickCaptureModal`, `AddToCalendarModal`), so this isn't a new *mistake* introduced by this phase so much as a faithful architectural copy of `Modal.jsx` — which the file's own top comment describes as the intentional model ("a sibling of the centered-dialog primitive ui/Modal.jsx"). It's flagged here because the copy inherited the flaw along with the pattern, and this phase specifically shipped exit-transform values (`x:/y: '100%'`) that, per this analysis, never actually get used.)

**Confidence:** derived from static code reading (all 9 call sites read directly, confirmed identical gating pattern) and standard `framer-motion`/`AnimatePresence` semantics, not from a live browser run. 04-05-SUMMARY.md's staged manual-verification checklist (steps 1–3, not yet signed off) is the right place to empirically confirm or refute this before treating it as ship-blocking — if the human pass shows the slide-out does in fact play, this finding should be revisited (it would mean framer-motion is doing something more forgiving here than documented).

**Suggested fix, if confirmed:** keep `<SidePanel>` itself always mounted at each call site and drive visibility purely through its `open` prop, e.g.:
```jsx
<SidePanel open={!!editing} onClose={() => setEditing(null)}>
  {editing && <ContactPanelBody ... />}
</SidePanel>
```
(and the analogous fix in `ui/Modal.jsx` for its own 5 callers, if this pattern is deemed worth fixing app-wide rather than just for the new panels).

### WR-02: Escape key closes the interaction-logging dialog and its enclosing SidePanel simultaneously, discarding unsaved edits

`ContactPanelBody.jsx` renders its "+ Log" interaction dialog through a portal, specifically to escape the `SidePanel`'s transformed containing block:

```jsx
{logOpen && createPortal(
  <LogInteractionModal contacts={contacts} contact={contact} onClose={() => setLogOpen(false)} onSaved={...} />,
  document.body
)}
```

`LogInteractionModal` renders via `ui/Modal.jsx`, which registers its own `window.addEventListener('keydown', ...)` Escape handler — and `SidePanel.jsx` (the enclosing panel, still mounted underneath) registers an identical `window`-level Escape handler of its own. Both listeners live on the same `window` target; DOM event dispatch calls *every* listener registered for `keydown` on that target, in registration order — `stopPropagation()` inside one has no effect on a sibling listener attached to the same element, so nothing here prevents both from firing. `SidePanel`'s listener was registered first (the panel was already open when "+ Log" was clicked), so on Escape: `SidePanel`'s `onClose` fires first (e.g. `setEditing(null)` / `setSelectedContactId(null)`), immediately followed by the Log modal's own `onClose` (`setLogOpen(false)`) — both batched into the same React commit. The net effect is that pressing Escape while the Log dialog is open closes **both** dialogs in one keypress, not just the topmost one — and since `ContactPanelBody` unmounts as part of that same commit, any unsaved edits in the contact form (name/role/notes/etc., typed but not yet hit "Save Changes") are silently discarded along with it.

This is a genuinely new interaction, not a preserved gap: the legacy `ContactDetailModal.jsx` never registered an Escape handler of its own (confirmed — no `useEffect`/`keydown` in the pre-phase file), so previously, Escape while the Log dialog was open only ever hit the Log modal's own (pre-existing) listener and closed just that one dialog, leaving the contact modal open underneath with its edits intact. `SidePanel.jsx` adding its own Escape handling (a real, worthwhile capability the old hand-rolled contact modal lacked) is what introduces the collision once a `ui/Modal.jsx`-based dialog is portaled inside it.

**Impact:** UI-only — no persisted-data corruption (nothing had been saved yet), user-recoverable by re-entering the discarded edits, and only reachable via the specific "open a contact → click + Log → press Escape" path. Still worth a fix given it's a real, reproducible data-loss-of-unsaved-work interaction, and it's exactly the kind of case 04-05-SUMMARY.md's manual checklist item 9 doesn't explicitly exercise (it verifies the dialog closes and the panel stays open, via presumably its own "✕", but doesn't call out Escape specifically).

**Suggested fix:** the simplest robust fix is for nested/portaled dialogs to stop the Escape keydown from being visible to ancestor listeners — e.g. have `ui/Modal.jsx`'s (and `SidePanel.jsx`'s) keydown handler call `e.stopImmediatePropagation()` and register on a scoped element (or use React's capture-phase bubbling with a ref) rather than two independent `window`-level listeners with no stacking awareness. A lighter-weight fix scoped to this one path: track "is a nested dialog open" in `ContactPanelBody` and have `SidePanel`'s `onClose` no-op while `logOpen` is true.

### IN-01: State-desync class of bug (Phase 3 precedent) — not present here

Verified none of the three panel bodies independently fetch a shared resource: `ContactPanelBody`, `ApplicationPanelBody`, and `JobPanelBody` all receive `contacts`/`apps`/`interactions`/`relationships`/`blurb`/`deadline` purely as props from the single call-site load (`App.jsx`'s `load()`, `RepoJobsView`'s `useJobBlurbs`/`useJobDeadlines` hooks called once at the list level, etc.). No panel body calls `fetch*` from `db.js` itself. The one nested case — `ApplicationPanelBody` swapping in `ContactPanelBody` (D-05) — passes its own live `contacts`/`interactions`/`relationships` props straight through (not a snapshot/copy), so there's no window for a second independent fetch of the same data to drift from the first.

### IN-02: D-05 in-place swap — data threading, stale closures, and back-button state preservation all confirmed correct

`ApplicationPanelBody`'s `if (openContact) { return <ContactPanelBody ... onBack={() => setOpenContactId(null)} /> }` is an early return inside the same component instance, not a conditional mount of a different component — so `ApplicationPanelBody`'s own `useState` (`form`, `dates`, `analysis`, `pasteUrl`, etc.) is untouched by which JSX branch gets returned, confirmed correct: clicking "back" returns to the application view with any in-progress edits (stage/date changes, a paste-URL import in flight, etc.) intact, exactly as the inline comment on lines 230–233 claims. `contacts`/`interactions`/`relationships` read directly from props at swap time (no captured copy), so no stale-closure risk. One deliberate behavior change worth confirming is intentional (not called out explicitly in-code beyond the D-05 comment): the swapped-in `ContactPanelBody`'s own "✕" button uses the *outer* `onClose` (closes the whole panel), not `onBack` — a change from the legacy nested-modal version, where the inner `ContactDetailModal`'s "✕" only closed the inner layer (`onClose={() => setOpenContactId(null)}`), leaving the application modal open underneath. This looks like the intended, more-consistent semantic for the new single-panel model ("✕" always fully closes, the new back-arrow always steps back one level) rather than an oversight, but flagging it since it is a genuine behavior change from pre-phase.

### IN-03: CalendarTab/ReferralCoverageTab prop omissions — confirmed genuinely preserved, not silently fixed, and confirmed non-crashing

Diffed `CalendarTab.jsx`'s two panel-body render sites and `ReferralCoverageTab.jsx`'s one against their pre-phase versions: the omitted props (`contacts`/`apps`/`interactions`/`relationships`/`onSaved`/`onFindPeople`/`onRefresh`/`onRefreshRelationships` for Calendar's application call; `contactRelationships`/`onRefreshRelationships` for Calendar's contact call and Coverage's contact call) are identical to what was omitted pre-phase — this matches `04-RESEARCH.md`'s own documented call-out verbatim and 04-05-SUMMARY.md's re-verification gates 12–13. Confirmed non-crashing: `ApplicationPanelBody`'s `contacts = [], apps = [], interactions = [], relationships = []` defaults and `ContactPanelBody`'s `(interactions || [])` guard are unchanged from the legacy modals, so the reduced-prop sites render an honest empty state (0 warm-tie contacts, no relationships editor) rather than throwing. One real, pre-existing (not introduced by this phase) rough edge worth surfacing again: `ApplicationPanelBody`'s "Save Stage / Dates" button — reachable from Calendar since it only requires `!isNew` — calls `onSaved()` unconditionally (not `onSaved?.()`) in `saveDates()`, and Calendar doesn't pass `onSaved`. Clicking that button from Calendar throws inside the function's own `try`, which is caught by its `catch (e) { setError(e.message) }` — so the update to Supabase still succeeds, but the user sees a raw `"onSaved is not a function"` error banner instead of the panel simply closing/refreshing. Confirmed via diff that this exact bug (identical unconditional `onSaved()` call, identical missing prop at the identical call site) already existed byte-for-byte in the pre-phase `ApplicationDetailModal.jsx` + `CalendarTab.jsx` pairing — not a regression, but worth a follow-up ticket since it's a confusing user-facing error message for a save that actually succeeded.

### IN-04: `createPortal` target and cleanup — correct, no leak

`ContactPanelBody`'s `logOpen && createPortal(<LogInteractionModal .../>, document.body)` targets the stable, always-present `document.body` node (not a component-created container that would need its own cleanup) and is gated by the same `logOpen` boolean that mounts/unmounts the dialog elsewhere in the app — standard, correct portal usage, no extra DOM node to leak and no double-render risk. The portal is exactly what's needed to escape `SidePanel`'s `motion.div` (which applies an inline `transform` while animating, creating a new containing block for `position: fixed` descendants per the CSS spec) — without it, `LogInteractionModal`'s own `fixed inset-0` overlay would be constrained to the panel's box instead of the viewport. This matches the phase's own stated rationale exactly.

### IN-05: Minor, low-priority — resizing across the 768px breakpoint while a panel is open

`useMediaQuery`'s `matchMedia('change')` listener means `SidePanel`'s `isDesktop` (and therefore its `initial`/`animate`/`exit` transform objects) can flip while the panel is already mounted and visible (e.g. a live window resize or devtools device-mode toggle). Since `initial` only applies on mount, resizing after mount doesn't re-run the entrance animation, but the `animate` target does change (`{x: 0}` → `{y: 0}` or vice versa) on an already-animating/settled element, which framer-motion will interpolate toward — a possible small visual glitch (e.g. a slight diagonal drift) rather than a clean instant re-position. Rare interaction (resizing a browser window with a panel open), cosmetic only, not worth a dedicated fix unless it's visually confirmed distracting during the manual UAT pass (checklist step 2 exercises this exact case).

### IN-06: No BYOK/RLS/security-boundary changes in this phase

None of the 11 reviewed files touch `api/*.js`, `lib/claude.js`/`openai.js`/`exa.js`, `db.js`'s Supabase calls, or any proxy/auth code. `ContactPanelBody.jsx`'s `useAuth()` import is pre-existing (unchanged) and reads only the client-side `profile.school` for a label string — no new key/token handling introduced. Confirmed nothing in this phase's diff crosses the app's server-auth or BYOK boundary.
