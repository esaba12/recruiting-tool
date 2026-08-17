---
phase: 02-unified-attention-feed-today
verified: 2026-08-17T03:15:00Z
status: gaps_found
score: 2/3 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/3
  gaps_closed:
    - "Truth 1's original defect (timelineFindsCount initialized to a stale hardcoded 0, so the allEmpty gate could hide a genuinely non-empty Timeline Finds section on first render) is confirmed fixed by Plan 02-05 — TodayTab.jsx:355-356 now initializes timelineFindsCount synchronously from lsGet(PENDING_KEY), independently corroborated by 02-REVIEW.md's re-review ('CR-01 (original) is confirmed fixed')."
  gaps_remaining: []
  regressions:
    - "A new, closely-related Critical bug was found by 02-REVIEW.md's re-review pass (CR-01, new numbering, same ID reused for the new finding) that the 02-05 gap-closure plan did not touch and no follow-up commit has since addressed: TodayTab.jsx's allEmpty early-return still gates whether TimelineFindsPanel mounts at all, and TimelineFindsPanel is the only call site in the entire app for findTimelineEvents() (the daily background scan). Once a user reaches a genuinely all-caught-up state (all 8 lib/attention.js arrays empty AND timelineFindsCount is genuinely 0), TodayTab returns <EmptyState/> before TimelineFindsPanel ever mounts, so the scan that would discover new Timeline-Finds-worthy dates from fresh call notes/application updates/interactions never runs again — on that visit or any later one — until some unrelated attention item happens to appear elsewhere. There is no manual 'Rescan' escape hatch available in that state either, since the button lives inside the unmounted panel. This is reported as a fresh gap below (re-scoped Truth 1 / ATTN-01), not carried over from the original VERIFICATION.md gap, which is why gaps_remaining is empty but a new gap is listed."
gaps:
  - truth: "User visits Today and sees one feed combining overdue follow-ups, stale applications, the Keep in Touch queue, Job Boards' Needs-Review bucket, and Timeline Finds."
    status: partial
    reason: "The literal first-render defect from the prior verification pass (stale timelineFindsCount=0 hiding a non-empty Timeline Finds section) is fixed by Plan 02-05 and independently confirmed by 02-REVIEW.md's re-review. However, that same re-review found a new, unresolved Critical bug one level up in the same gating logic: TodayTab.jsx's allEmpty early-return still controls whether TimelineFindsPanel mounts at all, and TimelineFindsPanel is the sole call site of findTimelineEvents() (the daily AI scan over application notes/calls/interactions that discovers new calendar-worthy dates) in the whole codebase — confirmed by a repo-wide grep showing exactly one call site, inside TimelineFindsPanel's mount effect. Once a user reaches a genuinely caught-up state (all 8 other arrays empty AND 0 pending Timeline Finds), TodayTab returns the page-level EmptyState before TimelineFindsPanel ever mounts, so meta.lastCheck (TimelineFindsPanel's own state, the 'have we scanned today?' gate) can never advance, no manual Rescan button is rendered anywhere, and the daily scan is permanently stuck — not just for that render, but for every subsequent visit, since TodayTab fully unmounts/remounts per tab switch and re-reads the same stuck localStorage state. The sidebar's today nav badge also excludes Timeline Finds from its count, so there is no other UI surface that would ever reveal this is happening. This directly undermines Success Criterion 1's 'combining ... Timeline Finds' framing on a durability basis: the unified feed does not reliably keep including live Timeline Finds signal over time for a user who ever reaches the caught-up state the app is explicitly designed to converge users toward — it only resumes scanning if some unrelated attention item happens to reappear first, an incidental and unreliable escape path. Confirmed directly against current source (not just SUMMARY.md/REVIEW.md claims): TodayTab.jsx:380-384 (gate + early return), :448 (panel mount, downstream of the gate), TimelineFindsPanel.jsx:58-63 (scan-on-mount effect gated on the same component's own mount), and a repo-wide grep confirming findTimelineEvents has exactly one call site."
    artifacts:
      - path: "app/src/components/TodayTab.jsx"
        issue: "Lines 380-384 (allEmpty + early-return) still gate TimelineFindsPanel's mount (line 448) on the current attention counts, and TimelineFindsPanel is the sole owner of the daily background scan's mount-triggered kickoff and its only manual rescan control. When the gate is true, the scanning component never mounts, so the scan can never run and there is no escape hatch."
      - path: "app/src/components/TimelineFindsPanel.jsx"
        issue: "Lines 58-63: the 'has today's scan run yet?' effect and the '↻ Rescan' button (lines 98-101) both live inside this component, which is only reachable through TodayTab's post-gate JSX branch — so both are unreachable in the exact state this bug describes."
    missing:
      - "Decouple TimelineFindsPanel's mount from the allEmpty gate — either (Option A, per 02-REVIEW.md's proposed fix, the smaller change) always render TimelineFindsPanel and rescope allEmpty/the page-level EmptyState to only the other 8 sections (TimelineFindsPanel already renders its own internal 'Nothing pending' empty state), or (Option B) move the 'has today's scan run?' check + scan() call out of TimelineFindsPanel's mount lifecycle into a hook that runs regardless of whether the panel itself is rendered."
