# Phase 4: Shared Record Side-Panel - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-19
**Phase:** 4-shared-record-side-panel
**Mode:** `--auto` — fully autonomous, single pass, no interactive prompts (per user request to streamline the workflow)
**Areas discussed:** Animation/entrance style, Component architecture, Modal.jsx disposition, Nested record navigation

---

## Animation/entrance style

| Option | Description | Selected |
|--------|-------------|----------|
| New slide-over transform (translate-x + backdrop fade) | Matches the phase's literal "side-panel" deliverable; desktop-only, mobile keeps existing bottom-sheet | ✓ |
| Reuse Modal.jsx's scale/fade entrance | Centered scale/fade doesn't visually read as a side-panel | |

**Selected:** New slide-over transform via framer-motion, extending CLAUDE.md's "3 animated moments" list to 4.
**Notes:** Recommended default — a centered scale/fade modal contradicts the phase's own name.

---

## Component architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Shared shell + type-specific body components | Mirrors Phase 2/3's Section/RowCap extraction precedent; isolates 3 divergent field sets | ✓ |
| One monolithic panel, type-conditional rendering | Simpler file count, but risks tangled conditionals and PANEL-02 regression | |

**Selected:** Shared shell (`SidePanel.jsx`) + type-specific bodies (`ContactPanelBody`/`ApplicationPanelBody`/`JobPanelBody`).
**Notes:** Recommended default — matches established codebase precedent and reduces regression risk given how different contact/application/job field sets actually are.

---

## Modal.jsx disposition

| Option | Description | Selected |
|--------|-------------|----------|
| New sibling primitive, Modal.jsx untouched | Modal.jsx keeps serving LogInteractionModal/QuickAddContactModal/AddToCalendarModal unchanged | ✓ |
| Extend Modal.jsx with a `variant="slide-over"` branch | One primitive, but adds conditional complexity to code still used elsewhere | |

**Selected:** New sibling primitive `SidePanel.jsx`.
**Notes:** Recommended default — avoids bloating a primitive still actively used by out-of-scope dialogs.

---

## Nested record navigation

| Option | Description | Selected |
|--------|-------------|----------|
| In-place swap with back button | Panel content swaps to the new record, breadcrumb/back returns to the prior one | ✓ |
| Stack a second panel instance | More visually complex, z-index/stacking risk |  |
| Replace with no way back | Loses today's existing round-trip capability (ApplicationDetailModal → ContactDetailModal) | |

**Selected:** In-place swap with a back affordance in the panel header.
**Notes:** Recommended default — preserves today's existing referrer round-trip behavior without stacking-panel complexity.

---

## Claude's Discretion

- Panel width/breakpoints, header/footer layout details
- File organization (separate body-component files vs. co-located sections)
- Migration order across the 3 record types (a planning-wave decision)

## Deferred Ideas

None — discussion stayed within phase scope.
