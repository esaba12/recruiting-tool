# 02 — Owner runbook: Google Cloud, Supabase, Vercel, cron

**Who:** owner. Items marked 🤖 can be run by Claude Code with approval, but auto-mode blocks
some of them; those are written as `! command` so you can run them in the session yourself.
This file replaces the P0 section of `.planning/v1.2-launch/08-ops-checklist.md`, which stays
as the record of what was decided and why. Real identifiers (project ref, prod domain, cron
secret) are in `CLAUDE.local.md`. This repo is public, so they don't go here.

Every step has a **Check** line. A step isn't done until its check passes.

## A. Google Cloud (project `recruitingos`)

Do this first. B–D don't depend on it, but 03 and the Gmail half of D do.

- [ ] **A1. Scopes.** APIs & Services → OAuth consent screen → Data access → add or confirm:
  `calendar.events`, `calendar.app.created` (non-sensitive) and `gmail.readonly` (restricted).
  **Check:** all three show in the scope list.
- [ ] **A2. Gmail API.** APIs & Services → Library → Gmail API → Enable.
  **Check:** it shows under Enabled APIs.
- [ ] **A3. Redirect URIs.** Credentials → the OAuth client behind `GOOGLE_CLIENT_ID` →
  Authorized redirect URIs. All five are needed:
  - `https://<project-ref>.supabase.co/auth/v1/callback`: Sign in with Google
  - `https://<prod-domain>/api/google-oauth-callback` and `http://localhost:3001/api/google-oauth-callback`: Calendar slots
  - `https://<prod-domain>/api/gmail` and `http://localhost:3001/api/gmail`: Gmail. The path is `/api/gmail`, not a separate callback file; it was folded in during the function-count fix.

  **Check:** in an incognito window, "Continue with Google" on prod reaches the consent screen
  with no `redirect_uri_mismatch`.
- [ ] **A4. Publish to Production, unverified** (Audience → Publish app). Users then see "Google
  hasn't verified this app → Advanced → Go to recruitingos", sign-ups are capped at 100 users,
  and the 7-day refresh-token expiry goes away. The reasons for skipping verification are in
  CLAUDE.md → Google OAuth. Ignore the branding-verification prompts.
  **Check:** the Audience page says "In production". Then disconnect and reconnect one calendar
  in Settings, and 8 days later "+ Event" still works.

## B. Supabase

- [ ] **B1. 🤖 `! supabase config push`.** The live project still has `site_url =
  http://127.0.0.1:3000`, so password-reset and magic-link emails point at localhost.
  `config.toml` already has the prod URL (`032fbd3`). Read the diff it prints before you
  confirm. If it would undo something you changed in the dashboard (auth providers, rate
  limits), say no and change `config.toml` to match the dashboard first.
  **Check:** send yourself a password reset from prod; the link goes to the prod domain.
- [ ] **B2. Custom SMTP** (Auth → SMTP settings). Built-in mail is capped at about 2/hour
  (`email_sent = 2`), so the third friend to sign up in an hour gets no confirmation email.
  Resend's free tier works: use their onboarding sender for testing, or a verified domain once
  you have one. Then raise `[auth.rate_limit] email_sent` in `config.toml` (30 is reasonable)
  and repeat B1.
  **Check:** five password resets in a row all arrive.
- [ ] **B3. Optional cleanup:** delete the `migration-test-e2e@test.dev` user (Auth → Users).
  It has `school_id = umich`, so it shows up in the shared-event RLS tests' world; it does no harm.

## C. Vercel (run from `app/`, where the project is linked)

- [ ] **C1. 🤖 Remove dead env vars.** No `api/` code reads them (checked with grep again 2026-10-16),
  so they're unneeded secret exposure:
  `! cd app && for v in ANTHROPIC_API_KEY EXA_API_KEY NOTION_API_KEY GOOGLE_REFRESH_TOKEN; do vercel env rm $v production -y; done`
  **Check:** `vercel env ls production` lists only the 7 required vars, plus `KV_REST_API_*`,
  `CRON_SECRET` and optionally `VITE_SENTRY_DSN`.
- [ ] **C2. Sentry.** Create a free Sentry project (platform React), then
  `! cd app && vercel env add VITE_SENTRY_DSN production` and redeploy (`npx vercel --prod`).
  Vite inlines `VITE_*` at build time, so it has no effect without the rebuild.
  **Check:** in the prod console, `throw` inside a component (or use Sentry's test button) and
  the event appears in Sentry within a minute.
- [ ] **C3. Upgrade the CLI** (optional): `npm i -g vercel@latest`. The installed 59.x is five majors behind.

## D. Gmail scan driver

- [ ] **D1. cron-job.org** (free): `POST https://<prod-domain>/api/gmail` every 10 min, with
  header `x-cron-secret: <CRON_SECRET>`. Vercel Hobby's own cron only runs daily, which is why
  an external pinger is needed. Without it, no one's connected Gmail is ever scanned.
  **Check:** first run it once by hand,
  `! curl -s -X POST -H "x-cron-secret: $CRON_SECRET" https://<prod-domain>/api/gmail`,
  which should return JSON with a per-connection summary. Then confirm the cron-job.org
  history shows 200s, and Vercel → Logs shows `/api/gmail` every 10 min.
- [ ] **D2. Connect your own Gmail** (Settings → "+ Connect another Gmail account"). Needs A1–A3.
  **Check:** after the next cron tick, Inbox shows the last few days of threads.
- [ ] **D3. Watch the load** once about 10 accounts are connected. Each scan loops over every
  connection, so compare the function duration against the 300s default. If it gets close,
  scan oldest-`last_scan_at`-first with a per-run cap, inside `api/gmail.js`. No new file.

## Done when

Every box above is checked. Then go to [03](03-recruiting-calendar-roundtrip.md) and [04](04-launch-week.md).