deferred: []
---

# Phase 2: Unified Attention Feed (Today) Verification Report

**Phase Goal:** Users see one unified "what needs my attention" feed instead of 5 fragmented surfaces scattered across the app.
**Verified:** 2026-08-17T03:15:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap closure (Plan 02-05, closing the original Truth 1 / ATTN-01 defect), now finding a distinct, closely-related unresolved defect surfaced independently by this phase's own code review pass.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User visits Today and sees one feed combining overdue follow-ups, stale applications, the Keep in Touch queue, Job Boards' Needs-Review bucket, and Timeline Finds. | ✗ FAILED (partial) | Original defect (stale `timelineFindsCount` init) fixed and confirmed (`TodayTab.jsx:355-356`, `lsGet(PENDING_KEY)`). But a new, currently-unresolved defect makes the "combining ... Timeline Finds" promise unreliable over time: `TimelineFindsPanel` (the sole call site of `findTimelineEvents()`, the daily background scan) only ever mounts when `allEmpty` is false — so once a user reaches a genuinely caught-up state, the scan permanently stops, with no manual rescan escape hatch reachable in that state. See gap below. |
| 2 | User clicks any attention item and lands directly on its full contact/application/job record in one click. | ✓ VERIFIED | Unchanged since the prior verification pass — re-confirmed directly against current source. Contact rows (`OverdueRow`, `ScheduleRow`, `HighUrgencyRow`, `KeepInTouchRow`) wire `onClick`/`onOpen` → `setSelectedContactId` → `ContactDetailModal` (`TodayTab.jsx:450-460`). Application rows (`ApplicationRow`, `OaRow`) wire `onOpen` → `setSelectedAppId` → `ApplicationDetailModal`, `onFindPeople={onFindPeople}` present verbatim (`TodayTab.jsx:469-484`), threaded from `App.jsx`'s real `goFindPeople` closure. Timeline Finds' documented exception (D-04b) remains a deliberate, pre-planned scope decision, not a gap. |
| 3 | The standalone Actions tab, Overview's separate nudge section, Keep in Touch's standalone queue view, and TimelineFindsPanel's standalone presentation are gone — not left running in parallel as a 9th destination. | ✓ VERIFIED | `app/src/components/ActionsTab.jsx` absent from disk; repo-wide grep for `ActionsTab`/`'actions'` returns zero hits. `OverviewTab.jsx` has no nudge/"needs attention" block (grep confirms zero matches). `KeepInTouchTab.jsx` still exists as a file but is never imported/rendered anywhere in `app/src/` (confirmed by grep — zero `import.*KeepInTouchTab` / `<KeepInTouchTab` hits); `App.jsx`'s `NETWORK_VIEWS` has no `keepintouch` entry (`table/cards/graph/coverage/outbox/discover` only). `CalendarTab.jsx` has zero references to `TimelineFindsPanel` — its sole mount is inside `TodayTab.jsx`. `Sidebar.jsx`'s `NAV_ITEMS` leads with `{ id: 'today' }` and has no `{ id: 'actions' }` entry. |

