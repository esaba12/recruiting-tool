# 07 — OAs mark themselves done from the completion email

**Who:** 🤖. **Migration:** none. **Depends on:** nothing (lands in 03's queue either way).

## Why

After you submit a HackerRank or CodeSignal test, you get "Thank you for completing your
assessment". The Apps Script pipeline (`scripts/email-pipeline.js`) already uses that: an
`OA_COMPLETED_RE` hint, an `OA_COMPLETED` classifier type, `upsertApplication` marking the OA
done, and a quiet "✅ OA marked complete" push. The server pipeline that replaces it
(`api/_lib/emailPipeline.js`, v1.3 spec 08) only partly has it: `OA_COMPLETED` is in
`NO_ACTION_TYPES` and `pushes.js` `statusPush` has the message, but the classifier's type list
doesn't include it, there's no hint, and `upsertApplication` has no branch for it. So on the
multi-tenant pipeline an OA stays "due" until you click Mark completed. This is a port, not a new
feature.

## Changes

1. **Classifier (`api/_lib/emailPipeline.js`):** add `OA_COMPLETED` to the `"type"` list in the
   prompt with the Apps Script's definition (an automated receipt that the candidate *finished*
   the OA, distinct from `OA_INVITE`), and port `OA_COMPLETED_RE` as an `extraHints` line, same
   wording as the Apps Script. Keep the two prompts in sync (CLAUDE.md known issue) until the
   Apps Script is retired.
2. **`upsertApplication`:** for `OA_COMPLETED`, only update an existing application
   (`pickApplication`); never create one, never change `stage`. Set `oa_completed = true` and
   `last_activity`. Pure helper `oaCompletedFields(data, existing)` beside `oaInviteFields`:
   returns `{}` when there's no existing app or it's already completed.
3. **Push:** `statusPush` already has the OA_COMPLETED message; only send it when (2) changed
   something (mirrors the Apps Script's "no matching application → no push").
4. **Reversible:** the application panel's OA "Completed" toggle already exists. Add a line
   under it, "Marked done from email · Nov 11", from the matching interaction (no new column).
5. **Order safety:** a later `OA_INVITE` with a new link still reopens it (`oaInviteFields`,
   unchanged), so a second round isn't lost.

## Tests first

`test/emailPipeline.test.js`:
- `oaCompletedFields`: existing open OA → `{ oa_completed: true }`; already done → `{}`; no
  existing app → `{}`.
- The prompt contains `OA_COMPLETED`; a body matching the regex adds the hint.
- `upsertApplication` with `OA_COMPLETED` and no match inserts nothing.
- Invite (link A) → completed → invite (link B) reopens; invite (link A) again doesn't.

## Checks

Unit tests cover the logic. Live (owner): finish any OA, wait for the next scan, the OA row
leaves Today and a "✅ OA marked complete" push arrives.

## Done when

Finishing an OA is the only step; the app notices from your inbox.
