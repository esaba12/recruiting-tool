---
phase: 1
slug: visual-foundation-industrial-design-tokens-primitives
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-15
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None installed — `app/package.json` `scripts` block contains only `dev`/`build`, no `test` script; no test config files or test directories found in `app/` |
| **Config file** | none — see Wave 0 |
| **Quick run command** | n/a (no automated test runner) |
| **Full suite command** | n/a |
| **Estimated runtime** | n/a |

This phase's success criteria are inherently visual/perceptual (token values "look industrial," primitives "visibly reflect" the new palette) plus two objectively-checkable gates (contrast validation, no-regression rendering) — neither of which a conventional unit-test suite is the natural tool for. The project's standing global directive (render it, screenshot it, and check it against the stated aesthetic direction before declaring UI work done) supplies the verification method for the perceptual criteria; scripted grep/Node checks cover the objective ones.

---

## Sampling Rate

- **After every task commit:** Run the deterministic grep checks (mono call-sites present, no stray stock-Tailwind color classes in `shared.jsx`) after any token/badge-color edit.
- **After every plan wave:** Full manual visual pass — load every existing tab + `/demo`, screenshot, compare against the stated industrial direction.
- **Before `/gsd-verify-work`:** Contrast validator run on the final chosen token values must be zero-FAIL (WARNs acceptable only with documented relief per the `dataviz` skill's rules).
- **Max feedback latency:** immediate (grep) / minutes (manual visual pass) — no long-running suite exists to bound.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(populated once PLAN.md tasks exist — see Phase Requirements → Test Map below for the requirement-level mapping available now)* | | | | | | | | | ⬜ pending |

### Phase Requirements → Test Map (from research, pending task-ID assignment)

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIS-02 | Dense data fields (dates/counts/deadlines/status codes) render in IBM Plex Mono | manual visual + grep | `grep -rn "font-mono\|<Mono>" app/src/components/ContactsTable.jsx app/src/components/PipelineTab.jsx app/src/components/jobBoards/` (confirm new mono call sites exist in the target files) | ❌ Wave 0 (no automated visual regression tooling in repo) |
| VIS-03 | New token values pass the `dataviz` contrast validator | scripted (Node) | `node <dataviz-skill-path>/scripts/validate_palette.js "<hex list>" --mode light` for the categorical set, plus manual `contrast(a,b)` checks for text/background pairs | ✅ (script exists in the skill, runnable today, no repo changes needed) |
| VIS-02/VIS-03 (regression) | All existing tabs render without regressions after the token swap | manual smoke test | Load each of the 8 current top-level tabs + `/demo` in a browser, screenshot, compare against pre-change baseline | ❌ Wave 0 (no automated screenshot-diff tooling in repo) |
| — (regression risk) | `shared.jsx`'s off-token colors don't silently stay stock-Tailwind | scripted (grep) | `grep -n "orange-\|purple-" app/src/shared.jsx` returns zero matches once fixed (or is explicitly deferred per RESEARCH.md Open Question 1) | ✅ (grep-based check works today) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No test framework install needed — this phase relies on deterministic grep checks + manual visual verification, not a unit-test suite (see Test Infrastructure above).
- [ ] Planner should still stub the grep-check commands above as explicit task-level `<verify>` steps so they run as Wave 0-equivalent gates per task, since no framework exists to run them automatically.

*Existing infrastructure (grep + manual browser verification) covers all phase requirements — no new tooling install required for this phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| New industrial token palette "looks" cohesive and on-direction | VIS-01 (directional, milestone-level) | Perceptual/aesthetic judgment — no automated tool evaluates aesthetic fit | Render app locally, screenshot every primitive (`Button`, `Badge`, `Card`, `Tabs`, `Input`, `Select`, `Modal`, `EmptyState`) and compare against the industrial/control-panel direction locked in PROJECT.md |
| All 8 existing tabs + `/demo` render without visual regression after token-value swap | Success Criterion 4 | No screenshot-diff tooling in repo; requires human comparison against pre-change baseline | Load each tab (Overview, Network, Explore, Pipeline, Actions, Calendar, Job Boards, Settings) and `/demo`, screenshot each, confirm no broken/illegible states |

---

## Validation Sign-Off

- [ ] All tasks have `<verify>` steps referencing the grep checks or manual visual pass above
- [ ] Sampling continuity: no 3 consecutive tasks without a verify step
- [ ] Wave 0 covers all MISSING references (none required — see Wave 0 Requirements)
- [ ] No watch-mode flags
- [ ] Feedback latency acceptable (immediate/grep-based; manual pass bounded to end of wave)
- [ ] `nyquist_compliant: true` set in frontmatter once the above are confirmed during execution

**Approval:** pending
