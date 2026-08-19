---
phase: 04-shared-record-side-panel
plan: 02
subsystem: ui
tags: [react, jsx, refactor, port, side-panel]

# Dependency graph
requires:
  - phase: 04-shared-record-side-panel (plan 01)
    provides: useMediaQuery hook, SidePanel shell, JobPanelBody (establishes the panel-body port pattern this plan follows)
provides:
  - "ContactPanelBody — the contact record surface ported out of the hand-rolled ContactDetailModal into a shell-agnostic body component, with an optional back affordance and a portal-rendered interaction-logging dialog"
affects: [04-03 (ApplicationPanelBody port), 04-04 (call-site re-pointing and legacy modal deletion)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Panel-body port pattern: strip the two legacy modal wrapper divs, move content into a fragment root, bump relative import depth by one directory level, leave the source modal file untouched until the final re-pointing plan"
    - "Nested-dialog containing-block fix: render any fixed-position dialog owned by a panel body through createPortal(..., document.body) so it escapes the panel's animated transform"

key-files:
  created:
    - app/src/components/panels/ContactPanelBody.jsx
  modified: []

key-decisions:
  - "Task 2's mechanical audit found that Task 1's port had dedented the entire JSX body when removing the two wrapper divs — a whole-body reindent that is not one of the plan's five sanctioned change categories. Restored the original ContactDetailModal indentation for all unchanged lines so the source-to-port diff reflects only the five sanctioned changes (167 lines net changed in git diff due to the indentation restoration touching every line, but the *normalized* source-diff — the actual audit signal — dropped from 367 to 43 changed lines, well under the plan's 60-line ceiling)."

patterns-established:
  - "Pattern: when removing wrapper elements during a body-port, preserve the original file's indentation for untouched content rather than re-flowing it — this keeps the source-to-port diff minimal and auditable, at the cost of one extra level of indentation relative to strict nesting (cosmetic only, does not affect JSX semantics or the build)."

requirements-completed: [PANEL-01, PANEL-02]

coverage:
  - id: D1
    description: "ContactPanelBody exists with the full 9-prop signature (contact, contacts, interactions, contactRelationships, onClose, onSaved, onRefreshRelationships, initial, onBack) and renders as plain children (no fixed/modal wrapper) — the shell in 04-01's SidePanel now owns positioning."
    requirement: "PANEL-01"
    verification:
      - kind: other
        ref: "grep -c 'fixed inset-0' / 'md:max-w-lg' both return 0; cd app && npm run build exits 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "All 18 contact capabilities (form fields, status/urgency/referral grid, relationships, alum/affinity two-way sync, life-domain, schedule block, whatTheyDid/notes, history, Met quick-log, interaction-logging dialog via portal, draft-outreach affordance, save/delete, error banner, back affordance) are present in the port, verified item-by-item against the source modal."
    requirement: "PANEL-02"
    verification:
      - kind: other
        ref: "Manual side-by-side read of app/src/components/ContactDetailModal.jsx vs app/src/components/panels/ContactPanelBody.jsx, itemized in this SUMMARY's Capability Parity Checklist"
        status: pass
    human_judgment: true
    rationale: "No render sites point at ContactPanelBody yet (that's 04-04's job) so there is no live UI to click through in this plan — parity is currently provable only by structural/textual audit, not by exercising the component in the browser. A human should skim the capability checklist below before 04-04 wires it into the app."

# Metrics
duration: ~35min
completed: 2026-08-19
status: complete
---

# Phase 04 Plan 02: Contact Panel Body Port Summary

**Ported the 376-line ContactDetailModal into panels/ContactPanelBody.jsx (18 capabilities, 19-key form) with a new optional back affordance and a portal-rendered interaction dialog, then repaired a whole-body reindentation found by a mechanical diff audit.**

## Performance

- **Duration:** ~35 min (Task 1 committed in a prior session; this session covered Task 2's audit-and-repair plus this SUMMARY)
- **Started:** 2026-08-18T18:25:44-07:00 (Task 1 commit)
- **Completed:** 2026-08-19T04:59:14Z
- **Tasks:** 2
- **Files modified:** 1 (`app/src/components/panels/ContactPanelBody.jsx`)

## Accomplishments
- Ported the full contact record surface (form, relationships, history, quick-log, draft-outreach) out of the hand-rolled `ContactDetailModal` into `panels/ContactPanelBody.jsx` as a shell-agnostic body component
- Added the one new capability the phase requires: an optional `onBack` prop that renders a back button in the sticky header (D-05)
- Fixed a real containing-block bug proactively: the interaction-logging dialog now renders through `createPortal(..., document.body)` so it isn't clipped/mispositioned by the panel's animated `transform`
- Task 2's mechanical audit caught and repaired unsanctioned reindentation drift, bringing the normalized source-to-port diff from 367 changed lines down to 43 — under the plan's 60-line ceiling — with every remaining hunk accounted for

## Task Commits

Each task was committed atomically:

1. **Task 1: Port the contact body into panels/ContactPanelBody.jsx** - `00e39f0` (feat) — pre-existing, verified against current file state rather than redone
2. **Task 2: Mechanical port audit against the source modal** - `2b59e97` (fix) — repaired reindentation drift found during the audit

_No plan-metadata commit yet in this session — STATE.md/ROADMAP.md updates are owned by the orchestrator after all wave agents complete, per this session's instructions._

## Files Created/Modified
- `app/src/components/panels/ContactPanelBody.jsx` - Contact record body ported from `ContactDetailModal.jsx`; renders as plain children (no modal wrapper), adds an optional `onBack` header affordance, and portals the interaction-logging dialog to `document.body`

## Capability Parity Checklist (PANEL-02)

Each item verified present in `app/src/components/panels/ContactPanelBody.jsx`, matched against `app/src/components/ContactDetailModal.jsx`:

1. ✅ Form state initializer covers all 19 keys (`name`, `company`, `role`, `email`, `linkedin`, `source`, `status`, `urgency`, `referredById`, `referralStatus`, `whatTheyDid`, `notes`, `followUpDate`, `isUMichAlum`, `affinity`, `lifeDomain`, `wantsToSchedule`, `scheduleBy`, `scheduleNote`) with identical defaults, including `initial.name`/`initial.company` seeding and `.slice(0, 10)` date truncation.
2. ✅ `isNew = !contact` branch: six always-visible fields render in both modes; Status/Urgency/Referred By/Referral Status/Follow-Up grid, Relationships, alum+affinity, schedule, whatTheyDid/notes, History, draft affordance, and Delete button all gated behind `!isNew` exactly as before.
3. ✅ Primary button copy switches between `+ Add Contact` (isNew) and `Save Changes`, with `Saving...` in-flight state.
4. ✅ `save()` calls `addContact` with `{ name, company, role, email }` on the isNew path, and `updateContact(contact.id, {...})` with all mapped fields (including `|| null` coercions on `role`, `source`, `referredById`, `followUpDate`, `scheduleBy`) on the edit path.
5. ✅ Name-required validation blocks save when blank.
6. ✅ `toggleUMichAlum`/`toggleAffinity` keep checkbox and affinity array in two-way sync via `schoolLabel`, still derived from `profile?.school`.
7. ✅ `toggleLifeDomain` toggles values into/out of `form.lifeDomain`.
8. ✅ Relationships block lists `myRelationships` with correct outgoing/incoming phrasing via `nameOf`, per-row remove calling `deleteContactRelationship` then `onRefreshRelationships`, and add row calling `addContactRelationship` then `onRefreshRelationships` (never `onSaved`).
9. ✅ Referred By dropdown and Relationships target select both populated from `referralOptions` with `Name @ Company` label format.
10. ✅ Alum checkbox + `ChipToggleGroup` over `affinityOptionsFor(profile)`; life-domain `ChipToggleGroup` over `LIFE_DOMAIN_OPTIONS`.
11. ✅ Schedule block: `wantsToSchedule` checkbox reveals `scheduleBy` date input and `scheduleNote` text input.
12. ✅ History block: `interactions` filtered to `contact?.id`, sorted newest-first, each row showing type Badge, direction, formatted date, summary, count in header.
13. ✅ Met quick-log button calls `logMetWithContact(contact)` then `onSaved()`, with in-flight state.
14. ✅ Log button opens the interaction-logging dialog (now via `createPortal`) with `contacts`, `contact`, an `onClose` that clears the flag, and an `onSaved` that clears the flag and calls `onSaved()`.
15. ✅ Draft-outreach affordance renders when `history.length <= 1`, toggles `DraftPanel` with `kind="cold_open"`.
16. ✅ Delete action calls `archiveContact(contact.id)` behind `confirm()`, then `onSaved()`, with `Deleting...` in-flight state.
17. ✅ Error banner surfaces thrown messages from every handler.
18. ✅ Back affordance renders only when `onBack` is supplied (wrapped `h2` in a `flex items-center gap-2 min-w-0` div, `ArrowLeft` icon at `size={14}`, `truncate` added to `h2`); close-button behavior unchanged in both cases.

## Mechanical Port Audit — Diff Hunk Classification (Task 2)

Normalized diff command: `diff <(sed 's/ContactDetailModal/ContactPanelBody/g' app/src/components/ContactDetailModal.jsx) app/src/components/panels/ContactPanelBody.jsx`

**After the Task 2 repair:** 43 changed lines total (`grep -c '^[<>]'`), well under the plan's 60-line ceiling. 9 diff hunks, all classified into the five sanctioned categories (one hunk spans three categories because diff merges adjacent import-line changes into a single hunk):

| Hunk (line range) | Category | Description |
|---|---|---|
| `0a1,2` | (e) provenance comment | Adds the 2-line "Ported from..." head comment |
| `2,9c4,12` | (b) + (c) + (d) combined | Import block: 5 path-depth rewrites (`../db.js`→`../../db.js` etc. — category b), `ArrowLeft` added to the `lucide-react` import (category c), `createPortal` import added (category d) |
| `11c14` | (c) onBack prop | Adds `onBack` to the destructured prop signature |
| `176,178c179` | (a) wrapper removal | Removes the outer `fixed inset-0` div and inner `md:max-w-lg` div, replaces with `<>` fragment root |
| `180c181,189` | (c) onBack header | Wraps `h2` in a `flex items-center gap-2 min-w-0` div with the conditional back button + `ArrowLeft` icon; adds `truncate` to `h2` |
| `364d372` | (a) wrapper removal | Removes the closing `</div>` for the deleted `bg-white` wrapper |
| `366c374` | (d) portal | Changes `{logOpen && (` to `{logOpen && createPortal(` |
| `372c380,381` | (d) portal | Changes `/>` to `/>,` + adds `document.body` argument |
| `374c383` | (a) wrapper removal | Changes closing `</div>` to `</>` |

**Zero hunks touch the bodies of `save`, `met`, `del`, `addRelationship`, `removeRelationship`, `toggleUMichAlum`, `toggleAffinity`, or `toggleLifeDomain`** — confirmed via `grep -A2 -B2` against the function-name patterns, no output.

**Category totals:** (a) wrapper removal/fragment root: 3 hunks · (b) import-depth rewrites: 1 hunk (shared) · (c) onBack prop/header: 2 hunks + shares the import hunk · (d) portal: 2 hunks + shares the import hunk · (e) provenance comment: 1 hunk.

## Decisions Made
- **Restored original indentation instead of re-flowing it.** Task 1's port dedented every line inside the removed wrapper divs (standard React refactor instinct — content moved up one nesting level, so it "should" dedent). But the plan's audit methodology (a textual diff against the source, normalized only for the component name) treats indentation as content, so a full-body dedent made the diff balloon to 367 changed lines even though nothing semantically changed. Since JSX doesn't care about whitespace and the plan explicitly lists five *narrow* sanctioned categories (none of which is "reindent everything"), the correct fix was to keep the original indentation for all untouched lines and let only the five sanctioned edits show up as diff hunks. The result reads with one extra level of indentation than strict nesting would imply (cosmetic only) but is now provably a move, not a rewrite.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repaired whole-body reindentation that blocked Task 2's verification gate**
- **Found during:** Task 2 (mechanical port audit)
- **Issue:** Task 1's port dedented the entire JSX body by one indentation level when removing the two wrapper divs. This is not one of the plan's five sanctioned change categories (wrapper removal/fragment root, import-depth rewrites, onBack prop+header, portal wrap, provenance comment), and it caused the normalized source-to-port diff to balloon to 367 changed lines against the plan's 60-line ceiling — a hard blocker for completing Task 2's verification.
- **Fix:** Rewrote the file, preserving the original `ContactDetailModal` indentation for every line not part of one of the five sanctioned changes. Verified byte-for-byte against the source for all untouched logic (state initializer, handlers, `field`/`select` helpers, JSX field blocks).
- **Files modified:** `app/src/components/panels/ContactPanelBody.jsx`
- **Verification:** Normalized diff dropped to 43 changed lines (< 60 ceiling); all 9 hunks classified into the five sanctioned categories; zero hunks touch any handler body; `cd app && npm run build` exits 0.
- **Committed in:** `2b59e97` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was purely mechanical (whitespace-only) and necessary to satisfy the plan's own verification gate. No behavioral change, no scope creep — the resulting file is functionally identical to what Task 1 produced, just textually closer to the source.

## Issues Encountered
None beyond the reindentation drift documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `ContactPanelBody` is ready for 04-04 to re-point call sites at, once `ApplicationPanelBody` (04-03) also exists.
- No render sites currently import `ContactPanelBody` — it coexists with the still-untouched `ContactDetailModal.jsx` as the plan requires. `git diff --exit-code app/src/components/ContactDetailModal.jsx` confirmed clean.
- The `createPortal` fix for the interaction-logging dialog should be spot-checked visually once 04-04 wires this body into the animated `SidePanel` shell, to confirm the dialog renders centered on the viewport rather than relative to the panel.

---
*Phase: 04-shared-record-side-panel*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: `app/src/components/panels/ContactPanelBody.jsx`
- FOUND: `.planning/phases/04-shared-record-side-panel/04-02-SUMMARY.md`
- FOUND commit `00e39f0` (Task 1)
- FOUND commit `2b59e97` (Task 2)
