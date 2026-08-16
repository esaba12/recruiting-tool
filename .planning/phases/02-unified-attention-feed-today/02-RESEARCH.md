# Phase 2: Unified Attention Feed (Today) - Research

**Researched:** 2026-08-16
**Domain:** React/Vite frontend consolidation — merging 5 existing UI surfaces into one new nav destination, zero new data/AI/backend work
**Confidence:** HIGH (all findings are direct code reads of this repo, not external library research — this phase has no new external dependencies)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Feed structure**
- **D-01:** Keep `ActionsTab.jsx`'s proven bucketed-`Section` pattern (title + accent color + row list) rather than a single flat chronological list. Extend it with 2 new sections for Keep in Touch (due/overdue contacts) and Job Boards Needs-Review, alongside the existing Overdue Follow-Ups / Stale Applications / High Urgency / OA-Due / OA-Needs-Check sections — 8 sections total, one per attention "reason". *Rationale: this pattern already exists, is well-tested, and a bucketed structure keeps 5 heterogeneous item types (contact/app/job/keep-in-touch/timeline-find) scannable rather than blurred into one undifferentiated list — lowest-risk choice for `--auto` mode.*
- **D-02:** Sort sections in the merged feed by time-sensitivity: Overdue Follow-Ups → Stale Applications → High Urgency Contacts → Keep in Touch Due → Job Boards Needs Review → Timeline Finds → OA-Due/OA-Needs-Check. Within each section, sort by existing per-surface logic unchanged (e.g. `staleApps` already sorts by days-in-stage descending). *Rationale: preserves each surface's already-tuned internal sort; only the section order is new, and it orders by how time-critical missing the item is.*

