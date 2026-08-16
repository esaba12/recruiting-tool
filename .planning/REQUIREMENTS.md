# Requirements — v1.0 UI/UX Overhaul

## v1 Requirements

### Navigation (NAV)

- [ ] **NAV-01**: User can reach every primary destination (Today, Network, Grow, Pipeline, Calendar) from a persistent nav of ~5 items, down from the current 8 top-level tabs
- [ ] **NAV-02**: User reaches Settings via a footer/profile affordance rather than a primary nav slot
- [ ] **NAV-03**: Every existing cross-tab deep link (e.g. "Find people →" from Pipeline/Explore into Discover) continues to work after the restructure, including repeat-click re-triggering on the same target company
- [ ] **NAV-04**: The public `/demo` route continues to show its trimmed nav and function with zero backend/BYOK dependency after the restructure

### Unified Attention Feed (ATTN)

- [x] **ATTN-01**: User sees one unified "what needs attention" feed on Today, combining overdue follow-ups, stale applications, the Keep in Touch queue, Job Boards' Needs-Review bucket, and Timeline Finds — replacing 5 previously separate surfaces
- [ ] **ATTN-02**: Each attention item deep-links to its full record (contact/application/job) in one click
- [ ] **ATTN-03**: The standalone Actions tab, Overview's separate nudge section, Keep in Touch's standalone queue view, and TimelineFindsPanel's standalone presentation are removed once merged into Today — not left running in parallel as a 9th destination

### Grow — Discovery Funnel Merge (GROW)

- [ ] **GROW-01**: User moves through company targeting → referral-gap analysis → people discovery as one connected flow on a single Grow destination, not 3 separate places (today: a top-level Explore tab plus 2 sub-views buried inside Network)
- [ ] **GROW-02**: Existing Explore/Coverage/Discover functionality (company ranking, referral gap detection, people discovery, cold-outreach drafting) is fully preserved, just re-housed under Grow

### Pipeline + Job Boards Merge (PIPE)

- [ ] **PIPE-01**: User switches between an Applications view (Kanban/Table) and a Job Boards view within one Pipeline destination, instead of two separate top-level tabs
- [ ] **PIPE-02**: Existing Job Boards functionality (multi-board tracking, auto-import, real-deadline extraction, triage buckets, calendar/stats views) is fully preserved inside the merged Pipeline destination
- [ ] **PIPE-03**: Job listings auto-imported from Job Boards continue to land in the Applications table with Triage='Needs Review' and continue feeding the unified Attention feed (ATTN-01)

### Shared Record Side-Panel (PANEL)

- [ ] **PANEL-01**: User opens a contact, application, or job record in one consistent side-panel component instead of 3+ divergent modal implementations
- [ ] **PANEL-02**: The shared panel supports every view/edit capability the modals it replaces already had — no feature regression on contact/application/job editing

### Visual Reskin — Industrial / Control-Panel (VIS)

- [ ] **VIS-01**: The app commits to a distinctive industrial/control-panel visual direction — new color, typography, border, and motion tokens applied consistently across every screen, including low-traffic ones (e.g. Job Boards' `RepoStats`/`UserProfileView`), not just the high-traffic tabs
- [x] **VIS-02**: IBM Plex Mono is applied systematically to numeric/data fields (dates, counts, deadlines, status codes) across dense tables and panels, replacing its current "reserved, barely used" state
- [x] **VIS-03**: New token values pass a contrast validation check (via the repo's existing `dataviz` skill validator) before being applied app-wide
- [ ] **VIS-04**: New motion (staggered reveals, transitions) is implemented via the `motion` package (successor to `framer-motion`, mechanical import-path migration) and explicitly excludes the force-directed network graph canvas and Recharts internals, to avoid performance regressions

### Instrument-Panel Stat Tiles (STAT)

- [ ] **STAT-01**: Today's KPI tiles are restyled as gauge-like mono readouts (funnel counts, days-to-deadline countdowns, activity sparkline) instead of generic card grids, reusing the existing Recharts wiring

## Future Requirements (Deferred Past This Milestone)

- Global command palette (Cmd/Ctrl-K) extending Quick Capture's AI action router into a full navigate+act palette — deferred, not required to fix the nav-sprawl problem itself; revisit once the collapsed nav makes the palette's index simpler to build
- Panel-light (square/LED) status iconography replacing rounded pill badges — pure polish, low risk to defer
- Dense ledger-style list rows as the app-wide default list style — highest surface area of the P3 items, sequence into a future milestone
- User-configurable "saved views" (Attio-style arbitrary filter/column builder) — explicitly out of scope; disproportionate for this tool's scale and edges into data-modeling work

## Out of Scope

- Backend / Supabase data-model restructuring (e.g. folding Job Boards' import mechanics directly into Pipeline's Postgres schema, changing table shapes) — this milestone is IA + visual layer only, per PROJECT.md
- Auth, BYOK, or multi-tenant architecture changes — unrelated to the nav/visual problem, already solid
- New AI capabilities or model/provider changes — existing AI features get relocated, not rebuilt or extended
- Introducing a client-side router — research (ARCHITECTURE.md) confirmed the existing closure/prop-relay deep-link pattern already covers what's needed; a router would touch `vercel.json`, `NotFoundPage.jsx`, and `/demo`'s pathname branching, all out of this milestone's file boundary
- Mobile-native app — stays a responsive web dashboard; existing mobile bottom-bar/floating-action patterns carry forward, adapted to the new nav

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VIS-02 | Phase 1 | Complete |
| VIS-03 | Phase 1 | Complete |
| ATTN-01 | Phase 2 | Complete |
| ATTN-02 | Phase 2 | Pending |
| ATTN-03 | Phase 2 | Pending |
| GROW-01 | Phase 3 | Pending |
| GROW-02 | Phase 3 | Pending |
| PANEL-01 | Phase 4 | Pending |
| PANEL-02 | Phase 4 | Pending |
| PIPE-01 | Phase 5 | Pending |
| PIPE-02 | Phase 5 | Pending |
| PIPE-03 | Phase 5 | Pending |
| NAV-01 | Phase 6 | Pending |
| NAV-02 | Phase 6 | Pending |
| NAV-03 | Phase 6 | Pending |
| NAV-04 | Phase 6 | Pending |
| VIS-01 | Phase 7 | Pending |
| VIS-04 | Phase 7 | Pending |
| STAT-01 | Phase 7 | Pending |

**Coverage:** 19/19 v1 requirements mapped.

---
*Requirements defined: 2026-08-15*
*Traceability filled in: 2026-08-15 (roadmap creation)*
