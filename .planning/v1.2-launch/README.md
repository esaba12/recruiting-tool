# v1.2 — Friends Launch

**Goal:** a friend recruiting for SWE, PM, IB, quant, or consulting can sign up from a link, get through
setup without help, and see something useful on day one.

**Written:** 2026-10-09, from a launch-readiness review (graph rebuilt the same day, 1,457 nodes).
**Execution:** direct, no GSD orchestration. Ask before any `supabase db push`.

## What's already ready (no work needed)

- Per-user isolation: RLS on every user table, `test/rls.test.js` covers it.
- BYOK keys and Google tokens are encrypted, with zero client-facing policies.
- Rate limiting is live in prod (Upstash, verified 2026-08-11).
- Prod is up (`/` returns 200), and `main` is in sync with `origin/main`.
- No server code falls back to a global `ANTHROPIC_API_KEY`/`EXA_API_KEY` (checked with grep), so a friend can't spend your keys.

## Status (2026-10-10)

Specs 01–07 are **committed on branch `v1.2-friends-launch` and open as PR #6, not merged**. The
preview deploy passed and was smoke-tested. Both migrations (`20261009000000_profile_tracks`,
`20261009010000_feedback`) are pushed to the live project, and `npm test` passes (278 tests,
including the live RLS suite; also passes under `TZ=America/New_York`). What's left before launch
is in [08](08-ops-checklist.md) → "Ship the code": merge, `supabase config push`, `clasp push`, and
the Vercel env cleanup. Rendered and checked in a browser:
the wizard (desktop and 390px), Today's getting-started state, Settings, Pipeline and Grow for an
IB-only account. Deviations from the specs:
- 02: resume after OAuth uses the saved `onboarding_step` alone (callbacks already redirect to
  `/`), with no `?resume` param. Target companies are free text for every track (no YC autocomplete).
- 04: one central guard (`lib/keyStore.js`'s `assertKey`, called inside the claude/openai/exa
  clients) plus `NeedsKey` on user-facing buttons, instead of wrapping every call site. Key status
  **fails open** when `/api/keys` can't be read (e.g. a 429), so users with keys are never locked out.
- 05: added `interview_round` to the classifier, so superday/final-round invites land on Onsite
  for every user. Apps Script mirror edited but **not `clasp push`ed**.
- 07: Sentry stays inert until `VITE_SENTRY_DSN` is set (see 08).
- Found along the way and fixed (`de19631`): Settings' "AI provider" dropdown now switches
  providers at runtime (`lib/aiProvider.js`), not only through the build-time `VITE_AI_PROVIDER`.
- Also fixed after review: date-only values now parse as local days (`lib/dates.js`); the demo
  data got valid stages and finance samples; Today's mobile rows no longer overlap. Rows written
  earlier with a UTC "today" were not migrated.
- Known, separate: Learn's LeetCode prep isn't working right. It needs its own investigation and
  isn't part of v1.2.

## Order: code first, then managerial work

| # | Spec | Kind | Migration | New serverless fn |
|---|------|------|-----------|-------------------|
| 01 | [Multi-track profile](01-multi-track-profile.md) | code | yes (`tracks`, `onboarded_at`) | no |
| 02 | [Onboarding wizard](02-onboarding-wizard.md) | code | uses 01 | no |
| 03 | [Track-aware surfaces + empty states](03-track-aware-surfaces.md) | code | no | no |
| 04 | [No-key mode](04-no-key-mode.md) | code | no | no |
| 05 | [Finance-aware AI prompts](05-finance-aware-prompts.md) | code (+ Apps Script mirror) | no | no |
| 06 | [De-personalize leftovers](06-depersonalize.md) | code | no | no |
| 07 | [Errors + feedback](07-errors-and-feedback.md) | code | yes (`feedback` table) | no |
| 08 | [Ops / launch checklist](08-ops-checklist.md) | **managerial**: consoles, config, env | config push | — |

Dependencies: 01 → 02 → 03. Specs 04–07 are independent of each other and can land in any order after 01.
08 can start any time, but its P0 items must be done before the link goes out.

**Function budget:** we're at 12/12 Vercel Hobby functions. Nothing in 01–07 adds an `api/*.js` file:
onboarding and feedback write through RLS from the client, and Sentry runs client-side only.
If an implementation turns out to need a server route, fold it into an existing function
(the `gh-api.js ?upstream=` / `google-connect.js ?action=` pattern) instead of adding a file.

## Out of scope for v1.2

- Google OAuth verification and buying a custom domain (only matters past about 100 users; see CLAUDE.md, "Google OAuth verification").
- Shared trial budget on the owner's Anthropic key (see 04, "Rejected alternative").
- A finance job-board source (03 hides Job Boards for non-SWE tracks instead).
- Events for campuses other than UMich (needs a `schools.feed_config` row per campus; phases 14–15 Events UI are still pending from v1.1).

## Definition of done (whole milestone)

1. A fresh account created through each sign-in path (email/password, Google, API key) lands in the wizard, finishes it, and reaches a Today page that isn't misleadingly empty.
2. A test account with `tracks = ['ib']` never sees GitHub job boards, YC-only Explore, or LeetCode widgets, and its Learn page seeds the IB template.
3. An account with no AI key can use Pipeline, Network, Calendar, and manual logging with no error banners, and every AI button explains why it's disabled.
4. A thrown render error shows up in Sentry, and the Feedback button writes a row.
5. Every P0 item in 08 is checked off, and three test friends (at least one non-SWE) complete sign-up unassisted.
