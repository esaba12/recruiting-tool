# Dashboard features (tab by tab)

> Current state as of 2026-10-22 (rewritten in v1.4 spec 06 C; Today updated for PR #22 and spec 08). History lives in git and
> `.planning/`. If a detail here disagrees with the code, the code wins.

Dev server: `cd app && npm run dev` → http://localhost:3001. Tabs come from `NAV_ITEMS` in
`components/layout/Sidebar.jsx`. Settings sits in the sidebar footer. `/demo` renders every tab
on seed data (`demoData.js`).

## Today (`TodayTab.jsx`, logic in `lib/attention.js`)

A dashboard (PR #22, 2026-10-20): the metric cards first, then a short **Now** strip (v1.5
spec 03, cut down 2026-11-11 on owner feedback). Cards share one shell, `today/DashCard.jsx`: a
mono caps label with a status dot and a count. `Group` stacks labeled lists inside a card, and
each list shows 3 rows before "+N more".

**Now strip** (`today/UpNext.jsx`, ranking in `lib/actionQueue.js`):
- `buildActionQueue` merges every list `deriveTodayAttention` builds and tiers it (Now / This week / Backlog; rules in the file header). Only the **Now** tier renders: overdue or due today, an interview within 36h, an offer due ≤ 3 days, thank-yous, a drafted reply waiting 2+ days, registration closing ≤ 2 days. 5 rows, then "+N more". Dated items by due date, then undated by age.
- Each row is the old card's row component (TodayTab `renderRow`), tagged with its kind, with a clock (snooze menu) for kinds that have a snooze list. Empty: "Nothing overdue or due today. Next: …" (`nextUp`).
- The queue's kinds are its Customize toggles; Awaiting reply / Stale thresholds are its settings. With it placed, the open count (header "N due" and the sidebar badge) is the Now count.

A header line gives the date and the open count (cards and lists that are on only), plus
"Unhide N" when anything is snoozed, and **Customize**.

**One derivation** (v1.5 spec 02): `lib/todayAttention.js` `deriveTodayAttention` builds every
list from the data, the layout and the snoozes. `lib/useTodayAttention.js` (layout + snoozes +
that) is mounted once in `AppInner` / `DemoAppInner` and passed to `TodayTab` as `attention`, and
the sidebar's Today badge is its `openCount`, so the badge always equals the header's "N open".

**Customize** (v1.4 spec 08). Each user arranges their own Today:
- The card registry is `lib/todayCards.js`, which is pure. Each card has a default width (`third` / `half` / `full`) and optional `groups` (the lists inside it).
- Users can turn any group off. Job boards to review is SWE/PM only, and Events needs a campus.
- Per-card settings: rows shown (3 / 5 / 10), People's "Awaiting reply after" days and Applications' "Stale after" days.
- The layout lives in `user_settings.today_layout` (`lib/useTodayLayout.js`), separate from snoozes. Nothing is saved until the user changes something, so an untouched account always gets `defaultLayout`: Pipeline / Network / Outreach, Rates, then the Now strip.
- **Layout v2** (v1.5 spec 03): the six action cards below are `defaultOff` (in Add cards, never auto-placed). A saved v1 layout is upgraded once by `upgradeV1Layout`: action cards dropped, the Now strip after the glance cards, their turned-off lists (or every list of a card the user had removed) turned off in the queue, People/Applications thresholds moved onto it, glance cards kept in order. **v3** (2026-11-11): a v2 layout (queue first) gets the queue moved after its last glance card (`moveQueueBelowCharts`).
- `reconcileLayout`:
  - Drops unknown or unavailable cards.
  - Clamps bad values.
  - Inserts new registry cards after their registry neighbour, with `seen` making sure a removed card stays removed.
- Rendering: consecutive same-width cards form a band. Thirds go 3-up, halves go in two balanced columns, and a full card sits alone. Only on an uncustomized layout does a lone half card stretch to full width.
- `today/TodayEditor.jsx` is lazy, and it's the only importer of `@dnd-kit` (its own chunk):
  - Compact tiles at their chosen width, including empty cards ("Nothing here right now").
  - Drag by the grip: mouse, a 200 ms touch hold, or Space + arrow keys. There are also ↑/↓/✕ buttons.
  - An Add-cards drawer lists unavailable cards with the reason. Reset to default and Done round it out.

**Metric cards** (`today/MetricCards.jsx`), side by side. Each one is a headline number over its
chart, with no separate stat tiles repeating the same numbers. They're hidden until there's data.
- **Pipeline:** applied count and %, funnel bars, next deadline (`pickNextDeadline`: open OAs, offer deadlines, upcoming interviews and job-board deadlines; ties go offer → OA → interview → job).
- **Network:** contact count and how many are warm, plus the status donut.
- **Outreach:** this week's interactions, the change from last week, and the 10-week trend.
- **Rates** (PR #25), full width below the other three:
  - Response, OA, Interview, Offer and Rejected, each as a share of applications sent (anything past Wishlist).
  - Each rate has a bar and its `n / N`.
  - `pipelineRates` reads `stagePath`, so a rejected app counts for the stages it reached.
  - An app with only backfilled history counts as applied → rejected (an undercount, not a guess).
  - It replaced the Pipeline card's Applied → Phone Screen line.

**Attention cards** (opt-in since v1.5 spec 03; half width), in two columns balanced by visible row count. Their lists feed Up next either way:
- **Decisions** (v1.4 spec 02, first by default): every app at Offer, soonest deadline first (`offerDecisions`), with a countdown; danger tone within 3 days. A row opens the offer decision view (see Pipeline).
- **Replies drafted** (v1.4 spec 10): replies the Gmail scan wrote for you. Each row (here or in Up next) has **Copy & open Gmail** (v1.5 spec 05, `lib/replySend.js` `copyAndOpen`: copies the text, opens the thread, marks the draft done so it leaves Today; `/demo` copies without navigating) and **Edit** (inline, saved on blur); the subject line opens the Inbox thread. Inbox's composer uses the same helper.
- **From your email:** AI action items, with "Dismiss all".
- **People:** groups for Send a thank-you, Overdue follow-up, Awaiting reply, High urgency, Want to schedule and Keep in touch.
  - **Send a thank-you** (v1.4 spec 03, `thankYouDue`): an interview 0–48h ago (contact matched by `normalizeCompanyName`; shows even with nobody on file) or a Call/Meeting 0–2 days old, until an outbound Email/LinkedIn to that person. Draft opens `today/EmailDraft.jsx` on a template (AI rewrite behind `NeedsKey`); Sent it logs an outbound Email.
  - **Overdue follow-up** (`overdueFollowUps(contacts, interactions)`): a passed Follow-Up Date, minus contacts you already wrote to (v1.5 spec 01, `lib/followUps.js` `followedUp`): an Outbound Email/LinkedIn/Call/Meeting dated no more than 3 days before the due date, or later, counts. **Done** clears the date (no automatic +7) and logs an `Other` "Followed up".
- **Applications:** groups for Interviews coming up (`upcomingInterviews`, the next 14 days; a timed one leaves once it's over; v1.5 spec 06 rows have **Prep**, which opens Learn's Company prep on that company via `focusCompany`, and **Join ↗** from `interviewJoinLink`: `applications.interview_link`, else the newest "📅 Meeting link:" invite lead from someone at that company; Join turns solid 30 min before a timed start), OA due, Stale (14+ days without movement by default), Job boards to review (tech tracks) and OA deadline unknown.
- **Events** (`today/EventAttentionSections.jsx` `EventsCard`): groups for signup steps due,
  registration closing and event follow-ups overdue, plus a footnote listing degraded feeds.

Interview Prep, the daily AI recap card and the collapse controls were removed in PR #22.
`learningAttention` and `fetchDailyRecap` still exist, but Today no longer calls them.

A fresh account sees `onboarding/GettingStarted.jsx` instead of "all clear": the live Gmail
first-scan state (`lib/gmailScan.js`) plus rows that open the tracker and LinkedIn importers.

- **Awaiting Reply** (`awaitingReply`): the contact's last Email/LinkedIn interaction was
  Outbound and 5+ days old with nothing back. Contacts with an open Follow-Up Date are excluded, so
  they're never double-nagged; once that follow-up is sent (`followedUp`) they show here. "They replied" logs an Inbound; "Draft nudge" uses `DraftPanel`'s
  `follow_up` kind.
- **Keep in Touch** (`lib/keepInTouch.js`): reconnect cadence per contact from tie strength
  (`affinity.js`) × `DEFAULT_CADENCE`. Moderate ties get the tightest interval. Excludes Closed
  contacts and anyone with a future Follow-Up Date.
- **Declutter** (`test/declutter.test.js`):
  - `trimActionItems` hides AI items already answered on the thread, long past due, or duplicated.
  - `todayPeople` (via `dedupeAcross`) keeps each contact in one People group. Priority: Overdue → Awaiting →
    Schedule → High Urgency → Keep in Touch, with Send a thank-you ahead of all of them. A group that's turned off is skipped, so its people show in the next one.
  - A Now row's clock (`today/SnoozeMenu.jsx`, v1.5 spec 04) hides it until Tomorrow or Monday (8:00 local), Next week, or After the interview / After the deadline (`lib/snooze.js` `snoozeOptions`). An old card's ✕ snoozes for 7 days, and its "Clear all" snoozes every row in the card.
    Snoozes live in `user_settings.today_prefs` (`lib/useTodayPrefs.js`) as `{ until, due }` (older ones are a bare `untilMs`), so they follow the account. `due` is the item's date when hidden; if it moves (new OA deadline, rescheduled interview), the item comes back early (`snoozeActive`).
  - The header's "Unhide N" (`today/UnhideMenu.jsx`) lists what's hidden with "back Mon"-style return dates, each with Unhide, plus Unhide all.
- Full-size versions of the metric charts are also on Pipeline → Sheet → Flow (funnel) and
  Network → Flow (status donut, weekly trend), in `charts/ActivityCharts.jsx`.

## Inbox (`InboxTab.jsx`, `lib/inbox.js`)

A pure derivation over `interactions`: Email rows grouped by Gmail thread (`channel_ref`).
- A hand-logged email with no thread is a thread of one (`manual:<id>`). It has no Gmail link and is never unread.
- Filters: All, Needs a reply, Applications, People, Sent.
- Application receipts are dropped unless you wrote back or there's an action item.
- "Reply in Gmail" deep-links to the right account (`gmailThreadUrl`).
- **Drafted replies** (v1.4 spec 10, `email_drafts`, written by the scan; see `email-pipeline.md`).
  `buildThreads` attaches `thread.draft`, and the row shows "Reply drafted". Under the messages there's a composer:
  - proposed time chips, with "checked against your calendar" or not;
  - editable text, saved on blur;
  - **Copy & open in Gmail** (marks it done), **Copy**, **Dismiss**.

  Nothing is sent from the app. Today's "Replies Drafted" opens the thread here (`initialThreadId`).

## Network (`NetworkTab` in `App.jsx`)

Views:
- **People:** `ContactsTable.jsx` at `md` and up, `ContactCards.jsx` below it.
- **Graph:** `NetworkGraphTab`, using `react-force-graph-2d`, lazy-loaded.
- **Flow:** the networking Sankey plus the status donut and weekly trend.

Header buttons:
- **+ Contact** opens `QuickAddContactModal.jsx`.
- **+ Log Interaction** opens `LogInteractionModal.jsx`.
- Clicking a contact opens `panels/ContactPanelBody.jsx` in the side panel.

- **Logging** (`LogInteractionModal.jsx`): one modal, channel Call / LinkedIn / Meeting / Email /
  Other.
  - Call and LinkedIn have paste-and-extract via `lib/ai.js`. A Call writes both a `calls` row and an
    `interactions` row.
  - LinkedIn capture is deliberately manual: no scraping, because of account-ban risk.
- **Quick Add** (`lib/enrichment.js` `enrichContact`): name + company + "what they do" → one Exa
  people search + one AI extraction (LinkedIn URL, role, descriptor, school, past employers).
  - It never fetches linkedin.com.
  - Fail-soft down to the typed values.
  - "How they fit" is deterministic:
    - Shared-background tags (`discovery.js` `affinityTagsFor`, scored with `affinityProfileFor`, seeded from the account's school).
    - Target-company match (`isTargetCompany` against `useTargetCompanies`).
    - Who else you know there.
- **`MetButton`**: one tap logs a Meeting and bumps Last Interaction / Follow-Up Date (`lib/quickLog.js`).
- **Networking flow** (`lib/networkingFlow.js`, `NetworkingFlowPanel.jsx`): one path per contact
  with anything logged.
  - Source: They reached out / Cold outreach / Intro / Event or chat / Other.
  - Then Conversation → Met → Referral asked.
  - Outcome: Referral / Active / No reply / Gone cold.
  - Click a band to list its contacts. Colors are `charts/theme.js` `flow.networkOutcome`.

## Grow (`GrowTab.jsx`)

One funnel page:

**01 Companies (`ExploreTab.jsx`):**
- An onboarding quiz (`CompanyOnboarding.jsx`, `rec_company_prefs`).
- YC directory (`lib/ycDirectory.js`) plus Exa company search, merged and ranked by one AI call (`lib/companyFinder.js`).
- **Add to targets** writes the shared target list (`user_settings.target_companies` via `useTargetCompanies`).
- A best-effort GitHub org badge, shown only when the org is confirmed (`/gh-api/orgs/*`).

**02 Coverage (`ReferralCoverageTab.jsx`):** which target companies you have no or weak contacts at.

**03 People (`DiscoverTab.jsx`, `lib/discovery.js`, `lib/discoveryScheduler.js`):**
- Exa public-web people search at gap companies, ranked by `discoveryScore`: résumé-signal overlap, reachability, and "next best person".
- A daily background pass is capped by a per-company cooldown (7d) and a daily budget (3).
- Exa result URLs are hashed, and the AI extraction is skipped when the pages haven't changed.
- Found people are a staging queue (`rec_discovered`) until **+ Add to Contacts**. "Draft intro" uses `drafting.js` `cold_open`.

Explore/Discover state is in `rec_*` localStorage keys (per device). The target list is not.

## Learn (`LearnTab.jsx`, see `learn.md`)

Per-track interview prep: mastery engine, FSRS review queue, LeetCode sync and company prep,
practice import (sheet, paste, screenshot), coach. Today no longer shows an Interview Prep
section (removed in PR #22). OA rows still offer "Done — log how it went →" into Learn.

## Pipeline (`PipelineTab.jsx`, views in `pipelineViews.js`)

Views:
- **Applications:** a board plus `DuplicatesPanel`.
- **Sheet:** `ApplicationsSheet.jsx`.
- **Job Boards:** tech tracks only.

Applications open in `panels/ApplicationPanelBody.jsx`, with stage timeline, OA fields (editable),
referrer (`referred_by_id`, never overwritten once set) and warm paths (`lib/warmIntro.js`).
Interview stages add **Next Interview** (date, optional time; `lib/dates.js` `inputsToInstant`),
and the Offer stage adds **Offer** (`OfferForm`: decide-by date plus free-text details).

**Offer decision view** (v1.4 spec 04, `panels/OfferPanelBody.jsx`): opens in place inside the
application panel, from Today's Decisions row or "Compare and ask others to expedite →".
- Edit each offer (chips switch between them); with 2+ offers, a side-by-side table of the facts, no scoring.
- **Still in process** (`lib/offers.js` `inProcessRows`): interview stages plus Applied with activity in 30 days, furthest stage first, each with the first `warmPathsToCompany` contact.
- **Ask to expedite** drafts (`expedite` kind in `lib/drafting.js`) name the earliest offer deadline. The offering company is never passed to the template or the prompt.

**Sheet** (model in `lib/applicationSheet.js`):
- Keyboard editing, with an optimistic overlay then `refreshApps()`.
- Stage edits apply `stageSideEffects`.
- Filters, columns, sort, grouping, location regions and Flow persist in `rec_sheet_prefs`. `groupBy` is `none | stage | location`; older prefs with `grouped: true` read as `stage`.
- **Location** (see below): region chips filter the grid and the Flow. Grouped by location, each row sits under one header only (its first region, or its first selected region), so keyboard row indexes stay one per application. A saved region with no rows left is ignored, since there'd be no chip to clear it.
- Exports `.xlsx` (`lib/xlsx.js`, dependency-free) and CSV of exactly the visible rows and columns.
- **Flow** shows the funnel and the application Sankey (`lib/applicationFlow.js`). The Sankey runs source → Applied → OA → interview stages → Accepted / In process / Ghosted (30+ days quiet) / Rejected, and clicking a band filters the grid.

**Stage history** (`application_stage_events`):
- Written only by a trigger on `applications.stage`. `source` is `pipeline` for service-role writes and `user` otherwise.
- Clients can only SELECT.
- `lib/stageHistory.js` attaches `stageEvents` and `daysInStage`, and synthesizes the path when there are no events.

**Live updates:** `lib/useApplicationsLive.js` subscribes to Supabase Realtime on both tables,
debounced into `refreshApps()`, plus a refresh on re-focus after 60s.

**Job Boards** (`components/jobBoards/`):
- Tracked boards (`rec_tracked_boards`, with suggested chips) are pulled in parallel and deduped on Company+Role+Location (`boardsRegistry.js`). A single-repo lookup sits under the board list.
- `github.js` parses markdown pipe tables and HTML `<table>`s, handles "↳" ditto rows, and decodes README base64 as UTF-8.
- Open listings auto-import into Applications as Triage = Needs Review, with an in-flight claim set against double imports.
- Needs-Review rows don't count as active (`isUntriaged`).
- **Location:** region chips (`ui/LocationFilter.jsx`) replace the old free-text location box and hardcoded city chips. The 📍 view toggle groups listings by region (6 cards per group until "Show all N"; per-group expansion replaces pagination there). A multi-city listing shows in every group it belongs to. `RepoStats`' Top Locations and Cities count regions, leaving out Remote and No location.
- Real deadlines (`lib/deadlines.js`, `useJobDeadlines.js`): Exa `/contents` reads the apply page, and the AI reports a date only if the page states one. Cached forever in `rec_job_deadlines`. Sorted closest-deadline first (`urgencyComparator`).
- Hidden for non-tech tracks: there's no comparable public feed for IB or consulting.

**Locations** (`lib/locations.js`, PR #41). Location fields are free text, so filtering and grouping use *regions* instead:
- `locationRegions(str)` splits on `, ; | / •`, newlines and "or". Each token is checked against a metro alias table first: "SF", "Palo Alto" → Bay Area; "NYC", "New York, NY" → New York; "Redmond" → Seattle; plus LA, Boston, Washington DC, Chicago, Austin, Denver, Atlanta, San Diego. Anything with "remote"/"anywhere" → Remote.
- After the alias check, US states and codes, Canadian provinces, countries, work-style words ("Hybrid", "Onsite") and "N locations" are dropped. Aliases run first, so "New York" and "LA" survive. Unknown cities are kept, title-cased ("Ann Arbor").
- Nothing left → `UNSPECIFIED` ("No location"). Results are memoized per string.
- `regionCounts` (most common first, No location last), `groupByRegion` (multi-region items land in each group; `only` narrows the groups) and `matchesRegions` (empty selection matches everything) are shared by Job Boards and the Sheet.
- Chip counts are computed before the location filter is applied, so each chip shows how many rows it would leave.
- Known gap: "Cambridge, UK" maps to Boston. Add aliases to `REGIONS` as new metros show up in the data, with a case in `test/locations.test.js`.
- The Applications board view has no location filter yet.

**Duplicates:** `findDuplicateGroups` (exact normalized Company+Role). "Archive N duplicates" keeps the oldest.

## Calendar (`CalendarTab.jsx`, see `google-calendar.md` and `recruiting-events.md`)

Views:
- **Grid:** month view of events, follow-ups and application dates.
- **Feed:** `lib/timeline.js`, Overdue / Next 7 Days / Later.
- **Events:** the shared Recruiting Events pool.

"+ Add Event" writes to Google Calendar (vision extraction from a screenshot uses Claude).

## Settings (`SettingsTab.jsx`)

- Secure your account (sign-in-with-API-key accounts only).
- Profile (tracks, school, AI provider) and appearance.
- Résumé (v1.4 spec 09): a PDF parsed in the browser (`lib/resumePdf.js`, lazy pdf.js), with only the text saved
  (`profiles.resume_text`). Shared `ResumeEditor` with the onboarding step.
- Drafted replies (v1.4 spec 10): the on/off switch (`user_settings.auto_draft_replies`) and call hours
  (`user_settings.availability`, shared `AvailabilityEditor` with the onboarding Calendar step).
- API keys (Anthropic, OpenAI, Exa, GitHub).
- Networking email accounts (Gmail connections, **Scan now** → `api/gmail.js ?action=scan-mine`).
- Push notifications (ntfy topic).
- Google Calendar slots and Recruiting-calendar sync.
- Send feedback.

## Proxy routes

All are auth-gated, with BYOK keys injected server-side. The same handlers serve dev
(`vite.config.js` `mountApiHandler`) and prod (`app/vercel.json` rewrites → `api/*.js`).

```
/gh-api          → api.github.com (repos/*, orgs/* only; optional per-user GitHub token)
/leetcode        → api/gh-api.js ?upstream=leetcode → LeetCode GraphQL (server-owned queries only)
/claude-api      → api.anthropic.com (v1/messages; fresh headers, no browser Origin)
/openai-api      → api.openai.com (v1/chat/completions)
/google-calendar → googleapis.com (allowlist in api/_lib/calendarAllowlist.js)
/exa             → api.exa.ai (search, findSimilar, contents)
/api/keys, /api/google-connect, /api/google-oauth-callback, /api/gmail, /api/events-* → see each file's header
```

The server-side Gmail scan and the push recap call the AI providers directly through
`api/_lib/llm.js` (see `ai-provider.md`).
