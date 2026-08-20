# Phase 5: Pipeline + Job Boards Merge - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-19
**Phase:** 5-pipeline-job-boards-merge
**Areas discussed:** View-switch UI & default view, Component architecture, Demo-mode handling, Toolbar/filter bar
**Mode:** `--auto` — every area auto-resolved to its recommended option, no interactive prompts. Logged here for review.

---

## View-switch UI & default view

| Option | Description | Selected |
|--------|-------------|----------|
| Segmented control matching existing convention | Reuse the `NETWORK_VIEWS`-style pill/segmented control already used by Network's Table/Cards/Graph/Outbox and Job Boards' own internal list/calendar toggle; Applications loads first | ✓ |
| Distinct sub-tab style | Invent a visually different tab-switcher pattern just for Pipeline | |
| Job Boards as default view | Land on Job Boards instead of Applications | |

**User's choice (auto-selected):** Segmented control matching existing convention, Applications default.
**Notes:** Reuses an established, already-styled pattern instead of inventing a second one; Applications is the higher-traffic daily-use surface per PROJECT.md's core value.

---

## Component architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Shell + renamed existing bodies, zero logic changes | New `PipelineTab.jsx` becomes a thin shell wrapping renamed, unmodified `ApplicationsView.jsx` / `jobBoards/JobBoardsView.jsx` | ✓ |
| Merge into one combined component | Fold Applications and Job Boards logic into a single file with conditional rendering | |

**User's choice (auto-selected):** Shell + renamed existing bodies, zero logic changes.
**Notes:** Matches Phase 3's `GrowTab` precedent and Phase 4's `SidePanel` shell/body precedent; lowest regression risk for PIPE-02's "fully preserved" requirement.

---

## Demo-mode handling

| Option | Description | Selected |
|--------|-------------|----------|
| Hide the Job Boards toggle entirely in demo mode | Anonymous `/demo` visitors see only the Applications view, no visible toggle | ✓ |
| Show toggle with a locked/sign-up-prompt state | Toggle visible but clicking it shows an upsell/locked message | |

**User's choice (auto-selected):** Hide entirely.
**Notes:** `/gh-api` calls `requireUser()` like every other proxy, so an anonymous visitor would only ever see a 401. `'github'` was already absent from `DEMO_NAV_ITEMS` before this phase — hiding the toggle is a continuation of existing behavior, not a new gap. No other merge phase in this milestone (Grow) introduced a locked-state UI pattern.

---

## Toolbar / filter bar

| Option | Description | Selected |
|--------|-------------|----------|
| Keep separate, self-contained toolbars per view | Applications and Job Boards each keep their own filter chips/search/stats controls | ✓ |
| Merge into one shared toolbar | Combine both views' filter controls into a single unified bar | |

**User's choice (auto-selected):** Keep separate, self-contained toolbars per view.
**Notes:** The two views use materially different filter vocabularies (application stage/triage vs. job bucket/location/deadline-urgency); merging would either lose options or bloat one control. Matches Grow's (Phase 3) precedent of each section keeping its own internal controls.

---

## Claude's Discretion

- Exact segmented-control visual treatment (icon-only vs. icon+label, spacing).
- Final filenames for the extracted view bodies (`ApplicationsView.jsx`/`JobBoardsView.jsx` are suggestions, not locked).
- Whether the Job Boards toggle reuses the existing `GitFork` icon (previously the `'github'` nav icon) or a new one.

## Deferred Ideas

- ROADMAP.md's Phase 5 goal text parenthetically mentions "Applications view (Kanban/Table)" — no locked requirement (PIPE-01) asks for a new Kanban board, and the current Applications view is a flat list. Building an actual Kanban view is deferred as a future-phase idea if still wanted after this merge, not built here.
