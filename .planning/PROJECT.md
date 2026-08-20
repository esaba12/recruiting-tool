# Recruiting OS

## What This Is

A zero-touch recruiting CRM for a student's SWE/PM internship search. Calls, emails, and job applications flow into a per-user Supabase Postgres store automatically (via a Gmail-reading Apps Script pipeline); a React + Vite dashboard is the daily-use interface. Multi-tenant since 2026-07-23 — anyone can sign up, bring their own Anthropic/OpenAI/Exa/GitHub API keys (BYOK), and get an isolated account.

## Core Value

The dashboard must be fast and cohesive to use every day during an active job search — right now it isn't: navigation has sprawled to 8 top-level tabs plus 7 buried sub-views inside just one of them, so this milestone's core value is an information architecture and visual system the user doesn't have to relearn each session.

## Requirements

### Validated

- ✓ Unify the "what needs my attention today" surfaces (Overview nudges, Actions tab, Keep in Touch queue, Job Boards "Needs Review" bucket, TimelineFindsPanel) into a single "Today" front door — Phase 2

<!-- Existing, already-built capabilities — this milestone does not touch these. -->

- ✓ Multi-tenant auth (Supabase Auth, email/password + Google OAuth) with per-user Row Level Security on every data table — existing
- ✓ BYOK key vault (Anthropic/OpenAI/Exa/GitHub), AES-256-GCM encrypted, server-side only — existing
- ✓ Core data model: `contacts`, `applications`, `calls`, `interactions` tables in Supabase Postgres — existing
- ✓ Email pipeline (Google Apps Script → Claude Haiku classification → Supabase) auto-ingests recruiting emails into contacts/applications/interactions — existing
- ✓ Per-user Google Calendar integration (personal + school calendar slots), screenshot→event extraction via Claude vision — existing
- ✓ Job board aggregation (GitHub README parsing, multi-board tracking, auto-import into Pipeline, real-deadline extraction via Exa) — existing
- ✓ AI-assisted company/people discovery (Explore, Discover), referral coverage gap analysis (Coverage), cold-outreach drafting (DraftPanel/Outbox) — existing
- ✓ Public `/demo` route reusing the same components against seeded fake data, for portfolio use — existing
- ✓ API hardening: per-user rate limiting, path allowlisting on proxies, security headers — existing
- ✓ Quick Capture: free-text → AI action router (add application, log interaction, update contact, add target company) — existing

### Active

<!-- This milestone: IA consolidation + full visual reskin. -->

- [ ] Collapse the 8 top-level tabs (Overview, Network, Explore, Pipeline, Actions, Calendar, Job Boards, Settings) down to ~4-5 real destinations. **Job Boards folded into Pipeline in Phase 5** (segmented-control view switch, `PIPE-01/02/03`) — nav down to 7 entries (Today, Overview, Network, Grow, Pipeline, Calendar, Settings); remaining ~5-item collapse (Settings → footer affordance) is Phase 6.
- [ ] Merge the Explore (companies) → Coverage (gaps) → Discover (people) funnel — currently a top-level tab plus 2 sub-views buried inside Network — into one coherent flow
- [ ] Full visual reskin committing to a distinctive industrial/control-panel aesthetic (dense data, sharp edges, mono accents for data, dashboard-instrument feel) — replacing the current functional-but-generic Tailwind SaaS look, per the user's global frontend-aesthetics standard (avoid Inter/purple-gradient/three-card-grid defaults; commit to a real typographic and motion system; verify visually before calling any UI phase done). **Foundation layer shipped in Phase 1** (token values + shared `ui/` primitives + Mono data typography) — the full app-wide sweep (every low-traffic screen, motion migration, instrument-panel stat tiles) is Phase 7.
- [ ] Preserve the public `/demo` route's trimmed nav and zero-backend-dependency guarantee through the restructure
- [ ] Reduce the 18 separate `rec_*` localStorage keys' surface area where the features they back get merged (not a hard requirement to eliminate all of them, but don't add more without reason)

### Out of Scope

- Backend / data-model restructuring (e.g. folding Job Boards' import mechanics directly into Pipeline's Postgres schema) — this milestone is IA + visual layer only; deeper structural changes are a separate future milestone if still wanted after the reskin
- Auth, BYOK, or multi-tenant architecture changes — already solid, unrelated to the nav/visual problem
- New AI capabilities or model/provider changes — out of scope; existing AI features get relocated, not rebuilt
- Mobile-native app — stays a responsive web dashboard (existing mobile bottom-bar/floating-action patterns carry forward, adapted to the new nav)

## Context

