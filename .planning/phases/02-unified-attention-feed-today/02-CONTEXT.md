# Phase 2: Unified Attention Feed (Today) - Context

**Gathered:** 2026-08-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Overdue follow-ups, stale applications, the Keep in Touch queue, Job Boards' Needs-Review bucket, and Timeline Finds merge into one "Today" destination — a new top-level unified attention feed. The 5 surfaces currently showing these separately (standalone Actions tab, Overview's nudge section, Keep in Touch's standalone queue view, TimelineFindsPanel's standalone presentation, and Job Boards' Needs-Review bucket as a triage-only view) are retired from independent presentation once merged — not left running in parallel as a 9th destination (ATTN-03). This phase does not touch the underlying data model, RLS policies, or triage/status logic that feeds these surfaces — only how they're presented and unified.

This discussion ran in `--auto` mode (autonomous discuss-phase, single pass) — every gray area below was resolved by picking the lowest-risk, most-precedented option rather than asking the user, per the user's earlier "just do it all" delegation during Phase 1's UAT. All decisions are logged with rationale so they can be revisited.

</domain>

<decisions>
## Implementation Decisions

### Feed structure
- **D-01 (revised after research):** Keep `ActionsTab.jsx`'s proven bucketed-`Section` pattern (title + accent color + row list) rather than a single flat chronological list. Sections: Overdue Follow-Ups, Stale Applications, High Urgency Contacts, **Want to Schedule** (carried forward from `ActionsTab.jsx`'s existing `scheduleContacts` — 02-RESEARCH.md found the original D-01 silently dropped this currently-shipped category; ATTN-03 requires `ActionsTab` to disappear, not for its features to disappear), OA-Due, OA-Needs-Check (kept as 2 separate sections, matching today's exact behavior — no split/merge invented), Keep in Touch Due, Job Boards Needs-Review, and Timeline Finds (own section, see D-04 revision below) — **9 sections total**. *Rationale: every section maps 1:1 to an already-shipped category; nothing is invented, nothing is silently cut.*
- **D-02:** Sort sections in the merged feed by time-sensitivity: Overdue Follow-Ups → Stale Applications → High Urgency Contacts → Keep in Touch Due → Job Boards Needs Review → Want to Schedule → OA-Due → OA-Needs-Check → Timeline Finds (last, since it's approve/dismiss suggestions rather than an overdue action — see D-04 revision). Within each section, sort by existing per-surface logic unchanged (e.g. `staleApps` already sorts by days-in-stage descending). *Rationale: preserves each surface's already-tuned internal sort; only the section order is new, and it orders by how time-critical missing the item is.*

### "Today" as a new destination
- **D-03:** "Today" is a new top-level nav item (not a rename of Overview, not new content bolted onto Overview) — Overview keeps its existing KPI/funnel/stats content unchanged, only loses its "Needs Attention" nudge section (per ATTN-03's explicit wording: "Overview's separate nudge section... removed", implying Overview persists as a distinct tab). Position Today first in the sidebar nav order, matching ROADMAP.md Phase 6's eventual "~5 items: Today, Network, Grow, Pipeline, Calendar" ordering. *Rationale: ROADMAP.md's phase title itself is "Unified Attention Feed (Today)" and Phase 6's success criteria already list "Today" as an established destination by that point — Phase 2 is where it's created, not Phase 6.*
- **D-03b (new, from research):** `/demo`'s `DEMO_NAV_ITEMS` filter (`App.jsx`) MUST gain `'today'` in this same phase, not deferred to Phase 6 — once `ActionsTab`/`'actions'` is deleted per ATTN-03, `/demo` silently breaks without this. Seed data already covers Overdue/Stale/Needs-Review sections. **Exception: Timeline Finds section is excluded from `/demo`** — its mount-time AI scan (`timelineFinder.js`) would visibly 401 with no BYOK key in demo mode.

### Record deep-linking (ATTN-02)
- **D-04 (corrected after research — original was wrong):** ~~`JobDetailModal` for jobs~~ was incorrect: Job Boards Needs-Review items are already full `apps` table rows by the time they're visible in Today (not raw board `job` objects with `blurb`/live-fetched `deadline`), so **both Stale Applications and Job Boards Needs-Review deep-link through `ApplicationDetailModal.jsx`** (currently wired only from `PipelineTab.jsx` — confirm it's reusable standalone before assuming so). Contacts still use `ContactDetailModal`. Do NOT attempt to route these through a shared side-panel — that's Phase 4 (`PANEL-01`/`PANEL-02`). **Must thread `onFindPeople`/`goFindPeople` into Today's use of `ApplicationDetailModal`**, exactly as `PipelineTab.jsx` already does — otherwise its "Find people →" button silently disappears (fails soft, easy to miss; flagged by 02-RESEARCH.md as a real cross-tab deep-link relay risk).
- **D-04b (new, from research):** Timeline Finds are NOT pointers to an existing contact/app/job record — each is an AI-proposed calendar event (`sourceType`/`sourceId`/`date`/`title`/`description`) staged in localStorage, materialized only on explicit "+ Add to Calendar". They cannot satisfy ATTN-02 the same way the other categories do. Treat as **approve/dismiss-only**, own section header, no record deep-link claim for this category.

### Inline actions
- **D-05:** Carry forward each source surface's existing one-tap inline actions into the merged feed rows (e.g. Overdue Follow-Ups keeps "Mark followed up", Keep in Touch keeps its "Log" quick-action opening `LogInteractionModal` pre-filled, Job Boards Needs-Review keeps its triage-bucket quick actions, Timeline Finds keeps its approve/dismiss actions). No new action types introduced. *Rationale: minimizes behavior change — users keep the exact interactions they already know, just relocated into one feed.*

### Shared derivation logic
- **D-06 (new, from research):** Extract `ActionsTab.jsx`'s overdue/stale filter+sort logic into a new `app/src/lib/attention.js` module, consumed by both the new Today tab and by whatever replaces `OverviewTab.jsx`'s/`App.jsx`'s independent duplicate computations of the same logic. *Rationale: 02-RESEARCH.md confirmed `OverviewTab.jsx` AND `App.jsx`'s `AppInner` both already independently duplicate this logic today — a 3rd copy in Today would be a 3rd/4th drift point; this was flagged in STATE.md as a planned extraction for this exact phase.*

### Claude's Discretion
- Exact visual treatment of the 9-section feed (spacing, collapse/expand behavior for sections with many items) is left to planning/implementation — presentation detail, not a decision that changes what the feature does.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone-level requirements and roadmap
- `.planning/REQUIREMENTS.md` §"Unified Attention Feed (ATTN)" — ATTN-01/02/03 acceptance criteria
- `.planning/ROADMAP.md` §"Phase 2: Unified Attention Feed (Today)" — goal, success criteria, dependency on Phase 1
- `.planning/PROJECT.md` — Core Value, Constraints (scope discipline: `app/src/components/`, `app/src/lib/`, `App.jsx` nav/routing, `index.css` tokens only)

### Phase 1 deliverables this phase builds on
- `.planning/phases/01-visual-foundation-industrial-design-tokens-primitives/01-UI-SPEC.md` — locked token values/typography this phase's new "Today" tab and feed cards must use (industrial palette, `Mono` primitive for dense data fields like days-overdue counts)
- `app/src/components/ui/Mono.jsx` — new typography primitive from Phase 1, likely relevant for day-count/date displays in attention rows

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/src/components/ActionsTab.jsx` (293 lines) — the closest existing analog. Has a `Section({title, subtitle, accent, children})` component and 6 category computations (`overdueContacts`, `staleApps`, `highUrgencyContacts`, `scheduleContacts`, `oaDueApps`, `oaNeedsCheckApps`) already wired to `isOverdue`/`isStaleApplication`/`isUntriaged` helpers from `shared.jsx`. `OverdueContactRow` component shows the existing inline-action pattern (expand, "Mark followed up", `hasNewerInteraction` staleness guard).
- `app/src/components/KeepInTouchTab.jsx` (93 lines) — standalone Keep in Touch queue view, to be merged in.
- `app/src/components/TimelineFindsPanel.jsx` + `app/src/lib/timelineFinder.js` — Timeline Finds source, currently buried inside Calendar.
- `app/src/components/jobBoards/helpers.js` — `BUCKET_TO_TRIAGE`/`TRIAGE_TO_BUCKET` maps; `'review'` bucket = `'Needs Review'` triage value, the Job Boards source for this feed.
- `app/src/shared.jsx` — `isOverdue`, `isStaleApplication`, `isUntriaged`, `daysSince`, `daysUntil`, `fmt` — the shared predicate/formatting helpers every source surface already uses; reuse rather than reimplement.

### Established Patterns
- Section-based grouping with an accent color per section (`ActionsTab.jsx`'s `Section` component) is the existing convention for "list of things needing action" — extend, don't replace.
- `OverviewTab.jsx` currently computes its own "Needs Attention" count independently (`overdueContacts.length + staleApps.length`) — this duplicate computation goes away once Today owns the unified feed; Overview should either drop the count or link to Today.

### Integration Points
- `App.jsx` — `NAV_ITEMS` import from `./components/layout/Sidebar.jsx`, tab-switch state (`setTab`), and the `DEMO_NAV_ITEMS` filter (currently `['overview', 'network', 'pipeline', 'actions']`) all need a new `'today'` entry threaded through — remember `/demo`'s trimmed nav must still work per PROJECT.md's Compatibility constraint (NAV-04 in Phase 6, but Today's data doesn't require auth/BYOK so it should be demo-compatible too).
- `db.js`'s `isDemoMode()` branches — Today's feed will call whatever `fetch*` functions the 5 source surfaces already call; no new Supabase queries needed, just aggregation.

</code_context>

<specifics>
## Specific Ideas

No specific ideas — this discussion ran in `--auto` mode with no user turns, so there are no direct user requirements to record beyond what's in `decisions` above and locked in ROADMAP.md/REQUIREMENTS.md.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Shared side-panel unification, referenced in D-04, is explicitly Phase 4's job, not deferred-and-forgotten — it's already on the roadmap.)

</deferred>

---

*Phase: 2-unified-attention-feed-today*
*Context gathered: 2026-08-16*
