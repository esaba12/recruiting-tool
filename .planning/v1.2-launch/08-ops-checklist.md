# 08 — Ops / launch checklist (managerial)

None of this is code. Most of it is console work only the owner can do (Google Cloud, Supabase
dashboard, Vercel, third-party signups). Items marked 🤖 can be run by Claude Code with approval.

## P0 — before the link goes out

### Ship the code
- [ ] **Merge PR #6** (`v1.2-friends-launch` → `main`). Vercel deploys `main` to prod. The preview build passed and was smoke-tested 2026-10-10 (`/`, `/demo`, `/privacy.html` all 200; the bundle contains the wizard, getting-started, no-key and feedback code). Claude Code's auto-mode blocks `gh pr merge`, so the owner merges in the GitHub UI or with `! gh pr merge 6 --merge`.
- [ ] After the merge, re-check prod: routes return 200 and the prod bundle has the same feature strings.
- [ ] 🤖 `clasp push` the Apps Script mirror (`scripts/email-pipeline.js`: finance ATS domains, keywords and `interview_round`). Check the output for "Skipping push", which means the remote manifest differs (see CLAUDE.md's clasp entry).

### Google Cloud (project `recruitingos`)
- [ ] **Decide the consent-screen mode.** Recommended: **publish to Production, unverified**. Users click through "Google hasn't verified this app → Advanced → Go to recruitingos", you're capped at 100 users, and there's no 7-day token expiry. The alternative (stay in Testing and add every friend's Google account as a Test user) means everyone's Calendar/Gmail silently breaks every 7 days.
- [ ] Credentials → OAuth client → Authorized redirect URIs, add:
  - `https://<project-ref>.supabase.co/auth/v1/callback` (Sign in with Google)
  - `https://<prod-domain>/api/google-oauth-callback` + `http://localhost:3001/api/google-oauth-callback` (Calendar slots)
  - `https://<prod-domain>/api/gmail` + `http://localhost:3001/api/gmail` (Gmail)
- [ ] OAuth consent screen → scopes → add `gmail.readonly` (and confirm `calendar.events`, `calendar.app.created`).
- [ ] APIs & Services → Library → enable **Gmail API**.

### Supabase (project ref in CLAUDE.local.md)
- [ ] 🤖 `supabase config push`. `site_url` was changed to the prod domain in `config.toml` (commit `032fbd3`), but the live project still has `http://127.0.0.1:3000`, so reset and magic-link emails point at localhost until this push runs. Auto-mode blocks it, so the owner runs `! supabase config push` and reviews the diff it prints. If the diff would overwrite settings changed in the dashboard, decline it.
- [ ] Custom SMTP (Auth → SMTP). Built-in mail is capped at about 2 emails/hour (`email_sent = 2`). Set up Resend or similar (free tier; needs a sender domain, or use their onboarding domain for testing). Then raise `email_sent` in `config.toml` to match.
- [x] 🤖 Push the v1.2 migrations (`profile_tracks`, `feedback`): pushed 2026-10-09, and `npm test` (RLS suite) passed.

### Vercel
- [ ] 🤖 Remove dead prod env vars: `ANTHROPIC_API_KEY`, `EXA_API_KEY`, `NOTION_API_KEY`, `GOOGLE_REFRESH_TOKEN`. Grep confirmed no `api/` code reads them; they're just unneeded secret exposure. Command: `! cd app && for v in ANTHROPIC_API_KEY EXA_API_KEY NOTION_API_KEY GOOGLE_REFRESH_TOKEN; do vercel env rm $v production -y; done`
- [ ] Optional: delete the leftover `migration-test-e2e@test.dev` account (Supabase → Auth → Users).
- [ ] Add `VITE_SENTRY_DSN` (after creating the Sentry project; see spec 07), then redeploy (Vite inlines `VITE_*` at build time).

### Gmail scan driver
- [ ] cron-job.org (or similar): `POST https://<prod-domain>/api/gmail` every 10 min with header `x-cron-secret: <CRON_SECRET from Vercel env>`. Without this, nobody's Gmail is ever scanned. Confirm with one manual `curl` and a log line in Vercel.
- [ ] Watch Vercel function usage after friends connect. Each scan iterates over every connected account, so check duration against the 300s default and Hobby invocation limits once there are about 10 accounts.

## P1 — launch week

- [ ] 🤖 Smoke test on prod with three disposable accounts (email/password, Google, API key), following milestone DoD #1–#3 in README.md. Delete them afterward.
- [ ] Refresh `/demo` so it shows Inbox + Learn properly (it's the "look before you sign up" link).
- [ ] Write the invite message: the link, "takes 3 minutes", what the unverified-Google screen looks like, that AI needs your own key (link to the in-app guide), and where the Feedback button is.
- [ ] Soft launch to 3–5 friends across tracks (at least 1 finance, 1 non-UMich), then read the `feedback` table and Sentry after 48h before a wider send.

## P2 — later / only if it grows

- [ ] Past about 80 users: buy a domain, move sign-in to `/login`, add a public landing page at `/`, and start Google verification (CLAUDE.md has the full path; `gmail.readonly` also needs a paid CASA assessment).
- [ ] Function cap is 12/12. Upgrade to Vercel Pro, or consolidate further, before the next new endpoint.
- [ ] Add a second campus's `schools.feed_config` row if a cluster of friends is at one school; finish v1.1 phases 14–15 (Events UI).
- [ ] Unpause or clean up the Supabase free-tier projects (`shishi` / `Stylist`) if the slot is needed.
