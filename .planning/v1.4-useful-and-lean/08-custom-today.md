# 08 — A Today you arrange yourself

> **Baseline changed (2026-10-20, PR #22).** Today is no longer one column of up to 17 Sections.
> Some of what's below assumes the old layout, so re-plan against the code before building:
> - Today is now a dashboard of `DashCard`s: Pipeline / Network / Outreach metric cards, then
>   the Replies drafted, From your email, People, Applications and Events cards in two balanced columns.
> - There is no Collapse all.
> - Interview Prep is gone.
>
> The registry's units should probably be these cards, plus their inner `Group`s as toggles.
> For example, an IB student turns off "Job boards to review" inside Applications.

**Who:** 🤖. **Migration:** none (layout lives in `user_settings`). **New serverless fn:** none.
**New dependency:** `@dnd-kit/core` + `@dnd-kit/sortable` (exact versions pinned at
implementation, at least two weeks old), loaded only in edit mode.
**Depends on:** 05 D (charts off Today), so the default layout is the lean one. Lands **before** 02–04, so
their new sections (Decisions, Send a thank-you) arrive as cards and don't have to be wired into TodayTab twice.

## Why

Today is one fixed column of up to 17 sections in an order chosen for one SWE user
(`TodayTab.jsx` L695–790). Different users care about different things:
- An IB student never uses Job Boards Needs-Review or OA Needs Check.
- Someone deep in networking wants Awaiting Reply on top.
- Someone mid-offer wants Decisions and nothing else.

Today the only controls are collapse and snooze (`lib/useTodayPrefs.js`).

## What the user gets

- A **Customize** button in Today's header strip (next to Collapse all) switches to edit mode:
  - Every placed card shows a drag handle, a size toggle (full or half width), a ✕ (remove) and a
    small ⚙ where the card has settings.
  - Cards that are empty right now still render in edit mode, as "Nothing here right now", so
    they can be arranged.
- **Drag to reorder.** On desktop, cards flow in a 2-column grid (`lg:` and up), where half-width
  cards pair up side by side. On phones it's one column in the same order, and a long-press starts the drag.
- **Add cards** opens a drawer listing every card not on the page:
  - Title, a one-line description and an **Add** button.
  - Grouped as Act now (feeds), Glance (stat tiles, charts) and Plan (events, prep).
  - Unavailable cards are listed with the reason (e.g. "needs a campus with an events feed",
    "SWE track only") and greyed out. They're never silently missing.
- **Per-card settings**, only where a knob already exists in code:
  - Row cap (3 / 5 / 10, from `RowCap`'s `cap`).
  - Awaiting Reply's day threshold (`awaitingReply` `thresholdDays`).
  - Stale Applications' day threshold (`staleApplications`' 14 days, made a parameter).
- **Reset to default** and **Done** at the end of the edit strip.
- Outside edit mode, Today behaves exactly as now: empty cards hide, snoozes and collapse work.
  The page just follows the saved layout.

## Design calls (made here, not open questions)

- **Ordered flow with two widths, not a free-form x/y grid.** A free-form grid (react-grid-layout
  style) leaves holes, needs per-breakpoint layouts, is miserable on a phone, and costs about 40 KB.
  Order plus width covers "put this first, put these two side by side". Cards keep their natural height.
- **@dnd-kit over `motion`'s `Reorder` or native HTML5 drag.** `Reorder` (already a dependency) only
  sorts along one axis and has no keyboard support. Native drag doesn't work on touch.
  @dnd-kit's sortable has pointer, touch (with a delay) and keyboard sensors. It's
  dynamically imported when edit mode opens, so normal Today loads pay nothing.
- **Keyboard and no-drag path.** In edit mode, each card also has ↑/↓ move buttons. That's the
  accessible path, and it's the one tests exercise.
- **Dedup follows the user's order.** `dedupeAcross` today keeps each contact in the first of a
  fixed priority list. After this, it runs over the *visible* people cards in *layout* order, so a
  person shows up in the highest card the user placed. Hiding Overdue Follow-Ups lets those
  people appear in the next people card instead of vanishing.
- **The header count** ("N to look at") and **Collapse all** cover visible cards only.
- **Motion budget** (design-system.md): no new ambient animation. The existing mount stagger
  stays. Drag uses @dnd-kit's transform. Add or remove is instant.

## Changes

1. **Card registry `lib/todayCards.js`** (pure, no React):
   - Each card: `{ id, title, group, description, defaultOn, defaultSize, settings?, available(profile, ctx) → true | reason }`.
   - The ids are today's `COLLAPSIBLE` ids, so collapse and snooze state carries over unchanged:
     `recap, items, overdue, stale, oa, awaiting, urgent, schedule, keepInTouch, review, oaCheck,
     evSteps, evReg, evFollow, evFeeds, prep`.
   - The stat tiles split into three cards: `tileFunnel`, `tileDeadline`, `tileActivity` (half width by default).
   - The charts 05 D removed come back as optional cards, **off by default**: `chartFunnel`,
     `chartAppFlow`, `chartNetFlow`, `chartNetStatus`, `chartNetTrend`. Recharts loads only when one is placed.
   - `gettingStarted` is pinned to the top while `isFreshAccount`. It's not movable or removable,
     since it disappears on its own.
   - Availability uses the existing gates:
     - `isTechOnly` / `profileTracks` for `review` and `oaCheck`.
     - `school_id` plus an events feed for the `ev*` cards.
     - Learn tracks for `prep`.
2. **Default layouts per track.** `defaultLayout(profile)` builds the order from `defaultOn` cards
   that are available for the user's tracks. For SWE it reproduces today's order, so nothing changes
   for existing users who never press Customize.
3. **Layout state `lib/useTodayLayout.js`**, in `user_settings` key `today_layout`
   (`{ v: 1, cards: [{ id, size, settings? }] }`, where order is array order and absent means removed).
   It's separate from `today_prefs` so snoozes and the layout don't overwrite each other.
   Optimistic save, same as `useTodayPrefs`. `/demo` works through `getUserSetting`'s in-memory branch, so
   the portfolio shows it.
4. **`reconcileLayout(saved, registry, profile)`**, pure:
   - Drops unknown ids (e.g. Timeline Finds after 05 C).
   - Drops cards that are no longer available.
   - Inserts **new** registry cards that are `defaultOn` at their default position relative to
     neighbours. 02's Decisions and 03's Thank-you show up for everyone this way. Track the ids a
     user has already been offered with `seen: [...]`, so a card they removed stays removed.
   - Clamps sizes and settings to the allowed values.
5. **Split `TodayTab.jsx` into cards**: `components/today/cards/*.jsx`, one per id, each
   receiving the derived data it needs. TodayTab becomes data derivation plus a layout renderer.
   The file is 832 lines and the third-largest god node in the graph. This is the refactor that
   makes everything above possible, not a side quest.
6. **Edit mode UI** (`components/today/TodayEditor.jsx`, lazy):
   - The sortable grid, the Add-cards drawer (rendered in a `SidePanel`), the per-card ⚙ popover,
     and Reset.
   - Styling uses tokens only. The edit chrome uses `border-dashed border-ink-300` plus the
     `Mono` handle, the industrial direction the app already uses. No new colors.

## Tests first (`test/todayLayout.test.js`)

- `defaultLayout`:
  - SWE gives today's order.
  - IB has no `review` or `oaCheck`.
  - No school means no `ev*` cards.
- `reconcileLayout`:
  - Unknown id dropped.
  - A new `defaultOn` card inserted after its registry neighbour.
  - A removed card (in `seen`) not re-added.
  - An unavailable card dropped.
  - Bad size or setting clamped.
- Layout reducers: move up/down (including at the ends), move to an index, add, remove, resize,
  change a setting, reset.
- `dedupeAcross` in layout order:
  - A person in Overdue and Awaiting shows in whichever is placed higher.
  - Hiding one lets them appear in the other.
- Header count over visible cards only.

## Checks

- Existing account: Today looks identical before and after deploy (same order, same sections).
- Customize: drag Awaiting Reply to the top, set two tiles to half width, remove Keep in Touch,
  add the Application Flow chart, then reload on another browser. The same layout loads.
- Phone (390px): long-press drag works, ↑/↓ works, and the drawer is usable.
- Keyboard only: reach the handle, move a card with arrow keys or ↑/↓, press Done.
- `/demo`: Customize works and resets on reload.
- Production build: the Today chunk doesn't grow by more than about 5 KB. @dnd-kit sits in its own
  chunk, fetched only on Customize.
- Screenshot edit mode and normal mode against the industrial direction (global CLAUDE.md rule).

## Done when

Any user can reorder, resize, add and remove Today cards on desktop, phone and keyboard. The
layout follows them across devices, and an untouched account sees no change.
