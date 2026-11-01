# v1.4 — Useful on day one, lean everywhere

**Goal:** a new user gets value before they connect anything or paste a key, the app keeps the
dates that matter most in a season (interviews, offer deadlines) instead of throwing them away,
the surfaces that duplicate each other go, and each user can arrange Today to fit how they recruit.

**Written:** 2026-10-19, from a code read (graph rebuilt the same day: 1,852 nodes, 4,963 edges),
`docs/architecture/`, `.planning/` and a grep pass over every view, `rec_*` key and AI call.
**Execution:** direct, one branch + one commit per spec, `npm test && npm run build`, browser check.
Ask before the one `supabase db push` (spec 02). No new `api/*.js` files (still 12/12).

**This doesn't replace v1.3.** The launch (v1.3 spec 02 → 04) is still the biggest unlock.
The pre-invite set (06, 05, 01, 07) changes what a friend sees in their first five minutes, so
it's worth doing while you finish v1.3 spec 02's console steps, which gate the invite anyway.
02–04 matter right now for your own season: interviews and offers come in October through December.

## Where we are (2026-10-23, after PR #27): checklist

🤖 = Claude can do it · 👤 = owner (console, inbox, approvals)

### Done
- [x] 06, 05, 01, 07 merged and live (PR #20), plus the smoke-test follow-up (PR #21). 07
  was smoke-tested on prod with two throwaway accounts, since deleted ([07](07-onboarding.md)).
- [x] Today as a dashboard (PR #22, merged 2026-10-20, outside the spec set):
  - Charts are back as metric cards, each a number over its chart (this partly reverses 05 D).
  - The 10+ sections became People, Applications, From your email and Events cards.
  - Interview Prep and the recap card were dropped.
  - Details are in `docs/architecture/dashboard-features.md`. 08's starting point changed (see the note there).
- [x] 09 résumé + 10 drafted replies built on `feat/v1.4-resume-reply-drafts` (3 commits)
- [x] Migration `20261020000000_resume_and_email_drafts.sql` pushed (owner approved 2026-10-20). Live RLS suite 14/14
- [x] `/demo` checked: Today "Replies Drafted" → Inbox composer, desktop and phone, no API/Supabase calls
- [x] Wizard checked on a throwaway account (deleted): résumé PDF → text saved, call hours saved, Ready shows both

### 09 + 10: ship it
- [x] 🤖 Push the branch and open the PR ([#23](https://github.com/esaba12/recruiting-tool/pull/23); the Vercel preview built)
- [x] 🤖 Résumé PDF upload under the **production CSP**: no violations, and the text extracted.
  The preview is behind Vercel deployment protection, so this ran on the production build
  served locally with `vercel.json`'s headers, using a throwaway account (deleted).
- [x] 👤 Review and merge: PR #23 merged 2026-10-20, after merging main (PR #22's Today dashboard; drafts became a card). Prod deployed, and the `/demo` Today → Inbox draft was checked live
- [ ] 👤 Settings → Drafted replies: set your call hours (and add your résumé if you skipped it)
- [ ] 👤 Live check. It needs Gmail connected (v1.3 spec 02 D2) and ideally a calendar.
  - [ ] From another account, email your connected Gmail: "could we find 30 min next week?"
  - [ ] Settings → **Scan now**. Inbox should show a drafted reply with 3 times that avoid your
    calendar events, and Today should list it.
  - [ ] Reply in Gmail. The next scan should mark the draft done, and it leaves Today.
  - [ ] A receipt or rejection in the same scan gets **no** draft.
- [ ] 🤖 After a week: check the cost (drafts run on the standard tier, ≤8 per mailbox per run) and
  how many drafts get dismissed vs. used. Tune the `needs_reply` wording if it over-drafts.

### Blocking the friends invite (unchanged)
- [ ] 👤 [v1.3 spec 02](../v1.3-launch-and-cleanup/02-owner-runbook.md) console steps: Google
  Cloud A1–A4, cron D1, Gmail D2, SMTP B2, Sentry C2
- [x] 🤖 v1.3 spec 02 B1: `site_url` in `supabase/config.toml` is the prod URL (`032fbd3`). 👤 still runs `supabase config push`
- [x] 🤖 v1.3 spec 02 C1: dead Vercel env vars listed in the runbook (production + Preview). 👤 runs the removal
- [ ] 👤 Live first inbox scan after a real Gmail connect (07's last unverified item)
- [ ] Then [v1.3 spec 04](../v1.3-launch-and-cleanup/04-launch-week.md) (launch week)

### Next code
- [x] 🤖 [08](08-custom-today.md) rearrangeable Today, built on `feat/v1.4-custom-today`. The registry units are PR #22's cards (Rates and Replies drafted included), and their lists are toggles. Checked on `/demo` (desktop, 390px, keyboard, dark).
- [x] 👤 Merged: PR #27, 2026-10-22. Live on prod, and the Customize editor was checked on `/demo`
- [x] 🤖 [02](02-interview-offer-dates.md) built on `feat/v1.4-interview-offer-dates` (2026-10-27), ahead of the cutover
  (decision 3 below), so the classifier change is mirrored in `scripts/email-pipeline.js`. Checked on `/demo` (desktop, 390px).
- [x] 👤 `supabase db push` for `20261027000000_interview_offer_dates.sql` (owner approved 2026-10-27). Live RLS suite 14/14
- [ ] 👤 `clasp push` **after** the db push: both pipelines select the new columns, so they fail until it's live
- [x] 🤖 Then push the branch and open the PR (#29); 👤 merge
- [x] 🤖 [03](03-thank-you.md) built on `feat/v1.4-thank-you` (off 02's branch, 2026-10-28). No migration. Checked on `/demo` (desktop, 390px)
- [x] 🤖 [04](04-offer-decisions.md) built on `feat/v1.4-offer-decisions` (off 03's branch, 2026-10-28). No migration. Checked on `/demo` (desktop, 390px)
- [x] 👤 Merged #29 → #30 → #31 (2026-10-29). Prod deployed; `/demo` checked live (Decisions → decision view, thank-you, interviews, expedite draft)

### Later (not planned yet)
- [ ] Real Gmail drafts: `gmail.compose` (a restricted scope, so it needs consent-screen
  changes and every mailbox has to reconnect), using the reserved `email_drafts.gmail_draft_id`
- [ ] Book the calendar event when they accept one of the offered times
- [ ] Regenerate a draft in the app. A push for new drafts only if asked (`pushes.js` keeps
  three kinds for now)

## Decisions

1. ✅ **Timeline Finds: cut** (owner, 2026-10-19). Folded into 05 C.
2. ✅ **Hold the invite** until the pre-invite set (06, 05, 01, 07) lands (owner, 2026-10-19).
3. ✅ **Spec 02 before the Apps Script cutover** (owner, 2026-10-27). The cutover was still a
   week of cron away with offer season under way, so 02 went first and the classifier change
   is in both pipelines (one extra `clasp push`).

## What the review found

1. **Day one is empty without Gmail plus a key.** The only ways in are the Gmail scan (needs an
   Anthropic key and Google consent), Job Boards (SWE only), or typing rows one at a time. Almost
   every student already has a spreadsheet tracker and 300+ LinkedIn connections, and neither can be imported.
   That hits non-SWE friends hardest, since Job Boards is hidden for them.
2. **The app reads interview dates and drops them.** The classifier returns `interview_date`
   (`api/_lib/emailPipeline.js:431`), and spec 12 parses exact invite times, but the write at
   `:560` keeps only OA fields. `applications` has no interview or offer-deadline column. So:
   - Today's Interview Prep fires for *any* app sitting at an interview stage, even a month-old one
     (`lib/attention.js` `learningAttention`).
   - Nothing counts down to an interview.
   - An offer's decision deadline, the highest-stakes date of the season, isn't stored anywhere.
3. **Nothing happens after an interview or a call.** No thank-you nudge or draft kind exists
   (`grep -ri "thank" src/lib src/components` finds nothing).
4. **Surfaces that duplicate each other:**
   - Network → Outbox is exactly Inbox's "Sent" filter (`type === 'Email' && Outbound`).
   - Today's Activity block repeats Pipeline → Sheet → Flow and Network → Flow.
   - The Job Boards "GitHub profile" lookup (contribution grid, top languages) has no recruiting use, and it keeps a third-party proxy alive (`?upstream=contrib`).
   - Timeline Finds re-derives dates that the email pipeline (spec 12 + 08 item 3) now captures directly.
5. **Onboarding ends on an empty screen.** Connecting Gmail in the wizard shows nothing until
   the next cron tick (up to 10 min, and the first 45-day pass can span several ticks). The
   Gmail step doesn't check for a key, and the Ready screen says "Gmail auto-tracking: ON" even
   when the scan is being skipped. Pushes are never mentioned. Nothing records which steps
   people skip, which is exactly the data v1.2's "revisit a shared key" decision is waiting on.
6. **Today is one fixed column chosen for one SWE user.** Up to 17 sections in a hard-coded order
   (`TodayTab.jsx` L695–790), where collapse and snooze are the only controls. An IB student can't
   drop the Job Boards and OA cards, and nobody can put what they care about first.
7. **Bugs found along the way:**
   - Quick Add reads `rec_target_companies` from localStorage (`QuickAddContactModal.jsx:50`). Nothing has written that key since the list moved to `user_settings` (`42dc3f0`), so "at a target company" never shows.
   - The server Gmail scan only uses Anthropic keys, so a user who picked OpenAI connects Gmail and gets nothing.
   - Network's Cards view, the only contacts list that reads well on a phone (Table is `overflow-x-auto`), uses raw `bg-indigo-50` and `rounded-xl shadow-sm`, against the styling rules.

## Specs

| # | Spec | Kind | Migration | Status |
|---|------|------|-----------|--------|
| 01 | [Import what you already have](01-import.md) | 🤖 | no | ✅ merged 2026-10-19 (PR #20) |
| 02 | [Interview and offer dates become fields](02-interview-offer-dates.md) | 🤖 + `clasp push` | **yes** | ✅ merged PR #29, live 2026-10-29 (migration live 2026-10-27; `clasp push` owed) |
| 03 | [After the interview: thank-you nudges](03-thank-you.md) | 🤖 | no (uses 02) | ✅ merged PR #30, live 2026-10-29 |
| 04 | [Offer decisions](04-offer-decisions.md) | 🤖 | no (uses 02) | ✅ merged PR #31, live 2026-10-29 |
| 05 | [Cut duplicates](05-cuts.md) | 🤖 | no | ✅ merged 2026-10-19 (PR #20) |
| 06 | [Fixes from the review](06-fixes.md) | 🤖 | no | ✅ merged 2026-10-19 (PR #20) |
| 07 | [Onboarding that ends with data on screen](07-onboarding.md) | 🤖 | no | ✅ merged 2026-10-19 (PR #20), smoke-tested on prod; live first scan untested until a real Gmail connect |
| 08 | [A Today you arrange yourself](08-custom-today.md) | 🤖, one new dependency (@dnd-kit) | no | ✅ merged 2026-10-22 (PR #27), live |
| 09 | [Résumé in onboarding](09-resume.md) | 🤖, one new dependency (pdfjs-dist) | **yes** (shared with 10) | ✅ merged 2026-10-20 (PR #23), live |
| 10 | [Drafted replies with suggested call times](10-reply-drafts.md) | 🤖 | **yes** (shared with 09) | ✅ merged 2026-10-20 (PR #23), live; real-mailbox check pending |

**Order:** 06 → 05 → 01 → 07 → *invite* → 08 → 02 → 03 → 04.
- 06, 05, 01 and 07 are the pre-invite set: 07 hosts 01's importers in the wizard and needs 06 B's
  provider-agnostic scan.
- 08 comes before 02–04 so their new Today sections (Decisions, Send a thank-you) land as cards
  in the registry, not as more hard-coded blocks. 08 also brings 05 D's charts back as optional cards.
02 gates 03 and 04. If v1.3 spec 08's cutover (retiring the Apps Script) hasn't happened when you
start 02, the classifier change has to be mirrored in `scripts/email-pipeline.js` (the
known-issues rule). Doing 02 after the cutover avoids that.

## Considered and not planned

- **Shared trial key on the owner's account.** Already decided in v1.2 spec 04: revisit only if
  feedback says key setup is why people drop off. 01 cuts the dependency on keys instead.
- **Behavioral story bank (STAR stories per competency, which story you told where).** Real for
  IB, consulting and PM, but Learn already tracks behavioral as practice topics. Build it only if
  a non-SWE friend asks for it.
- **A finance job-board source.** There's still no maintained public feed like SimplifyJobs for IB or
  consulting. Import (01) is the honest answer for those tracks.
- **Moving Discover/Explore localStorage state to `user_settings`.** v1.3 spec 06 E's rule still
  holds: do it only if cross-device use turns out to matter. Spec 06 fixes the one place where stale
  localStorage gives a wrong answer today.
- **Browser extension, PWA, usage analytics.** Quick Capture's paste-a-link already covers saving a
  posting. With 3–5 friends, asking them beats instrumenting them.
- **Network Graph view.** It's heavy (`react-force-graph-2d`) and mostly visual, but it's lazy
  loaded, costs nothing when unused, and is the strongest `/demo` screenshot. Keep it.
- **Pipeline board vs Sheet.** They look like duplicates but aren't: a kanban for moving cards and
  a grid for bulk edit and export are different jobs. Keep both.

## Definition of done

1. A fresh account with no key and no Google connection imports a CSV tracker and a LinkedIn
   `Connections.csv`, and Pipeline, Network and Coverage are populated. Today isn't flooded.
2. A fresh account that connects Gmail in the wizard sees its own applications appear within
   about a minute, with no cron tick needed. A no-key account is never told Gmail is on.
   `onboarding_log` shows the steps taken.
3. An interview email produces an `interview_at` on the application. Today shows it counting
   down, then a thank-you nudge after it passes.
4. An offer email with a stated deadline produces `offer_deadline`, and Today counts it down above
   everything else.
5. Outbox, the GitHub profile lookup, the `?upstream=contrib` proxy and Today's chart block are
   gone, with `/demo` still covering every tab.
6. Any user can reorder, resize, add and remove Today cards (desktop, phone, keyboard), the
   layout follows them across devices, and an account that never presses Customize sees no change.
7. `npm test && npm run build` pass and every spec has been checked in the browser, `/demo` included.
