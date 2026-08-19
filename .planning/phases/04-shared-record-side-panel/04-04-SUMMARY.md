---
phase: 04-shared-record-side-panel
plan: 04
subsystem: ui
tags: [react, jsx, refactor, side-panel, call-site-migration]

# Dependency graph
requires:
  - phase: 04-shared-record-side-panel (plan 01)
    provides: useMediaQuery hook, SidePanel shell, JobPanelBody
  - phase: 04-shared-record-side-panel (plan 02)
    provides: ContactPanelBody
  - phase: 04-shared-record-side-panel (plan 03)
    provides: ApplicationPanelBody, D-05 in-place record swap
provides:
  - "All 9 record render sites re-pointed to SidePanel + the matching *PanelBody"
  - "Three legacy record modal files deleted (ContactDetailModal.jsx, ApplicationDetailModal.jsx, jobBoards/JobDetailModal.jsx)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Call-site migration pattern: replace legacy `<XDetailModal ...props />` with `<SidePanel open onClose={...}><XPanelBody ...props /></SidePanel>`, carrying the exact prop set (including pre-existing omissions) forward unchanged"

key-files:
  created: []
  modified:
    - app/src/App.jsx
    - app/src/components/ReferralCoverageTab.jsx
    - app/src/components/TodayTab.jsx
    - app/src/components/CalendarTab.jsx
    - app/src/components/PipelineTab.jsx
    - app/src/components/jobBoards/RepoJobsView.jsx

key-decisions:
  - "Preserved every pre-existing prop omission exactly as documented in the plan (Calendar's reduced contact/application prop sets, Coverage's missing onRefreshRelationships) rather than 'fixing' them as a side effect of the port, per 04-RESEARCH.md Pitfall 4"
  - "Deleted the three legacy modal files only after both edits building clean (Task 3 sequencing), confirming zero regression before removing the fallback source files"

patterns-established:
  - "Record-panel call-site migration: shell wraps body 1:1 per render site, no shared host component needed at the call-site level since SidePanel/*PanelBody already carry that composition"

requirements-completed: [PANEL-01, PANEL-02]

coverage:
  - id: D1
    description: "All 8 non-nested render sites (App.jsx contact, TodayTab contact+application, CalendarTab contact+application, ReferralCoverageTab contact, PipelineTab application, RepoJobsView job) render through the shared SidePanel shell with byte-identical prop sets to their pre-migration modal calls, including every pre-existing omission (Calendar's 3 omissions, Coverage's 1 omission) preserved unchanged."
    requirement: "PANEL-01"
    verification:
      - kind: other
        ref: "grep-based structural checks per task (SidePanel/body render counts, zero legacy-modal references, exact prop-omission counts) plus cd app && npm run build (exit 0) after each task"
        status: pass
    human_judgment: false
  - id: D2
    description: "The three legacy record modal files (ContactDetailModal.jsx, ApplicationDetailModal.jsx, jobBoards/JobDetailModal.jsx) are deleted with zero dangling imports or JSX renders anywhere in app/src; EventDetailModal.jsx (a different, still-live component) and ui/Modal.jsx (the untouched out-of-scope primitive) are both confirmed intact."
    requirement: "PANEL-01"
    verification:
      - kind: other
        ref: "grep -rEn '<(Contact|Application|Job)DetailModal' and 'from .*(Contact|Application|Job)DetailModal.jsx' both return 0 repo-wide; git diff --exit-code on ui/Modal.jsx succeeds; test -f on EventDetailModal.jsx succeeds; cd app && npm run build exits 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Repo-wide render/body counts match the phase's expected totals: 8 <SidePanel> renders, 5 <ContactPanelBody> (4 top-level + 1 inside ApplicationPanelBody's D-05 swap), 3 <ApplicationPanelBody>, 1 <JobPanelBody>."
    requirement: "PANEL-02"
    verification:
      - kind: other
        ref: "grep -rn counts across app/src --include='*.jsx': SidePanel=8, ContactPanelBody=5, ApplicationPanelBody=3, JobPanelBody=1"
        status: pass
    human_judgment: false
  - id: D4
    description: "The app's actual UI behavior at all 9 render sites (panel opens/closes correctly, create paths work, D-05 swap works, Calendar's reduced-prop sites don't crash) has not been exercised in a running browser this plan — structural/grep verification and a passing production build are the strongest proof available."
    verification: []
    human_judgment: true
    rationale: "This plan runs headless in a worktree with no browser available; per workflow.human_verify_mode=end-of-phase, live click-through verification (opening a contact/application/job from each of the 8 sites, exercising create-mode on Network/Coverage/Pipeline, and confirming the D-05 dossier-contact swap + back button) is staged for the end-of-phase human review rather than run inline in this plan."

# Metrics
duration: ~12min
completed: 2026-08-19
status: complete
---

# Phase 04 Plan 04: Re-point All Record Render Sites to SidePanel Summary

