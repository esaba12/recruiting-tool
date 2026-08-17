---
phase: 02-unified-attention-feed-today
plan: 5
subsystem: ui
tags: [gap-closure, attention-feed, react-state, today-tab]

# Dependency graph
requires:
  - phase: 02-unified-attention-feed-today
    provides: "app/src/components/TodayTab.jsx (02-02, the allEmpty gate + timelineFindsCount state), app/src/components/TimelineFindsPanel.jsx (02-01, the PENDING_KEY localStorage key + onPendingChange callback)"
provides:
  - "TimelineFindsPanel.jsx's PENDING_KEY exported as a named binding"
  - "TodayTab.jsx's timelineFindsCount initializes synchronously from localStorage on first render, closing the BROKEN ORDERING gap 02-VERIFICATION.md flagged as the sole failing must-have for ATTN-01 (corroborated by 02-REVIEW.md's CR-01)"
affects:
  - "app/src/components/TodayTab.jsx's allEmpty page-level gate — now correct on first render regardless of TimelineFindsPanel's mount order"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lazy useState initializer reading a co-located component's exported localStorage key, mirroring the pattern TimelineFindsPanel.jsx already used for its own `pending` state"

key-files:
  created: []
  modified:
    - app/src/components/TimelineFindsPanel.jsx
    - app/src/components/TodayTab.jsx

key-decisions:
  - "Implemented Approach (a) from both 02-VERIFICATION.md and 02-REVIEW.md's CR-01 (synchronous localStorage read via lazy useState initializer) rather than Approach (b) (always-mount TimelineFindsPanel, rescope allEmpty) — Approach (b) would have rendered the full section stack even when Timeline Finds is the only non-empty category with zero pending items, contradicting 02-UI-SPEC.md line 142's 'in place of the stack' / 'all 9 arrays' framing"
  - "Left allEmpty's boolean expression, the early-return line, and the TimelineFindsPanel mount line byte-identical to before this plan — fix scoped entirely to the initial-value source of timelineFindsCount, per the plan's explicit scope boundary"

patterns-established: []

requirements-completed: [ATTN-01]

coverage:
  - id: D1
    description: "PENDING_KEY is exported from TimelineFindsPanel.jsx with its value and META_KEY's non-exported status unchanged"
    requirement: "ATTN-01"
    verification:
      - kind: unit
        ref: "grep checks for export const PENDING_KEY / single declaration / META_KEY non-export + npx esbuild syntax check"
        status: pass
    human_judgment: false
  - id: D2
    description: "TodayTab.jsx's timelineFindsCount initializes synchronously from localStorage via lsGet(PENDING_KEY) instead of a hardcoded 0; allEmpty/early-return/TimelineFindsPanel-mount lines unchanged; CalendarTab.jsx untouched; production build succeeds"
    requirement: "ATTN-01"
    verification:
      - kind: unit
        ref: "grep checks for lsGet/PENDING_KEY imports, absence of stale useState(0), presence of lsGet(PENDING_KEY), byte-identical allEmpty/early-return/mount lines, zero CalendarTab.jsx diff + npx esbuild syntax check"
        status: pass
      - kind: integration
        ref: "cd app && npm run build"
        status: pass
    human_judgment: false
  - id: D3
    description: "Combined regression sweep re-verifies both tasks' deterministic gates together against the final merged tree, confirms the diff is scoped to exactly the 2 declared files under app/src, and a live-browser re-check of the CR-01 scenario is staged for the next end-of-phase UAT batch"
    requirement: "ATTN-01"
    verification:
      - kind: unit
        ref: "combined grep re-check of both files + git diff --name-only HEAD~2 HEAD -- app/src matching exactly the 2 expected files"
        status: pass
      - kind: integration
        ref: "cd app && npm run build"
        status: pass
    human_judgment: true
    rationale: "The gap was confirmed by a static code trace, not a live browser session — 02-VERIFICATION.md's own Behavioral Spot-Checks table notes this. The source-level fix is provably correct by construction (see Task 2's acceptance criteria), but confirming the actual rendered DOM requires a live session with a specific 8-empty-categories + 1-pending-Timeline-Find data state, deferred to the phase's end-of-phase UAT batch per workflow.human_verify_mode=end-of-phase (same batch 02-04-PLAN.md's still-pending 9-step check is staged for)."

duration: 8min
completed: 2026-08-17
status: complete
---

# Phase 2 Plan 5: Gap Closure — Timeline Finds Attention Gate Ordering Bug (ATTN-01 / CR-01) Summary

**Fixed TodayTab.jsx's page-level "all clear" gate reading a stale hardcoded-0 timelineFindsCount before TimelineFindsPanel ever mounted, by exporting TimelineFindsPanel's PENDING_KEY and initializing timelineFindsCount synchronously from the same localStorage key via a lazy useState initializer.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-17T02:31:00Z (approx.)
- **Completed:** 2026-08-17T02:39:00Z (approx.)
- **Tasks:** 3 completed (2 code tasks + 1 verification-only combined sweep)
- **Files modified:** 2

