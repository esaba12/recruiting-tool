# 03 — Track-aware surfaces

**Depends on:** 01 (`isTechOnly`, `hasTrack`).

## Problem

Several surfaces only make sense for tech recruiting, and for a finance or consulting user they
range from empty to wrong:

| Surface | Why it's tech-only |
|---|---|
| Pipeline → **Job Boards** view (`PipelineTab.jsx:16`) | the sources are GitHub-README internship repos (`boardsRegistry.js` `SUGGESTED_BOARDS`), which are all SWE |
| Grow → **Companies** (`GrowTab.jsx:41` → `ExploreTab`) | the candidate pool is the YC directory (`lib/ycDirectory.js`), which is startups only, and the prompt is SWE/PM-shaped |
| Learn LeetCode widgets | already gated by `lcOnly` per track, so no change is needed |

## Change

### Pipeline
- `PipelineTab` already takes a `views` prop. In `App.jsx`, pass `PIPELINE_VIEWS` filtered to drop `jobBoards` unless `hasTrack(profile,'swe') || hasTrack(profile,'pm')`.
- Job-board auto-import is triggered from inside the Job Boards view, so hiding the view stops it. Confirm nothing in `AppInner` starts it independently.

### Grow → Companies
- When the user has **no** swe/pm track, render a non-YC variant of the Companies section:
  - Hide the YC autocomplete and the YC candidate pool (`mergeCandidates` gets `yc: []`).
  - Exa company search stays (it's web-wide), and `buildCompanyQuery` gets the track label so the query becomes, for example, "investment banks and boutique advisory firms with sophomore/junior summer analyst programs".
  - The ranking prompt in `companyFinder.js` reads `tracksLabel` (from spec 01) instead of hardcoding SWE/PM, and its "signals students under-weight" list gets per-track variants (finance: group/deal-flow exposure, return-offer rate, culture/hours; consulting: staffing model, training, exit options).
- Mixed users (e.g. SWE + IB) get the current behavior plus finance terms in the query. Don't build two separate pools.
- Coverage and Discover are company-agnostic already, so no change there.

### Pipeline stage vocabulary (copy only, no schema change)
The stages stay `Wishlist / Applied / Phone Screen / Technical / Onsite / Offer / Accepted / Rejected`
(`shared.jsx:39-51`), so the stats, funnel, and email pipeline keep working. For users with any
non-tech track, add a tooltip/legend on the stage selector: *Phone Screen = HireVue / first round,
Technical = second round / technicals, Onsite = superday / final round.* The email pipeline does
the same mapping (spec 05).

## Tests / verification

- Unit: a small `visiblePipelineViews(profile)` helper, tested for SWE-only, IB-only, and SWE+IB.
- Manual: an IB-only test account sees no Job Boards toggle (the toggle disappears when only one view is left, per `PipelineTab.jsx:26`) and gets no YC chips in Grow, and an Exa run returns banks/firms, not startups.
- The owner (SWE+PM) account is unchanged, verified by screenshotting before and after.

## Acceptance

An IB-only or consulting-only account never shows a GitHub job board or a YC company.
