# 01 — Follow-ups clear themselves

**Who:** 🤖. **Migration:** none. **Depends on:** nothing.

## Why

A contact's Follow-Up Date says "write to this person by Nov 8". When you do, from Gmail, the
scan logs your email as an Outbound interaction within 10 minutes. The Today row ignores that:
it stays in **Overdue follow-up** in red until you click "Mark followed up", and when it does
notice a newer interaction (`hasNewerInteraction` in `TodayTab.jsx`) it only renames the button
to "Details" and explains the date is stale. That's the app asking you to confirm what it
already knows, on the most common action in the season.

"Mark followed up" also logs an `Other` interaction ("Followed up (marked via Actions)") and
pushes the date out 7 days, which re-nags you in a week whether or not that's wanted, and adds a
fake point to the Outreach chart.

## Changes

1. **Server: the scan clears a due follow-up when you write.** In `api/_lib/emailPipeline.js`,
   after `logThreadMessages` writes a new **Outbound** message for a `contactId`: if that
   contact's `follow_up_date` is on or before the message date + 3 days (you wrote within 3 days
   of the due date, or any time after it), set `follow_up_date = null`. Pure helper
   `followUpSatisfied(followUpDate, sentDate)` next to `contactFollowUpDate`, exported for tests.
   - Writing early by more than 3 days doesn't clear a later follow-up (you may have planned a
     second touch).
   - A later `FOLLOW_UP_NEEDED` email still schedules a new date (`contactFollowUpDate`, unchanged).
   - Once the date is cleared, **Awaiting reply** takes over after its threshold (it skips
     contacts with any follow-up date today, so there's no double nag).
2. **Client: the same rule, for LinkedIn/manual logs and old data.** `lib/attention.js`
   `overdueFollowUps(contacts, interactions)` drops a contact with an Outbound Email/LinkedIn/
   Call/Meeting interaction dated on or after `followUpDate − 3d`. Today stops rendering those
   rows. `hasNewerInteraction` and the "Details / the date is just stale" panel go.
3. **"Mark followed up" becomes "Done".** It sets `followUpDate` to null (no automatic +7) and
   logs one interaction, `type: 'Other'`, `direction: 'Outbound'`, summary "Followed up". The
   contact panel still lets you set a new date.
4. **`App.jsx` badge** callers of `overdueFollowUps` pass `interactions` (spec 02 replaces the
   badge formula anyway).
5. **Apps Script:** no change. The client rule (2) covers interactions it logs.

## Tests first

`test/declutter.test.js` (or new `test/followUps.test.js`):
- `followUpSatisfied`: sent 4 days before due → false; 3 days before → true; on the day → true;
  after → true; no follow-up date → false.
- `overdueFollowUps`: an Outbound Email after the due date removes the contact; an Inbound
  doesn't; an Outbound 10 days before the due date doesn't.
- The scan path: a fake db where logging an Outbound for a contact with a past `follow_up_date`
  issues the `follow_up_date: null` update; an Inbound doesn't.

## Checks

`/demo`: Amara Osei (overdue Nov 8) leaves Overdue follow-up after logging an outbound email in
her panel. "Done" clears the row and the contact panel shows no follow-up date. Live (owner):
reply to an overdue contact from Gmail and the row is gone after the next scan.

## Done when

Sending the follow-up is the only step. Nothing on Today asks you to confirm it.

## As built (2026-11-11)

- **Shared rule** in `src/lib/followUps.js` (`followUpSatisfied`, `followedUp`), imported by
  `lib/attention.js` and `api/_lib/emailPipeline.js`.
- **The scan decides inside `upsertContact`** (`followUpPatch`), not after logging. Found while
  building: the classifier can label your own "just following up" email `FOLLOW_UP_NEEDED`,
  which re-scheduled the follow-up 3 days out on every send. Now your own email that satisfies
  a due follow-up clears it and never schedules another. Threads that return early (UNRELATED /
  generic networking) clear it through `clearSentFollowUp`.
- **Awaiting reply** now includes a contact whose follow-up was sent, so the person moves from
  Overdue to Awaiting instead of disappearing.
- `/demo`: Amara Osei's seeded "Following up — Vercel SWE internship" (4 days ago, due 3 days
  ago) now clears her overdue row, which is the bug this fixes. Ryan's "Done" removes his row.
- Tests: `test/followUps.test.js` (13).

