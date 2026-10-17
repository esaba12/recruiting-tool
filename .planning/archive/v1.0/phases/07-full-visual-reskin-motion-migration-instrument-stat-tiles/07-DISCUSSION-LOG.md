# Phase 7: Full Visual Reskin + Motion Migration + Instrument Stat Tiles - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-20
**Phase:** 7-full-visual-reskin-motion-migration-instrument-stat-tiles
**Areas discussed:** Shape system ("sharp edges"), App-wide sweep method, Motion migration mechanics, Instrument-panel stat tile design

---

## Shape system — the "sharp edges" commitment

| Option | Description | Selected |
|--------|-------------|----------|
| Tighten shape as new primitive defaults | Reduce corner radius (rounded-xl/2xl → rounded-md/sm), swap soft shadows for visible borders, define once in ui/ primitives | ✓ |
| Leave shape alone, color/typography sweep only | Keep current rounded-xl/shadow-sm card look, only fix remaining hardcoded colors | |

**User's choice (auto-selected):** Tighten shape as new primitive defaults
**Notes:** Phase 1 deliberately deferred shape ("Card surfaces stay bg-white unchanged" — `01-UI-SPEC.md` line 108). PROJECT.md's Active requirement literally names "sharp edges" as part of the industrial direction, and the user's global frontend-aesthetics directive flags "uniform border radius everywhere" as an AI-slop signal. This is the most visually consequential auto-selected decision in this phase — flagged for a human second look before planning proceeds.

---

## App-wide sweep — method and known seed list

| Option | Description | Selected |
|--------|-------------|----------|
| Systematic grep-based audit | Audit every remaining non-token color + generic-card pattern across the whole component tree, seeded with known hits | ✓ |
| Curated fixed file list | Pre-enumerate a specific file list and stop there | |

**User's choice (auto-selected):** Systematic audit, seeded with known hits
**Notes:** VIS-01 explicitly says "not just the high-traffic tabs." A fixed list risks under-covering exactly the low-traffic screens (RepoStats, UserProfileView) the requirement calls out by name. Seed list from this session's scout: `charts/theme.js` stale hex mirror, `ApplicationsView.jsx` DuplicatesPanel (orange-*), `JobPanelBody.jsx`/`ApplicationPanelBody.jsx` "Analyze →" button (indigo-*), `CalendarTab.jsx`/`ExploreTab.jsx`/`ReferralCoverageTab.jsx`/`TimelineFindsPanel.jsx` (indigo-*), `RepoJobsView.jsx`'s WCAG-failing toggle (bg-warning-500, 2.45:1), `RepoStats.jsx`/`UserProfileView.jsx` (pre-Phase-1 generic-card pattern).

---

## Motion migration mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| Mechanical swap + the 2 VIS-04-named additions | framer-motion → motion package/import swap across 5 files; new stagger only on Today's Section list + stat tiles | ✓ |
| Mechanical swap + broader animation redesign | Same swap, plus add motion to additional surfaces beyond what VIS-04 names | |

**User's choice (auto-selected):** Mechanical swap + the two VIS-04-named additions only
**Notes:** Avoids scope creep into a broader animation redesign not asked for. Matches CLAUDE.md's existing discipline ("framer-motion powers exactly 3 moments... deliberately not scattered"). Explicit exclusions preserved: `NetworkGraphTab.jsx`'s force-directed canvas (already has zero framer-motion usage) and Recharts internals (BarChart/DonutChart/TrendChart keep their own animation, no `motion` wrapper added).

---

## Instrument-panel stat tile design (STAT-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Additive tile row above existing Activity charts | New Mono-readout tile row inserted above the existing funnel/donut/trend charts in `ActivitySection`, charts stay as detailed view underneath | ✓ |
| Replace charts entirely with tiles-only | Tiles become the only representation, existing Recharts charts removed | |

**User's choice (auto-selected):** Additive tile row above existing charts
**Notes:** STAT-01's "built on the existing Recharts wiring" reads as augmenting, not discarding, the Phase-6-ported former-Overview charts. A full replacement risks losing signal PROJECT.md's Charts section already validated through the `dataviz` skill. Tile design detail (tick-mark motif vs. progress bar, exact tile count) left to the UI-SPEC stage — this phase has `UI hint: yes` in ROADMAP. Days-to-deadline sources from `rec_job_deadlines` cross-referenced against Pipeline apps, fails soft with no invented dates. Activity sparkline compresses `TrendChart`'s existing trailing-10-week data.

---

## Claude's Discretion

- Exact tile count/grid arrangement, exact radius values (rounded-md vs rounded-lg), exact border-width/color pairing for the flat-panel look.
- Whether the tick-mark/segmented visual motif on stat tiles is a bottom border, gradient fill, or thin progress bar.
- Whether Today's `Section` stagger re-triggers on every navigation or only on first mount.
- Exact `motion` package version to pin (research-stage lookup).

## Deferred Ideas

None — discussion stayed within phase scope. Two STATE.md-flagged items (`RepoJobsView.jsx` WCAG failure, `charts/theme.js` stale hex mirror) were folded into this phase's D-02 sweep rather than deferred further, since Phase 7 is the milestone's last phase.