## Accomplishments
- `TimelineFindsPanel.jsx`'s previously module-private `PENDING_KEY` constant is now `export const PENDING_KEY` — zero behavior change to the file itself, `META_KEY` remains un-exported.
- `TodayTab.jsx` imports `lsGet` from `./jobBoards/helpers.js` and the named `PENDING_KEY` binding from `./TimelineFindsPanel.jsx` (alongside its existing default import), and `timelineFindsCount`'s `useState` call now uses a lazy initializer: `isDemoMode ? 0 : (lsGet(PENDING_KEY) || []).length`. This mirrors `TimelineFindsPanel.jsx`'s own `pending` state's synchronous-from-storage init pattern exactly.
- The code comment above the `allEmpty` gate was reworded to describe the corrected data flow (synchronous initial read via the shared `PENDING_KEY`, kept in sync afterward by `onPendingChange`) instead of the prior comment's now-inaccurate claim that the callback was the only way the count could ever be corrected.
- `allEmpty`'s boolean expression, the `if (allEmpty) return <EmptyState .../>` early-return line, and the `TimelineFindsPanel` mount line at line 445 are byte-identical to before this plan — confirmed via grep in both Task 2's and Task 3's verify steps.
- `app/src/components/CalendarTab.jsx` has zero diff, confirming CR-02 (a separate, out-of-scope defect) was not touched.
- Combined regression sweep (Task 3) re-ran all of Task 1's and Task 2's deterministic checks together against the fully merged tree, confirmed `git diff --name-only` under `app/src` matches exactly `app/src/components/TimelineFindsPanel.jsx` and `app/src/components/TodayTab.jsx`, and `cd app && npm run build` succeeds cleanly.
- The live-browser re-confirmation of the exact CR-01 scenario (8 empty categories + 1 real pending Timeline Finds item) is staged in this plan's Task 3 `<human-check>` block for the phase's next end-of-phase UAT batch, per `workflow.human_verify_mode=end-of-phase` — the same batch 02-04-PLAN.md's still-pending 9-step check is staged for.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Export PENDING_KEY from TimelineFindsPanel.jsx | `b9898cc` | app/src/components/TimelineFindsPanel.jsx |
| 2 | Initialize TodayTab.jsx's timelineFindsCount synchronously from localStorage | `5c2e7ec` | app/src/components/TodayTab.jsx |
| 3 | Combined regression sweep + staged live-browser re-check | N/A (verification-only, no `<files>` listed) | — |

## Files Created/Modified

- `app/src/components/TimelineFindsPanel.jsx` — `PENDING_KEY` constant declaration gained `export`; no other line changed.
- `app/src/components/TodayTab.jsx` — `lsGet` added to the `./jobBoards/helpers.js` import; `PENDING_KEY` added as a named import alongside the default `TimelineFindsPanel` import; `timelineFindsCount`'s `useState(0)` replaced with a lazy initializer reading `lsGet(PENDING_KEY)`; the comment above `allEmpty` reworded. `allEmpty`, the early-return, and the `TimelineFindsPanel` mount line are unchanged.

## Decisions Made
- Implemented Approach (a) — synchronous localStorage read via lazy `useState` initializer — as specified by both 02-VERIFICATION.md's `missing` list and 02-REVIEW.md's CR-01 proposed fix, rejecting Approach (b) (always-mount `TimelineFindsPanel`, rescope `allEmpty` to the other 8 arrays) because it would change visible behavior beyond what's needed to close the gap (rendering the full section stack even when Timeline Finds is the only non-empty category and has zero pending items itself, contradicting 02-UI-SPEC.md line 142's literal "all 9 arrays" / "in place of the stack" contract).
- Kept the fix strictly scoped to the initial-value source of `timelineFindsCount` — `allEmpty`'s expression, the early-return line, and the `TimelineFindsPanel` mount line are all byte-identical to before this plan, verified via grep in both Task 2 and Task 3.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' automated verify blocks passed on the first attempt with no fix-up needed.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. This is a client-side-only React state fix; no new environment variables, migrations, or manual setup steps.

## Threat Flags

None — this plan's `<threat_model>` register (T-02-09 Information Disclosure, T-02-10 Tampering) covers the only surface this fix touches (one additional synchronous read of an already-locally-readable `localStorage` key, one render earlier than before); both are dispositioned `accept` with no new trust boundary crossed. No new files/endpoints/schema introduced.

## Next Phase Readiness

- ATTN-01's sole failing must-have (Truth 1 / Success Criterion 1, per 02-VERIFICATION.md) is now provably closed at the source level: `timelineFindsCount` initializes correctly on first render regardless of `TimelineFindsPanel`'s mount order, so the `allEmpty` gate can no longer incorrectly show the page-level "Nothing needs your attention" EmptyState when real pending Timeline Finds items exist and all 8 other categories are empty.
- Final re-verification of ATTN-01 as fully closed depends on the staged live-browser check (Task 3's `<human-check>` block) confirming the actual rendered DOM in the specific 8-empty + 1-pending combined data state — deferred to the phase's next end-of-phase UAT batch alongside 02-04-PLAN.md's still-pending 9-step check.
- No blockers. No stubs. `app/src/components/CalendarTab.jsx`'s separate CR-02 defect remains untouched and out of scope for this plan, as stated in the plan's Objective.

---
*Phase: 02-unified-attention-feed-today*
*Completed: 2026-08-17*

## Self-Check: PASSED

All files found on disk (`02-05-SUMMARY.md`, `app/src/components/TimelineFindsPanel.jsx`, `app/src/components/TodayTab.jsx`); both task commit hashes (`b9898cc`, `5c2e7ec`) confirmed present in git log.
