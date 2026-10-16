---
phase: 2
slug: unified-attention-feed-today
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-16
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None detected — no `test`/`spec` files, no `vitest`/`jest` config, no test script in `app/package.json`. Same pre-existing condition Phase 1 operated under. |
| **Config file** | none — see Wave 0 |
| **Quick run command** | n/a (no automated test runner) |
| **Full suite command** | n/a |
| **Estimated runtime** | n/a |

This phase's success criteria mix a removal claim (ATTN-03: 4 surfaces fully gone, not duplicated) with a functional/visual claim (ATTN-01/02: unified feed shows correct items, deep-links work) — the former is grep-verifiable, the latter needs a live render, matching Phase 1's precedent.

---

## Sampling Rate

- **After every task commit:** grep checks for the specific files/references that task removed or added.
- **After every plan wave:** full manual visual pass through Today's sections + verify `/demo` still works + verify no dangling `'actions'`/`ActionsTab` references.
- **Before `/gsd-verify-work`:** the ATTN-03 removal grep (`grep -rn "ActionsTab\|'actions'" app/src/` returns zero hits) must be clean, plus a human visual pass on Today's 9 sections and each deep-link target.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(populated once PLAN.md tasks exist)* | | | | | | | | | ⬜ pending |

### Phase Requirements → Test Map (from research, pending task-ID assignment)

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ATTN-01 | Today shows all 9 sections with correct items | manual (visual UAT) | — | ❌ No test infra in repo |
| ATTN-02 | Clicking an item opens the correct detail modal (`ContactDetailModal` for contacts, `ApplicationDetailModal` for stale-apps/needs-review, approve/dismiss for Timeline Finds) | manual (visual UAT) | — | ❌ No test infra in repo |
| ATTN-03 | Actions tab / Overview nudge / Keep-in-Touch standalone view / TimelineFindsPanel standalone presentation are gone, not duplicated | scripted (grep) + manual | `grep -rn "ActionsTab\|'actions'" app/src/` returns zero hits outside git history; confirm `KeepInTouchTab`'s standalone view no longer appears in Network's view switcher; confirm `TimelineFindsPanel` no longer renders inside `CalendarTab.jsx` | ✅ (grep works today) |
| — (regression) | `/demo`'s `DEMO_NAV_ITEMS` includes `'today'`, Timeline Finds excluded from demo mode | manual + grep | `grep -n "DEMO_NAV_ITEMS" app/src/App.jsx` shows `'today'` included | ✅ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No test framework install needed — grep-based + manual visual verification, matching Phase 1's precedent.

*Existing infrastructure (grep + manual browser verification) covers all phase requirements — no new tooling install required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Today's 9 sections render correct, complete data | ATTN-01 | Requires live render against real (or demo) data across all 9 categories | Load Today with a signed-in session that has items in each category (or /demo for the 8 non-Timeline-Finds categories), confirm each section shows the right items |
| Each item type opens the correct modal with working "Find people →" | ATTN-02 | Requires clicking through the live UI; `onFindPeople` wiring is a fail-soft regression that won't throw an error if broken | Click a contact item → `ContactDetailModal` opens; click a stale-app or Needs-Review item → `ApplicationDetailModal` opens with a working "Find people →" button |
| No visual/functional regression on Overview (post nudge-section removal) or Calendar (post TimelineFindsPanel removal) | ATTN-03 | Perceptual/functional check on the *surrounding* surfaces, not just the removed ones | Load Overview — confirm it still renders KPIs/funnel correctly without its old nudge section; load Calendar — confirm no broken layout where TimelineFindsPanel used to render |

---

## Validation Sign-Off

- [ ] All tasks have `<verify>` steps referencing the grep checks or manual visual pass above
- [ ] Sampling continuity: no 3 consecutive tasks without a verify step
- [ ] Wave 0 covers all MISSING references (none required — see Wave 0 Requirements)
- [ ] No watch-mode flags
- [ ] Feedback latency acceptable (immediate/grep-based; manual pass bounded to end of wave)
- [ ] `nyquist_compliant: true` set in frontmatter once the above are confirmed during execution

**Approval:** pending
