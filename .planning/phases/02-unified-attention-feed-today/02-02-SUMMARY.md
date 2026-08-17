---
phase: 02-unified-attention-feed-today
plan: 2
subsystem: ui
tags: [react, attention-feed, todaytab, lucide-react]

# Dependency graph
requires:
  - phase: 02-unified-attention-feed-today
    provides: "lib/attention.js's 8 derivation functions + keepInTouchDue re-export, NAV_ICON.today, TimelineFindsPanel's Section-matching chrome + onPendingChange prop (02-01)"
provides:
  - "app/src/components/TodayTab.jsx — default export TodayTab, self-contained and fully working (not yet mounted anywhere in App.jsx)"
  - "Section, RowCap, OverdueRow, ScheduleRow, HighUrgencyRow, KeepInTouchRow, ApplicationRow, OaRow local components; hasNewerInteraction, changeAppTriage, handleMet helpers"
affects: [02-03-nav-cutover]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RowCap: shared per-section 5-row cap with tier-colored Show more/fewer toggle, reused across all 8 array-backed sections via a hoisted HEADING_COLOR lookup shared with Section"
    - "Row-click-opens-detail-modal + stopPropagation-on-nested-interactive-elements, extended from PipelineTab.jsx's precedent onto Application/OA rows that were previously inert"

key-files:
  created:
    - app/src/components/TodayTab.jsx
  modified: []

key-decisions:
  - "KeepInTouchRow takes an explicit `status` prop (not just `contact`) since keepInTouchDue's queue items are `{contact, status}` pairs and the row needs status.cadence/overdueDays/never to render — plan text's listed signature omitted it, added for correctness (Rule 1)"
  - "ApplicationRow takes `changeAppTriage` as an explicit prop (the mutation function itself, not `onRefresh`) since it's a standalone top-level component and cannot close over TodayTab's local changeAppTriage the way the plan's action text implicitly assumed — added for correctness (Rule 3, blocking issue)"
  - "Added Clock and MessageSquarePlus lucide-react imports (used by the ported KeepInTouchRow body) — the plan's Task 1 import list omitted them from its explicit icon list; without them the file would throw a ReferenceError (Rule 3)"
  - "KeepInTouchRow's overdue-status heading text stays text-accent-700 (unchanged from KeepInTouchTab.jsx) — the plan's 'exactly one visual change' instruction scoped the accent-to-warning recolor to the card's border only, not this secondary text color"

patterns-established:
  - "RowCap(items, cap, tier, renderItem): every array-backed attention section renders through this instead of a bare .map(), giving all 8 sections the same 5-row default + Show more/fewer behavior for free"

requirements-completed: [ATTN-01, ATTN-02]

coverage:
  - id: D1
    description: "TodayTab.jsx renders all 9 attention sections (Overdue Follow-Ups, Stale Applications, High Urgency Contacts, Keep in Touch Due, Job Boards Needs-Review, Want to Schedule, OA-Due, OA-Needs-Check, Timeline Finds) in D-02's exact time-sensitivity order"
    requirement: "ATTN-01"
    verification:
      - kind: unit
        ref: "bash grep+esbuild verification embedded in 02-02-PLAN.md Task 1/2/3 <verify> blocks (section-order line-number ascending check, symbol presence, esbuild parse)"
        status: pass
    human_judgment: true
    rationale: "TodayTab.jsx is not mounted anywhere in App.jsx yet per this plan's explicit scope boundary (Plan 02-03 wires the nav cutover) — visual/interaction correctness in a live browser can't be confirmed until then. Deterministic gates (symbol presence, import correctness, order-by-line-number, esbuild parse) all pass, but a human/UAT pass against the real rendered feed is deferred to Plan 02-03's build."
  - id: D2
    description: "Every contact-shaped and application-shaped row deep-links to its full ContactDetailModal/ApplicationDetailModal in one click, with the onFindPeople cross-tab relay threaded through to ApplicationDetailModal"
    requirement: "ATTN-02"
    verification:
      - kind: unit
        ref: "bash grep verification embedded in 02-02-PLAN.md Task 3 <verify> block (onFindPeople={onFindPeople} presence, ApplicationDetailModal mounted exactly once)"
        status: pass
    human_judgment: true
    rationale: "Same as D1 — the modal wiring is statically verified (correct props threaded, correct prop names) but the actual click-to-open behavior can't be exercised in a live app until Plan 02-03 mounts TodayTab."
  - id: D3
    description: "Every carried-forward inline action (mark followed up, mark scheduled, mark completed, triage chips, Met, Log) is preserved unchanged; Timeline Finds stays approve/dismiss-only per D-04b; demo mode omits the Timeline Finds section entirely"
    requirement: "ATTN-02"
    verification:
      - kind: unit
        ref: "bash grep verification embedded in 02-02-PLAN.md Task 1/2/3 <verify> blocks (stopPropagation count >=3, !isDemoMode guard on TimelineFindsPanel mount)"
        status: pass
    human_judgment: true
    rationale: "Inline-action byte-for-byte porting was verified by direct code comparison against ActionsTab.jsx/KeepInTouchTab.jsx during implementation; a human/UAT click-through against the live feed is deferred to Plan 02-03."

