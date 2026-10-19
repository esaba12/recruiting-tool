# 03 — After the interview: thank-you nudges

**Who:** 🤖. **Migration:** none (uses 02's `interview_at`). **Depends on:** 02.

## Why

Thank-you notes within a day of an interview or coffee chat are standard in every track, and
they matter most in IB and consulting. The app knows when you met someone (Call/Meeting
interactions, `MetButton`, event capture) and, after 02, when an interview happened. It does
nothing with either.

## Changes

1. **`lib/attention.js` `thankYouDue(apps, contacts, interactions, { now })`**, a pure derivation
   in the `awaitingReply` style:
   - **Interviews:** `interviewAt` between 48h ago and now, with no Outbound Email/LinkedIn
     interaction to a contact at that company (`normalizeCompanyName`) since `interviewAt`.
   - **Conversations:** a Call/Meeting interaction in the last 48h, with no Outbound to that
     contact since.
   - Excludes anything snoozed (`useTodayPrefs`) and Rejected/Accepted apps.
2. **Today card "Send a thank-you"** (`thankYou` in [08](08-custom-today.md)'s registry, `defaultOn`, default position just above Awaiting Reply, a people card for `dedupeAcross`, which follows layout order,
   so one person shows up once). Row actions:
   - **Draft:** a new `thank_you` kind in `lib/drafting.js`, seeded with the interaction's notes
     or key insights, or the application's role.
   - **Sent it:** logs an Outbound interaction, which clears the row.
   - **✕:** the existing snooze.
3. **Draft prompt** goes through `lib/ai.js` (`AI_MODELS.MINI`) and is gated by `NeedsKey`. With no
   key, the row still shows, and "Draft" becomes a plain template the user edits.
4. **`/demo`:** seed one call from yesterday so the section renders.

## Tests first

`test/declutter.test.js` or a new `test/thankYou.test.js`:
- In window vs out of window.
- An outbound after the interview clears it, but an outbound *before* it doesn't.
- Company match uses `normalizeCompanyName`.
- `dedupeAcross` priority: the same contact in Thank-you and Awaiting Reply only shows in Thank-you.

## Checks

Log a call in the browser and the row appears. Hit Sent it and it's gone. The no-key account
shows the template draft.

## Done when

Every interview and logged conversation gets one nudge, which goes away the moment you reply.
