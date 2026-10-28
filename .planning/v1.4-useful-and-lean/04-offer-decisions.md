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

## As built (2026-10-28)

- **Opens in place.** `panels/OfferPanelBody.jsx` renders inside `ApplicationPanelBody` (the
  same swap a contact uses), so every place that opens an application gets it. Today's Decisions
  row opens straight into it (`initialView="offer"`); an Offer-stage panel has "Compare and ask
  others to expedite →". Back returns to the application.
- **One form.** `OfferForm` (deadline + `OFFER_DETAIL_FIELDS`, now in `lib/offers.js`) replaced
  02's inline Offer section, so the panel and the decision view edit the same way. With 2+
  offers, chips pick which one you're editing.
- **Compare** is a plain table, one column per offer; `Mono` on the deadline and money fields only.
- **Still in process** (`inProcessRows`): interview stages, plus Applied with `lastActivity`
  (or `appliedDate`) in 30 days. Furthest stage first, then most recent. The contact is the first
  of `warmPathsToCompany`.
- **Expedite drafts** name the earliest deadline among your offers. The offer company is never
  passed to the template or the prompt, so it can't leak; the `expedite` prompt also says not
  to guess it. `ThankYouDraft` became the shared `today/EmailDraft.jsx`.
- **`/demo`:** a second offer (Datadog, 5 days, with details) next to Ramp.