duration: 4min
completed: 2026-08-16
status: complete
---

# Phase 2 Plan 2: TodayTab Unified Attention Feed Summary

**Built `app/src/components/TodayTab.jsx` — a self-contained 9-section attention feed (485 lines) combining 5 legacy surfaces into one D-02-ordered, tier-colored component, ready for Plan 02-03's nav cutover but not yet mounted anywhere.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-16T21:05:00Z
- **Completed:** 2026-08-16T21:09:00Z
- **Tasks:** 3 completed
- **Files modified:** 1 (new)

## Accomplishments
- `TodayTab.jsx` created with a re-keyed `Section` wrapper (danger/warning/ink/accent — Phase 1's 4 locked color families, replacing `ActionsTab.jsx`'s off-token red/orange/yellow/indigo) and a new shared `RowCap` component giving every array-backed section a 5-row default with a tier-colored "Show N more / Show fewer" toggle.
- 5 row shapes built across the file's 3 tasks: `OverdueRow`/`ScheduleRow` (ported verbatim from `ActionsTab.jsx`, name-block click repointed from inline-expand to opening `ContactDetailModal`), `HighUrgencyRow` (new — the source row was fully inert), `KeepInTouchRow` (ported from `KeepInTouchTab.jsx`, overdue border recolored accent→warning), `ApplicationRow`/`OaRow` (Stale Applications, Job Boards Needs-Review, OA-Due, OA-Needs-Check — newly wired to open `ApplicationDetailModal` on row click, with `stopPropagation` added to every nested interactive element: JD links, triage chips, the assessment link, mark-completed).
- All 8 array-backed sections assembled in D-02's exact time-sensitivity order (Overdue Follow-Ups → Stale Applications → High Urgency Contacts → Keep in Touch Due → Job Boards Needs-Review → Want to Schedule → OA-Due → OA-Needs-Check), each retrofitted onto `RowCap`; `TimelineFindsPanel` mounted as the 9th and final section (own chrome, `!isDemoMode`-gated, feeding `onPendingChange` into the page-level empty-state guard).
- `ApplicationDetailModal` mounted exactly once with the full `PipelineTab.jsx` prop contract, including `onFindPeople={onFindPeople}` so the "Find people →" cross-tab relay survives the move — this was the plan's explicitly flagged highest-risk regression point.
- Page-level `EmptyState` guard covers all 9 sections' emptiness (including Timeline Finds' live pending count, short-circuited in demo mode) with reworded copy: "✓ Nothing needs your attention. You're on top of it."

## Task Commits

Each task was committed atomically:

1. **Task 1: TodayTab scaffold — Section wrapper, contact-row sections, Keep-in-Touch section** - `efcae15` (feat)
2. **Task 2: Application-row and OA-row sections + shared row-cap helper** - `72cf433` (feat)
3. **Task 3: Final assembly — D-02 order, ApplicationDetailModal mount, Timeline Finds, row-cap retrofit, empty state** - `1c9b902` (feat)

## Files Created/Modified
- `app/src/components/TodayTab.jsx` - New unified attention feed component, 485 lines, default export `TodayTab` plus 8 local helper/row components

