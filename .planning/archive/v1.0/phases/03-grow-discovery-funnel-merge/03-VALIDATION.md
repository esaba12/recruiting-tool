---
phase: 3
slug: grow-discovery-funnel-merge
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-18
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — this repo has no automated test runner (`[VERIFIED: repo structure, no test runner in app/package.json]`, RESEARCH.md §Validation Architecture) |
| **Config file** | none — no test framework exists |
| **Quick run command** | n/a — no automated suite |
| **Full suite command** | n/a — no automated suite |
| **Estimated runtime** | n/a |

Consistent with Phase 1 and Phase 2 precedent: verification for this codebase is a staged, conversational human-check pass (`/gsd-verify-work`), not automated tests. This phase does not introduce a test framework — that would be an out-of-scope cross-cutting infra decision, not something GROW-01/GROW-02 requires.

---

## Sampling Rate

- **After every task commit:** visual smoke check of the specific section/file edited (no automated quick-run exists)
- **After every plan wave:** full manual pass of the 4-row checklist below
- **Before `/gsd-verify-work`:** full manual checklist must be green
- **Max feedback latency:** n/a (no automated suite — feedback is the manual checklist)

---

## Per-Task Verification Map

No automated per-task commands exist for this repo. Each task's `<verify>`/`<acceptance_criteria>` must instead point to a **source assertion** (grep/read-based, e.g. confirming a stale reference is gone or a prop is threaded correctly) or a **behavior assertion** covered by the Phase Requirements → Test Map below. The planner should map each task to one of the 4 rows here rather than inventing a new automated command.

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Manual Verification Steps | File Exists? |
|--------|----------|-----------|---------------------------|-------------|
| GROW-01 | User moves Companies→Coverage→People without leaving Grow | manual-only | Land on Grow with ≥1 target company; click "+ Add to targets" on a new company card → confirm smooth-scroll to Coverage + row highlight; click "🔍 Find people" on a Coverage row → confirm smooth-scroll to People + row highlight/pre-search, all without a tab switch | N/A — no automated suite |
| GROW-01 (cont'd) | External deep-links land on Grow, not dead Network routing | manual-only | From Pipeline, open an application, click "who could I meet here" → confirm it lands on Grow/People, not a blank Network tab. Repeat identically from Today's equivalent panel | N/A |
| GROW-02 | All 4 capabilities (ranking, gap detection, discovery, drafting) still work | manual-only | Run one full pass of each: refresh Companies ranking, view a Coverage gap row, run/re-run a People search, generate + copy a cold-outreach draft | N/A |
| GROW-01 success criterion 3 | Old destinations gone | manual-only (+ grep) | Confirm Sidebar has no "Explore" item; Network's segmented control has no Coverage/Discover chips; `grep -rn "'explore'\|NETWORK_VIEWS.*coverage\|NETWORK_VIEWS.*discover" app/src` returns nothing live | N/A |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — all 4 rows ⬜ pending until execution.*

---

## Wave 0 Requirements

*None — this repo has never had an automated test framework; introducing one is out of this phase's scope. Existing manual-verification infrastructure (staged human-check pass) covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full Companies→Coverage→People flow, scroll+highlight | GROW-01 | No automated test framework in repo; scroll/highlight is a visual/interaction behavior | See Phase Requirements → Test Map row 1 |
| All 4 legacy capabilities still function post-merge | GROW-02 | No automated test framework in repo; requires live Exa/Claude calls (BYOK) to verify | See Phase Requirements → Test Map row 3 |
| Old destinations (Explore tab, Coverage/Discover sub-views) fully removed | GROW-01 criterion 3 | UI/nav absence check, partially grep-able but final confirmation is visual | See Phase Requirements → Test Map row 4 |

---

## Validation Sign-Off

- [ ] All tasks have `<verify>`/`<acceptance_criteria>` mapped to a Phase Requirements → Test Map row or a source assertion
- [ ] Sampling continuity: no 3 consecutive tasks without a verification step
- [ ] Wave 0 covers all MISSING references — n/a, no Wave 0 gaps
- [ ] No watch-mode flags — n/a, no test runner
- [ ] Feedback latency < n/a (manual checklist only)
- [ ] `nyquist_compliant: true` set in frontmatter once all 4 checklist rows are ✅ at phase execution end

**Approval:** pending