- Tech stack: React + Vite, Tailwind v4 (`@theme` tokens in `app/src/index.css`, no `tailwind.config.js`), Supabase (Postgres + Auth), Vercel serverless functions as auth-gated BYOK proxies, `framer-motion` (currently used sparingly: modal open/close, tab-switch fade only), `recharts` for charts, `lucide-react` icons, hand-rolled shadcn-shaped `ui/` primitives (Button, Modal, Badge, Card, Tabs, Input, Select, EmptyState).
- Current design tokens (updated Phase 1, 2026-08-16): `ink` (cool gunmetal/graphite scale, was warm charcoal) + `accent` (safety-orange, was warm amber) + full `success`/`warning`/`danger` ramps, all contrast-validated via the `dataviz` skill's WCAG checker. Same token names as before — zero call-site edits, per the locked "same names, new values" constraint. Fonts unchanged: Space Grotesk (headings) / Public Sans (body); IBM Plex Mono is no longer "reserved, barely used" — a new `Mono` primitive (`app/src/components/ui/Mono.jsx`) now wraps dense data fields (dates, day-counts, deadlines) across Network, Pipeline, and Job Boards.
- Ground-truth nav audit (2026-08-15, verified against actual code, not stale docs): 8 top-level tabs in `Sidebar.jsx`'s `NAV_ITEMS`; `NetworkTab` alone renders 7 sub-views (Table/Cards/Graph/Keep in Touch/Coverage/Outbox/Discover) behind a segmented control; 3 floating quick-action buttons (Quick Capture, +Schedule, +Event) in the sidebar footer and mirrored as mobile FABs. **Updated after Phase 2 (2026-08-18):** still 8 top-level tabs, but `Actions` is gone and `Today` now leads the list (per D-03); `NetworkTab` is down to 6 sub-views (Keep in Touch's standalone view retired per ATTN-03 — its reconnect-cadence logic now surfaces inside Today instead). `OverviewTab`'s nudge section and `CalendarTab`'s `TimelineFindsPanel` mount are also gone, both absorbed into Today.
- `app/src/components/` has grown to 29 top-level files (6,700+ lines) plus a 13-file `jobBoards/` sub-app and a 30-file `lib/` directory; several lib modules (`hiringVelocity.js`, `networkCoverage.js`, `warmIntro.js`, `timelineFinder.js`) power features that are UI-scattered rather than co-located.
- The project's own `CLAUDE.md` is the closest thing to an existing architecture map and is treated as authoritative context for phases in this milestone, in place of a separate `/gsd-map-codebase` pass (skipped this cycle — the manual audit above plus CLAUDE.md's existing depth made a redundant automated pass low-value).
- Comparable-product research (Huntr, Teal — the two most-cited job-search CRM tools) confirms the general direction: both converge on one Kanban-style pipeline + one CRM/contacts layer, not a tab-per-feature sprawl.

## Constraints

