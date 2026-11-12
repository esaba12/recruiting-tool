# 03 — "Up next": one ranked action list at the top of Today

**Who:** 🤖. **Migration:** none (`user_settings.today_layout` changes shape in code only).
**Depends on:** 01, 02.

## Why

Today is organized by where an item came from (People, Applications, Events, Replies drafted,
From your email, Decisions), below four charts. On `/demo` an OA due today is ~1,100px down,
next to job-board triage. The question Today should answer first is "what do I do next?", and
right now you assemble the answer yourself from six cards and fifteen lists.

## Changes

### 1. `lib/actionQueue.js` (pure)

`buildActionQueue(attention, { now })` turns 02's `deriveTodayAttention` groups into one list
of items:

```js
{ key,          // snooze key, same format as today ('oa:<appId>')
  kind,         // 'offer' | 'interview' | 'oa' | 'thankYou' | 'reply' | 'followUp' | 'awaiting'
                // | 'schedule' | 'urgent' | 'actionItem' | 'event' | 'stale' | 'review' | 'keepInTouch' | 'oaCheck'
  title, sub,   // "Hudson River Trading" · "SWE Intern · OA"
  due,          // ms or null — the date that drives ranking
  tier,         // 'now' | 'week' | 'later'
  reason,       // short right-side text: "due today", "in 2d · Fri 2:00 PM", "no reply in 5d"
  primary,      // { label, action } — see table
  ref }         // the app / contact / event / draft / item the row opens
```

**Tiers** (first rule that matches wins):

