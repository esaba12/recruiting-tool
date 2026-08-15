# Recruiting OS

## What This Is

A zero-touch recruiting CRM for a student's SWE/PM internship search. Calls, emails, and job applications flow into a per-user Supabase Postgres store automatically (via a Gmail-reading Apps Script pipeline); a React + Vite dashboard is the daily-use interface. Multi-tenant since 2026-07-23 — anyone can sign up, bring their own Anthropic/OpenAI/Exa/GitHub API keys (BYOK), and get an isolated account.

## Core Value

The dashboard must be fast and cohesive to use every day during an active job search — right now it isn't: navigation has sprawled to 8 top-level tabs plus 7 buried sub-views inside just one of them, so this milestone's core value is an information architecture and visual system the user doesn't have to relearn each session.

## Requirements

### Validated

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

- [ ] Collapse the 8 top-level tabs (Overview, Network, Explore, Pipeline, Actions, Calendar, Job Boards, Settings) down to ~4-5 real destinations
- [ ] Merge the Explore (companies) → Coverage (gaps) → Discover (people) funnel — currently a top-level tab plus 2 sub-views buried inside Network — into one coherent flow
- [ ] Unify the "what needs my attention today" surfaces — currently fragmented across Overview nudges, the Actions tab, Keep in Touch's queue, Job Boards' "Needs Review" bucket, and TimelineFindsPanel (buried inside Calendar) — into a single front door
- [ ] Full visual reskin committing to a distinctive industrial/control-panel aesthetic (dense data, sharp edges, mono accents for data, dashboard-instrument feel) — replacing the current functional-but-generic Tailwind SaaS look, per the user's global frontend-aesthetics standard (avoid Inter/purple-gradient/three-card-grid defaults; commit to a real typographic and motion system; verify visually before calling any UI phase done)
- [ ] Preserve the public `/demo` route's trimmed nav and zero-backend-dependency guarantee through the restructure
- [ ] Reduce the 18 separate `rec_*` localStorage keys' surface area where the features they back get merged (not a hard requirement to eliminate all of them, but don't add more without reason)

### Out of Scope

- Backend / data-model restructuring (e.g. folding Job Boards' import mechanics directly into Pipeline's Postgres schema) — this milestone is IA + visual layer only; deeper structural changes are a separate future milestone if still wanted after the reskin
- Auth, BYOK, or multi-tenant architecture changes — already solid, unrelated to the nav/visual problem
- New AI capabilities or model/provider changes — out of scope; existing AI features get relocated, not rebuilt
- Mobile-native app — stays a responsive web dashboard (existing mobile bottom-bar/floating-action patterns carry forward, adapted to the new nav)

## Context

- Tech stack: React + Vite, Tailwind v4 (`@theme` tokens in `app/src/index.css`, no `tailwind.config.js`), Supabase (Postgres + Auth), Vercel serverless functions as auth-gated BYOK proxies, `framer-motion` (currently used sparingly: modal open/close, tab-switch fade only), `recharts` for charts, `lucide-react` icons, hand-rolled shadcn-shaped `ui/` primitives (Button, Modal, Badge, Card, Tabs, Input, Select, EmptyState).
- Current design tokens: `ink` (warm charcoal scale) + `accent` (warm amber/orange), fonts Space Grotesk (headings) / Public Sans (body) / IBM Plex Mono (reserved, barely used).
- Ground-truth nav audit (2026-08-15, verified against actual code, not stale docs): 8 top-level tabs in `Sidebar.jsx`'s `NAV_ITEMS`; `NetworkTab` alone renders 7 sub-views (Table/Cards/Graph/Keep in Touch/Coverage/Outbox/Discover) behind a segmented control; 3 floating quick-action buttons (Quick Capture, +Schedule, +Event) in the sidebar footer and mirrored as mobile FABs.
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
| Scope tier: "Consolidation + full visual reskin," not the largest tier | User wants nav/IA simplification and a real aesthetic overhaul, but explicitly ruled out deeper backend/data restructuring (e.g. Job Boards → Pipeline schema merge) for this milestone | — Pending |
| Aesthetic direction: Industrial / control-panel | User's pick among the mandated aesthetic-direction options; fits "Recruiting OS" branding as a literal dashboard/instrument-panel tool used daily | — Pending |
| Process: phased GSD milestone (discuss → plan → execute → verify per phase) over one freehand session | User explicitly wants checkpoints given the size of the change (touches every tab and component) | — Pending |
| Skipped a separate `/gsd-map-codebase` pass | This session's manual audit plus the repo's own extremely detailed `CLAUDE.md` already provide brownfield architecture context equivalent to what mapping would produce; re-deriving it was judged low-value | — Pending |

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
*Last updated: 2026-08-15 after initialization*
