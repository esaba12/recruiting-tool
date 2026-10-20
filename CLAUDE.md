# Recruiting OS — Claude Context

A recruiting CRM for students' internship searches (SWE, PM, IB, quant, consulting). Calls,
emails, applications, events and interview prep land in a per-user Supabase Postgres store, and
a React + Vite dashboard is the interface. Multi-tenant: anyone can sign up, bring their own
Anthropic/OpenAI/Exa/GitHub keys (BYOK), and get an isolated account. The original
single-tenant Notion version is legacy, kept only for the one-time migration script.

> Personal profile and real deployment identifiers (prod URL, Supabase ref, Vercel team, secrets)
> are in `CLAUDE.local.md` (gitignored). **This repo is public**: never put those in a tracked file.

**Open work:** `.planning/v1.4-useful-and-lean/README.md` (import, onboarding, custom Today,
interview/offer dates, résumé + drafted replies; its "Where we are" checklist is the live status) and `.planning/v1.3-launch-and-cleanup/README.md` (launch owner steps). Roadmap history:
`.planning/ROADMAP.md`. Deep dives by topic: `docs/architecture/` (index at the bottom).

---

## Stack

| Piece | Role |
|---|---|
| React 18 + Vite 5 (`app/`) | Dashboard. Dev at http://localhost:3001 |
| Vercel (root dir `app/`) | Hosting; auto-deploys `main`. Serverless functions in `app/api/` (**12/12 Hobby cap**) |
| Supabase | Postgres + Auth (email/password, Google, "sign in with API key") + encrypted BYOK/token vault. RLS on every user table |
| Claude (Haiku 4.5 / Sonnet) | Default AI provider; vision (screenshots) always uses Claude |
| OpenAI (GPT-5.1 / mini) | Alternate provider, picked per user in Settings |
| Exa | Public-web search: people/company discovery, apply-page deadline extraction |
| Google Calendar + Gmail APIs | Per-user OAuth (two calendar slots, N Gmail accounts) |
| Google Apps Script (`scripts/email-pipeline.js`) | Owner-only Gmail pipeline + ntfy pushes. Being replaced by `api/gmail.js` (v1.3 spec 08) |
| Upstash Redis | Per-user rate limiting (fails open when unset) |
| Recharts, motion, lucide-react, ts-fsrs, Sentry | Charts, the 3 animation moments, icons, spaced repetition, error reporting (inert without `VITE_SENTRY_DSN`) |
| pdfjs-dist (lazy chunk) | Résumé PDF → text in the browser (`lib/resumePdf.js`); the file is never uploaded |

## Commands

```bash
cd app && npm run dev          # localhost:3001; runs the real api/*.js handlers via mountApiHandler()
cd app && npm test             # vitest; loads the root .env; includes the live RLS suite (test/rls.test.js)
cd app && npm run build
cd app && npx vercel --prod    # manual deploy (must run from app/)
supabase db push               # ALWAYS dry-run first and ask the user before pushing
clasp push                     # Apps Script; "Skipping push" = remote manifest differs, clone to check first
graphify . --no-viz --code-only  # rebuild the code graph in graphify-out/
```

## Repo map

