# Roadmap: Recruiting OS

## Overview

This is the v1.0 "UI/UX Overhaul" milestone — the first-ever GSD milestone for this repo. The app's data layer, auth, and AI proxies are already solid; what's broken is the information architecture (8 top-level tabs plus 7 sub-views buried in one of them) and the visual system (functional-but-generic Tailwind SaaS look). The journey: lay down a contrast-validated industrial design-token foundation once (Phase 1), consolidate the three highest-value fragmented surfaces one at a time — attention/triage (Phase 2), company-to-people discovery (Phase 3), and record editing (Phase 4) — fold Job Boards into Pipeline now that a shared panel exists to support its view switcher (Phase 5), finish collapsing the primary nav to ~5 destinations with Settings demoted to a footer affordance (Phase 6), and finally sweep the full, now-stable component tree with the deep industrial reskin, the `motion` migration, and instrument-panel stat tiles (Phase 7). Chrome and the content it points to land together per surface throughout — no phase moves nav ahead of the destination it targets.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Visual Foundation — Industrial Design Tokens & Primitives** - Contrast-validated industrial token values and mono-for-data typography land under the existing token names, restyling every shared `ui/` primitive with zero call-site edits elsewhere. (completed 2026-08-16)
- [x] **Phase 2: Unified Attention Feed (Today)** - Overdue follow-ups, stale applications, Keep in Touch, Job Boards' Needs-Review, and Timeline Finds merge into one "what needs attention" feed, retiring the 5 surfaces that used to show them separately. (completed 2026-08-17)
- [ ] **Phase 3: Grow — Discovery Funnel Merge** - Company targeting, referral-gap analysis, and people discovery become one connected flow on a single Grow destination. (executed 2026-08-18, awaiting human UAT — see 03-UAT.md)
- [ ] **Phase 4: Shared Record Side-Panel** - Contact, application, and job records open in one consistent side-panel component instead of 3+ divergent modals. (executed 2026-08-19, awaiting human UAT — see 04-UAT.md)
- [ ] **Phase 5: Pipeline + Job Boards Merge** - Job Boards becomes a view inside Pipeline (alongside Applications), using the shared side-panel from Phase 4 for record editing.
- [ ] **Phase 6: Navigation Consolidation Complete** - Primary nav lands at ~5 destinations (Today, Network, Grow, Pipeline, Calendar), Settings moves to a footer affordance, and every cross-tab deep link plus the public `/demo` route are verified intact.
- [ ] **Phase 7: Full Visual Reskin + Motion Migration + Instrument Stat Tiles** - Every screen — including low-traffic ones — fully commits to the industrial aesthetic, motion runs on the `motion` package, and Today's KPI tiles become gauge-like mono readouts.

## Phase Details

### Phase 1: Visual Foundation — Industrial Design Tokens & Primitives

**Goal**: The app's design tokens and shared UI primitives establish the industrial/control-panel visual foundation — contrast-validated and typographically systematic — that every later phase builds on once, not per-surface.
**Depends on**: Nothing (first phase)
**Requirements**: VIS-02, VIS-03
**Success Criteria** (what must be TRUE):

  1. Dense data fields (dates, counts, deadlines, status codes) in tables and panels render in IBM Plex Mono, replacing its current "reserved, barely used" state.
  2. The new industrial color token values pass the `dataviz` skill's contrast validator before they ship.
  3. Every shared `ui/` primitive (Button, Badge, Card, Tabs, Input, Select, Modal, EmptyState) visibly reflects the new palette and typography.
  4. All existing tabs continue to render and function correctly after the token-value swap — no regressions from reusing the same token names with new values.

**Plans**: 5/5 plans complete
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Token-value swap (index.css @theme) + shared.jsx off-token color fixes + WCAG contrast re-validation
- [x] 01-02-PLAN.md — New Mono primitive + Button/Badge/Tabs WCAG-fix and Label-weight edits

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-03-PLAN.md — Mono rollout: ContactsTable.jsx + PipelineTab.jsx
- [x] 01-04-PLAN.md — Mono rollout: jobBoards/JobCard.jsx + jobBoards/JobDetailModal.jsx

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-05-PLAN.md — Combined regression sweep + staged visual verification (end-of-phase UAT)

**UI hint**: yes

### Phase 2: Unified Attention Feed (Today)

