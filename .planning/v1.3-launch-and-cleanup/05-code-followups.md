# 05 — Small code follow-ups

**Status:** items 1–2 done on `chore/v1.3-cleanup`; item 3 is a standing rule.

## 1. ✅ Event ingest stops asking without a campus

**Was:** `App.jsx` mounted `useEventIngest({ enabled: true })`. For a user with no
`profiles.school_id`, `/api/events-ingest` answers 400 "pick your campus". The hook only sets
`lastCheck` on success, so it retried on every page load, one wasted authenticated request per
load for every non-UMich friend. (From the v1.1 handoff's "Known small follow-ups".)

**Now:** `enabled: !!profile?.school_id`. The hook's effect depends on `enabled`, so picking a
campus in Settings starts the daily pull in the same session.

## 2. ✅ Job Boards keeps its state across Pipeline view switches (WR-02)

**Was:** `PipelineTab` rendered `{view === 'jobBoards' && <JobBoardsView/>}`, so switching to
Applications or Sheet and back unmounted it and discarded the pulled board results, search
history and the ad-hoc lookup. (From `05-REVIEW.md` WR-02, reproduced in 05-UAT test 3.)

**Now:** Job Boards mounts on first open and then stays mounted inside `<div hidden>`. It has
no global listeners and nothing fixed-position (checked), so hiding it is enough. Applications
and Sheet still remount: they hold nothing that's expensive to lose. The Sheet's filters
persist in `rec_sheet_prefs`.

**Verify by hand:** Pipeline → Job Boards → pull tracked boards → Sheet → Job Boards: the
results are still there and there's no second pull.

## 3. Function budget (standing rule)

Vercel Hobby allows 12 functions and the project is at 12/12. Before adding any new `api/*.js`:
fold it into an existing handler (the `gh-api.js ?upstream=` and `google-connect.js ?action=`
pattern), or upgrade to Pro. `api/_lib/*` files don't count toward the limit.

## Also considered, not doing

- **WR-01** (Pipeline's view list and the rendered body are maintained separately): there are
  three views now and both lists come from `PIPELINE_VIEWS`, so the drift risk is small. Leave it.
- **`ingest_sources` "who relayed" audit column:** relays are host-validated and the freshness
  gate runs before any write. Revisit only if a second campus comes online with untrusted relays.
