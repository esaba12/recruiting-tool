# 07 — Error reporting + in-app feedback

## Problem

There's no error tracking or analytics in the app (no Sentry or PostHog setup was found). Once
friends are using it, a broken flow is invisible unless someone texts you. `ErrorBoundary.jsx`
exists but only renders a fallback.

## Change

### Sentry (client only, no new serverless function)
- Add `@sentry/react`. Call `Sentry.init` in `main.jsx` behind `import.meta.env.VITE_SENTRY_DSN`, so it's a no-op when the DSN is unset (local dev, forks).
- `ErrorBoundary.jsx` → `Sentry.captureException` in `componentDidCatch`.
- Set the user context to the Supabase user **id only**. No email, and no request bodies: `beforeSend` strips `request.data` and any breadcrumb whose URL is `/api/keys`, so a BYOK key can never be captured.
- `sendDefaultPii: false`, and leave tracing and replay **off**. Replay would record pasted keys and email contents.
- CSP: add the Sentry ingest origin to `connect-src` in `vercel.json` (e.g. `https://*.ingest.us.sentry.io`, but confirm the exact host from the DSN).
- The release is the Vercel git SHA (`VITE_VERCEL_GIT_COMMIT_SHA`, if exposed; otherwise skip).

### Feedback button
- New migration: a `feedback` table: `id, user_id default auth.uid(), message text check (length ≤ 4000), page text, created_at`. RLS: **insert own only** (`with check (auth.uid() = user_id)`), with no select policy for clients. The owner reads it in the Supabase dashboard.
- Add a "Feedback" item in the Sidebar footer next to Settings. It opens a small modal (textarea + current tab name) and inserts via supabase-js. No email is sent and no new function is needed.
- Add `feedback` to `test/rls.test.js`: user B can't read user A's row, and user A can't insert with `user_id = B`.

### Lightweight usage signal (optional)
Skip a full analytics SDK. A daily active count can be read from `auth.users.last_sign_in_at`
plus row counts in the dashboard. Revisit if v1.2 grows past friends.

## Verification

- Throw inside a test component on a preview deploy, confirm the event lands in Sentry with only the user id, then remove the throw.
- Submit feedback, confirm the row exists, and confirm a second account gets 0 rows from `select * from feedback`.

## Managerial dependency

Create the Sentry project and set `VITE_SENTRY_DSN` in Vercel (listed in 08).