**Goal**: Users see one unified "what needs my attention" feed instead of 5 fragmented surfaces scattered across the app.
**Depends on**: Phase 1
**Requirements**: ATTN-01, ATTN-02, ATTN-03
**Success Criteria** (what must be TRUE):

  1. User visits Today and sees one feed combining overdue follow-ups, stale applications, the Keep in Touch queue, Job Boards' Needs-Review bucket, and Timeline Finds.
  2. User clicks any attention item and lands directly on its full contact/application/job record in one click.
  3. The standalone Actions tab, Overview's separate nudge section, Keep in Touch's standalone queue view, and TimelineFindsPanel's standalone presentation are gone — not left running in parallel as a 9th destination.

**Plans**: 6/6 plans complete
Plans:
**Wave 1**

- [x] 02-01-PLAN.md — attention.js derivation module + Today nav icon prep + TimelineFindsPanel chrome refactor

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — TodayTab.jsx build: all 9 attention sections, deep-links, row-cap, Timeline Finds

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — Atomic nav cutover: Today live, Actions/Overview-nudge/Keep-in-Touch-view/TimelineFindsPanel-mount retired

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-04-PLAN.md — Combined regression sweep + staged end-of-phase visual verification

**Gap closure (round 1)** *(from 02-VERIFICATION.md — Truth 1 / ATTN-01 confirmed BLOCKER, corroborated by 02-REVIEW.md CR-01)*

- [x] 02-05-PLAN.md — Fix TodayTab.jsx's "all clear" gate: initialize timelineFindsCount synchronously from localStorage so real pending Timeline Finds items are never hidden behind the page-level EmptyState

