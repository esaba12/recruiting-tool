# Phase 3: Grow — Discovery Funnel Merge - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-17
**Phase:** 3-grow-discovery-funnel-merge
**Areas discussed:** Flow structure

---

## Flow structure

### Q1 — Overall page structure

| Option | Description | Selected |
|--------|-------------|----------|
| Stacked sections, one page | Companies / Coverage / People each render as an always-visible section on one scrollable page — mirrors Today's Section pattern from Phase 2. | ✓ |
| Step funnel with progress bar | Explicit Step 1→2→3 wizard, only one stage visible at a time, forward/back navigation. | |
| Segmented control (today's pattern, relocated) | Same Companies/Coverage/People tabs Network already used, just moved under a new Grow nav item. | |

**User's choice:** Stacked sections, one page (recommended option).
**Notes:** Chosen as the option that most literally satisfies "one connected flow ... without leaving the destination."

### Q2 — Section density / list length handling

| Option | Description | Selected |
|--------|-------------|----------|
| Cap each section, "+ show all N" expand | Show the top handful per section with a "show all" expander — keeps the page scannable without hiding sections entirely. | ✓ |
| Always show full lists, no cap | Every item renders in full every time — simplest rule, but risks a very long page. | |
| Collapsible sections (user expands/collapses) | Each section starts collapsed to a count + header — most compact, but reintroduces the accordion pattern Phase 2 removed. | |

**User's choice:** Cap each section, "+ show all N" expand (recommended option).

### Q3 — Cross-section linking behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-scroll + highlight the target section | Clicking "Find people" smooth-scrolls to the People section and highlights/pre-filters it for that company — reuses the existing focus-company mechanic, scrolling instead of tab-switching. | ✓ |
| No auto-navigation, just refresh in place | Data updates but the page doesn't move — user manually scrolls to notice the change. | |
| Inline expand within the same section | "Find people" expands a sub-panel directly under the Coverage row instead of jumping to the People section. | |

**User's choice:** Auto-scroll + highlight the target section (recommended option).
**Notes:** Called out as the single behavior that actually makes the 3 sections read as connected rather than merely co-located.

### Q4 — Empty state before any target companies exist

| Option | Description | Selected |
|--------|-------------|----------|
| Show Coverage/People with a prompt pointing up | Sections always render, but Coverage/People show an EmptyState like "Add target companies above to see gaps." | ✓ |
| Hide Coverage/People until ≥1 target company exists | Only the Companies section renders until a first target is added. | |

**User's choice:** Show Coverage/People with a prompt pointing up (recommended option).
**Notes:** Chosen to keep the "always 3 sections" mental model stable and to visually teach the funnel order on first visit.

### Wrap-up check

Asked whether to continue discussing Flow structure or move to context-writing. User selected "I'm ready for context" — no further areas were opened.

---

## Claude's Discretion

- Exact visual treatment within each section (card layout, spacing, highlight animation style/duration) — presentation detail, left to planning/implementation.
- Section internal sort/filter behavior (Coverage's gap→weak→strong sort, Discover's `discoveryScore` ranking) — carries forward unchanged, not re-litigated.
- Exact section header copy ("Companies"/"Coverage"/"People" vs. alternate wording) — left to planning.
- **D-05 (external deep-link re-pointing)** was inferred by Claude rather than directly asked — Pipeline's "Find people →" must land on Grow's People section using the same D-04 mechanic once Discover moves out of Network. Flagged in CONTEXT.md for research/planning to confirm rather than treated as fully settled by the user.

## Deferred Ideas

None — discussion stayed within phase scope. Only "Flow structure" was selected from the presented gray areas (Cross-step linking behavior, Default landing view, External deep-link target were offered but not separately selected — linking behavior and the external deep-link were folded into the Flow structure discussion above since they turned out to be inseparable from it).
