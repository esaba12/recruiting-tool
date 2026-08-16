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
- **D-01:** Keep `ActionsTab.jsx`'s proven bucketed-`Section` pattern (title + accent color + row list) rather than a single flat chronological list. Extend it with 2 new sections for Keep in Touch (due/overdue contacts) and Job Boards Needs-Review, alongside the existing Overdue Follow-Ups / Stale Applications / High Urgency / OA-Due / OA-Needs-Check sections — 8 sections total, one per attention "reason". *Rationale: this pattern already exists, is well-tested, and a bucketed structure keeps 5 heterogeneous item types (contact/app/job/keep-in-touch/timeline-find) scannable rather than blurred into one undifferentiated list — lowest-risk choice for `--auto` mode.*
- **D-02:** Sort sections in the merged feed by time-sensitivity: Overdue Follow-Ups → Stale Applications → High Urgency Contacts → Keep in Touch Due → Job Boards Needs Review → Timeline Finds → OA-Due/OA-Needs-Check. Within each section, sort by existing per-surface logic unchanged (e.g. `staleApps` already sorts by days-in-stage descending). *Rationale: preserves each surface's already-tuned internal sort; only the section order is new, and it orders by how time-critical missing the item is.*

### "Today" as a new destination
- **D-03:** "Today" is a new top-level nav item (not a rename of Overview, not new content bolted onto Overview) — Overview keeps its existing KPI/funnel/stats content unchanged, only loses its "Needs Attention" nudge section (per ATTN-03's explicit wording: "Overview's separate nudge section... removed", implying Overview persists as a distinct tab). Position Today first in the sidebar nav order, matching ROADMAP.md Phase 6's eventual "~5 items: Today, Network, Grow, Pipeline, Calendar" ordering. *Rationale: ROADMAP.md's phase title itself is "Unified Attention Feed (Today)" and Phase 6's success criteria already list "Today" as an established destination by that point — Phase 2 is where it's created, not Phase 6.*

### Record deep-linking (ATTN-02)
- **D-04:** Each attention item deep-links to its full record using the *existing* modal/view for that record type — `ContactDetailModal` for contacts, the existing inline expand/detail flow for applications (as already used in `ActionsTab.jsx`/`PipelineTab.jsx`), `JobDetailModal` for jobs. Do NOT attempt to route these through a shared side-panel — that component doesn't exist until Phase 4 (`PANEL-01`/`PANEL-02`). *Rationale: building or partially building the shared panel here would be scope creep into Phase 4's job; reusing today's actual per-type modals satisfies ATTN-02 ("deep-links to full record in one click") without inventing new UI, and Phase 4 swaps the target later without touching this phase's feed logic.*

### Inline actions
- **D-05:** Carry forward each source surface's existing one-tap inline actions into the merged feed rows (e.g. Overdue Follow-Ups keeps "Mark followed up", Keep in Touch keeps its "Log" quick-action opening `LogInteractionModal` pre-filled, Job Boards Needs-Review keeps its triage-bucket quick actions). No new action types introduced. *Rationale: minimizes behavior change — users keep the exact interactions they already know, just relocated into one feed.*

### Claude's Discretion
- Exact visual treatment of the 8-section feed (spacing, collapse/expand behavior for sections with many items, whether OA-Due/OA-Needs-Check stay as their own sections or fold into Stale Applications) is left to planning/implementation — these are presentation details, not decisions that change what the feature does.
- Whether Timeline Finds (currently `TimelineFindsPanel.jsx` + `lib/timelineFinder.js`, buried inside Calendar) needs its own visible section header or blends into an existing category is an implementation call — RESEARCH.md should confirm what a "Timeline Find" item actually contains before the planner decides its card shape.

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