**Re-pointed all 8 non-nested record render sites across 6 files to `<SidePanel>` + the matching `*PanelBody`, then deleted the three legacy record modal files — PANEL-01 is now fully delivered.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-19T05:14:03Z (approx, first task commit)
- **Completed:** 2026-08-19T05:16:39Z (last task commit)
- **Tasks:** 3
- **Files modified:** 6 (App.jsx, ReferralCoverageTab.jsx, TodayTab.jsx, CalendarTab.jsx, PipelineTab.jsx, jobBoards/RepoJobsView.jsx) + 3 deleted (ContactDetailModal.jsx, ApplicationDetailModal.jsx, jobBoards/JobDetailModal.jsx)

## Accomplishments
- All 6 call-site files now import `SidePanel` from `ui/` and the matching body from `panels/`, with every render site's prop set carried forward byte-for-byte from its pre-migration modal call
- Every pre-existing prop omission (Calendar's 3, Coverage's 1) preserved exactly — no site gained a capability it didn't have before
- The three legacy record modal files (`ContactDetailModal.jsx`, `ApplicationDetailModal.jsx`, `jobBoards/JobDetailModal.jsx`) are deleted; repo-wide grep confirms zero remaining imports or JSX renders of any of the three
- `ui/Modal.jsx` (still serving `LogInteractionModal`, `QuickAddContactModal`, `AddToCalendarModal`) and `EventDetailModal.jsx` (a different, still-live component used by `CalendarTab.jsx`) both confirmed untouched
- Production build (`cd app && npm run build`) passes clean after every task, including immediately before and after the three deletions

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-point the contact-only call sites (App.jsx, ReferralCoverageTab.jsx)** - `de001ef` (feat)
2. **Task 2: Re-point the dual-record call sites (TodayTab.jsx, CalendarTab.jsx)** - `a08df40` (feat)
3. **Task 3: Re-point Pipeline and Job Boards, then delete the three legacy modal files** - `022d919` (feat)

_No plan-metadata commit in this session — SUMMARY.md is committed separately per worktree-mode instructions; STATE.md/ROADMAP.md updates are owned by the orchestrator after all wave agents complete._

## Files Created/Modified
- `app/src/App.jsx` - NetworkTab's contact render site wrapped in SidePanel; two `refreshContactRelationships` comments reworded to stop naming the deleted modal file
- `app/src/components/ReferralCoverageTab.jsx` - `addingFor` contact-create render site wrapped in SidePanel, `onRefreshRelationships` omission preserved
- `app/src/components/TodayTab.jsx` - contact and application render sites wrapped in SidePanel; `changeAppTriage` comment reworded
- `app/src/components/CalendarTab.jsx` - contact and application render sites wrapped in SidePanel, all 3 pre-existing prop omissions preserved
- `app/src/components/PipelineTab.jsx` - application render site (incl. `addingNew` create path) wrapped in SidePanel
- `app/src/components/jobBoards/RepoJobsView.jsx` - job render site wrapped in SidePanel
- `app/src/components/ContactDetailModal.jsx` - **deleted**
- `app/src/components/ApplicationDetailModal.jsx` - **deleted**
- `app/src/components/jobBoards/JobDetailModal.jsx` - **deleted**

## Render Sites — Before/After Prop Counts

| # | File | Record | Prop count (unchanged) | Notes |
|---|------|--------|------------------------|-------|
| 1 | `App.jsx` (NetworkTab) | contact | 7 | Full set; `contact` still derives from `editing === 'new' ? null : editing` |
| 2 | `TodayTab.jsx` | contact | 7 | Full set |
| 3 | `TodayTab.jsx` | application | 12 | Full set |
| 4 | `CalendarTab.jsx` | contact | 4 | Omits `interactions`, `contactRelationships`, `onRefreshRelationships` (preserved) |
| 5 | `CalendarTab.jsx` | application | 4 | Omits `contacts`, `apps`, `interactions`, `relationships`, `onSaved`, `onFindPeople`, `onRefresh`, `onRefreshRelationships` (preserved) |
| 6 | `ReferralCoverageTab.jsx` | contact | 7 | Create mode (`contact={null}` + `initial`); omits `onRefreshRelationships` (preserved) |
| 7 | `PipelineTab.jsx` | application | 12 | Full set; exercises create mode via `addingNew` |
| 8 | `jobBoards/RepoJobsView.jsx` | job | 8 | Full set |
| 9 | `ApplicationPanelBody.jsx` (D-05 swap) | nested contact | 8 | Already migrated in 04-03 as the in-place swap; unaffected by this plan's file deletions since the swap host was already `ApplicationPanelBody.jsx`, not the deleted `ApplicationDetailModal.jsx` |

Repo-wide totals confirmed by grep: 8 `<SidePanel` renders, 5 `<ContactPanelBody` (4 top-level + 1 D-05 swap), 3 `<ApplicationPanelBody`, 1 `<JobPanelBody`.