```
app/
  src/
    App.jsx            Root: /demo → DemoApp, else AuthGate → OnboardingWizard | AppInner (tabs + app-level hooks)
    db.js              The data layer. Every fetch*/add*/update* is RLS-scoped, with an isDemoMode() branch for /demo
    demoData.js        Seed data for /demo (dates relative to today)
    googleCalendar.js  Client for /google-calendar (both slots, Recruiting calendar, demo short-circuit)
    github.js          Job-board README parser (markdown + HTML tables, UTF-8-safe base64)
    shared.jsx         Business consts (STATUS_COLOR, STAGE_COLOR, isUntriaged, findDuplicateGroups…)
    index.css          Tailwind v4 @theme tokens, 5 color schemes × light/dark
    lib/               Pure logic + hooks. ai.js is the only AI entry point; ingest/ (event feeds),
                       learning/ (Learn engine), use*.js hooks mounted in AppInner
    components/        One file per tab + modals; ui/ primitives, layout/, charts/, jobBoards/,
                       events/, import/ (tracker + LinkedIn importers), learning/, onboarding/,
                       panels/ (side-panel bodies), today/
  api/                 12 Vercel functions (see "Rules"); _lib/ = shared server code (doesn't count toward the cap)
  test/                vitest suites + fixtures
  public/              privacy.html, terms.html, theme-init.js, Search Console file (never delete google*.html)
supabase/migrations/   Schema + RLS, source of truth for the data model
scripts/               email-pipeline.js (Apps Script), migrate-notion-to-supabase.js (one-time)
notion/schema.md       Legacy field reference for the migration script
docs/architecture/     Topic deep dives (moved out of this file 2026-10-16)
.planning/             Milestone specs; archive/ holds v1.0 GSD artifacts + the v1.1 handoff
```

Tabs (`NAV_ITEMS` in `components/layout/Sidebar.jsx`): **Today · Inbox · Network · Grow · Learn ·
Pipeline · Calendar**, with Settings in the sidebar footer. `/demo` shows every tab on seed data
(`demoData.js`, its own chunk, registered via `db.js` `setDemoData`).

## Rules (non-negotiable)

- **Security model.** Every user table has RLS `auth.uid() = user_id`. `user_api_keys`,
  `google_calendar_tokens` and `gmail_tokens` have **zero** client policies; only service-role
  code reads them, after `requireUser(req)`. Shared event tables (`events`, `employers`, …) are
  school-scoped reads with no client writes. Run `npm test` (RLS suite) after any policy change.
- **Every proxy** calls `requireUser()` → `checkRateLimit()` → path allowlist → key lookup, in
  that order. A proxy without `requireUser()` is a bug (that's how `api/notion.js` leaked a
  personal token before it was deleted).
- **No new `api/*.js` files.** Fold new routes into an existing handler (`gh-api.js ?upstream=`,
  `google-connect.js ?action=`, `gmail.js` by method) or upgrade to Vercel Pro first.
- **AI calls** go through `lib/ai.js` (`aiJSON`/`aiText`, `AI_MODELS.MINI|STANDARD`), never
  `claude.js`/`openai.js` directly. The one exception is vision, which uses `claude.js`.
  Server code with no browser (Gmail scan, push recap) uses `api/_lib/llm.js`, same tiers. UI copy
  names the provider via `aiProviderLabel()`. AI features fail soft without a key: `NeedsKey`
  explains it on buttons, and `lib/keyStore.js`'s `assertKey` guards the clients.
- **`/demo` must never hit an auth-gated endpoint.** New data paths need a demo branch
  (`lib/demoMode.js` `isDemoMode()`, seeds read via `db.js` `getDemoData()`); Google calls
  short-circuit in `googleCalendar.js`/`lib/googleAuth.js`, GitHub in `github.js`, and
  `assertKey` refuses every AI/Exa call on `/demo`. `lsGet`/`lsSet` are in-memory there.
- **localStorage** goes through `lib/scopedStorage.js` `lsGet`/`lsSet` (namespaced by user id).
  Don't add new `rec_*` keys without a reason; durable or shared state belongs in `user_settings`.
- **Free-text `company`/`school` stay** alongside the nullable `employer_id`/`school_id`. Never
  migrate them in place; matching keys off `normalizeCompanyName`.
- **Styling:** semantic tokens only (`bg-surface`, `text-ink-*`, `text-on-accent`, `text-link`;
  never `bg-white` or raw Tailwind colors). Chart colors go through the `dataviz` skill and `charts/theme.js`.
  Only clickable things look clickable: hover/pointer only on handlers, `text-link` only on links
  (`docs/architecture/design-system.md` → Affordances).
