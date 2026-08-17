---
phase: 02-unified-attention-feed-today
plan: 6
subsystem: ui
tags: [react, hooks, refactor, attention-feed, timeline-finds]

requires:
  - phase: 02-unified-attention-feed-today
    provides: "TodayTab.jsx's unified attention feed, TimelineFindsPanel's daily-scan chrome (Plan 02-05's timelineFindsCount workaround)"
provides:
  - "app/src/lib/useTimelineFinds.js — a reusable hook owning Timeline Finds' meta/pending/running/error state and the daily-scan effect, decoupled from any component's mount lifecycle"
  - "TimelineFindsPanel.jsx as a pure presentational component (no owned React state/effects)"
  - "TodayTab.jsx calling useTimelineFinds unconditionally above its allEmpty gate, closing the ATTN-01/CR-01(new) scan-lockout gap"
affects: [today-tab, timeline-finds, calendar-integration]

tech-stack:
  added: []
  patterns:
    - "Data-lifecycle hooks (useXyz) called unconditionally by a component that is guaranteed to always mount, so an internal daily/background effect can't get stuck behind a JSX early-return in a child component that only conditionally mounts."

key-files:
  created:
    - app/src/lib/useTimelineFinds.js
  modified:
    - app/src/lib/timelineFinder.js
    - app/src/components/TimelineFindsPanel.jsx
    - app/src/components/TodayTab.jsx

key-decisions:
  - "Implemented Option B (extract the daily-scan trigger into a hook called unconditionally by TodayTab) rather than re-litigating Option A (always-mount TimelineFindsPanel) — Option A was already rejected twice (Plan 02-05, 02-REVIEW.md) for contradicting 02-UI-SPEC.md's all-9-arrays/single-EmptyState contract."
  - "META_KEY/PENDING_KEY string values ported byte-identical into the new hook (not renamed, not exported) so already-persisted user data (staged pending items, lastCheck) is read correctly after the refactor, not reset."
  - "The manual '↻ Rescan' button remains unreachable in the exact all-caught-up state (same as before this plan) — accepted per the plan's own scoping, since the automatic once-daily scan no longer depends on that state at all."

requirements-completed: [ATTN-01]

coverage:
  - id: D1
    description: "useTimelineFinds.js extracted as the sole call site of findTimelineEvents(), with meta/pending/running/error state and scan/dismiss/updateField/approve ported verbatim, plus an enabled-gated daily-scan effect (deps [enabled])"
    requirement: ATTN-01
    verification:
      - kind: other
        ref: "bash grep+esbuild syntax check (Task 1 verify block), see /Users/ethansaba/code/recruiter/app/src/lib/useTimelineFinds.js"
        status: pass
    human_judgment: false
  - id: D2
    description: "TimelineFindsPanel.jsx refactored to pure presentational component (pending/running/error/meta props + onScan/onDismiss/onUpdateField/onApprove callbacks, no owned hooks); TodayTab.jsx calls useTimelineFinds unconditionally above allEmpty, whose first 8 clauses and early-return line are unchanged"
    requirement: ATTN-01
    verification:
      - kind: other
        ref: "bash grep+esbuild+build check (Task 2 verify block); npm run build exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Combined regression sweep across all 4 changed files plus exact change-scope confirmation (git diff against pre-plan base commit e40e456) and a clean production build"
    requirement: ATTN-01
    verification:
      - kind: other
        ref: "bash combined sweep (Task 3 verify block, adapted to diff against base commit e40e456 since sequential-executor task commits land per-task rather than leaving the working tree dirty for git status --porcelain)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live-browser confirmation that the daily scan fires and self-updates the page even from a genuinely all-caught-up state, plus the two carried-forward 02-04/02-05 UAT items"
    verification: []
    human_judgment: true
    rationale: "Requires a live browser session with a specific multi-step localStorage/data sequence and Network-tab observation to confirm real day-boundary-crossing scan behavior — no automated check in this codebase can simulate that. Staged per workflow.human_verify_mode=end-of-phase for the next end-of-phase UAT batch (see Task 3's <human-check> block in 02-06-PLAN.md)."

duration: 5min
completed: 2026-08-17
status: complete
---

# Phase 2 Plan 6: Extract useTimelineFinds hook — close ATTN-01 scan-lockout gap Summary

