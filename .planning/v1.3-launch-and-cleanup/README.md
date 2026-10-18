# v1.3 — Launch + cleanup

**Goal:** get the friends launch out the door (v1.2's owner steps, still open), close the last
v1.1 verification, and cut the repo down to what the live app actually uses.

**Written:** 2026-10-16, from a full read of `.planning/`, `CLAUDE.md`, the README and every branch
and worktree, plus a dead-code scan of `app/src` and `app/api`.
**Execution:** direct, no GSD orchestration. Ask before any `supabase db push`. No new `api/*.js`
files: the project is at the Vercel Hobby limit of 12 functions.

## Where things stand

| Milestone | Code | Still open |
|---|---|---|
| v1.0 IA + reskin (phases 1–7) | ✅ shipped Aug 2026 | Nothing. Phases 3–4 still say "awaiting human UAT", but both have been in daily use since August, so they count as accepted. GSD artifacts archived to `.planning/archive/v1.0/`. |
| v1.1 Recruiting Events (phases 8–15) | ✅ shipped 2026-10-16 (PR #11) | The live round trip to the Recruiting calendar → [03](03-recruiting-calendar-roundtrip.md) |
| v1.2 Friends launch (specs 01–07) | ✅ shipped 2026-10-12 (PR #6) | Owner console steps → [02](02-owner-runbook.md), then launch week → [04](04-launch-week.md) |

## Specs

| # | Spec | Who | Status |
|---|------|-----|--------|
| 01 | [Merge `feat/demo-refresh`](01-merge-demo-refresh.md) | owner | ✅ merged 2026-10-17 (PR #9) |
| 02 | [Owner runbook: Google Cloud, Supabase, Vercel, cron](02-owner-runbook.md) | owner (🤖 where marked) | open |
| 03 | [Recruiting calendar live round trip](03-recruiting-calendar-roundtrip.md) | owner + 🤖 | blocked on 02 (Google scopes) |
| 04 | [Launch week: smoke test, invite, soft launch](04-launch-week.md) | owner + 🤖 | blocked on 02 |
| 05 | [Small code follow-ups](05-code-followups.md) | 🤖 | ✅ merged 2026-10-17 (PR #13). Job Boards keep-alive still needs a by-hand check |
| 06 | [Prune + refactor](06-prune-and-refactor.md) | 🤖 | ✅ merged 2026-10-17 (PR #13); branch cleanup done except the `demo-refresh` worktree (01 step 4); E items are later |
| 07 | [Docs restructure (slim CLAUDE.md)](07-docs-restructure.md) | 🤖 | ✅ merged 2026-10-17 (PR #13) |
| 08 | [Retire the Apps Script email pipeline](08-email-pipeline-consolidation.md) | 🤖 after 02's cron | later; needs the features the serverless scan lacks first |
| 09 | [Split the bundle by tab](09-bundle-split.md) | 🤖 | ✅ done on `feat/bundle-split`: entry 1,985 → 497 KB + 357 KB vendor (gzip 585 → 255), no build warning |
| 10 | [Gmail scan budget + incremental discovery](10-scan-budget.md) | 🤖, one `db push` | open (replaces 02 D3 and 08 item 4) |
| 11 | [Per-message dedup for logged emails](11-interaction-dedup.md) | 🤖, one `db push` + `clasp push` | open; **must land before 02 D2** |
| 12 | [Calendar invites on the serverless path](12-calendar-invites.md) | 🤖 | open (08 item 2) |

Order: 02 → (03 ∥ 04). 01 and 05–07 are merged (PRs #9, #13).
08 waits until the Gmail cron (in 02) has run cleanly for a week.

**🤖 track (09–12), needs no console work from the owner.** Order: **09 → 11 → 10 → 12**,
one branch and one commit per spec, `npm test && npm run build` and a browser check each.
- 09 first: no schema change, nothing waits on it, and it's measurable.
- 11 before 10: it gates 02 D2. Its migration and 10's ship in **one** `supabase db push`
  (dry-run shown, owner approves once), after both are written and tested.
- 12 last: the biggest, it touches the same scan loop as 10 and 11, and it can be tested only
  offline until 02 D1/D2 are done.

## Definition of done

1. Every P0 box in [02](02-owner-runbook.md) is checked, and v1.2's DoD #1–#5 hold on prod.
2. [03](03-recruiting-calendar-roundtrip.md)'s five checks pass against the real Google account.
3. Three friends, at least one of them non-SWE, sign up without help, and after 48h you've read the `feedback` table and Sentry.
4. ✅ (2026-10-17) `main` has no dead top-level folders. CLAUDE.md is an index under 25 KB, not a 118 KB changelog. Every local worktree is either in use or removed.
