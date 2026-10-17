# Phase 2: Unified Attention Feed (Today) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-16
**Phase:** 2-unified-attention-feed-today
**Areas discussed:** Feed structure, "Today" as a new destination, Record deep-linking, Inline actions

**Mode:** `--auto` (autonomous, single pass, no user turns) — every choice below was auto-selected as the lowest-risk/most-precedented option rather than asked interactively, per the user's "just do it all" delegation during Phase 1's UAT session.

---

## Feed structure

| Option | Description | Selected |
|--------|-------------|----------|
| Bucketed sections (extend `ActionsTab.jsx`'s `Section` pattern) | Group by attention "reason" (overdue, stale, keep-in-touch, needs-review, etc.), 8 sections total | ✓ |
| Single flat chronological list | All 5 sources interleaved by date/urgency into one undifferentiated list | |

**Auto-selected:** Bucketed sections.
**Notes:** Already a proven, tested pattern in the codebase; a flat list would blur 5 heterogeneous item types together, working against the "scannable" goal of the feature.

---

## "Today" as a new destination

| Option | Description | Selected |
|--------|-------------|----------|
| New top-level nav item | Today is its own tab, Overview keeps existing KPI/funnel content minus its nudge section | ✓ |
| Rename Overview to Today | Overview tab becomes Today, absorbing both existing content and the new feed | |

**Auto-selected:** New top-level nav item.
**Notes:** ATTN-03's wording ("Overview's separate nudge section... removed") implies Overview persists as a distinct tab; ROADMAP.md Phase 6 already lists "Today" as an established destination by that point, meaning Phase 2 is where it's created.

---

## Record deep-linking (ATTN-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing per-type modals | `ContactDetailModal`, existing app detail flow, `JobDetailModal` | ✓ |
| Build/partially-build shared side-panel now | Anticipate Phase 4's `PANEL-01`/`PANEL-02` shared panel | |

**Auto-selected:** Reuse existing per-type modals.
**Notes:** The shared side-panel is explicitly Phase 4's scope (`PANEL-01`/`PANEL-02`) — building any part of it here would be scope creep. ATTN-02 only requires one-click access to the full record, which today's existing modals already satisfy.

---

## Inline actions

| Option | Description | Selected |
|--------|-------------|----------|
| Carry forward each source's existing actions | "Mark followed up", Keep in Touch's "Log", Job Boards triage buttons — unchanged, just relocated | ✓ |
| Design new unified action set | New generic action UI shared across all attention item types | |

**Auto-selected:** Carry forward existing actions.
**Notes:** Minimizes behavior change for users who already know these interactions; a new unified action model isn't required by ATTN-01/02/03.

---

## Claude's Discretion

- Exact visual treatment of the 8-section feed (spacing, section collapse/expand for long lists, whether OA-Due/OA-Needs-Check merge into Stale Applications or stay separate) — presentation detail, left to planning.
- Timeline Finds' card shape/section grouping — deferred until RESEARCH.md confirms what a "Timeline Find" item actually contains.

## Deferred Ideas

None — discussion stayed within phase scope.
