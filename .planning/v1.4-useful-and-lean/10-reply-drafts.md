# 10 — Drafted replies with suggested call times

**Who:** 🤖. **Migration:** yes (`email_drafts`, shared file with [09](09-resume.md)). **Depends on:** 09 (résumé text), the server Gmail scan.

## Why

The scan already reads every recruiting and networking thread, and Inbox already knows which ones
need a reply. The user still writes every answer from scratch and checks their calendar by
hand to offer times. Once Gmail (and optionally Calendar) is connected, replies should be
waiting.

## Decisions (owner, 2026-10-20)

- Drafts live **in the app for now** (Inbox and Today). There's no new Google scope.
  Writing real Gmail drafts (`gmail.compose`, restricted scope, re-consent) comes later, and
  `email_drafts.gmail_draft_id` is reserved for it.
- Draft **only threads that need a reply**.
- Call-time availability is **asked in onboarding** (the Calendar step) and is editable in
  Settings. Until it's set, drafts ask the other person for times.

## Changes

1. **Migration:** `email_drafts` (unique `(user_id, reply_to_message_id)`). RLS: own
   select/update/delete. There's no client insert, since only the scan writes drafts.
2. **Classifier:** adds `needs_reply` and `reply_intent` (schedule_call | answer | confirm |
   thank | other). `follow_up_draft` stays as it is (the interview calendar event uses it). The
   Apps Script doesn't draft, so it needs no mirror.
3. **`api/_lib/replyDraft.js`:**
   - `shouldDraftReply`: a person, needs a reply, not a receipt, OA or rejection, not from the
     user, not automated or bulk, at most 7 days old, setting on, at most 8 per run.
   - `slotsFor` / `fetchBusy`: `freeBusy` across every connected calendar slot.
   - `buildReplyPrompt` / `draftReply`: standard tier, last 3 messages with quotes stripped,
     the résumé, and the exact slots. It never invents times and never commits to anything.
   - `saveReplyDraft` (ignore-duplicates; supersedes an older pending draft on the thread) and
     `settleThreadDrafts` (the user replied, so the drafts are done).
4. **`src/lib/availability.js`** (pure, server and client): `normalizeAvailability`,
   `suggestSlots` (zone- and DST-correct, ≥18h out, spread over days), `formatSlot`.
5. **Scan wiring** (`scanGmailConnection`): settings are read once per mailbox, slots are
   fetched at most once per scan and only when needed, and everything is best effort like the
   calendar event.
6. **Client:**
   - `db.js` `fetchEmailDrafts`/`updateEmailDraft` (with demo branches). App loads drafts fail-soft.
   - `buildThreads` attaches `thread.draft`.
   - Inbox: "Reply drafted" tag on the thread row, and a drafted-reply composer under the thread
     with slot chips, editable text, Copy & open in Gmail (marks it done), Copy, and Dismiss.
   - Today: a "Replies Drafted" feed (snoozable) that opens the Inbox thread.
   - Settings → Drafted replies: an on/off switch and the availability editor.
   - Wizard Calendar step: "When are you free for calls?"
   - `/demo` seeds two drafts.
7. **Not done on purpose:** a push for drafts (`pushes.js` stays at its three kinds), regenerate,
   sending, and booking the accepted time.

## Tests

`test/availability.test.js`, `test/replyDraft.test.js`, `test/replyDrafts.test.js`,
`test/inbox.test.js` (drafts on threads), `test/rls.test.js` (`email_drafts`). The RLS case
needs the migration pushed.

## Verified

- `/demo`: Today shows Replies Drafted. Clicking through opens the Inbox thread with the
  composer, at desktop and phone widths. No `/api` or Supabase requests.
- Settings renders both sections (disabled on `/demo`).
- Migration pushed 2026-10-20. The `email_drafts` RLS case passes (no client insert, re-scan never
  overwrites a dismissed draft, invisible to and not editable by another user).
- Wizard Calendar step on a throwaway account: the availability editor and its preview show,
  `user_settings.availability` saves (Mon–Thu, 9–6, 30 min, the browser zone), and Ready shows Call times ON.
- **Not yet (needs a live mailbox):** send a "could we find 30 min next week?"
  email from a second account to a connected mailbox, then Scan now. Inbox should show a draft
  with 3 free slots that avoid calendar events. Reply in Gmail; the next scan should mark it done.
