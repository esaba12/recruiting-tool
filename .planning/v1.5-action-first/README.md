# v1.5 — Action first

**Goal:** open Today and the first thing you see is what to do, in order. Upcoming interviews,
OAs due, replies to send and overdue follow-ups sit at the top in one ranked list, not spread
across six cards under four charts. Anything the app can already tell is done (you sent the
email, you finished the OA) clears itself, without a "mark it" click.

**Written:** 2026-11-11, from a `/demo` walkthrough of Today and a code read of `TodayTab.jsx`,
`lib/attention.js`, `lib/todayCards.js`, `lib/useTodayPrefs.js`, `App.jsx`,
`api/_lib/emailPipeline.js`, `api/_lib/pushes.js` and `scripts/email-pipeline.js`.
**Execution:** direct, one branch + one PR per spec, tests first, `npm test && npm run build`,
browser check on `/demo` (desktop + 390px + dark). One migration (spec 06): ask before
`supabase db push`. No new `api/*.js` files (still 12/12).

## What's wrong now (2026-11-11)

1. **Actions are below the fold.** The default layout puts Decisions, Pipeline, Network,
   Outreach and Rates first (about 600px). On `/demo` the most urgent item, an OA due *today*,
   sits ~1,100px down inside the Applications card.
2. **Grouped by source, not urgency.** Six action cards and up to 15 lists. "Interview in 2
   days" and "OA due today" share a card with 8 stale applications and job-board triage.
   Nothing says what to do first.
3. **The counts disagree.** The sidebar badge (19 on `/demo`) and the Today header ("31 open")
   use different formulas. `App.jsx` (two copies, lines ~407 and ~556) leaves out interviews,
   decisions, drafted replies, thank-yous and events, and counts lists the user turned off.
4. **The app asks about things it already knows.**
   - Overdue follow-up: the Gmail scan logs your sent email as an Outbound interaction, but the
     row stays overdue until "Mark followed up". `hasNewerInteraction` only relabels the button
     "Details". "Mark followed up" also logs a fake `Other` interaction and pushes the date +7.
   - OA due never clears itself. The server pipeline lost `OA_COMPLETED` in the port from Apps Script.
5. **Drafted replies take four hops:** Today → Inbox → copy → Gmail → paste → send.
6. **Snooze is always 7 days.** No "tomorrow", "Monday" or "after the interview".
7. **Interview rows do nothing** but open the application. No prep, no join link.

## Specs, in build order

| # | Spec | Impact | Effort | Migration |
|---|---|---|---|---|
| [01](01-followups-clear-themselves.md) | Follow-ups clear themselves when you've sent the email | High | S | none |
| [02](02-one-count.md) | One open count everywhere (badge = header) | Medium | S | none |
| [03](03-up-next-queue.md) | "Up next": one ranked action list at the top of Today | Highest | M | none |
| [04](04-snooze-to-a-date.md) | Snooze to a date: tomorrow, Monday, after the interview | Medium | S | none |
| [05](05-send-replies-from-today.md) | Send drafted replies from Today | Medium | S (A) / M (B) | none |
| [06](06-interview-rows.md) | Interview rows: prep, join link, morning push | Medium | S–M | `interview_link` |
| [07](07-oa-done-from-email.md) | OAs mark themselves done from the completion email | Medium | S | none |

01 and 02 come first because they make 03 trustworthy: a ranked list that shows things you've
already done, or a badge that disagrees with it, is worse than what's there now. 03 builds on
02's shared derivation. 04–07 are independent after 03.

## Decisions made (2026-11-11)

1. **The queue replaces the action cards** (03). People, Applications, Events, Replies drafted,
   From your email and Decisions stop being default cards; what they listed goes into "Up next"
   (by urgency) or a collapsed **Backlog** (stale apps, job boards to review, keep in touch, OA
   deadline unknown). The cards stay in the registry so Customize can add them back. Showing
   each item twice is the clutter this milestone removes.
2. **Charts move below the queue**, not off Today.
3. **Replies:** build the copy-and-open path on Today now (05 A). Creating real Gmail drafts
   (05 B, `gmail.compose`) waits until the verification decision, since every user would have
   to reconnect Gmail.
4. **OA completion flips silently** with a push (07), matching what Apps Script already did for
   the owner, and is reversible in the application panel.

## Where we are: checklist

🤖 = Claude can do it · 👤 = owner (console, approvals, merge)

- [x] 🤖 Specs written (2026-11-11)
- [x] 🤖 01 follow-ups clear themselves → PR (2026-11-11; also stops your own "following up" email from re-scheduling the follow-up 3 days out)
- [x] 🤖 02 one count → PR (2026-11-11; `/demo` badge = header = 30, both 28 after Clear all on replies)
- [x] 🤖 03 Up next → PR (2026-11-11; `/demo` desktop, 390px, dark, Customize checked)
- [x] 🤖 04 snooze to a date → PR (2026-11-11)
- [x] 🤖 05 A reply actions on Today → PR (2026-11-11)
- [ ] 🤖 06 interview rows → PR; 👤 approve `supabase db push` for `interview_link`
- [ ] 🤖 07 OA done from email → PR
- [ ] 👤 Live check after 01 + 07: send a follow-up from Gmail and finish an OA, wait for the
  next 10-min scan, and both rows leave Today without a click
- [ ] 👤 Decide 05 B (Gmail drafts) together with the OAuth verification decision
- [ ] 🤖 Update `docs/architecture/dashboard-features.md` (Today section) as each spec lands
