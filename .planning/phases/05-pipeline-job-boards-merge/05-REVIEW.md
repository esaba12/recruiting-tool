---
phase: 05-pipeline-job-boards-merge
reviewed: 2026-08-20T01:05:55Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - app/src/App.jsx
  - app/src/components/ApplicationsView.jsx
  - app/src/components/jobBoards/JobBoardsView.jsx
  - app/src/components/layout/Sidebar.jsx
  - app/src/components/PipelineTab.jsx
  - app/src/components/TodayTab.jsx
findings:
  critical: 0
  warning: 6
  info: 3
  total: 9
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-08-20T01:05:55Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

This phase collapses the former top-level "Job Boards" tab (`GitHubTab.jsx`) and the former top-level "Pipeline" tab (old `PipelineTab.jsx`, now renamed `ApplicationsView.jsx`) into one `pipeline` nav entry with a new `PipelineTab.jsx` shell that toggles between them via a segmented control. Diffing against `diff_base` confirms `ApplicationsView.jsx` and `JobBoardsView.jsx` are near-verbatim renames of the pre-existing files (only the exported function name changed), while `App.jsx`, `Sidebar.jsx`, and `TodayTab.jsx` received small, mechanical wiring/comment updates to remove the standalone `github` tab. `PipelineTab.jsx` itself is the one genuinely new file in this phase.

