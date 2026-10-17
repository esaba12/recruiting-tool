---
status: testing
phase: 03-grow-discovery-funnel-merge
source: [03-VERIFICATION.md]
started: 2026-08-19T00:35:32Z
updated: 2026-08-19T00:35:32Z
---

## Current Test

number: 2
name: 6+ target companies, deep-link a company ranked 6th+, confirm visible + highlighted (WR-01 runtime check)
expected: |
  The WR-01 fix's row-reorder (splice the focused row to the front when its index >= ROW_CAP=5)
  causes the focused row to always render within RowCap's visible slice, so the scroll/highlight
  effect does not silently no-op.
awaiting: user response

## Tests

### 1. Companies → Coverage → People scroll-and-highlight flow
expected: Both scroll-and-highlight transitions fire, land on the correct row, and a newly-added company is immediately visible in Coverage/People without a page refresh (CR-01 fix's runtime behavior).
result: PASSED — live-verified via browser automation (Playwright) against the real dev server at localhost:3001. Clicked "🔍 Find people" on Coverage's TestCo Alpha row: page smooth-scrolled to the People section, auto-switched to "By company" view, and TestCo Alpha's row rendered with the accent ring-highlight exactly per D-04's spec. Screenshot evidence captured during this session. The "+ Add to targets" → scroll-to-Coverage half of this flow was not separately live-clicked (would require adding a new company to the real account's target list), but shares the identical `onTargetAdded`/`goToCoverage` mechanic already confirmed wired in 03-VERIFICATION.md's Key Link Verification table.

### 2. 6+ target companies, deep-link-focus a company ranked 6th+ (WR-01)
expected: The focused row is visible (not hidden behind RowCap's cap) and correctly highlighted post-scroll.
result: [pending]
note: This test account currently has only 3 target companies (TestCo Alpha/Beta/Gamma), so RowCap's cap=5 truncation never engages — the scenario can't be reproduced without either the real account acquiring 6+ target companies naturally, or deliberately adding synthetic ones (declined, to avoid polluting live production CRM data). The fix itself was independently re-verified at the source level in 03-VERIFICATION.md (row-reorder splice runs before RowCap truncation, confirmed via direct code read against commit e7b2034) — high confidence, but not a live click-through.

### 3. External deep-links from Pipeline/Today land on Grow, not a dead route
expected: Both call sites route through App.jsx's re-pointed goFindPeople, landing on GrowTab with the People section pre-scrolled/highlighted for that company.
result: [pending]
note: This test account has 0 applications and 0 contacts, so there's no real Pipeline/Today row with a "who could I meet here" panel to click. Both call sites (Pipeline and Today) were confirmed re-pointed at the source level in 03-VERIFICATION.md's Key Link Verification table (App.jsx:319, App.jsx:321 both route through the same goFindPeople body). Recommend a quick live click-through once real pipeline data exists.

### 4. All 4 preserved GROW-02 capabilities (ranking, gap detection, discovery, drafting)
expected: All 4 AI/search-backed capabilities function identically to their pre-merge behavior, now inside Grow's stacked sections.
result: [pending]
note: This test account has no Anthropic API key configured (confirmed live: clicking "Find people" returned the app's own friendly "Add your Anthropic API key in Settings" error, not a crash — correct error handling, but blocks a real capability test). Exa search calls did succeed live (200 OK) during this session's click-through. No functional logic was removed from any of the 3 merged components per 03-VERIFICATION.md's source diff — response *quality* is what needs a human with real API keys.

## Summary

total: 4
passed: 1
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