| Tier | What lands there |
|---|---|
| **Now** | anything past due (OA, follow-up, event step); due today; interview within the next 36h; offer deadline ≤ 3 days; thank-you due (it's a 48h window); a drafted reply whose inbound email is 2+ days old; registration closing ≤ 2 days |
| **This week** | due in the next 7 days; interviews 36h–7d out; other drafted replies; awaiting reply; want to schedule; high urgency; email action items (by `due_date`, else this week); other offers; event steps and registrations ≤ 7 days |
| **Later** (Backlog, collapsed) | stale applications; job boards to review; keep in touch; OA deadline unknown; interviews 8–14 days out |

Within a tier: by `due` ascending, then items without a due date by age (oldest first). A
person or application appears once (reuse `dedupeAcross`, highest tier wins).

**Primary action per kind** (one button; ✕/snooze is always secondary):

| Kind | Primary | Also |
|---|---|---|
| offer | Decide → offer decision view | |
| interview | Prep (06) | Join (06) |
| oa | Open OA ↗ (`oaLink`) | Done |
| thankYou | Draft (`EmailDraft`) | Sent it |
| reply | Copy & open Gmail (05) | Open in Inbox |
| followUp | Draft follow-up (`DraftPanel`) | Done (01) |
| awaiting | Draft nudge | They replied |
| schedule | Draft outreach | Scheduled |
| actionItem | Done | Dismiss |
| event | Register ↗ / Done | Skip |
| stale / review / keepInTouch / oaCheck | open the app/contact | existing chips (triage, Met) |

Reuse the existing row components where they fit (`OaRow`, `ThankYouRow`, `AwaitingReplyRow`,
`DecisionRow`…) by giving them a compact queue variant, rather than writing new ones.

### 2. The `queue` card (`components/today/UpNext.jsx`)

- Full width, first on the page. Header: **Up next**, the Now count in the danger tone if > 0,
  "N this week".
- **Now** shows every row. **This week** shows 5, then "+N more". **Backlog** is one collapsed
  line ("Backlog · 14: 8 stale, 2 to review, 3 keep in touch, 1 OA deadline unknown") that
  expands in place, grouped by kind.
- Each row: kind icon, title, sub, reason (danger tone when past due), primary button, ✕.
- Empty Now + This week: "Nothing due. Next: Anthropic interview Fri 2:00 PM" (the earliest
  future item), or "All clear" when there's nothing at all. Fresh accounts keep `GettingStarted`.
- Motion: the existing card stagger only; a done row collapses out (height + fade, 150ms,
  `prefers-reduced-motion` respected). No new animation moments.

### 3. Layout (`lib/todayCards.js`)

- Registry: `queue` first (`kind: 'act'`, `size: 'full'`, settings `awaitingDays` and
  `staleDays` moved here from People/Applications). Decisions, Replies drafted, From your email,
  People, Applications and Events stay in the registry with `defaultOff: true`.
- `defaultLayout`: `queue`, then Pipeline / Network / Outreach (thirds), then Rates.
- **Layout v2.** `reconcileLayout` upgrades a saved v1 layout once: put `queue` first, drop the
  six action cards (carry their `awaitingDays`/`staleDays` and their turned-off groups into the
  queue's settings, so a list someone turned off stays off), keep the glance cards in their
  order, `v: 2`. Without this, users who customized would see every item twice.
- Customize: the queue's lists (the kinds) are its toggles, like a card's groups today. A user
  can still add the old cards back from the Add-cards drawer.

### 4. Count

02's `openCount` becomes Now + This week. Backlog doesn't count toward the badge.

### 5. `/demo`

Seeds already cover every kind. Check the Now tier has the HRT OA (due today), the Anthropic
interview isn't Now until within 36h, and the thank-you to Deepak is Now.

## Tests first

`test/actionQueue.test.js`:
- Tiering, one case per rule in the table, including the boundaries (36h, 3 days, 7 days).
- Sort within a tier; undated items after dated ones.
- Dedup: a contact in thank-you and awaiting reply shows once, as thank-you, in Now.
- A turned-off kind is absent; a snoozed key is absent.
`test/todayLayout.test.js`: v1 → v2 upgrade (queue first, action cards dropped, settings and
turned-off groups carried over, glance order kept, idempotent on v2).

## Checks

`/demo` desktop: the first thing under the date line is Up next with the HRT OA at the top.
390px: the queue fills the screen first, buttons are reachable, no horizontal scroll. Dark mode.
Keyboard: rows and buttons tab in order. Customize: turning off "Keep in touch" removes it from
Backlog; adding the old People card back works.

## Done when

Opening Today answers "what do I do next" in the first screen, in order, with one button per item.

## As built (2026-11-11)

- `lib/actionQueue.js` (`buildActionQueue`, `QUEUE_KINDS`, `nextUp`, `backlogSummary`);
  `deriveTodayAttention` builds the queue when the `queue` card is placed and derives a list when
  either its old card or the queue has it on.
- **Rows are the existing components** (`renderRow` in TodayTab) with a kind tag on the left
  (hidden under `sm`), not new compact variants. The per-kind primary button table is what those
  rows already offer; 05 and 06 add Copy & open Gmail and Prep/Join.
- **No row-exit animation:** the design system allows three motion moments
  (`docs/architecture/design-system.md`), so done rows just leave on refresh.
- **No Rows setting** on the queue card (Now shows all, This week caps at 5).
- Layout v2 + `upgradeV1Layout` as specced; an unavailable card (events without a campus) doesn't
  turn its kinds off.
- `/demo`: Now = Career Cafe follow-up, Ryan's follow-up, the Anthropic signup step, the HRT OA
  (due today) and Deepak's thank-you; 14 this week; backlog 11. Badge 19 = header. Checked at
  1280px, 390px (no horizontal scroll), dark mode, and Customize.
- Tests: `test/actionQueue.test.js` (13), `test/todayLayout.test.js` (v2 + upgrade, 27),
  `test/todayAttention.test.js` (5).

## Revised after shipping (2026-11-11)

Owner feedback on the live version: "i liked having my graphs and stuff. theres even more
bullshit now." Picked fix: **charts first, then a short Now strip**. The card is titled "Now",
renders only the Now tier (5 rows + "+N more"), and has no This week list, backlog or degraded-feeds
footnote. The header reads "N due" and the badge counts Now only. Layout v3 moves the queue after
the last glance card for anyone who saved a v2 layout. `buildActionQueue` still computes all
three tiers (the empty state's "Next: …" reads the later ones).