- **Compatibility**: The public `/demo` route (`DemoApp` in `App.jsx`) reuses the exact same tab components against seeded fake data via `db.js`'s `isDemoMode()` branch — any nav restructuring must keep this working without forking components into separate "demo" versions.
- **Scope discipline**: Data flows, the 4-table Postgres schema, and RLS policies stay untouched this milestone — changes are confined to `app/src/components/`, `app/src/lib/` (UI-adjacent logic only), navigation/routing state in `App.jsx`, and the Tailwind design tokens in `index.css`.
- **Aesthetic standard**: Must follow the user's global frontend-aesthetics directive — commit explicitly to the industrial/control-panel direction, avoid generic AI-slop defaults (Inter font, purple gradients, uniform-radius three-card grids), and visually verify (render + screenshot) against that direction before any UI-facing phase is marked done.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Scope tier: "Consolidation + full visual reskin," not the largest tier | User wants nav/IA simplification and a real aesthetic overhaul, but explicitly ruled out deeper backend/data restructuring (e.g. Job Boards → Pipeline schema merge) for this milestone | Holding — Phase 1 stayed strictly token/primitive-value scope, zero data-layer touch |
| Aesthetic direction: Industrial / control-panel | User's pick among the mandated aesthetic-direction options; fits "Recruiting OS" branding as a literal dashboard/instrument-panel tool used daily | Phase 1 shipped: cool-gunmetal/safety-orange token ramp, WCAG-validated, visually confirmed via Playwright against `/demo` |
| Process: phased GSD milestone (discuss → plan → execute → verify per phase) over one freehand session | User explicitly wants checkpoints given the size of the change (touches every tab and component) | Phase 1 ran discuss (skipped, deemed redundant with existing ROADMAP/PROJECT detail) → research → UI-SPEC (2 revision rounds) → plan → execute (3 waves) → code review → verify → UAT — full loop worked end to end |
| Skipped a separate `/gsd-map-codebase` pass | This session's manual audit plus the repo's own extremely detailed `CLAUDE.md` already provide brownfield architecture context equivalent to what mapping would produce; re-deriving it was judged low-value | Held for Phase 1 — pattern-mapper + direct file reads sufficed, no gaps surfaced |
| Phase 1: token-value-only reskin, same token names, zero call-site edits | Verified via Tailwind v4 docs (Context7) that a pure `@theme` value swap requires no consumer edits; kept the "don't rename tokens" constraint enforceable | Confirmed in practice: only 3 of 8 `ui/` primitives needed any JSX diff (`Button`/`Badge`/`Tabs`); `Card`/`Input`/`Select`/`Modal`/`EmptyState`/`ChipToggleGroup` picked up the new palette with zero code changes |
| `charts/theme.js` hex-mirror sync deferred to Phase 7 | It's a hand-maintained hex duplicate of the same tokens (Recharts can't consume CSS custom properties); syncing now vs. later was a real tradeoff | Deferred as planned — Overview's donut chart will show the old palette until Phase 7; documented, not silently missed |
| Phase 2: Today's "all caught up" gate must never gate the Timeline Finds daily-scan *trigger*, only its display | First code-review pass found the gate hid a real pending item behind the EmptyState (stale count init); the smaller fix for that (Plan 02-05) was correct but incomplete — a second re-review then found the same gate also permanently prevented the scanning component from ever mounting once genuinely caught up, since it owned both the trigger and the display | Round-2 fix (Plan 02-06) extracted the trigger into a `useTimelineFinds` hook called unconditionally by `TodayTab`, above the gate — decoupling "does the scan run" from "what does the page show." Explicitly rejected reusing the review's "always render the panel" suggestion a second time, since that had already been rejected once (Plan 02-05) for breaking the UI-SPEC's single-EmptyState contract; the correct fix moves the *trigger*, not the *display*. Verified live via Playwright (not just source-level): a real scan request fired underneath a genuinely-rendered EmptyState. |
| Phase 5: shell-wraps-renamed-bodies over merged logic; segmented control over stacked sections | Follows Phase 3's `GrowTab` precedent and PIPE-02's "fully preserved" requirement — a byte-for-byte rename minimizes regression surface. Applications and Job Boards are mutually exclusive daily-use modes (unlike Grow's simultaneous funnel stages), so a `NETWORK_VIEWS`-style toggle fit better than always-rendered sections | `PipelineTab.jsx` (45-line shell) + renamed `ApplicationsView.jsx`/`jobBoards/JobBoardsView.jsx`, zero logic changes to either body. Live-verified via Playwright against `localhost:3001`: real 468-listing board pull → auto-import → Today's attention feed, SidePanel open/save from both views, `/demo` zero-chrome, mobile responsive — all pass |

**Bugs caught and fixed during Phase 1** (worth remembering for later phases): the token re-pick surfaced 3 pre-existing WCAG contrast failures not caused by this phase (Button primary 2.23:1, urgency MED 1.91:1, urgency LOW/Referral-NotAsked 4.12:1) plus one introduced-then-caught-in-review failure (JobCard's "closes soon" badge, 2.09:1) — all fixed to ≥4.5:1. A similar pre-existing failure in `RepoJobsView.jsx` (`bg-warning-500`, 2.45:1) was found but left unfixed — outside Phase 1's 10-file scope, flagged for Phase 7 or a standalone follow-up.

**Bugs caught and fixed during Phase 2:** two rounds of gap-closure were needed to fully close ATTN-01. Round 1 (Plan 02-05) fixed a first-render staleness bug (`timelineFindsCount` initialized to a stale `0` instead of reading real localStorage state). A second code-review pass then found a distinct, more serious durability bug in the same gating mechanism — the "all caught up" gate could permanently stop the daily Timeline Finds AI scan from ever running again once a user reached that state, with no escape hatch, since the component that owned the scan trigger only mounted when there was something to show. Round 2 (Plan 02-06) fixed this by relocating the trigger into a hook called unconditionally, independent of what renders. One new low-severity bug was introduced by that refactor and left open (not blocking this phase's success criteria): `useTimelineFinds.js`'s `scan()` merges AI results via a stale closure rather than a functional state update, so a `dismiss()`/`updateField()` call landing mid-scan can be silently overwritten — flagged as WR-09 in `02-REVIEW.md` for a future fix.

**Bugs caught and fixed during Phase 5:** none in the shipped code — all 6 code-review warnings (0 critical) were pre-existing patterns or accepted UX tradeoffs, not fixed this phase (see `05-REVIEW.md`). One tooling bug was caught and corrected during closeout: `roadmap.update-plan-progress` auto-checked Phase 5 `[x]` complete in ROADMAP.md the instant the last plan's summary landed, before verification or human UAT ran — identical to the bug already fixed once for Phase 4 in commit `f6a304c` one day earlier. Corrected manually again; `gsd-verifier` caught it live during Phase 5's own verification pass. The underlying `roadmap.update-plan-progress` behavior is still unfixed and will likely recur for Phase 6/7 — flagged in `STATE.md`.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-20 after Phase 5 (Pipeline + Job Boards Merge)*