**Gap closure (round 2)** *(from 02-VERIFICATION.md re-verification pass — re-scoped Truth 1 / ATTN-01, corroborated by 02-REVIEW.md CR-01 "new": Timeline Finds' daily scan could never run again once a user reached a genuinely all-caught-up state)*

- [x] 02-06-PLAN.md — Extract useTimelineFinds.js hook so the daily scan trigger runs unconditionally in TodayTab (above the allEmpty gate), decoupled from TimelineFindsPanel's own (still gated) mount

**UI hint**: yes

### Phase 3: Grow — Discovery Funnel Merge

**Goal**: Company targeting, referral-gap analysis, and people discovery become one connected flow on a single Grow destination.
**Depends on**: Phase 1
**Requirements**: GROW-01, GROW-02
**Success Criteria** (what must be TRUE):

  1. User moves from company targeting through referral-gap analysis into people discovery without leaving the Grow destination.
  2. Every existing capability — company ranking, referral gap detection, people discovery, cold-outreach drafting — still works, just re-housed under Grow.
  3. The standalone Explore top-level tab and the Coverage/Discover sub-views previously buried inside Network no longer exist as separate destinations.

**Plans**: 8/8 plans complete
Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Extract ui/Section.jsx (Section/RowCap/HEADING_COLOR) out of TodayTab.jsx, add Mono step-index prop
- [x] 03-02-PLAN.md — Sidebar/icons: rename NAV_ITEMS 'explore'→'grow', add NAV_ICON.grow (Sprout)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-03-PLAN.md — ExploreTab.jsx: strip header, add onTargetAdded prop, apply RowCap
- [x] 03-04-PLAN.md — ReferralCoverageTab.jsx: fix auto-expand textarea, new EmptyState copy, port focus/highlight mechanic, apply RowCap
- [x] 03-05-PLAN.md — DiscoverTab.jsx: fix stale EmptyState copy, apply RowCap to Recommended list

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-06-PLAN.md — GrowTab.jsx (new): 3-section always-rendered page, coverageFocus/peopleFocus state, cross-section scroll+highlight wiring

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 03-07-PLAN.md — App.jsx: re-point goFindPeople to Grow, swap tab routing, remove NetworkTab's dead Coverage/Discover sub-views

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 03-08-PLAN.md — Combined regression sweep + staged end-of-phase manual verification

**UI hint**: yes

### Phase 4: Shared Record Side-Panel

**Goal**: Contact, application, and job records open in one consistent side-panel component instead of 3+ divergent modal implementations.
**Depends on**: Phase 1
**Requirements**: PANEL-01, PANEL-02
**Success Criteria** (what must be TRUE):

  1. User opens a contact, an application, and a job listing and sees the same side-panel component/pattern each time.
  2. Every view/edit capability the replaced modals supported (contact status/urgency/referred-by, application stage/triage, job triage bucket, etc.) still works from the shared panel — no feature regression.

**Plans**: 5/5 plans complete
Plans:
**Wave 1**

- [x] 04-01-PLAN.md — ui/SidePanel.jsx shell + lib/useMediaQuery.js + panels/JobPanelBody.jsx port
- [x] 04-02-PLAN.md — panels/ContactPanelBody.jsx port (19 form keys, relationships, history) + optional onBack

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-03-PLAN.md — panels/ApplicationPanelBody.jsx port + NetworkAtCompany + D-05 in-place record swap

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-04-PLAN.md — Re-point all 9 render sites across 6 files, delete the 3 legacy record modals

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 04-05-PLAN.md — Combined regression sweep + staged end-of-phase manual verification

**UI hint**: yes

### Phase 5: Pipeline + Job Boards Merge

**Goal**: Applications and Job Boards live under one Pipeline destination with a view switch, instead of two separate top-level tabs.
**Depends on**: Phase 4
**Requirements**: PIPE-01, PIPE-02, PIPE-03
**Success Criteria** (what must be TRUE):

  1. User switches between an Applications view and a Job Boards view from within one Pipeline destination.
  2. Every existing Job Boards capability — multi-board tracking, auto-import, real-deadline extraction, triage buckets, calendar/stats views — still works inside the merged destination.
  3. A job auto-imported from Job Boards lands in the Applications table with Triage='Needs Review' and shows up in Today's unified attention feed.
  4. Editing an application or job record inside the merged Pipeline destination opens the shared side-panel from Phase 4.

**Plans**: 1/2 plans executed
Plans:
**Wave 1**

- [x] 05-01-PLAN.md — Rename both tab bodies verbatim, add the PipelineTab view-switch shell, collapse the render branches and nav entry

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 05-02-PLAN.md — Combined regression sweep + staged end-of-phase manual verification

**UI hint**: yes

### Phase 6: Navigation Consolidation Complete

**Goal**: The primary nav is a persistent ~5-item destination list, Settings is demoted to a footer affordance, and every cross-tab deep link plus the public demo route survive the restructure.
**Depends on**: Phase 2, Phase 3, Phase 5
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04
**Success Criteria** (what must be TRUE):

  1. User reaches Today, Network, Grow, Pipeline, and Calendar from a persistent nav of ~5 items, down from the original 8 top-level tabs.
  2. User reaches Settings via a footer/profile affordance rather than a primary nav slot.
  3. Every existing cross-tab deep link (e.g. "Find people →" from Pipeline/Grow into Discover) still works, including repeat clicks re-triggering on the same target company.
  4. The public `/demo` route still shows its trimmed nav and functions with zero backend/BYOK dependency.

**Plans**: TBD
**UI hint**: yes

### Phase 7: Full Visual Reskin + Motion Migration + Instrument Stat Tiles

**Goal**: Every screen — including low-traffic ones — fully commits to the industrial/control-panel aesthetic against the final, stable component tree; motion runs on the `motion` package; Today's KPI tiles read as instrument-panel gauges.
**Depends on**: Phase 6
**Requirements**: VIS-01, VIS-04, STAT-01
**Success Criteria** (what must be TRUE):

  1. Every screen, including low-traffic ones like Job Boards' RepoStats/UserProfileView, visibly reflects the industrial color/typography/border/motion system — not just the high-traffic tabs.
  2. Staggered reveals and transitions run through the `motion` package, with the force-directed network graph canvas and Recharts internals explicitly untouched by the migration.
  3. Today's KPI tiles read as gauge-like mono readouts (funnel counts, days-to-deadline countdowns, an activity sparkline) instead of generic card grids, built on the existing Recharts wiring.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Visual Foundation | 5/5 | Complete    | 2026-08-16 |
| 2. Unified Attention Feed | 6/6 | Complete    | 2026-08-17 |
| 3. Grow — Discovery Funnel Merge | 8/8 | Complete   | 2026-08-18 |
| 4. Shared Record Side-Panel | 5/5 | Complete   | 2026-08-19 |
| 5. Pipeline + Job Boards Merge | 1/2 | In Progress|  |
| 6. Navigation Consolidation Complete | 0/TBD | Not started | - |
| 7. Full Visual Reskin + Motion + Stat Tiles | 0/TBD | Not started | - |