**Score:** 2/3 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `app/src/lib/attention.js` | 8 named derivation functions + `keepInTouchDue` re-export | ✓ VERIFIED | Unchanged since prior pass; all 8 functions + re-export present, imported by name (not reimplemented) in `TodayTab.jsx:5`. |
| `app/src/components/TodayTab.jsx` | Unified 9-section attention feed, default export `TodayTab` | ⚠️ HOLLOW (partial) | File exists, builds cleanly, all 9 sections present in correct order — but the page-level gate (lines 380-384) still has a real, currently-unresolved logic defect: it silently stops the Timeline Finds daily scan once the user is caught up (see Truth 1's gap). |
| `app/src/components/TimelineFindsPanel.jsx` | Section-matching chrome + `onPendingChange` prop, `PENDING_KEY` exported | ✓ VERIFIED (chrome/wiring) — ⚠️ contributes to Truth 1's gap (mount-lifecycle coupling) | `export const PENDING_KEY` present (Plan 02-05 Task 1); `onPendingChange` fires via `useEffect` on every `pending` change; chrome/approve/dismiss/updateField unchanged. But this is also the sole owner of the daily-scan trigger and the only Rescan control, both unreachable when `TodayTab`'s gate hides the panel. |
| `app/src/lib/icons.js` | `NAV_ICON.today` (Gauge), `NAV_ICON.actions` removed | ✓ VERIFIED | Unchanged since prior pass. |
| `app/src/components/layout/Sidebar.jsx` | `NAV_ITEMS` leads with Today, no Actions entry | ✓ VERIFIED | `NAV_ITEMS[0] = { id: 'today', label: 'Today' }`; no `id: 'actions'` anywhere. |
| `app/src/App.jsx` | `AppInner`/`DemoApp` render `TodayTab`; `NETWORK_VIEWS` drops `keepintouch` | ✓ VERIFIED | Confirmed directly; `NETWORK_VIEWS` = table/cards/graph/coverage/outbox/discover. |
| `app/src/components/ActionsTab.jsx` | Deleted | ✓ VERIFIED | Absent from disk; zero repo-wide references. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `TodayTab.jsx` contact rows | `ContactDetailModal` | `onOpen(c)` → `setSelectedContactId` → conditional mount | ✓ WIRED | Confirmed at current line numbers 450-460. |
| `TodayTab.jsx` application rows | `ApplicationDetailModal` | `onOpen(a)` → `setSelectedAppId` → conditional mount | ✓ WIRED | Confirmed at 469-484, including `onFindPeople={onFindPeople}`. |
| `App.jsx` (`AppInner`) | `TodayTab.jsx` | `goFindPeople` closure passed as `onFindPeople` prop | ✓ WIRED | Unchanged since prior pass. |
| `lib/attention.js` exports | `TodayTab.jsx` imports | named import, not reimplementation | ✓ WIRED | Unchanged since prior pass. |
| `TimelineFindsPanel.jsx`'s `onPendingChange` | `TodayTab.jsx`'s `timelineFindsCount` state | `setTimelineFindsCount` passed as the prop, initial value now read synchronously from `localStorage` | ✓ FIXED (first-render ordering) | Original "BROKEN ORDERING" finding closed by Plan 02-05 — confirmed at `TodayTab.jsx:355-356`. |
| `TodayTab.jsx`'s `allEmpty` gate | `TimelineFindsPanel.jsx`'s mount (and therefore its scan-on-mount effect + Rescan button) | conditional render at line 448, downstream of the early-return at line 384 | ✗ NOT WIRED FOR DURABILITY | The gate that gained a correct *first-render* value from Plan 02-05 is the same gate that unconditionally prevents the scanning component from ever mounting once genuinely caught up — this is the new gap. Confirmed by repo-wide grep: `findTimelineEvents` has exactly one call site, inside `TimelineFindsPanel.jsx`'s mount effect (lines 58-63), and that component is only reachable past the `allEmpty` early-return. |
| `CalendarTab.jsx` | `TimelineFindsPanel.jsx` | mount removed | ✓ CONFIRMED REMOVED | Unchanged since prior pass. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| ATTN-01 | 02-01, 02-02, 02-03, 02-05 | Unified feed on Today combining 5 surfaces | ⚠️ PARTIALLY BLOCKED | All 5 categories' derivation/rendering logic exists and is wired, and the original first-render gate defect is fixed — but the feed cannot reliably keep "combining ... Timeline Finds" over time once a user reaches a caught-up state, because the only component that can ever refresh Timeline Finds data stops being mountable in that state. REQUIREMENTS.md currently marks ATTN-01 `[x]`/`Complete`, which this verification pass does not confirm as fully accurate given the newly-found, still-open regression. |
| ATTN-02 | 02-02, 02-03 | Each item deep-links to its full record in one click | ✓ SATISFIED | Unchanged since prior pass; re-confirmed directly against current source. |
| ATTN-03 | 02-03 | Old surfaces removed, not duplicated | ✓ SATISFIED | Unchanged since prior pass; re-confirmed directly against current source, including the now-orphaned (never-imported) `KeepInTouchTab.jsx` file. |

REQUIREMENTS.md maps exactly ATTN-01/02/03 to Phase 2 — no orphaned requirements found. Note: REQUIREMENTS.md's checklist currently shows ATTN-01 as `[x]` complete and the coverage table as "Complete" — this verification pass finds that status premature given the open gap below.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/src/components/TodayTab.jsx` / `TimelineFindsPanel.jsx` | `TodayTab.jsx:380-384,448`; `TimelineFindsPanel.jsx:58-63` | Scanning component's mount (and therefore its only scan-trigger and only manual-rescan control) is gated behind a page-level "nothing to show" early return | 🛑 Blocker | Directly causes Truth 1's gap — the daily Timeline Finds scan can permanently stop running once a user is caught up, with no escape hatch. Independently found and documented as CR-01 in the current `02-REVIEW.md` (post-02-05 re-review); no follow-up commit has landed since (`git log` for both files ends at 02-05's commits, `b9898cc`/`5c2e7ec`). |
| `app/src/components/TodayTab.jsx` | 81-83, 136-138, 306-308 | Silent `catch { setMarking(false) }` with no user-visible error surface on 3 inline mutation handlers | ⚠️ Warning | Carried forward from prior review pass (WR-06), unresolved. Not blocking this phase's stated success criteria (happy path fully functional), noted for completeness. |
| `app/src/components/TodayTab.jsx`, `App.jsx`, `CalendarTab.jsx` | various | `changeAppTriage`/`handleMet` mutation calls with no `try`/`catch` at call sites | ⚠️ Warning | Carried forward (WR-07), unresolved. Same disposition as above. |
| `app/src/components/OverviewTab.jsx` | 36 | `hasRecruitingActivity = apps.length > 0` ignores `isUntriaged()` policy | ⚠️ Warning | Carried forward (WR-01), pre-existing, out of this phase's scope. |
| `app/src/components/CalendarTab.jsx` | 47,102-105,291,299 | Feed view never refreshes `feedEvents` after create/delete | ⚠️ Warning | Carried forward as CR-02 in `02-REVIEW.md`, explicitly out of scope for Plan 02-05 (its Objective states CR-02 is a separate defect). Does not block Phase 2's stated success criteria (Calendar is not one of the 5 unified surfaces), noted for completeness. |

