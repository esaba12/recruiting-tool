# 05 — Send drafted replies from Today

**Who:** 🤖 (A); 👤 decision then 🤖 (B). **Migration:** none. **Depends on:** 03.

## Why

The Gmail scan writes a reply (v1.4 spec 10) and Today lists it, but sending it means: click the
row → Inbox opens the thread → "Copy & open Gmail" → find the thread → paste → send. The
connection is `gmail.readonly` (`api/_lib/googleOAuth.js`), so the app can't put the draft in
Gmail itself.

## A — Copy & open Gmail on the row (build now)

1. Extract the composer's send path from `InboxTab.jsx` (the "Copy & open Gmail" handler around
   the `navigator.clipboard.writeText` / `gmailThreadUrl` code) into `lib/replySend.js`
   `copyAndOpen(draft, thread)`, so Inbox and Today share it.
2. The queue's `reply` row: primary **Copy & open Gmail** (copies the draft body, opens the
   thread with `gmailThreadUrl`, toast "Copied. Paste in Gmail."), secondary **Edit** (expands
   the draft inline, same editor as Inbox) and **Open in Inbox**.
3. After copying, the row shows "Waiting for you to send" until the next scan sees your reply on
   the thread and marks the draft done (already built in spec 10), so it leaves on its own.
4. `/demo`: copying works with the seeded drafts; opening Gmail is replaced by the demo toast
   (no external navigation from `/demo` rows, same as Inbox).

**Tests:** `test/replyDrafts.test.js` gains `copyAndOpen` with a stub clipboard and `window.open`;
clipboard failure falls back to selecting the text in the inline editor.

## B — Real Gmail drafts (decide with OAuth verification)

Add `gmail.compose` to `GMAIL_OAUTH_SCOPE`. At scan time, after writing an `email_drafts` row,
call `users.drafts.create` with the thread's `threadId` and `In-Reply-To`/`References` headers,
store the Gmail draft id on the row, and Today's primary becomes **Open draft in Gmail**. Deleting
or sending in Gmail is picked up by the next scan.

Cost: `gmail.compose` is a restricted scope like `gmail.readonly`, so it doesn't change the
verification tier, but every connected mailbox must **Reconnect** to grant it, and a draft
appearing in someone's Gmail unasked is a bigger trust step than a draft inside the app. Fold the
endpoint work into `api/gmail.js` (no new function). **Decide when the OAuth verification
decision is made** (`docs/architecture/google-calendar.md`); until then A is the path.

## Checks

`/demo`: a reply row's Copy shows the toast and the clipboard has the body. Live (owner): copy,
send from Gmail, and the row leaves after the next scan.

## Done when

A drafted reply is one click from being in Gmail, and it leaves Today once you send it.