No BLOCKER-level defects were found — nothing here crashes the app, leaks data across tenants, or introduces an injection/security surface. However, the merge introduces a real usability regression (state loss when toggling the new segmented control) and a design fragility (the segmented control's visible options and its rendered body are two independently-maintained data sources that can silently desync). The review also surfaces several pre-existing but in-scope defects in the renamed files — most notably user-facing copy in `ApplicationsView.jsx` that still references Notion, even though the app fully migrated off Notion to Supabase — and a handful of silently-swallowed error paths in `TodayTab.jsx` that predate this phase but are worth fixing given the file is in scope.

## Warnings

### WR-01: Segmented control body render is decoupled from the `views` prop it displays

**File:** `app/src/components/PipelineTab.jsx:21-42`
**Issue:** The visible tab selector is driven by the `views` prop (defaults to `PIPELINE_VIEWS`, or `DEMO_PIPELINE_VIEWS` for the demo route), but the actual rendered body is a hardcoded two-way ternary that only ever checks `view === 'applications'`:
```js
{view === 'applications'
  ? <ApplicationsView .../>
  : <JobBoardsView apps={apps} onImported={onImported} />}
```
`view` state itself is also hardcoded to initialize as `'applications'` (`useState('applications')`), independent of whatever `views[0].key` actually is. Today this happens to be safe because both call sites in `App.jsx` only ever pass either the full 2-entry `PIPELINE_VIEWS` or the 1-entry `DEMO_PIPELINE_VIEWS` (which is `[applications]`). But the abstraction the shell's own comment describes — "a segmented control over two mutually exclusive bodies" driven by `views` — isn't actually enforced: if `PIPELINE_VIEWS` is ever reordered, renamed, or extended with a third view, the selector UI and the rendered body will silently disagree, and nothing will catch it at compile- or run-time.
**Fix:** Derive the rendered body from a config map keyed by `view`, and validate `view` against `views` on change:
```js
const BODIES = { applications: ApplicationsView, jobBoards: JobBoardsView }
const [view, setView] = useState(views[0]?.key ?? 'applications')
...
const Body = BODIES[view] ?? ApplicationsView
<Body apps={apps} .../>
```

### WR-02: Job Boards local state (pulled results, search history) is silently discarded on every segmented-control toggle

**File:** `app/src/components/PipelineTab.jsx:24-42`, `app/src/components/jobBoards/JobBoardsView.jsx:11-18`
**Issue:** `PipelineTab.jsx`'s own comment explains that only one body mounts at a time so that "Job Boards' auto-import/deadline-fetch effects must not run while the user is looking at Applications." That's a reasonable reason to unmount, but the cost is real: `JobBoardsView`'s local state (`data`, `history`, `lastPull`, `showAdHoc`, `input`) all live inside `JobBoardsView` itself and are torn down on unmount. Before this phase, Job Boards was a full top-level tab, so a user switching away from it was a deliberate, comparatively rare navigation. Now it's one click on a segmented control right next to "Applications," which encourages exactly the back-and-forth (e.g., check an application, flip to Job Boards to see the pulled list, flip back) that triggers the state loss most often — every "Pull all tracked boards" result, the ad-hoc lookup history, and any in-progress single-repo lookup is wiped the moment the user glances at Applications and returns.
**Fix:** Lift `data`/`history`/`lastPull` (and `showAdHoc`) up into `PipelineTab.jsx` (or a small context) so they survive the toggle, and pass an `active`/`visible` boolean down into `JobBoardsView` to gate its auto-import/deadline effects instead of relying on mount/unmount for that gating.

### WR-03: DuplicatesPanel confirm dialog still tells users duplicates are archived "in Notion"

**File:** `app/src/components/ApplicationsView.jsx:56`
**Issue:**
```js
<button onClick={() => { if (confirm(`Archive ${extraCount} duplicate row${extraCount !== 1 ? 's' : ''}? This keeps the oldest copy of each and archives the rest in Notion (recoverable from Notion's trash).`)) dedupe() }}
```
This is factually wrong for the current app: per `CLAUDE.md`, the app is fully migrated off Notion onto Supabase, and `archiveApplication()` (`app/src/db.js:336-345`) simply flips an `archived: true` column on the `applications` row in Postgres — there is no Notion workspace involved and no "Notion trash" to recover from. In demo mode it's even more misleading: `archiveApplication()` there `splice()`s the row out of the in-memory array entirely (`db.js:338-340`), with no recovery path of any kind. A user who reads this dialog and later wants to undo an accidental bulk-archive will look in the wrong place.
**Fix:** Update the copy to describe the real mechanism, e.g. "This keeps the oldest copy of each and marks the rest archived (hidden from the active list, not permanently deleted)." — and drop the Notion reference entirely.

### WR-04: DuplicatesPanel.dedupe() has no partial-failure handling

**File:** `app/src/components/ApplicationsView.jsx:26-39`
**Issue:**
```js
async function dedupe() {
  setArchiving(true); setError(null)
  try {
    for (const g of groups) {
      const [, ...dupes] = g
      for (const d of dupes) await archiveApplication(d.id)
    }
    onRefresh()
  } catch (e) {
    setError(e.message)
  } finally {
    setArchiving(false)
  }
}
```
`onRefresh()` only runs if every `archiveApplication()` call in every group succeeds. If one call fails partway through a multi-group dedupe (a transient network error, for example), everything archived before the failure has already taken effect server-side, but the UI is never told to refresh — the parent's `apps` list still shows the now-archived rows as if nothing happened, and the surfaced error message gives no indication of which specific applications succeeded vs. which one failed.
**Fix:** Refresh regardless of outcome (e.g. `finally { onRefresh(); setArchiving(false) }`), and/or archive with `Promise.allSettled` so a single failure doesn't abort the rest of the batch, reporting exactly which rows failed.

### WR-05: TodayTab row actions swallow errors with no user-facing feedback

**File:** `app/src/components/TodayTab.jsx:38-48` (`markFollowedUp`), `95-103` (`markScheduled`), `265-273` (`markCompleted`)
**Issue:** All three mutating handlers follow the same pattern:
```js
try {
  await updateContact(c.id, { ... })
  onRefresh?.()
} catch {
  setMarking(false)
}
```
The error is caught and completely discarded — no message is shown, nothing is logged, and the button simply returns to its normal state. On a transient failure (network blip, RLS/auth hiccup, etc.), the user has no way to know the action didn't take effect; the item silently remains in the same overdue/needs-review queue with no explanation, and they may assume it worked.
**Fix:** Track and surface the error, mirroring the pattern `DuplicatesPanel` already uses elsewhere in this same phase's files:
```js
} catch (e) {
  setMarking(false)
  setError(e.message)
}
```
plus a small inline `{error && <p className="text-xs text-danger-600">{error}</p>}` under the row.

### WR-06: Unknown/legacy `stage` values sort to the very top of the Applications list

**File:** `app/src/components/ApplicationsView.jsx:123`
**Issue:**
```js
.sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))
```
`Array.prototype.indexOf` returns `-1` for any `stage` value not present in `STAGE_ORDER` (a null/blank stage from a bad import, a stage name that's been renamed/retired, etc.). Since `-1` is lower than every valid index, such a row sorts ahead of every legitimate stage — including `Interview`/`Offer` — silently misrepresenting priority to the user with no error surfaced anywhere.
**Fix:**
```js
const stageRank = s => { const i = STAGE_ORDER.indexOf(s); return i === -1 ? STAGE_ORDER.length : i }
.sort((a, b) => stageRank(a.stage) - stageRank(b.stage))
```

## Info

### IN-01: Segmented-control markup duplicated verbatim across files

**File:** `app/src/components/PipelineTab.jsx:27-37` vs. `app/src/App.jsx:94-102` (NetworkTab's view switcher)
**Issue:** `PipelineTab.jsx`'s new Applications/Job Boards toggle is a byte-for-byte copy of the pill-button segmented-control markup and class list already used by `NetworkTab` in `App.jsx` (`border border-ink-200 rounded-full overflow-hidden` wrapper, per-button `bg-ink-900 text-white` / `bg-white text-ink-500 hover:bg-ink-50` active/inactive classes). This phase was an opportunity to extract a shared `<SegmentedControl items={...} value={...} onChange={...} />` component instead of adding a third copy of the same pattern.
**Fix:** Extract to `components/ui/SegmentedControl.jsx` and use it from both `NetworkTab` and `PipelineTab`.

### IN-02: `changeAppTriage`/`changeTriage` duplicated between TodayTab.jsx and ApplicationsView.jsx

**File:** `app/src/components/TodayTab.jsx:332-335`, `app/src/components/ApplicationsView.jsx:95-98`
**Issue:** The two functions are identical (the code even has a comment in `TodayTab.jsx` acknowledging "Matches ApplicationsView.jsx's changeTriage exactly"), meaning any future change to the triage mutation logic has to be remembered and applied in two places.
**Fix:** Extract to a shared helper (e.g. `lib/attention.js` or a new `lib/triage.js`) and import it from both files.

### IN-03: Magic number for follow-up interval

**File:** `app/src/components/TodayTab.jsx:41`
**Issue:** `new Date(Date.now() + 7 * 86400000)` hardcodes a 7-day snooze with no named constant, making the interval harder to find/tune later.
**Fix:** `const FOLLOW_UP_SNOOZE_DAYS = 7` near the top of the file, referenced here as `Date.now() + FOLLOW_UP_SNOOZE_DAYS * 86400000`.

---

_Reviewed: 2026-08-20T01:05:55Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