**"Today" as a new destination**
- **D-03:** "Today" is a new top-level nav item (not a rename of Overview, not new content bolted onto Overview) — Overview keeps its existing KPI/funnel/stats content unchanged, only loses its "Needs Attention" nudge section (per ATTN-03's explicit wording: "Overview's separate nudge section... removed", implying Overview persists as a distinct tab). Position Today first in the sidebar nav order, matching ROADMAP.md Phase 6's eventual "~5 items: Today, Network, Grow, Pipeline, Calendar" ordering. *Rationale: ROADMAP.md's phase title itself is "Unified Attention Feed (Today)" and Phase 6's success criteria already list "Today" as an established destination by that point — Phase 2 is where it's created, not Phase 6.*

**Record deep-linking (ATTN-02)**
- **D-04:** Each attention item deep-links to its full record using the *existing* modal/view for that record type — `ContactDetailModal` for contacts, the existing inline expand/detail flow for applications (as already used in `ActionsTab.jsx`/`PipelineTab.jsx`), `JobDetailModal` for jobs. Do NOT attempt to route these through a shared side-panel — that component doesn't exist until Phase 4 (`PANEL-01`/`PANEL-02`). *Rationale: building or partially building the shared panel here would be scope creep into Phase 4's job; reusing today's actual per-type modals satisfies ATTN-02 ("deep-links to full record in one click") without inventing new UI, and Phase 4 swaps the target later without touching this phase's feed logic.*
  - **⚠ Research correction — see "Deep-link modal reality check" below.** `ActionsTab.jsx` does NOT currently have any app-record modal/expand flow — its stale-application rows are plain non-clickable text with only a JD external link. The actual reusable application-detail component is `ApplicationDetailModal.jsx` (used by `PipelineTab.jsx`), not anything already present in `ActionsTab.jsx`. And `JobDetailModal` cannot be used for the Job Boards Needs-Review section without a live board fetch it doesn't have access to from Today — see below for the concrete substitute.

**Inline actions**
- **D-05:** Carry forward each source surface's existing one-tap inline actions into the merged feed rows (e.g. Overdue Follow-Ups keeps "Mark followed up", Keep in Touch keeps its "Log" quick-action opening `LogInteractionModal` pre-filled, Job Boards Needs-Review keeps its triage-bucket quick actions). No new action types introduced. *Rationale: minimizes behavior change — users keep the exact interactions they already know, just relocated into one feed.*

### Claude's Discretion
- Exact visual treatment of the 8-section feed (spacing, collapse/expand behavior for sections with many items, whether OA-Due/OA-Needs-Check stay as their own sections or fold into Stale Applications) is left to planning/implementation.
- Whether Timeline Finds needs its own visible section header or blends into an existing category is an implementation call — see "What a Timeline Find actually is" below for the concrete data this decision needs.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. Shared side-panel unification (D-04) is explicitly Phase 4's job, already on the roadmap, not deferred-and-forgotten.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ATTN-01 | User sees one unified "what needs attention" feed on Today, combining overdue follow-ups, stale applications, Keep in Touch queue, Job Boards Needs-Review, and Timeline Finds — replacing 5 previously separate surfaces | Exact source data/predicates for all 5 (plus the 3 ActionsTab-only categories not named in ATTN-01 but which must go *somewhere* once Actions is retired) documented below in "Exact Current Implementation" |
| ATTN-02 | Each attention item deep-links to its full record (contact/application/job) in one click | "Deep-link modal reality check" below identifies the actual reusable modal per item type, corrects CONTEXT.md's D-04 assumption about `ActionsTab.jsx`/`JobDetailModal`, and specifies exact props each needs |
| ATTN-03 | Standalone Actions tab, Overview's nudge section, Keep in Touch's standalone queue view, TimelineFindsPanel's standalone presentation removed once merged — not left running in parallel | "App.jsx Nav Wiring" section below gives the exact lines to remove/add in `App.jsx`, `Sidebar.jsx`, `NAV_ICON` |
</phase_requirements>

## Summary

This phase is a pure frontend consolidation: no new libraries, no new AI calls, no new Supabase queries. All 5 source surfaces already fetch their data via functions `App.jsx`/`DemoApp` already call (`fetchContacts`, `fetchApplications`, `fetchInteractions`); Today just needs to receive those same props and re-derive/re-render what 4 different components currently compute independently.

The single most important correction this research makes to CONTEXT.md's D-04: **`ActionsTab.jsx` has no application-record modal today.** Its "Stale Applications" rows are inert `ActionRow` components — company/role/stage/days-badge text plus an external JD link, nothing clickable to a detail view. The actual reusable per-application detail component is `ApplicationDetailModal.jsx` (currently wired only from `PipelineTab.jsx`), which supports everything Today's stale-application and Needs-Review rows need (stage/triage editing, notes, AI fit analysis, network-at-company panel) and is safe to reuse standalone. Similarly, `JobDetailModal.jsx` (CONTEXT's stated target for "jobs") is NOT reusable for the Needs-Review section without a live GitHub board fetch that Today has no reason to trigger — the correct target for Needs-Review items is also `ApplicationDetailModal`, since every Needs-Review item is already an `apps` row (`triage === 'Needs Review'`) by the time it's visible anywhere in the app (auto-import happens the moment a board is pulled — see `RepoJobsView.jsx`).

A second finding requiring a planner decision: CONTEXT.md's D-01 lists "8 sections total" but its own enumeration ("Overdue Follow-Ups / Stale Applications / High Urgency / OA-Due / OA-Needs-Check" + 2 new = 7) is one section short, and it silently drops `ActionsTab.jsx`'s 6th existing category, "Want to Schedule" (people queued via "+ Schedule", `scheduleContacts`). Since `ActionsTab.jsx` is being fully retired (ATTN-03) and D-01's own rationale is "preserve every already-tuned surface," this read as an omission, not a deliberate cut — see "Open Questions" for the recommended resolution (add a 9th section, or fold OA-Due/OA-Needs-Check into one section to net back to 8 while keeping Schedule).

**Primary recommendation:** Build `app/src/lib/attention.js` as a single derivation module exporting one function per attention category (mirroring `ActionsTab.jsx`'s existing 6 computations plus 2 new ones for Keep in Touch and Needs-Review), consumed by three call sites — the new `TodayTab.jsx`, `App.jsx`'s sidebar-badge count, and nothing else, since `OverviewTab.jsx`'s nudge section is deleted outright, not ported. Reuse `ApplicationDetailModal` for both app-shaped sections (Stale Applications, Needs-Review), `ContactDetailModal` for all contact-shaped sections (Overdue, High Urgency, Keep in Touch, Want to Schedule), and keep Timeline Finds' existing approve/dismiss card UI largely as-is (it doesn't deep-link to a contact/app/job record at all — see below).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Attention-item derivation (filter/sort predicates) | Frontend (client lib, `lib/attention.js`) | — | Pure client-side computation over already-fetched Supabase rows; no new query needed, same tier as today's `ActionsTab.jsx`/`OverviewTab.jsx` computations |
| Today feed rendering (sections, rows) | Frontend (React component, `TodayTab.jsx`) | — | New presentational component, no state beyond UI (modal-open, expand/collapse) |
| Record detail view/edit on click | Frontend (existing modals: `ContactDetailModal`, `ApplicationDetailModal`) | API/Backend (via `db.js` → Supabase, RLS-scoped) | Modals already own their own save/patch calls through `db.js`; Today only opens them, doesn't duplicate their logic |
| Timeline Finds scan (AI extraction) | API/Backend (`/claude-api` proxy → Anthropic, BYOK) | Frontend (`lib/timelineFinder.js` orchestration) | Unchanged from today — this phase only relocates the *presentation* of `TimelineFindsPanel`, not its AI-calling background scan |
| Nav routing (`tab === 'today'`) | Frontend (`App.jsx` state) | — | No router; consistent with every other tab, see "App.jsx Nav Wiring" |

## Exact Current Implementation of the 5 (+3) Source Surfaces

### 1. Overdue Follow-Ups (`ActionsTab.jsx` + duplicated in `OverviewTab.jsx` + duplicated in `App.jsx`)

```js
// ActionsTab.jsx and OverviewTab.jsx both compute this identically:
const overdueContacts = contacts
  .filter(isOverdue)                                    // shared.jsx: c.status !== '✅ Closed' && !!c.followUpDate && daysUntil(c.followUpDate) <= 0
  .sort((a, b) => daysUntil(a.followUpDate) - daysUntil(b.followUpDate))

// App.jsx (AppInner) computes a THIRD independent copy, count-only, for the sidebar badge:
const overdueCount = contacts.filter(isOverdue).length
```

**Row component:** `OverdueContactRow` (`ActionsTab.jsx:133-183`) — props `{ contact, interactions, onRefresh }`. Renders name/company/role/email, `Badge` for status, "Was due {date} ({N}d ago)" in `text-danger-600`, and two inline actions: **"Draft follow-up"/"Details"** (expands a `DraftPanel` inline, unless `hasNewerInteraction(contact, interactions)` is true, in which case it shows a "date's just stale" hint instead) and **"Mark followed up"** (calls `updateContact` + `addInteraction`, then `onRefresh()`). Row itself has an `onClick` on the name/company block that toggles `expanded` — it does **not** open `ContactDetailModal`; the expand only reveals `DraftPanel` inline. Today can keep this exact row+expand pattern, or additionally make the row open `ContactDetailModal` for full-record access (CONTEXT's ATTN-02 requires the latter — the current inline expand alone does not satisfy "lands directly on its full contact... record").

### 2. Stale Applications (`ActionsTab.jsx` + duplicated in `OverviewTab.jsx` + duplicated in `App.jsx`)

```js
const activeApps = apps.filter(a => !TERMINAL_STAGES.includes(a.stage) && !isUntriaged(a))
const staleApps = activeApps
  .filter(isStaleApplication)                            // shared.jsx: (a.daysInStage ?? daysSince(a.lastActivity)) > 14
  .sort((a, b) => {
    const da = a.daysInStage ?? daysSince(a.lastActivity)
    const db = b.daysInStage ?? daysSince(b.lastActivity)
    return db - da                                       // most-stale (largest days) first
  })
```

**Row today:** generic `ActionRow` (`ActionsTab.jsx:279-293`) — `{ primary: a.company, secondary: a.role, link: a.jdLink && {href, label:'View JD ↗'}, badge: <Badge stage>, meta: '{N}d in {stage}' }`. **Not clickable** — no `onClick`, no modal. This is the exact gap ATTN-02 requires Today to close: wrap this row (or its Today equivalent) in an `onClick={() => setSelectedAppId(a.id)}` that opens `ApplicationDetailModal`, following `PipelineTab.jsx`'s exact pattern (`PipelineTab.jsx:163,208-223`).

### 3. High Urgency Contacts (`ActionsTab.jsx` only)

```js
const highUrgencyContacts = contacts.filter(c =>
  c.urgency === 'HIGH' && c.status !== '✅ Closed' && (!c.followUpDate || daysUntil(c.followUpDate) > 0)
)
```
No explicit sort (array order = fetch order). Row: generic `ActionRow`, not clickable — same gap as Stale Applications; needs `ContactDetailModal` wiring for ATTN-02.

### 4. OA-Due / OA-Needs-Check (`ActionsTab.jsx` only — currently ONE combined UI section, "Online Assessments")

```js
const oaDueApps = apps
  .filter(a => a.oaDueDate && !a.oaCompleted)
  .sort((a, b) => daysUntil(a.oaDueDate) - daysUntil(b.oaDueDate))
const oaNeedsCheckApps = apps
  .filter(a => a.oaLink && !a.oaDueDate && !a.oaCompleted && a.oaResearchCheckedAt)
```
**Important:** today these render inside **one** `Section title="Online Assessments (N)"` block (`ActionsTab.jsx:52-61`), not two separate sections — D-01's phrasing ("OA-Due / OA-Needs-Check sections", plural) implies splitting them, which is a real behavior/visual change from today, not a pure relocation. Row: `OaRow` (`ActionsTab.jsx:236-277`) — not clickable, only an external "Open assessment ↗" link plus "✓ Mark completed" (`updateApplication(a.id, {oaCompleted: true})`).

### 5. Want to Schedule (`ActionsTab.jsx` only — NOT named in ATTN-01, NOT in CONTEXT's D-01 list)

```js
const scheduleContacts = contacts
  .filter(c => c.wantsToSchedule)
  .sort((a, b) => {
    if (!a.scheduleBy && !b.scheduleBy) return 0
    if (!a.scheduleBy) return 1
    if (!b.scheduleBy) return -1
    return new Date(a.scheduleBy) - new Date(b.scheduleBy)
  })
```
Row: `ScheduleQueueRow` (`ActionsTab.jsx:188-231`) — "Draft outreach" (expands `DraftPanel` with `kind="cold_open"`) and "✓ Scheduled" (`updateContact(c.id, {wantsToSchedule: false})`). **See "Open Questions" — this category has no home in CONTEXT's 8-section plan but is a currently-shipped feature that will silently disappear once `ActionsTab.jsx` is deleted per ATTN-03 unless explicitly carried into Today.**

### 6. Keep in Touch (`KeepInTouchTab.jsx` + `lib/keepInTouch.js`, standalone Network sub-view today)

```js
// lib/keepInTouch.js — keepInTouchQueue(contacts, interactions, settings = DEFAULT_CADENCE)
// { strong: 45, moderate: 30, weak: 75, cold: 120 } days per tie-strength bucket
// Excludes: contact.status === '✅ Closed' (parked), and anyone with a FUTURE explicit followUpDate
//   (already has a plan owned by Overdue Follow-Ups — no double-nag)
// Includes: never-contacted (status.never) OR overdueDays >= 0 (due today or later)
// Sort: most-overdue first, "never contacted" sinks to just above 0-overdue (not top)
```
Row today (`KeepInTouchTab.jsx:39-88`): full card, clickable **name/company block `onClick={() => onEdit(c)}`** which already opens `ContactDetailModal` (wired in `App.jsx`'s `NetworkTab` at line ~192). This is the ONE source surface among the 5 that already satisfies ATTN-02 out of the box. Inline actions: `MetButton` (one-tap "Met", calls `logMetWithContact`) and **"Log"** button (opens `LogInteractionModal` pre-filled via `onLog(c)` → `setLogContact(c)` in `NetworkTab`). Today needs equivalent `onEdit`/`onLog`/`onMet` wiring at its own level (App.jsx or TodayTab), not reachable through `NetworkTab`'s local state once Keep in Touch's standalone view is removed from `NETWORK_VIEWS`.

### 7. Job Boards Needs-Review (`jobBoards/helpers.js` + `RepoJobsView.jsx`, currently ONLY reachable after a live board pull)

`BUCKET_TO_TRIAGE.review === 'Needs Review'`. **Critical finding:** the "Needs Review bucket" as a UI concept only exists today *inside* `RepoJobsView.jsx`, which requires `data.jobs` — state populated by `GitHubTab.jsx` after the user pulls a board (`pullAllBoards()` or a single-repo lookup). Today has no reason to trigger a live GitHub/board fetch just to render its attention feed. **The correct data source for Today is simply:**
```js
const needsReviewApps = apps.filter(a => a.triage === 'Needs Review' && a.stage === 'Wishlist')
// (this is exactly isUntriaged(a) && a.triage === 'Needs Review' — i.e. isUntriaged(a) minus the 'Pass' branch)
```
Every one of these is already a full `applications` row (created by `RepoJobsView.jsx`'s auto-import: `addApplication({ company, role, jdLink: applyUrl, location, sourceRepo, datePosted: dateAdded })`), so `ApplicationDetailModal` — not `JobDetailModal` — is the correct, already-data-compatible deep-link target (see "Deep-link modal reality check" below). `ApplicationDetailModal` already renders the triage quick-action buttons (`BUCKET_CONFIG` chips, `changeStatus`) whenever `untriaged` is true (`app.stage === 'Wishlist'`), satisfying D-05's "carry forward triage-bucket quick actions" without new code.

### 8. Timeline Finds (`TimelineFindsPanel.jsx` + `lib/timelineFinder.js`, currently buried inside `CalendarTab.jsx`)

**What it actually is:** an AI-scanned staging queue of *proposed calendar events*, not a view onto an existing contact/app/job record. `findTimelineEvents()` scans `apps`/`calls`/`interactions` free-text fields (notes, call summaries, transcripts) for dated events (interview dates, OA deadlines, start dates) not yet on the calendar, batched through Claude Haiku, hash-gated (`rec_timeline_meta`) so unchanged records cost zero tokens on repeat scans. A found item has this shape:
```js
{ key, sourceType: 'application'|'call'|'interaction', sourceId, company, role,
  title, date /* YYYY-MM-DD */, startTime /* '' or 'HH:MM' */, description /* quoted snippet */ }
```
Staged in localStorage (`rec_timeline_pending`), nothing is written until the user clicks **"+ Add to Calendar"** (`approve()` → `createEvent()` → real Google Calendar write, then removed from pending). A **"Dismiss"** button discards without writing.

**⚠ This item type structurally cannot satisfy ATTN-02 ("deep-links to full contact/application/job record") the way the other 4 do** — a Timeline Find is not itself a contact/app/job, it's a candidate calendar event *derived from* one (via `sourceType`/`sourceId`). Two honest options for the planner: (a) treat "clicking it" as approving/reviewing the proposed event inline (current UX — arguably satisfies "acts on it in one click" even if not literally "opens the source record"), or (b) additionally thread a click-through using `sourceType`/`sourceId` to open the underlying application/call/contact record (`sourceType === 'application'` → `ApplicationDetailModal` via `sourceId`; `'call'`/`'interaction'` have no exact dedicated modal today — `'call'` could route to the linked contact via `contactId` on the `Call` row, `'interaction'` likewise via `interactionId`'s `contactId`). Recommend (a) as lowest-risk/in-scope, since CONTEXT.md's "Claude's Discretion" note already flags this card-shape decision as open and unresolved — but the planner must explicitly decide and document rather than silently assume it's identical to the other 4 categories.

**Runs on mount, unconditionally** (`TimelineFindsPanel.jsx:55-60`, gated only by "already scanned today" via `meta.lastCheck`), calling the AI proxy without any user click — unlike `DraftPanel` (click-gated) or `Discover`'s background scan (has its own daily/cooldown/budget gates but is inside an auth-required tab already). Relevant for the `/demo` decision below.

## Deep-link modal reality check (corrects CONTEXT.md D-04)

| Item type | CONTEXT's stated target | Actual reusable component | Standalone-usable from Today? | Required props |
|-----------|--------------------------|---------------------------|-------------------------------|-----------------|
| Contact (Overdue, High Urgency, Keep in Touch, Want to Schedule) | `ContactDetailModal` | `ContactDetailModal.jsx` — **confirmed correct** | Yes — already opened standalone from `NetworkTab`/`ApplicationDetailModal`'s "who do I know" panel with no shared state needed | `contact`, `contacts`, `interactions`, `contactRelationships`, `onClose`, `onSaved`, `onRefreshRelationships` (all already flow down to `App.jsx`'s `AppInner`, no new fetch needed) |
| Application (Stale Applications, OA-Due/Needs-Check) | "existing inline expand/detail flow... as already used in `ActionsTab.jsx`" | **`ApplicationDetailModal.jsx`** — `ActionsTab.jsx` has NO such flow today; must be newly wired, following `PipelineTab.jsx`'s exact usage | Yes — `PipelineTab.jsx:208-223` shows the complete standalone usage pattern | `app`, `contacts`, `apps`, `interactions`, `relationships`, `onStatusChange`, `onClose`, `onDelete`, `onSaved`, `onFindPeople`, `onRefresh`, `onRefreshRelationships` — **`onFindPeople` must be threaded from `App.jsx`'s existing `goFindPeople` closure (see "Cross-tab deep-link relay" below) or the "Find people →" button inside the modal silently disappears (fails soft — `onFindPeople &&` guard — but is a real feature loss if forgotten)** |
| Job (Job Boards Needs-Review) | `JobDetailModal` | **`ApplicationDetailModal.jsx`** — `JobDetailModal` needs `job` (raw parsed board listing), `blurb`, `deadline`, `onRecheckDeadline`, `prefs` — all only available inside a live `RepoJobsView` fetch session; Needs-Review items are already `apps` rows by the time they're visible anywhere else | `JobDetailModal` is NOT usable from Today without re-fetching board data (out of scope — see Pitfalls); `ApplicationDetailModal` is directly usable, same as Stale Applications | Same as Application row above |
| Timeline Find | (not addressed by D-04) | N/A — not a record type; see "What a Timeline Find actually is" above | Approve/Dismiss card UI reused as-is; optional click-through to `sourceType`'s record is a planner decision, not a given | `TimelineFindsPanel`'s existing props (`apps, calls, interactions, contacts, onEventCreated`) — reusable wholesale as a section, or its internals lifted into a Today-native row |

## App.jsx Nav Wiring (exact current state, for the planner's diff)

**`app/src/components/layout/Sidebar.jsx`:**
```js
const NAV_ITEMS = [
  { id: 'overview', label: 'Overview' },
  { id: 'network',  label: 'Network' },
  { id: 'explore',  label: 'Explore' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'actions',  label: 'Actions' },   // ← DELETE per ATTN-03
  { id: 'calendar', label: 'Calendar' },
  { id: 'github',   label: 'Job Boards' },
  { id: 'settings', label: 'Settings' },
]
```
Per D-03, add `{ id: 'today', label: 'Today' }` as the **first** entry. `NAV_ICON` (`lib/icons.js:36-45`) is a parallel id→icon map — needs a `today:` entry added (no icon reserved for this today; `lucide-react` already imports elsewhere in the app, e.g. `AlarmClock`, `Radar`, `Zap`, or `Gauge` would fit the "instrument panel" Phase 1 aesthetic — pick one consistent with Phase 1's `01-UI-SPEC.md` direction, not decided by this research).

**`app/src/App.jsx` (`AppInner`):**
- Line 20: `import ActionsTab from './components/ActionsTab.jsx'` → replace with `TodayTab` import.
- Line 347: `{!loading && tab === 'actions' && <ActionsTab .../>}` → replace with `{!loading && tab === 'today' && <TodayTab .../>}`.
- Lines 304-314: `overdueCount`/`staleCount`/`scheduleCount`/`actionCount` (currently feeding the `actions` sidebar badge) should be recomputed via the new `lib/attention.js` module (see "Reusable extraction" below) and re-keyed to `counts.today` instead of `counts.actions`.
- Line 333: `OverviewTab`'s `onOpenActions={() => setTab('actions')}` prop → becomes `onOpenActions={() => setTab('today')}` (or the whole scheduleQueue nudge block in `OverviewTab.jsx:80-88` is deleted if Overview drops that too — CONTEXT only mandates removing the "Needs Attention" danger-colored block at `OverviewTab.jsx:127-156`, the separate indigo "want to schedule" nudge at lines 80-88 is a distinct block not explicitly named in ATTN-03 but references the same retiring destination and should be updated or removed in the same pass).

**`app/src/App.jsx` (`DemoApp` + `DEMO_NAV_ITEMS`):**
```js
const DEMO_NAV_ITEMS = NAV_ITEMS.filter(item => ['overview', 'network', 'pipeline', 'actions'].includes(item.id))
```
`'actions'` **must** be replaced with `'today'` in this filter, or `/demo` silently loses its attention-feed access entirely the moment `ActionsTab`/`'actions'` tab id is deleted (NAV-04's "demo continues to function" requirement, even though NAV-04 itself is formally Phase 6's — see "Public Demo Route" below, this is a Phase 2 decision that can't be deferred without breaking `/demo` today). `DemoApp`'s render branch (`App.jsx:434`) needs the same `tab === 'actions'` → `tab === 'today'` swap, with `TodayTab` given the same props `ActionsTab` currently gets (`contacts, apps, interactions, onRefresh`) plus whatever the Keep-in-Touch/Needs-Review sections need (`interactions` already flows; `apps` already flows — no new demo-mode fetch required).

## Cross-tab deep-link relay — regression risk (per STATE.md's carried-forward blocker)

`grep`-verified call sites for `onFindPeople`/`focusCompany`:
- **Sources (who currently calls `onFindPeople`):** `ReferralCoverageTab.jsx:124`, `ExploreTab.jsx` (`CompanyCard`), and `ApplicationDetailModal.jsx`'s `NetworkAtCompany` sub-component (both the count-header button and the zero-state button).
- **Destination:** `App.jsx`'s `goFindPeople` closure (`App.jsx:252-254`) sets `networkFocusCompany`/`networkInitialView`/`tab`, landing in `NetworkTab`'s Discover view.
- **None of the 5 surfaces being merged into Today are currently a source or destination of this relay** — `ActionsTab.jsx`, `KeepInTouchTab.jsx`, `TimelineFindsPanel.jsx`, and the Needs-Review bucket UI (`RepoJobsView.jsx`) never call or receive `onFindPeople`/`focusCompany`.
- **New risk introduced by this phase specifically:** once Today reuses `ApplicationDetailModal` (per the corrected D-04 above) for Stale Applications and Needs-Review rows, it inherits `ApplicationDetailModal`'s existing `onFindPeople` prop and its `NetworkAtCompany` sub-panel. If Today doesn't thread `App.jsx`'s `goFindPeople` down to it (the same way `PipelineTab.jsx:219` already does), the "Find people →" button inside those modals silently vanishes (fails soft, no crash) rather than erroring — an easy-to-miss regression since nothing throws. **Action for planner:** explicitly pass `onFindPeople={goFindPeople}` into Today's `ApplicationDetailModal` usage, mirroring `PipelineTab.jsx` exactly.

## What a "Timeline Find" actually contains (for CONTEXT's open card-shape question)

Answered fully above under source #8. Summary for quick reference: fields are `{ key, sourceType, sourceId, company, role, title, date, startTime, description }`; source is a scan over 3 record types' free text (application notes, call summaries/transcripts, interaction summaries/bodies); typical volume is small and bursty (only records with real dated content produce hits — the scan explicitly skips the auto-generated "Posted <date>" stub notes and empty text, and demo/most real accounts will show 0-3 pending items most days, not a constant stream). It is fundamentally an "approve this proposed calendar write" card, not a read-only pointer to an existing record — recommend giving it its own section header (not blending into an existing category) since its action verb ("+ Add to Calendar" / "Dismiss") is categorically different from every other section's actions (mark followed up / log / triage), and CONTEXT already left this as an open implementation call, not a locked decision.

## Reusable extraction: `lib/attention.js` (confirms STATE.md's carried-forward roadmap note)

**Confirmed necessary.** Overview's nudge section (`OverviewTab.jsx:37-40`) computes `overdueContacts`/`staleApps` with the exact same filter+sort logic as `ActionsTab.jsx:30-40`, and `App.jsx`'s `AppInner` (lines 304-308) computes a third, count-only copy of `overdueCount`/`staleCount`/`scheduleCount` for the sidebar badge. All three already delegate to the same `shared.jsx` predicates (`isOverdue`, `isStaleApplication`) — the duplication is in the array-building/sorting layer, not the predicates themselves.

**Recommended shape** — one function per category, each taking the same `(contacts, apps, interactions)`-shaped args (only using what it needs), each returning an already-sorted array:
```js
// app/src/lib/attention.js
export function overdueFollowUps(contacts) { /* ActionsTab.jsx:30-32, verbatim */ }
export function staleApplications(apps) { /* ActionsTab.jsx:7,34-40, verbatim */ }
export function highUrgencyContacts(contacts) { /* ActionsTab.jsx:42-44, verbatim */ }
export function oaDue(apps) { /* ActionsTab.jsx:13-15, verbatim */ }
export function oaNeedsCheck(apps) { /* ActionsTab.jsx:16-17, verbatim */ }
export function wantToSchedule(contacts) { /* ActionsTab.jsx:21-28, verbatim — see Open Questions */ }
export function keepInTouchDue(contacts, interactions) { /* thin re-export of lib/keepInTouch.js's keepInTouchQueue — already its own module, don't duplicate */ }
export function needsReviewApps(apps) { /* apps.filter(a => a.triage === 'Needs Review' && a.stage === 'Wishlist') */ }
```
Consumed by: `TodayTab.jsx` (full feed), `App.jsx`'s `AppInner` (counts only, replacing lines 304-308's inline math). **Not** consumed by `OverviewTab.jsx` — its "Needs Attention" block (lines 127-156) is deleted outright per ATTN-03, not ported to use the new module, since Overview no longer shows this content at all.

## Common Pitfalls

### Pitfall 1: Assuming `ActionsTab.jsx` already has app-record and contact-record modals wired
**What goes wrong:** A plan that says "reuse ActionsTab's existing detail flow" for Stale Applications / High Urgency rows will find there is none — those rows are inert text today (see "Exact Current Implementation" #2/#3 above).
**Why it happens:** CONTEXT.md's D-04 states this as fact without having read the actual component; `KeepInTouchTab.jsx`'s rows genuinely are clickable-to-modal, creating a false impression that all 5 surfaces already work this way.
**How to avoid:** Explicitly wire `onClick={() => setSelectedContactId/AppId(x.id)}` + render `ContactDetailModal`/`ApplicationDetailModal` in Today's own local state, following `PipelineTab.jsx`'s and `NetworkTab`'s exact patterns — this is genuinely new wiring, not a relocation.
**Warning signs:** A plan task that says "move the JSX" without also saying "add modal state + onClick" for the Stale Applications / High Urgency / OA sections.

### Pitfall 2: Reusing `JobDetailModal` for the Needs-Review section
**What goes wrong:** `JobDetailModal` requires `job` (a raw board-listing object with `applyUrl`/`dateAdded`), `blurb`, and `deadline` — none of which exist for a Needs-Review item unless Today also triggers a live GitHub board pull, which is out of this phase's scope (data flows are explicitly frozen per PROJECT.md's Scope discipline constraint) and would silently duplicate `RepoJobsView.jsx`'s auto-import logic.
**Why it happens:** CONTEXT.md's D-04 names `JobDetailModal` for "jobs" without checking what data it actually needs versus what's available outside `RepoJobsView`.
**How to avoid:** Use `ApplicationDetailModal` for Needs-Review rows instead — every Needs-Review item is already a full `apps` row by definition (auto-import writes it the moment a board pull happens), so this is a strict downgrade in effort, not a compromise.

### Pitfall 3: Silently dropping "Want to Schedule" when `ActionsTab.jsx` is deleted
**What goes wrong:** CONTEXT's D-01/D-02 never mention `scheduleContacts` (the "Want to Schedule" category); if the planner follows the 7-item list literally, `ActionsTab.jsx`'s deletion (ATTN-03) removes this currently-shipped feature with no successor.
**Why it happens:** D-01's "8 sections total" count doesn't reconcile against its own 7-item enumeration — likely an off-by-one in the auto-mode discussion, not a deliberate scope cut (its own rationale is "preserve every already-tuned surface").
**How to avoid:** Recommend the planner add a 9th section for Want to Schedule (using `ScheduleQueueRow` as-is), OR collapse OA-Due + OA-Needs-Check back into ActionsTab's current single "Online Assessments" section (netting 7 real sections + Schedule = 8, matching D-01's stated total while preserving every existing category). Either resolves the gap; silently dropping the feature does not match CONTEXT's own stated rationale and should not happen without an explicit call-out in the plan.
**Warning signs:** A plan with exactly the 7 sections named in D-01 and no mention of `scheduleContacts`/`wantsToSchedule`/`ScheduleQueueRow` anywhere.

### Pitfall 4: TimelineFindsPanel's unconditional AI scan firing in `/demo`
**What goes wrong:** If Today is added to `/demo`'s nav (required — see below) and includes a Timeline Finds section by default, `TimelineFindsPanel`'s mount-time effect (`TimelineFindsPanel.jsx:55-60`) calls the AI proxy unconditionally (gated only by "not already scanned today"), which will 401 for an anonymous demo visitor exactly like `DraftPanel` does today — except `DraftPanel` only fires on a manual click, so this would be the first *automatic* AI-triggering error in `/demo`.
**Why it happens:** Timeline Finds' "hands-off daily scan" design (explicitly modeled after Discover/Explore's background-check pattern) assumes an authenticated session; it was never exercised in `/demo` because it currently only lives inside `CalendarTab`, which isn't in `DEMO_NAV_ITEMS`.
**How to avoid:** Either omit the Timeline Finds section from Today when `isDemoMode()` is true (cheapest, matches the existing "trim what needs auth" philosophy documented in `App.jsx`'s `DEMO_NAV_ITEMS` comment), or guard `TimelineFindsPanel`'s auto-scan effect with an `isDemoMode()` check the same way `db.js` guards every fetch/write.
**Warning signs:** Visiting `/demo` → Today shows a visible timeline-scan error banner on first load with no user action taken.

## Public Demo Route — the `'today'` nav decision (flagged as open in CONTEXT.md's constraints)

CONTEXT.md's project-instructions block explicitly asks this phase to decide whether `'today'` joins `/demo`'s trimmed nav. Research finding: **it must**, not as a nice-to-have but because `DEMO_NAV_ITEMS` currently includes `'actions'`, and once `ActionsTab`/the `'actions'` tab id is deleted (ATTN-03 requires this), `/demo` would either 404-silently-filter to a non-existent tab or lose attention-feed access outright unless `'today'` replaces it in the same commit. This matches STATE.md's carried-forward blocker: *"any phase that renames a tab id or reshapes merged data must update `DEMO_NAV_ITEMS` in the same commit, not after."*

Demo-compatibility of each section, verified against `demoData.js`'s actual seed content:
- **Overdue Follow-Ups / Stale Applications / High Urgency:** fully demo-compatible — pure client-side filters over already-seeded `contacts`/`apps`, no AI/BYOK. Seed data includes at least one `wantsToSchedule: true` contact and several apps with `daysInStage > 14`.
- **Keep in Touch:** fully demo-compatible — `keepInTouchQueue` is pure client-side math; the "Log" action opens `LogInteractionModal`, which has the same fail-soft AI-extraction-only-on-click behavior already accepted for `ActionsTab`'s `DraftPanel` in demo mode today.
- **Job Boards Needs-Review:** fully demo-compatible — `demoData.js` seeds exactly 2 apps with `triage: 'Needs Review', stage: 'Wishlist'` (Airbnb, Discord — `demoData.js:86-87`), so the section will render real content, not an empty state.
- **Timeline Finds:** NOT demo-compatible as-is — see Pitfall 4. Recommend excluding this section (or its auto-scan) when `isDemoMode()`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Contact record view/edit | A new lightweight "contact preview" card | `ContactDetailModal.jsx` as-is | Already handles status/urgency/referred-by/affinity/history/relationships — reimplementing any subset for Today risks silent feature drift from the "real" contact editor |
| Application/job record view/edit | A new lightweight "job preview" card, or `JobDetailModal` retrofitted to work off `apps` rows | `ApplicationDetailModal.jsx` as-is | Already handles stage/triage/notes/AI-fit-analysis/network-at-company; retrofitting `JobDetailModal` to accept `apps` rows would require rewriting most of its prop contract (`blurb`/`deadline`/`prefs` all assume live-fetched board data) |
| Attention-derivation filter/sort logic | Re-deriving overdue/stale/urgent predicates inside `TodayTab.jsx` | `shared.jsx`'s existing `isOverdue`/`isStaleApplication`/`isUntriaged` + the new `lib/attention.js` wrapper functions | These predicates are already the single source of truth per `shared.jsx`'s own doc comments (explicitly citing that 3 places used to compute stale-ness independently before consolidation) — a 4th independent copy in `TodayTab.jsx` would reintroduce the exact drift `shared.jsx` was built to prevent |
| Keep in Touch cadence math | Anything — this is untouched | `lib/keepInTouch.js`'s `keepInTouchQueue` | Explicitly out of scope; this phase only relocates presentation |

**Key insight:** every piece of derivation logic this phase needs already exists somewhere in the codebase (mostly in `ActionsTab.jsx`, `shared.jsx`, and `lib/keepInTouch.js`); the actual net-new work is (a) one small extraction module, (b) a new presentational component, (c) wiring 2 already-existing modals to 2 categories that don't currently open them, and (d) nav plumbing. There is no scenario in this phase that calls for writing new filter/sort math from scratch.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Want to Schedule" should be added as a 9th section (or OA collapsed back to 1 section) rather than dropped | Pitfall 3 | Low — either resolution is cheap; the real risk is *silently* dropping it without the planner/user noticing, not which resolution is picked |
| A2 | Timeline Finds should get its own section header, not blend into an existing category | "What a Timeline Find actually contains" | Low — presentation-only, reversible in review; CONTEXT already flagged this as open |
| A3 | Today should be added to `/demo`'s nav (replacing `'actions'`) in this same phase, not deferred to Phase 6 | "Public Demo Route" | Medium — if deferred instead, `/demo` breaks (dead `'actions'` filter reference) the moment `ActionsTab` is deleted; recommend NOT deferring, but flag for user/planner confirmation since it technically pulls a NAV-04-flavored decision into Phase 2 |
| A4 | Timeline Finds' click target (approve-inline vs. click-through to source record) — recommended as approve-inline only | "What a Timeline Find actually contains" | Low — either choice satisfies the "acts on it in one click" spirit of ATTN-02; CONTEXT explicitly left this open |

**None of these are compliance/security/performance claims** — all are UI/IA judgment calls already flagged as open by CONTEXT.md itself; this research narrows them with concrete code facts rather than inventing new requirements.

## Open Questions

1. **Does "Want to Schedule" get a section in Today?**
   - What we know: it's a currently-shipped `ActionsTab.jsx` category (`scheduleContacts`/`ScheduleQueueRow`) not named anywhere in ATTN-01 or CONTEXT's D-01/D-02 section lists, yet `ActionsTab.jsx` is being fully deleted (ATTN-03).
   - What's unclear: whether this was a deliberate scope cut or an oversight in the auto-mode discussion.
   - Recommendation: add it as a 9th section (cheapest, zero feature loss, reuses `ScheduleQueueRow` verbatim) — flag to the user/planner explicitly rather than silently including or excluding it.

2. **Does the Timeline Find card click through to its source record, or stay approve/dismiss-only?**
   - What we know: the underlying data (`sourceType`/`sourceId`) could support a click-through for `sourceType === 'application'` at minimum (direct `ApplicationDetailModal` reuse); `'call'`/`'interaction'` sources have no equally direct 1-hop modal target.
   - What's unclear: whether ATTN-02's "each attention item deep-links to its full record" is meant to literally include Timeline Finds, given they're event-proposals, not existing records.
   - Recommendation: approve/dismiss-only for v1 of this phase (lowest risk, matches CONTEXT's "Claude's Discretion" framing); note in the plan that this is a deliberate scope-narrowing of ATTN-02 for this one category, not an oversight.

3. **Should OA-Due and OA-Needs-Check be split into 2 rendered sections (per D-01's literal wording) or stay combined as today's single "Online Assessments" section?**
   - What we know: today they're one `Section` block; D-01's list treats them as 2 named items.
   - What's unclear: whether splitting was intentional or just how CONTEXT enumerated the underlying data arrays.
   - Recommendation: keep them combined (matches current, tested UX, and resolves the "8 sections" count cleanly alongside adding Want to Schedule as open question #1) unless the planner has a specific reason to split.

## Environment Availability

Skipped — this phase has no new external tool/service/runtime dependencies. Every data source (`fetchContacts`, `fetchApplications`, `fetchInteractions`), AI call (`aiJSON` via `/claude-api` or `/openai-api`, already gated by existing BYOK/`requireUser()`), and calendar write (`createEvent` via `/google-calendar`) is already live and already used by the components being relocated. No new npm packages, no new env vars, no new provisioning.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no `test`/`spec` files, no `vitest`/`jest` config, no test script in `app/package.json` found in this repo |
| Config file | none — see Wave 0 |
| Quick run command | N/A (no automated tests exist in this repo today) |
| Full suite command | N/A |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ATTN-01 | Today shows all 8-9 sections with correct items | manual (visual UAT) | — | ❌ No test infra in repo |
| ATTN-02 | Clicking an item opens the correct detail modal | manual (visual UAT) | — | ❌ No test infra in repo |
| ATTN-03 | Actions/nudge/Keep-in-Touch-standalone/TimelineFinds-standalone are gone, not duplicated | manual (grep + visual UAT: confirm `'actions'` tab id and `ActionsTab.jsx` import are fully removed, confirm `KeepInTouchTab`'s standalone view no longer appears in `NETWORK_VIEWS`, confirm `TimelineFindsPanel` no longer renders inside `CalendarTab.jsx`) | `grep -rn "ActionsTab\|'actions'" app/src/` should return zero hits outside git history | ❌ No test infra in repo |

### Sampling Rate
- **Per task commit:** manual smoke check (dev server, click through Today's sections)
- **Per wave merge:** full manual pass through Today + verify `/demo` still works + verify no dangling `'actions'`/`ActionsTab` references
- **Phase gate:** end-of-phase human visual-verification pass (per this repo's `workflow.human_verify_mode=end-of-phase` convention already used in Phase 1)

### Wave 0 Gaps
- No test framework exists in this repo at all (confirmed: no `vitest`/`jest` dependency, no config file, no `test` script). This is a pre-existing condition, not something this phase should newly introduce — Phase 1 also had zero automated tests and relied entirely on staged human visual verification. Recommend the same approach here: no new test infra stood up, full reliance on grep-verification (for ATTN-03's "fully removed" claims) + human UAT (for ATTN-01/02's "looks right, works right" claims).

## Security Domain

Not applicable — this phase touches zero auth, zero RLS, zero new data flows, zero new external calls. Every AI/data/calendar call already goes through the same `requireUser()`-gated, RLS-scoped, BYOK-injected paths documented in `CLAUDE.md`'s "Multi-Tenant Auth + BYOK" and "API Hardening" sections; this phase only changes which component renders the results.

## Sources

### Primary (HIGH confidence — direct repo reads, this session)
- `app/src/components/ActionsTab.jsx` — full read, all 6 category computations, row components
- `app/src/components/KeepInTouchTab.jsx` + `app/src/lib/keepInTouch.js` — full read
- `app/src/components/TimelineFindsPanel.jsx` + `app/src/lib/timelineFinder.js` — full read
- `app/src/components/OverviewTab.jsx` — full read, nudge section location confirmed
- `app/src/components/jobBoards/helpers.js` + `app/src/components/jobBoards/RepoJobsView.jsx` (partial, bucket/import logic) + `app/src/components/jobBoards/GitHubTab.jsx` (full) + `app/src/components/jobBoards/JobDetailModal.jsx` (partial, prop contract) — confirmed Needs-Review data source and JobDetailModal's actual requirements
- `app/src/App.jsx` — full read, nav state, `DemoApp`, `DEMO_NAV_ITEMS`, `goFindPeople` relay
- `app/src/components/layout/Sidebar.jsx` + `app/src/components/layout/AppShell.jsx` — full read, `NAV_ITEMS` structure
- `app/src/lib/icons.js` — full read, `NAV_ICON` map
- `app/src/components/ContactDetailModal.jsx` (partial, top ~80 lines — prop contract confirmed) — `app/src/components/PipelineTab.jsx` (full) + `app/src/components/ApplicationDetailModal.jsx` (full) — confirmed `ApplicationDetailModal`'s complete prop/behavior contract and its `onFindPeople` dependency
- `app/src/shared.jsx` — full read, all shared predicates (`isOverdue`, `isStaleApplication`, `isUntriaged`, `daysSince`, `daysUntil`, `fmt`)
- `app/src/components/MetButton.jsx` — full read
- `app/src/demoData.js`, `app/src/db.js` (grep) — confirmed demo seed data includes Needs-Review apps and a schedule-queued contact
- `grep -rn "onFindPeople\|focusCompany"` across `app/src` — confirmed exact source/destination call sites for the deep-link relay
- `.planning/phases/01-visual-foundation-industrial-design-tokens-primitives/01-UI-SPEC.md` — full read, Mono primitive contract and token values this phase's new UI must reuse

### Secondary (MEDIUM confidence)
- None — no external documentation lookups were needed; this phase has no new libraries or APIs.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: N/A — no new stack, this phase reuses 100% existing components/libs
- Architecture: HIGH — every claim traced to a specific file/line read this session
- Pitfalls: HIGH — all 4 pitfalls are concrete code-verified gaps (missing modal wiring, wrong modal choice, silently-dropped category, demo AI-401 risk), not speculative

**Research date:** 2026-08-16
**Valid until:** Until this phase's plan is written (this research is tied to the exact current-state code, which the plan will change) — not a time-based "30 days" freshness window, since the very next phase's work invalidates parts of it by design (e.g. `ActionsTab.jsx`'s current shape is documented here specifically because it's about to be deleted).
