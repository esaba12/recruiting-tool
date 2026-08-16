---
phase: 1
slug: visual-foundation-industrial-design-tokens-primitives
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-16
---

# Phase 1 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| None crossed by plans 01-01 through 01-04 | CSS custom-property value edits, color-class-string edits, and one new presentational `<span>` wrapper component. No network request, no user input, no auth/session/access-control code, no data persistence. | Already-fetched, already-trusted display strings (formatted dates/counts from `shared.jsx` helpers) — never raw/untrusted input. |
| Local dev server (client browser ↔ Vite dev server), plan 01-05 | Standard local development loop used for the phase-closing visual verification pass — already covered by this repo's existing auth/RLS/BYOK model, unchanged by this phase. | None new — read-only visual inspection of the existing signed-in session or `/demo`'s no-auth path. |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | (none identified) | `app/src/index.css` `@theme` block | low | accept | Static, build-time-compiled CSS custom properties with no runtime input surface; confirmed negligible by `01-RESEARCH.md`'s Security Domain section. | closed |
| T-01-02 | (none identified) | `app/src/shared.jsx` color-map constants | low | accept | Pure string-literal object maps consumed by a presentational Badge component; no user input flows into these values. | closed |
| T-01-03 | (none identified) | `app/src/components/ui/Mono.jsx` | low | accept | New presentational component; renders only `children` passed by existing trusted call sites (formatted date/count strings), no `dangerouslySetInnerHTML`, no raw HTML injection. | closed |
| T-01-04 | (none identified) | `Button.jsx` / `Badge.jsx` / `Tabs.jsx` | low | accept | className-string edits only; no props/behavior surface changed. | closed |
| T-01-05 | (none identified) | `ContactsTable.jsx` / `PipelineTab.jsx` Mono call sites | low | accept | `Mono` renders only pre-formatted date strings and numeric day-counts already produced by trusted `shared.jsx` helpers. | closed |
| T-01-06 | (none identified) | `JobCard.jsx` / `JobDetailModal.jsx` Mono call sites | low | accept | `Mono` renders only already-displayed date/countdown strings (parsed board postings, AI-extracted deadline text per `lib/deadlines.js`'s existing "never invent a date" constraint) — no new rendering of untrusted raw HTML. | closed |
| T-01-07 | (none identified) | Local dev server used for visual verification (01-05) | low | accept | Standard `npm run dev` local loop already in daily use for this project; no new exposure introduced by running it for a screenshot pass. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (high) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

All 7 threats identified across the phase's 5 plans are severity `low`, well below the configured `high` block threshold, and each carries a documented `accept` disposition authored at plan time (not retroactively) — `register_authored_at_plan_time: true`. Per the ASVS L1 short-circuit rule, no deep auditor verification pass was required: this is a purely presentational token/typography phase (CSS custom-property values, color-class strings, and one new non-HTML-injecting wrapper component), touching no authentication, session, access-control, input-validation, or cryptography surface.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-01-01 through T-01-07 | Phase is a token-value/typography reskin with zero new input surface, zero auth/session/access-control/data-persistence changes. Every threat's mitigation is structural (no untrusted data flows into any changed code) rather than requiring new runtime controls. | Claude (gsd-secure-phase, ASVS L1 short-circuit) | 2026-08-16 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-16 | 7 | 7 | 0 | Claude (gsd-secure-phase) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-16
