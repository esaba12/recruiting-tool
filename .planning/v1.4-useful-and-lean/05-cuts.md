# 05 — Cut duplicates

**Status:** ✅ done 2026-10-19 on `feat/v1.4-pre-invite`. Deviations: Inbox now shows hand-logged
emails as one-message threads (Outbox was their only list); the `gh-api` allowlist dropped `users/`;
Network's Table view is now labelled "People" (it's cards on phones); the bar chart got top headroom
for its value labels.

**Who:** 🤖, plus one owner decision (C). **Migration:** none. Land before the invite goes out.

Each cut lists its evidence. Nothing here removes a capability that has no other home.

## A. Network → Outbox (cut)

`OutboxTab.jsx` lists `type === 'Email' && direction === 'Outbound'`, which is exactly what
Inbox's **Sent** filter shows (`lib/inbox.js` `FILTERS`), and Inbox does it better (threads,
replies). Remove the view from `NETWORK_VIEWS`, `TAB_CHUNKS.outbox`, the demo route list and the
`shared.jsx` comment. Delete `OutboxTab.jsx`. Anything deep-linking to `network/outbox` goes to
Inbox with `filter=sent`.

## B. Job Boards GitHub profile lookup (cut)

The single-repo/username box accepts a GitHub *username* and renders a profile: contribution grid,
top languages, recent events (`UserProfileView.jsx`, `ContributionGrid.jsx`). None of that helps
anyone find or track a job, and it's the only reason `api/gh-api.js` still proxies the third-party
`github-contributions-api.jogruber.de` (`?upstream=contrib`, unauthenticated by design).
- Keep the single-**repo** lookup, which adds a board.
- The input accepts `owner/repo` or a repo URL only. A bare username shows "paste a repo, e.g.
  SimplifyJobs/Summer2026-Internships".
- Delete:
  - `UserProfileView.jsx` and `ContributionGrid.jsx`.
  - `github.js`'s `fetchGitHubProfile`, `buildWeeks`, `topLanguages` and `parseEvents`, if nothing else uses them (grep says only these files do).
  - `LANG_COLOR` and `EVENT_LABELS` in `jobBoards/helpers.js`, if they're unused afterwards.
  - The contrib branch in `api/gh-api.js`, its `vercel.json` rewrite, `vite.config.js`'s `/gh-contrib` mount, any CSP `connect-src` entry for it, and the line in `docs/architecture/dashboard-features.md`'s proxy table.

## C. Timeline Finds (cut: owner decided 2026-10-19)

`lib/timelineFinder.js` runs a daily AI pass over application notes, call transcripts and
interactions, looking for dates, then stages them for calendar approval. It was built before the
pipeline could read dates itself. Since then:
- Spec 12 reads calendar invites.
- 08 item 3 creates interview events.
- The classifier extracts OA deadlines.
- 02 stores interview and offer dates.

What's left is dates mentioned in your own free-text notes. That's a daily charge on every user's
key, for a section most days will show empty. It's about 400 lines (`timelineFinder.js`,
`useTimelineFinds.js`, `timeline.js` if it's only used here, `TimelineFindsPanel.jsx`) plus
`rec_timeline_*` keys.

Delete it and its Today wiring (`TodayTab.jsx:14,23`). `lib/timeline.js` stays: Calendar's Feed
view uses it. The two orphaned `rec_timeline_*` keys are left alone, since `scopedStorage` has no
remove, and they're harmless.

## D. Today's Activity block (move, don't delete)

Today is the action list. Its Activity section (`TodayTab.jsx` ~L450–560) repeats charts that
already live where you can act on them:
- The application Sankey → Pipeline → Sheet → Flow.
- The networking Sankey → Network → Flow.

Changes:
- Keep the `StatTileRow` on Today. That's the at-a-glance part.
- Move the Application Funnel and its conversion line to Pipeline → Sheet → Flow, above the Sankey.
- Move "Network by Status" and "Networking Activity" to Network → Flow.
- Delete the two Sankey copies from Today.

[08](08-custom-today.md) brings each chart back as an optional Today card, off by default.

Recharts then never loads on Today, and `TodayTab.jsx` (832 lines, the third-biggest node in the
graph) loses roughly 120 lines.

## E. Network → Cards toggle (fold into responsive layout)

The Cards view is the only contacts list that reads well on a phone, since `ContactsTable` is a
wide `overflow-x-auto` grid. As a toggle, it's a second way to see the same rows on desktop.
- Render the card list below `md` and the table at `md` and up (`useMediaQuery`), then drop
  `cards` from `NETWORK_VIEWS`.
- Bring the card markup onto tokens while there: replace `bg-indigo-50 text-indigo-600` (the
  Referred-by badge), `rounded-xl` and `shadow-sm hover:shadow-md`, per design-system.md's shape rules.
- Move it out of `App.jsx` into `components/ContactCards.jsx`.

## Tests

- Update the demo route test/fixtures that list Network views.
- `test/github.test.js`: drop the profile-parsing cases, and keep the repo/HTML-table cases.
- If any test covers the contrib proxy branch, remove it alongside.

## Checks

- `/demo`: every tab still renders.
- Network on 390px shows cards and on desktop shows the table.
- Inbox → Sent shows what Outbox used to.
- `/gh-contrib/...` returns 404.
- The production build is smaller (note the before/after entry and Today chunk sizes).

## Done when

A–E are merged, and `docs/architecture/dashboard-features.md` no
longer mentions what was cut.