## Decisions Made
- Carried every pre-existing prop omission forward exactly as the plan specified — did not thread `interactions`/`contactRelationships`/`onRefreshRelationships`/`onFindPeople`/etc. into Calendar's or Coverage's reduced call sites "while in there." This is a deliberate no-op decision, not an oversight: 04-RESEARCH.md Pitfall 4 is explicit that quietly changing behavior at these sites during the port is out of scope for this phase.
- Deleted the three legacy modal files only after both call-site edit tasks were independently verified building clean (Task 3's own sequencing: edits first, `npm run build` gate, deletions last) — confirms the deletions are pure cleanup with zero functional dependency remaining, not a risky simultaneous swap-and-delete.
- Left the three historical-provenance comments that still name the old modal files (`shared.jsx`'s Interaction-channel-colors comment, `ui/ChipToggleGroup.jsx`'s extraction note, `QuickScheduleModal.jsx`'s form reference) untouched, per the plan's explicit instruction — these are accurate statements about code provenance in files this plan otherwise does not touch, not stale references to a live import.

## Pre-existing findings, not fixed this phase

Per Task 2's explicit instruction (04-RESEARCH.md Pitfall 4), the following pre-existing conditions were investigated but deliberately left unfixed since fixing them would be an unplanned behavior change:

- **Confirmed safe, no crash risk:** Traced whether Calendar's reduced application prop set (omitting `contacts`, `interactions`, `apps`, `relationships`) could crash `ApplicationPanelBody`'s `NetworkAtCompany` sub-component (which calls `companyCoverage(company, contacts, interactions)` — and `companyCoverage` does an unguarded `contacts.filter(...)`). Verified via `git show` against the pre-deletion `ApplicationDetailModal.jsx` that the original modal's top-level destructuring already defaulted these props (`contacts = []`, `apps = []`, `interactions = []`, `relationships = []`), and confirmed `ApplicationPanelBody.jsx`'s destructuring signature (line 102) preserves the identical defaults. Same check for `ContactPanelBody.jsx`: `interactions` has no default but is guarded with `(interactions || [])` at its one usage site (line 74), matching the pre-migration `ContactDetailModal.jsx` behavior exactly. Net result: Calendar's reduced-prop sites render an empty-state UI (no relationships editor, no dossier "find more people" link, no warm-path counts) exactly as they did before this port — not a crash, and not a new gap. No SUMMARY-worthy bug found; this is a confirmation, not a new finding.
- **Not investigated further (deliberately out of scope):** Whether the resulting *empty-state UX* at Calendar's reduced-prop sites (e.g. NetworkAtCompany showing "0 people you know at [company]" for an application that might actually have warm paths, simply because `contacts` wasn't threaded through) is itself a product gap worth closing is a UX question outside this plan's charter. Flagging for a possible follow-up decision, not fixing here.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' verification gates (grep-based structural checks + `npm run build`) passed on the first attempt with no auto-fixes required.

## Issues Encountered

None. One environment-only step (not a plan deviation): this worktree had no `app/node_modules` installed — ran `npm ci` in `app/` before the first `npm run build` could execute. No source files were affected; `node_modules/` is gitignored.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PANEL-01 and PANEL-02 are now fully delivered: contact, application, and job records all open through one shared `SidePanel` component across every site in the app, with zero prop-set regressions and the three legacy modal files gone.
- `git status --porcelain` is clean after this plan's three commits — exactly the 6 modified files and 3 deletions listed in the plan's `files_modified` frontmatter, nothing else.
- The live click-through verification (opening each of the 8 sites, exercising create-mode on Network/Coverage/Pipeline, and confirming the D-05 dossier-contact swap + back button + the `createPortal`-rendered interaction-logging dialog inside the animated shell) is staged for the phase's end-of-phase human review per `workflow.human_verify_mode=end-of-phase` — no further plans in this phase depend on this verification completing first.
- This was the last plan in Phase 4's wave; no further `04-*` plans are pending.

---
*Phase: 04-shared-record-side-panel*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: `app/src/App.jsx` (modified)
- FOUND: `app/src/components/ReferralCoverageTab.jsx` (modified)
- FOUND: `app/src/components/TodayTab.jsx` (modified)
- FOUND: `app/src/components/CalendarTab.jsx` (modified)
- FOUND: `app/src/components/PipelineTab.jsx` (modified)
- FOUND: `app/src/components/jobBoards/RepoJobsView.jsx` (modified)
- CONFIRMED DELETED: `app/src/components/ContactDetailModal.jsx`
- CONFIRMED DELETED: `app/src/components/ApplicationDetailModal.jsx`
- CONFIRMED DELETED: `app/src/components/jobBoards/JobDetailModal.jsx`
- FOUND commit `de001ef` (Task 1)
- FOUND commit `a08df40` (Task 2)
- FOUND commit `022d919` (Task 3)