- **Process:** no GSD orchestration. Work inline, tests first where a spec names them, then
  `npm test && npm run build`, then check in the browser, one commit per spec. Subagents only when the user asks.
- **Never commit** `.env*`, `context.md`, `CLAUDE.local.md`, `.clasp.json`. Claude Code can't read
  `.env*` here; ask the user to run env edits with `!`.

## Gotchas worth knowing before touching code

- Vercel's catch-all dynamic routes only match one segment, so proxies are flat files with `?path=` rewrites in `app/vercel.json`. The SPA rewrite must stay **last**.
- Vite inlines `VITE_*` at **build** time: a Vercel env change needs a redeploy.
- `vercel` CLI commands must run from `app/` (Root Directory is `app`).
- PostgREST caps responses at 1,000 rows, so page with `.range()` (see `fetchLearning`).
- Anthropic rejects proxied calls that carry the browser's `Origin`: proxies build fresh headers.
- `events.umich.edu` (Cloudflare) challenges server fetches at random, so ingestion falls back to a browser relay, and relayed payloads are host-validated.
- Google OAuth consent screen: unverified apps are capped at 100 users; Testing mode means 7-day refresh tokens. The verification decision is in `docs/architecture/google-calendar.md`.
- pdf.js under the CSP: no `unsafe-eval`, so `getDocument` needs `isEvalSupported: false`. The worker comes from a same-origin `?url` import, and cleanup is `loadingTask.destroy()` (pdf.js 6 has no `doc.destroy()`).
- Reply drafts are scan-written only (`email_drafts` has no client insert policy). Slot math is pure in `src/lib/availability.js` and shared by server and client.
- ICS invites: read fields only from the `VEVENT` block (`VTIMEZONE` has its own `DTSTART`). Server-side, convert `TZID` times through `api/_lib/ics.js` (Vercel runs in UTC).
- Node 20 + Supabase Realtime in scripts/tests: pass `realtime: { transport: ws }`.
- Apps Script: more than 50 Script Properties makes the UI read-only (set them from code); `UrlFetchApp` to ntfy.sh fails intermittently (retries in place).

## Known issues

- Google refresh tokens expire every 7 days while the consent screen is in Testing mode. Fix: publish (v1.3 spec 02 A4).
- Two email pipelines with duplicated classifier prompts (`INTERVIEW_VS_NETWORKING` in both). Keep them in sync until v1.3 spec 08 lands.

## docs/architecture index

| File | Covers |
|---|---|
| `auth-and-byok.md` | Supabase Auth, sign-in-with-API-key tradeoffs, BYOK vault, scopedStorage, Notion migration |
| `api-hardening.md` | Rate-limit tiers, path allowlists, CSP/security headers, audit results |
| `ai-provider.md` | Provider switch (per user now), model tiers, OpenAI request shape |
| `dashboard-features.md` | Tab by tab: Today, Network logging, Quick Add, Keep in Touch, Discover, Explore, Job Boards, duplicates, Awaiting Reply, Pipeline Sheet + Sankey, proxy route table |
| `recruiting-events.md` | v1.1: shared pool tenancy, ingestion, enrichment/relevance, Recruiting calendar, conflict engine, imports, Events UI |
| `learn.md` | Learn: tracks, mastery engine, LeetCode sync/history/company prep, practice import, FSRS, coach |
| `google-calendar.md` | "+ Event" vision flow, two calendar slots, direct OAuth flow, why verification was skipped |
| `email-pipeline.md` | Apps Script pipeline: discovery queries, classification, referrers, invites vs interviews, ntfy pushes |
| `data-model.md` | Supabase tables vs the legacy Notion DBs |
| `design-system.md` | Tokens, schemes + dark mode, fonts, motion budget, charts |
| `deployment-and-demo.md` | Vercel env vars, deploy steps, `/demo` architecture |
| `dev-tooling.md` | graphify, GitHub MCP guardrails, project subagents, clasp |
