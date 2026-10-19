# 07 — Onboarding that ends with data on screen

**Status:** ✅ merged 2026-10-19 (PR #20). Smoke-tested on prod the same day with two throwaway accounts
(deleted afterwards):
- IB, no key: the Gmail step shows the key warning; both importers write through RLS; target chips
  fill from the tracker; the Ready screen shows the import counts; Today has no Keep in Touch rows
  for the imported connections.
- Consulting, every step skipped: the push link lands on Settings; the getting-started card's
  import row adds apps and the card updates on close without a reload.
- `onboarding_log` read back as e.g. `about:next → key:skip → gmail:skip → calendar:skip → data:skip → done:finish`.
- Not covered: the live first scan (needs a real Google consent), so check it when you connect your own Gmail (v1.3 02 D2).
- Fixed from the smoke test: Today hid nothing on an empty account, so the Activity tiles showed
  zeros; they now wait for the first application or interaction.

Deviations:
- The Ready screen's push link finishes the wizard and opens Settings via the URL hash (the app
  isn't mounted yet, so `rec:navigate` can't reach it).
- A scan skipped for "no AI key" no longer stamps `last_scanned_at` (Settings used to say "Last
  scanned" for a mailbox that never was).
- Shared state lives in `lib/gmailScan.js`. A finished scan or a closed importer fires
  `rec:data-changed`, which AppInner answers with a quiet refetch (no unmount).
- New rate-limit tier `SCAN` (6/hour per user).

**Who:** 🤖. **Migration:** none. **New serverless fn:** none (one new `?action=` branch in
`api/gmail.js`). **Depends on:** 01 (import UI) and 06 B (provider-agnostic scan). Land before the invite.

## Why

The wizard (`components/onboarding/OnboardingWizard.jsx`) goes About → AI key → Gmail → Calendar
→ Targets → Ready. Every step past About works. The problem is what the user sees at the end:

1. **Connecting Gmail shows nothing for up to 10 minutes.** The OAuth callback saves the token and
   redirects to `/` (`api/gmail.js` `handleOauthCallback`). The first scan waits for the next
   cron-job.org tick, and a 45-day first pass can span several ticks (`SCAN_BUDGET_MS` = 240 s).
   The user finishes the wizard and lands on a Today that says "Not much here yet". Only Settings
   says "Not scanned yet" (`SettingsTab.jsx:425`). It reads as broken, and it's the step the
   wizard calls "the magic part".
2. **Gmail without a usable key silently does nothing.** The Gmail step doesn't check keys. Skip
   the key step (or pick OpenAI, until 06 B lands) and the scan returns `skipped:
   'no_anthropic_key'` on every tick (`emailPipeline.js:660`). The wizard's Ready screen still says
   "Gmail auto-tracking: ON".
3. **The Targets step is the only way to bring anything in, and it's three hand-typed people.**
   After 01 there are real imports. They belong here, and target companies can be suggested from
   what was imported instead of typed from a hint.
4. **Phone alerts are never mentioned.** Pushes (the 11am/midnight digests, OA and interview alerts)
   are opt-in under Settings → Notifications. That's the feature that brings people back daily,
   and a new user won't find it.
5. **Nothing records which steps get skipped.** The v1.2 spec 04 decision ("revisit a shared
   trial key only if key setup is why people drop off") has no data to go on. `onboarding_step`
   only holds the current step and is cleared on finish.

## Changes

1. **"Scan now" for the signed-in user.** Add `POST /api/gmail?action=scan-mine` in `api/gmail.js`,
   in the same style as the existing `?action=test-push` branch:
   - Order: `requireUser()` → `checkRateLimit()` (strict tier, a few per hour) → scan only
     `gmail_tokens` rows for that `user_id`, with the same `scanGmailConnection` and a shorter
     budget (~60 s).
   - It respects `SCAN_COOLDOWN_MS` per connection, so it can't double-run with the cron.
   - Called automatically once, when the app loads after the OAuth redirect if a connection has
     `last_scanned_at = null`. Also available from Settings as "Scan now".
   - `/demo` short-circuits it (`lib/googleAuth.js` already has a demo branch).
2. **First-scan status on Today.** When any connection has `last_scanned_at = null`, or the
   scan-mine call is in flight, `GettingStarted` shows a live row:
   "Reading your inbox (last 45 days)… applications and contacts appear here as they're found."
   `useApplicationsLive` already pushes new rows over Realtime, so Pipeline and the counts fill
   in on their own. When the first scan finishes, the row becomes "Found N applications, M
   contacts" (counts from a refetch), then disappears from the checklist.
3. **Gmail step checks the key.** If `useKeyStatus` says the scan's provider has no key (after
   06 B: neither key), the step shows "Gmail needs an AI key to read your mail. Go back and add
   one, or connect now and it starts when you do." Connecting is still allowed. The Ready screen
   shows "Gmail: connected, waiting for a key" instead of ON.
4. **Replace the Targets step with "Bring your data"** (01's importers, now hosted here):
   - Upload/paste an application tracker, then upload LinkedIn `Connections.csv`, both skippable,
     each showing "N added" when done.
   - Then **target companies**, pre-filled as chips from the imported tracker's companies (most
     recent first, capped at 15, each removable), plus the existing free-text box and the
     track-based hint. With no imports, this is today's step.
   - The three "people you already know" rows stay only when no connections were imported.
   - `STEP_IDS` changes, so `resumeStep` restarts users saved mid-wizard on `seed` at the beginning.
     Map `seed` → `data` instead (one line in `lib/onboarding.js`, tested).
5. **Ready screen = what happens next, not just switches.** Keep the ON/off rows. Add:
   - Counts imported this session.
   - "Your first inbox scan is running" when relevant.
   - One optional line: "Get phone alerts for OAs and interviews: Settings → Notifications"
     (deep link via `rec:navigate`). Not a wizard step, since ntfy needs an app install, and that
     belongs on the user's own time.
6. **Record the funnel.** On each step transition, append `{ step, action: 'next'|'skip'|'back', at }`
   to a `user_settings` key `onboarding_log` (capped at 50 entries; the owner reads it with SQL).
   Nothing new on the client beyond `setUserSetting`. Don't clear it on finish.
   - 04-launch-week's 48h review gains one query: skips per step across users.
7. **GettingStarted checklist** (`components/onboarding/GettingStarted.jsx`):
   - Add "Import a tracker or LinkedIn connections" (opens the importer) as the first row, so
     someone who skipped it in the wizard sees it again.
   - The "Connect Gmail" row shows the waiting-for-a-key state from 3.
   - `isFreshAccount` stays the gate.

## Tests first

- `test/onboarding.test.js`:
  - `resumeStep('seed')` → `'data'`.
  - Target suggestions from imported apps: dedup by `normalizeCompanyName`, most recent first, cap 15.
  - Log append and cap.
- `test/gmail.test.js` (or the existing scan tests):
  - `scan-mine` rejects unauthenticated requests.
  - It scans only the caller's connections.
  - It honors the cooldown.
- `GettingStarted` state mapping as a pure helper: never scanned / scanning / done with counts /
  connected but no key.

## Checks

- Fresh account on prod: connect Gmail in the wizard, finish, and within about a minute Today shows
  the scan row and Pipeline starts filling. No cron tick needed.
- Fresh account with no key: the Gmail step shows the key warning, and Ready says "waiting for a key".
- Import a tracker in the wizard: the target chips are pre-filled from it.
- `select value from user_settings where key = 'onboarding_log'` shows the steps taken.
- `/demo` is unaffected (the wizard never renders there).
- Wizard at 390px.

## Done when

A friend who connects Gmail sees their own applications appear before they've left the
first screen, nobody is told a feature is on when it can't run, and you can see which step people skip.
