---
phase: 02
slug: unified-attention-feed-today
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-18
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Client (React) → already-fetched Supabase data | `TodayTab.jsx` renders `contacts`/`apps`/`interactions`/`calls` props already fetched via the existing RLS-scoped `fetch*` calls in `App.jsx` — no new query, no new data path introduced anywhere in this phase. | Already-RLS-scoped recruiting CRM data (contacts, applications, interactions) |
| Client → existing per-record modals | `ContactDetailModal`/`ApplicationDetailModal` reused as-is; both already write through `db.js`'s RLS-scoped update/insert calls. | Same as above |
| Client → Timeline Finds' AI scan (`useTimelineFinds.js` as of Plan 02-06, formerly `TimelineFindsPanel.jsx`) | The existing `requireUser()`-gated `/claude-api`/`/openai-api` proxy call, unchanged in shape across every plan in this phase — Plan 02-06 relocated *where* the trigger lives (component → hook), not the trust boundary itself. | Application notes / call summaries / interaction text sent to the AI proxy for date extraction |
| Browser `localStorage` (`rec_timeline_meta`/`rec_timeline_pending`, per-user-scoped via `scopedStorage.js`) ↔ React state | Pre-existing boundary; Plans 02-05 and 02-06 each performed one additional read (02-05) or a full relocation (02-06) of the same already-locally-readable keys — no new input source, no data crossing in from outside the browser. | Staged (not-yet-approved) Timeline Finds events; daily-scan bookkeeping |
| Public `/demo` route | Anonymous, unauthenticated visitors. `isDemoMode` must suppress `TimelineFindsPanel`'s mount and short-circuit `useTimelineFinds`'s `enabled` flag, since that scan is the one AI-proxy call this phase's new surfaces could otherwise fire without auth. | None (mitigation is that no data crosses this boundary at all in demo mode) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | (none identified) | `app/src/lib/attention.js` | low | accept | Pure synchronous array transforms over already-fetched, already-RLS-scoped props — identical trust boundary to the `ActionsTab.jsx`/`keepInTouch.js` logic it was extracted from. | closed |
| T-02-02 | (none identified) | `TimelineFindsPanel.jsx` (chrome refactor, Plan 02-01) | low | accept | Presentational-only change; the AI-calling `scan()`/`approve()` functions and their `requireUser()`-gated proxy calls were unmodified by that plan. | closed |
| T-02-SC (02-01) | Tampering | npm/pip/cargo installs | n/a | accept | Zero new package installs — 100% reuse of already-installed `lucide-react`/`react`. | closed |
| T-02-03 | Information Disclosure | `TodayTab.jsx` + reused `ContactDetailModal`/`ApplicationDetailModal` | low | accept | Renders only props already passed down from `App.jsx`'s RLS-scoped `fetch*` results — no new query surface. | closed |
| T-02-04 | Tampering (functional integrity, not a classic exploit) | `ApplicationDetailModal` mount inside `TodayTab` | medium | mitigate | `onFindPeople` must thread from the caller through to `ApplicationDetailModal` or the cross-tab "Find people →" relay silently breaks (fail-soft, no crash, no data exposure). **Re-verified directly against current source (2026-08-18):** `TodayTab.jsx:343` accepts `onFindPeople` in its signature, `TodayTab.jsx:489` passes `onFindPeople={onFindPeople}` into `ApplicationDetailModal` verbatim. Independently confirmed by 02-VERIFICATION.md's re-verification pass (Truth 2, `TodayTab.jsx:478-493`). | closed |
| T-02-SC (02-02) | Tampering | npm/pip/cargo installs | n/a | accept | Zero new package installs. | closed |
| T-02-05 | Denial of Service (resource/cost abuse — the proxy already fails closed via `requireUser()`) | `/demo` route reaching Timeline Finds' mount-time AI scan | low | mitigate | `DemoApp`'s `TodayTab` call passes `isDemoMode`, gating the scan trigger. **Re-verified directly against current source (2026-08-18), including post-02-06 relocation:** `TodayTab.jsx:359` passes `enabled: !isDemoMode` into `useTimelineFinds(...)`; `useTimelineFinds.js:56-57`'s effect checks `if (!enabled) return` before anything else — the scan cannot fire in demo mode regardless of which component owns the trigger. `TodayTab.jsx:452` additionally keeps `TimelineFindsPanel` itself unmounted (`{!isDemoMode && (...)}`) — belt-and-suspenders, not a single point of failure. | closed |
| T-02-06 | (none identified) | `Sidebar.jsx`/`icons.js` `NAV_ITEMS`/`NAV_ICON` edits | low | accept | Static config-array edits only. | closed |
| T-02-SC (02-03) | Tampering | npm/pip/cargo installs | n/a | accept | Zero new package installs. | closed |
| T-02-07 | (none identified) | Local dev server used for visual/functional verification | low | accept | Standard `npm run dev` local loop already in daily use for this project. | closed |
| T-02-08 | Denial of Service (cost/abuse — proxy already fails closed) | `/demo` route, end-to-end confirmation | low | accept | Human-check confirmed no AI-proxy call fires for an anonymous demo visitor. | closed |
| T-02-09 | Information Disclosure | `TodayTab.jsx`'s (Plan 02-05, now superseded by Plan 02-06) synchronous `lsGet(PENDING_KEY)` read | low | accept | No new data exposed, no new trust boundary crossed — same already-locally-readable `rec_timeline_pending` key `TimelineFindsPanel.jsx` already read/wrote. Superseded by Plan 02-06's relocation into `useTimelineFinds.js` (see T-02-11), which carries the identical disposition forward. | closed |
| T-02-10 | Tampering | `rec_timeline_pending` localStorage value (client-controlled, e.g. devtools) | low | accept | Pre-existing risk, unchanged: any client-side script/devtools user can already alter localStorage today. A tampered count only affects local UI section-visibility — `approve()`'s actual Google Calendar write (and its own field validation) is unchanged. Superseded by T-02-12 (Plan 02-06). | closed |
| T-02-11 | Information Disclosure | `useTimelineFinds.js`'s lazy `useState` initializers (`lsGet(META_KEY)`/`lsGet(PENDING_KEY)`) | low | accept | Same already-locally-readable data as before Plan 02-06, just read from a relocated module — no new trust boundary, no PII scope change. | closed |
| T-02-12 | Tampering | `rec_timeline_meta`/`rec_timeline_pending` localStorage values (client-controlled) | low | accept | Pre-existing risk, unchanged by the Plan 02-06 refactor — `approve()` (logic ported byte-for-byte into `useTimelineFinds.js`) remains the only path that writes to Google Calendar, with unchanged request-shape validation. | closed |
| T-02-13 | Denial of Service (self, cost) | `useTimelineFinds.js`'s daily-scan effect now runs on every `TodayTab` mount, not only when `TimelineFindsPanel` happened to be visible | low | accept | This is the deliberate fix (closing CR-01 new / ATTN-01's scan-lockout gap), not a new risk — `meta.lastCheck !== todayStr()` (unchanged gate logic) still caps real scan/AI-call work to at most once per calendar day regardless of mount frequency; only the ownership of the check moved. **Independently confirmed live** during this phase's UAT (2026-08-18, Test 3): a single scan attempt fired per stale-`lastCheck` reload, not repeatedly. | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks beyond those already dispositioned `accept` in the Threat Register above (11 of 13 threats) — each carries its own rationale inline; no separate escalation was required for any of them.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-18 | 13 | 13 | 0 | Claude (gsd-secure-phase, orchestrator classification — short-circuited per ASVS L1 rule: threats_open=0, register_authored_at_plan_time=true, asvs_level=1; both `mitigate`-dispositioned threats re-verified directly against current source rather than trusted from plan-time claims alone) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-18