No debt markers (`TBD`/`FIXME`/`XXX`) found in `TodayTab.jsx` or `TimelineFindsPanel.jsx`. `cd app && npm run build` succeeds cleanly (3782 modules, 2.40s, no errors beyond the pre-existing chunk-size notice).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full production build compiles with TodayTab reachable from the entry point | `cd app && npm run build` | 3782 modules transformed, built in 2.40s, zero errors | ✓ PASS |
| `findTimelineEvents` has exactly one call site in the codebase (confirms the new gap's mechanism) | `grep -rn "findTimelineEvents" app/src/` | 2 hits: the export in `lib/timelineFinder.js` and the one call in `TimelineFindsPanel.jsx:39` | ✓ CONFIRMED (bug mechanism verified) |
| `timelineFindsCount` reads real `localStorage` state on first render (Plan 02-05's fix) | `grep -n "lsGet(PENDING_KEY)" app/src/components/TodayTab.jsx` | Present at line 356, inside the `useState` lazy initializer | ✓ PASS |
| `KeepInTouchTab.jsx` is orphaned (ATTN-03 regression check) | `grep -rn "import.*KeepInTouchTab\|<KeepInTouchTab" app/src/` | Zero hits | ✓ PASS |
| Repo-wide ATTN-03 grep (`ActionsTab`/`'actions'`) | `grep -rn "ActionsTab\|'actions'" app/src/` | Zero hits | ✓ PASS |

### Human Verification Required

No `02-UAT.md` exists yet for this phase. The phase's own `02-04-PLAN.md` Task 2 staged a 9-step human-check (nav order, section order/rendering, deep-link click-throughs, Timeline Finds chrome, Overview/Calendar/Network cleanup, `/demo` route) for end-of-phase UAT review, and `02-05-PLAN.md` Task 3 staged an additional live-browser re-check of the original CR-01 scenario — neither has been run yet. Given this pass's newly-confirmed regression, add one more scenario to that same batch:

1. **Test:** Run the full 9-step human-check staged in `02-04-PLAN.md` Task 2 plus the CR-01 (original) re-check staged in `02-05-PLAN.md` Task 3 (an account with all 8 non-Timeline-Finds categories empty but a real pending Timeline Finds item present — confirm the section renders, not the page-level EmptyState).
   **Expected:** All steps pass as described in those plans.
   **Why human:** Visual/interaction confirmation in a live browser — deferred to end-of-phase per `workflow.human_verify_mode=end-of-phase`.
2. **Test (new, for the CR-01/new regression once fixed):** With a real signed-in account, reach a genuinely all-caught-up state (all 9 sections empty, including 0 pending Timeline Finds), leave the account in that state across a simulated day boundary (e.g. manually clear/backdate `rec_timeline_meta`'s `lastCheck` in devtools, or wait a real day), add a new future-dated item to a call note/application/interaction that `findTimelineEvents()` should detect, then reload Today.
   **Expected (once the fix from this gap lands):** The daily scan still runs and the new item surfaces in Timeline Finds, even though the user was in the all-caught-up state on the prior visit.
   **Why human:** Requires a live browser session with a specific multi-day, multi-state data sequence; no automated check in this codebase can simulate real day-boundary crossing or verify the AI scan's actual output.

### Gaps Summary

Plan 02-05 correctly and verifiably closed the exact defect the prior `02-VERIFICATION.md` flagged: `timelineFindsCount` no longer starts at a stale hardcoded `0` — it reads the real `rec_timeline_pending` localStorage state synchronously on first render, via `TimelineFindsPanel`'s newly-exported `PENDING_KEY`. This was independently corroborated by a fresh code review pass (`02-REVIEW.md`, re-review), which explicitly confirms "CR-01 (original) is confirmed fixed."

However, that same re-review traced the surrounding code further and found a new, closely-related, still-unresolved Critical bug in the exact same gating mechanism: `TodayTab.jsx`'s `allEmpty` early-return doesn't just decide whether to show a page-level empty state — it also decides whether `TimelineFindsPanel` mounts at all, and `TimelineFindsPanel` is the only place in the entire codebase that ever calls `findTimelineEvents()` (the daily AI scan that discovers new calendar-worthy dates from call notes/application updates/interactions). Once a user reaches the exact "you're all caught up" state the app is designed to converge users toward, the scanning component never mounts, so the scan can never run again — not on that visit, not on any later one — until some unrelated attention item happens to appear and incidentally unlocks the gate. There is no manual "Rescan" escape hatch reachable in that state either, since the button lives inside the same unmounted panel. This was independently confirmed in this verification pass by a repo-wide grep showing `findTimelineEvents` has exactly one call site, and by direct reading of the current `TodayTab.jsx`/`TimelineFindsPanel.jsx` source (not just the SUMMARY.md/REVIEW.md narrative).

This bears directly on Success Criterion 1 and ATTN-01: the unified feed's promise to combine "overdue follow-ups, stale applications, the Keep in Touch queue, Job Boards' Needs-Review bucket, and Timeline Finds" is not durable — for any user who reaches a caught-up state, the Timeline Finds component of that promise silently and permanently stops functioning, with no visible signal (the sidebar's `today` badge also excludes Timeline Finds) and no user-facing recovery path. This is a regression in the phase's core "reliably live over time" value proposition, not merely a first-paint cosmetic issue, and REQUIREMENTS.md's current `[x]` marking of ATTN-01 as Complete is premature until it's addressed.

No commit fixing this new finding has landed since `02-REVIEW.md` was written — `git log` for both `TodayTab.jsx` and `TimelineFindsPanel.jsx` still ends at Plan 02-05's commits (`b9898cc`, `5c2e7ec`). `02-REVIEW.md` proposes a small, well-scoped fix (Option A: always render `TimelineFindsPanel`, since it already renders its own internal "Nothing pending" empty state, and rescope the page-level `allEmpty`/`EmptyState` to only the other 8 sections). Recommend routing this back through `/gsd-plan-phase --gaps` before closing this phase, followed by the still-pending end-of-phase human UAT batch (both `02-04-PLAN.md`'s 9-step check and `02-05-PLAN.md`'s CR-01-original re-check, plus the new CR-01/new day-boundary scenario staged above), none of which have been run yet.

---

_Verified: 2026-08-17T03:15:00Z_
_Verifier: Claude (gsd-verifier)_