## Decisions Made
- `KeepInTouchRow` takes an explicit `status` prop (in addition to `contact`) since `keepInTouchDue`'s queue items are `{contact, status}` pairs, not bare contacts — required for the cadence/overdue-day text the row displays.
- `ApplicationRow` takes the `changeAppTriage` mutation function itself as a prop (not just `onRefresh`), since it's a standalone top-level component and can't close over `TodayTab`'s locally-defined `changeAppTriage` the way the plan's action prose implicitly assumed.
- Added `Clock`/`MessageSquarePlus` lucide-react imports in Task 1 — needed by the verbatim-ported `KeepInTouchRow` body but omitted from the plan's explicit "the lucide-react icons" list.
- Left `KeepInTouchRow`'s overdue-status heading text at `text-accent-700` unchanged — the plan's "exactly one visual change" instruction scoped the accent→warning recolor to the card's border only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Correctness] `KeepInTouchRow` needs a `status` prop, not just `contact`**
- **Found during:** Task 1
- **Issue:** The plan's listed signature `KeepInTouchRow({ contact: c, interactions, onOpen, onLog, onMet })` has no way to access `status.cadence`/`status.overdueDays`/`status.never`, which the ported card body (from `KeepInTouchTab.jsx:40-87`) requires to render the cadence line and overdue-status text. `keepInTouchDue(contacts, interactions)` (a re-export of `keepInTouchQueue`) returns `{contact, status}` pairs, not bare contacts.
- **Fix:** Added `status` as an explicit prop, destructured directly from the `{contact, status}` items when mapping in `TodayTab`'s Keep in Touch Due section.
- **Files modified:** `app/src/components/TodayTab.jsx`
- **Verification:** `npx esbuild` parse + manual trace of `keepInTouchDue`'s return shape against the row's usage.
- **Committed in:** `efcae15`

**2. [Rule 3 - Blocking issue] `ApplicationRow`'s triage-chip mutation can't reach `TodayTab`'s closure**
- **Found during:** Task 2
- **Issue:** The plan's action text has `ApplicationRow`'s triage chips call `changeAppTriage(a, b.key)` directly, implying it's in scope — but `changeAppTriage` is defined inside `TodayTab`'s function body, and `ApplicationRow` is a separate top-level component that cannot close over it.
- **Fix:** Added `changeAppTriage` as an explicit prop to `ApplicationRow`, threaded from `TodayTab`'s JSX at each of the two usage sites (Stale Applications, Job Boards Needs-Review).
- **Files modified:** `app/src/components/TodayTab.jsx`
- **Verification:** `npx esbuild` parse; traced the call site back to `TodayTab`'s own `changeAppTriage` definition.
- **Committed in:** `72cf433`

**3. [Rule 3 - Blocking issue] Missing `Clock`/`MessageSquarePlus` imports**
- **Found during:** Task 1
- **Issue:** `KeepInTouchRow`'s ported body uses `<Clock size={11} />` (tie-strength meta line) and `<MessageSquarePlus size={12} />` (Log button), matching `KeepInTouchTab.jsx`'s original imports — but the plan's Task 1 "the lucide-react icons" list only named `CalendarClock, AlertTriangle, HeartHandshake, UserPlus`, which would leave both undefined at runtime.
- **Fix:** Added `Clock, MessageSquarePlus` to the Task 1 lucide-react import line.
- **Files modified:** `app/src/components/TodayTab.jsx`
- **Verification:** `npx esbuild` parse (would not have caught the runtime ReferenceError, but confirmed no syntax issue); cross-checked against `KeepInTouchTab.jsx`'s own import line.
- **Committed in:** `efcae15`

---

**Total deviations:** 3 auto-fixed (2× Rule 3 blocking-issue, 1× Rule 1 correctness)
**Impact on plan:** All three were necessary for the file to actually run without a ReferenceError or a broken click handler — no scope creep, no invented features. The plan's prose descriptions were slightly under-specified on prop-threading mechanics for components split out of `TodayTab`'s closure; the fixes preserve every behavior the plan asked for.

## Issues Encountered
None — all three deviations above were caught and fixed inline during implementation, not discovered as later failures.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `app/src/components/TodayTab.jsx` exists, is syntactically valid (verified via `esbuild` after every task), and exports a `TodayTab` default function with the exact prop contract Plan 02-03 needs: `{ contacts, apps, interactions, calls, relationships, onFindPeople, onRefresh, onRefreshRelationships, isDemoMode }`.
- Not yet imported/mounted anywhere in `App.jsx` — by design, per this plan's explicit scope boundary. Plan 02-03 must supply exactly this prop shape or a section silently loses its data (e.g. omitting `calls` breaks Timeline Finds, omitting `onFindPeople` silently drops the Find-people relay — same class of risk STATE.md's "Cross-tab deep-link relay" blocker already flags).
- Live browser/UAT verification of click-through behavior (row → modal, Show more/fewer toggle, triage chips, Timeline Finds approve/dismiss) is deferred to Plan 02-03, the first point `npm run build`'s entry graph actually reaches this file.
- No blockers.

---
*Phase: 02-unified-attention-feed-today*
*Completed: 2026-08-16*

## Self-Check: PASSED

`app/src/components/TodayTab.jsx` found on disk; all 3 task commit hashes (`efcae15`, `72cf433`, `1c9b902`) found in git log.
