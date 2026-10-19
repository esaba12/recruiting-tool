# 04 — Offer decisions

**Who:** 🤖. **Migration:** none (uses 02's `offer_deadline`, `offer_details`). **Depends on:** 02.

## Why

An exploding offer is the one moment where the whole pipeline matters at once. You need to
see what else is still in process, ask those companies to expedite, and compare offers side by
side before the deadline. Today, an app at Offer is just a card in a column.

## Changes

1. **Decision view.** Opened from Today's Decisions row and from any Offer-stage application panel.
   It's a panel body (`panels/OfferPanelBody.jsx`), not a new tab:
   - The offers being decided: details from `offer_details`, with editable fields (base, bonus,
     location, start, notes), plus the deadline countdown.
   - **Still in process:** every non-terminal app past Applied (`INTERVIEW_STAGES` plus Applied with
     activity in 30 days), sorted by stage, each with its contact at the company if one exists
     (`warmPathsToCompany`).
2. **"Ask to expedite" drafts.** A new `expedite` kind in `lib/drafting.js`, one per in-process app.
   It names the deadline but never the competing company unless the user adds it. Same `NeedsKey`
   and plain-template fallback as 03. Sending is still the user's job: draft and copy, nothing
   auto-sends.
3. **Compare.** With 2+ offers, the panel shows them as columns (same fields, `Mono` for numbers).
   No scoring or weighting: just the facts side by side.
4. **`/demo`:** seed two offers and three in-process apps.

## Tests first

`test/offers.test.js`:
- The in-process selection (terminal stages excluded, a stale Applied app excluded).
- Sort order.
- The expedite template fills the deadline and leaves the competitor out.

## Checks

On `/demo`, open an offer from Today and see the in-process list and two drafts. Edit details,
reload, and they persist (the real account, after 02 is pushed).

## Done when

From one offer you can see everything still in play and have an expedite draft for each in under a minute.