**Extracted Timeline Finds' daily-scan trigger and all owned state into a new `useTimelineFinds` hook, called unconditionally by `TodayTab` above its `allEmpty` gate, so the background AI scan can never get permanently stuck behind a genuinely-all-caught-up render.**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-08-17
- **Tasks:** 3 completed (2 code tasks + 1 verification/staging task)
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Closed 02-VERIFICATION.md's re-scoped Truth 1/ATTN-01 gap and 02-REVIEW.md's CR-01 (new): the daily Timeline Finds scan (and its `meta.lastCheck`/hash-skip bookkeeping) now runs at least once/day even when the user reaches a genuinely all-caught-up state, because its trigger lives in `TodayTab` (always mounted whenever the Today tab is open) instead of `TimelineFindsPanel` (only conditionally mounted).
- `TimelineFindsPanel.jsx` is now a pure presentational component — zero owned React state/effects — making its render behavior trivially predictable from props alone.
- `02-UI-SPEC.md`'s all-9-arrays/single-page-level-EmptyState contract is untouched: `TimelineFindsPanel`'s mount condition and JSX are byte-identical to before this plan (only its 4 event handlers were rewired to prop callbacks).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract useTimelineFinds.js — decouple the daily-scan trigger from TimelineFindsPanel's mount lifecycle** - `92c68be` (feat)
2. **Task 2: Refactor TimelineFindsPanel.jsx to presentational; wire TodayTab.jsx to call useTimelineFinds unconditionally above the allEmpty gate** - `8b6a237` (refactor)
3. **Task 3: Combined regression sweep + staged live-browser re-check batch** - no code changes (verification-only task, `<files></files>` in the plan); results folded into this summary.

_Note: no separate plan-metadata commit was made prior to this summary — this commit (adding 02-06-SUMMARY.md, STATE.md, ROADMAP.md) serves that role per the standard execute-plan flow._

## Files Created/Modified
- `app/src/lib/useTimelineFinds.js` - New hook: owns `meta`/`pending`/`running`/`error` state and the daily-scan `useEffect` (gated on `enabled`, deps `[enabled]`), plus `scan`/`dismiss`/`updateField`/`approve` — ported verbatim from the former `TimelineFindsPanel.jsx` logic. `META_KEY`/`PENDING_KEY` are module-private, same string values as before.
- `app/src/lib/timelineFinder.js` - Header comment's credit line updated to name `useTimelineFinds.js` instead of the old component filename (comment-only; `findTimelineEvents` untouched).
- `app/src/components/TimelineFindsPanel.jsx` - Rewritten as pure presentational: new signature `{ pending, running, error, meta, onScan, onDismiss, onUpdateField, onApprove }`; no `useState`/`useEffect`/`useMemo`/`useRef`; no longer exports `PENDING_KEY`. JSX markup/copy/styling unchanged; only its 4 event handlers now call prop callbacks.
- `app/src/components/TodayTab.jsx` - Imports `useTimelineFinds` from `../lib/useTimelineFinds.js`; drops `lsGet` and `PENDING_KEY` imports (no longer needed); replaces the `timelineFindsCount`/`setTimelineFindsCount` state pair with a single unconditional `useTimelineFinds({ apps, calls, interactions, contacts, enabled: !isDemoMode })` call positioned above `allEmpty`; `allEmpty`'s Timeline Finds clause now reads `timelineFinds.length === 0` directly; `TimelineFindsPanel`'s mount line passes the hook's returned state/callbacks as named props.

## Decisions Made
- Implemented Option B (hook extraction) per the plan's design — see `key-decisions` in frontmatter for the full rationale on why Option A was rejected again.
- No new UI affordance was added for manually rescanning from the all-caught-up state; the accepted trade-off (per the plan) is that the automatic once-daily scan no longer depends on that state at all, so the primary lockout is closed without it.

## Deviations from Plan

None — plan executed exactly as written, with one execution-model adaptation noted below (not a deviation from the plan's intended outcome).

**Adaptation note (not a deviation):** Task 3's verify script as written in the plan uses `git status --porcelain -- app/src` to confirm the exact 4-file change scope, which assumes an uncommitted working tree at that point. Because this executor commits each task atomically immediately after its own verification passes (per `task_commit_protocol`), the working tree was already clean by the time Task 3 ran. I substituted `git diff --name-only <pre-plan-base-commit> HEAD -- app/src` (base commit `e40e456`, the last commit before this plan's code changes landed) — semantically identical confirmation of the same 4-path change scope, adapted for the sequential per-task-commit execution model. All other Task 3 checks ran exactly as specified and passed.

## Issues Encountered
One self-correction during Task 2: the reworded comment above `allEmpty` initially still contained the literal string `timelineFindsCount` (referencing Plan 02-05's now-removed state variable by name, for context), which tripped Task 2's own acceptance grep (`timelineFindsCount` must not appear anywhere in `TodayTab.jsx`). Reworded to describe the removed workaround without using the literal identifier; re-ran verification, which then passed cleanly. No functional code was affected — comment-only fix, folded into Task 2's commit before it was made (not a separate deviation commit).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Source-level fix for ATTN-01/CR-01(new) is complete and verified deterministically (all 3 tasks' automated checks green, production build succeeds, exact 4-file change scope confirmed). Per `workflow.human_verify_mode=end-of-phase`, the live-browser confirmation batch (3 items — 2 carried forward from 02-04/02-05, 1 new for this plan's fix) remains staged for the phase's still-pending end-of-phase UAT pass; see Task 3's `<human-check>` block in `02-06-PLAN.md` for exact repro steps. No blockers for closing out Phase 2 once that UAT batch runs.

---
*Phase: 02-unified-attention-feed-today*
*Completed: 2026-08-17*

## Self-Check: PASSED

All 4 modified/created files confirmed present on disk; commits `92c68be`, `8b6a237`, and `d892a2c` confirmed in git log.
