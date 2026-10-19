# 02 — Interview and offer dates become fields

**Who:** 🤖. **Needs from owner:** approval for one `supabase db push`. If v1.3 spec 08's
cutover hasn't happened yet, also a `clasp push`. **Gates:** 03, 04.

## Why

The classifier already extracts `interview_date` (`api/_lib/emailPipeline.js:431`), and spec
12 parses exact invite start times. The application write at `:560` only keeps OA fields, so the
date goes to a push message and (with Calendar connected) a calendar event, then it's gone. That
causes three problems:
- Today can't say "interview tomorrow".
- Interview Prep (`learningAttention`) fires for every app at an interview stage, however old.
- An offer's decision deadline isn't captured anywhere.

## Changes

1. **Migration** `supabase/migrations/2026MMDD000000_interview_offer_dates.sql`:
   ```sql
   alter table public.applications
     add column if not exists interview_at timestamptz,      -- next scheduled interview
     add column if not exists interview_time_known boolean not null default false,
     add column if not exists offer_deadline date,           -- decision due
     add column if not exists offer_details jsonb;           -- { base, bonus, equity, location, start, notes }
   ```
   No RLS change: "applications: all own" covers it. Dry-run, then ask.
2. **Classifier** (`emailPipeline.js`; mirror in `scripts/email-pipeline.js` unless 08's
   cutover is done):
   - Add `offer_deadline` ("YYYY-MM-DD only if the email states a date to respond by, else null —
     never guess"), with the same never-invent wording as `oa_due_date`.
   - Write `interview_at` on INTERVIEW_INVITE. Use the invite's start time when there is one
     (`interview_time_known = true`). Otherwise use `interview_date` at noon in the campus zone
     (`schools.timezone`, which the scan already reads), with `interview_time_known = false`, and the
     UI shows the date with no time.
   - Write `offer_deadline` on OFFER. Never overwrite a user-set value with null.
3. **`db.js`** maps the three fields (`interviewAt`, `offerDeadline`, `offerDetails`). The demo
   seeds get one upcoming interview and one offer with a deadline.
4. **ApplicationPanelBody:** edit `interview_at` (date + optional time) and, at Offer stage,
   the deadline and details. Same pattern as the manual OA fields from 2026-09-17.
5. **Today:**
   - New card **Decisions** in [08](08-custom-today.md)'s registry (`decisions`, `defaultOn`, default position first, so `reconcileLayout` adds it for everyone): offers with a deadline, sorted
     soonest first, showing a `Mono` countdown. Offers with no deadline show "no deadline on file —
     add one".
   - **Interview Prep** keys off `interview_at` within 7 days when it's set, and falls back to
     today's stage rule only for apps without one. That stops the month-old false positives.
   - The Next Deadline stat tile (`pickNextDeadline`) includes offer deadlines and interviews.
6. **Pushes:** the existing 11am digest gains offer deadlines within 3 days. No new push kind.

## Tests first

- `test/emailPipeline.test.js`:
  - `offer_deadline` is written on OFFER and never overwritten with null.
  - `interview_at` comes from an invite start time vs from date only.
- `test/attention.test.js`:
  - `pickNextDeadline` with an offer deadline.
  - `learningAttention` ignores an interview-stage app whose `interviewAt` is 30 days past.
  - The Decisions ordering.
- The RLS suite still passes after the push.

## Checks

- A real (or replayed) interview invite sets `interview_at`, and Today shows the countdown.
- In `/demo`, Decisions renders with the seeded offer.
- `TZ=America/New_York npm test` passes (date-only values parse as local days, `lib/dates.js`).

## Done when

The migration is live, both fields are written by the scan and editable by hand, and Today uses them.
