# Dashboard features (tab by tab)

> Current state as of 2026-10-22 (rewritten in v1.4 spec 06 C; Today updated for PR #22 and spec 08). History lives in git and
> `.planning/`. If a detail here disagrees with the code, the code wins.

Dev server: `cd app && npm run dev` → http://localhost:3001. Tabs come from `NAV_ITEMS` in
`components/layout/Sidebar.jsx`. Settings sits in the sidebar footer. `/demo` renders every tab
on seed data (`demoData.js`).

## Today (`TodayTab.jsx`, logic in `lib/attention.js`)

A dashboard (PR #22, 2026-10-20). Cards share one shell, `today/DashCard.jsx`: a mono caps
label with a status dot and a count. `Group` stacks labeled lists inside a card, and each list
shows 3 rows before "+N more".

A header line gives the date and the open count (cards and lists that are on only), plus
"Unhide N" when anything is snoozed, and **Customize**.

**Customize** (v1.4 spec 08). Each user arranges their own Today:
- The card registry is `lib/todayCards.js`, which is pure. Each card has a default width (`third` / `half` / `full`) and optional `groups` (the lists inside it).
- Users can turn any group off. Job boards to review is SWE/PM only, and Events needs a campus.
- Per-card settings: rows shown (3 / 5 / 10), People's "Awaiting reply after" days and Applications' "Stale after" days.
- The layout lives in `user_settings.today_layout` (`lib/useTodayLayout.js`), separate from snoozes. Nothing is saved until the user changes something, so an untouched account always gets `defaultLayout`, the PR #22 dashboard.
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

**Attention cards** (half width by default), in two columns balanced by visible row count:
- **Decisions** (v1.4 spec 02, first by default): every app at Offer, soonest deadline first (`offerDecisions`), with a countdown; danger tone within 3 days. A row opens the offer decision view (see Pipeline).
- **Replies drafted** (v1.4 spec 10): replies the Gmail scan wrote for you, each opening its Inbox thread.
- **From your email:** AI action items, with "Dismiss all".
- **People:** groups for Send a thank-you, Overdue follow-up, Awaiting reply, High urgency, Want to schedule and Keep in touch.
  - **Send a thank-you** (v1.4 spec 03, `thankYouDue`): an interview 0–48h ago (contact matched by `normalizeCompanyName`; shows even with nobody on file) or a Call/Meeting 0–2 days old, until an outbound Email/LinkedIn to that person. Draft opens `today/EmailDraft.jsx` on a template (AI rewrite behind `NeedsKey`); Sent it logs an outbound Email.
- **Applications:** groups for Interviews coming up (`upcomingInterviews`, the next 14 days; a timed one leaves once it's over), OA due, Stale (14+ days without movement by default), Job boards to review (tech tracks) and OA deadline unknown.
- **Events** (`today/EventAttentionSections.jsx` `EventsCard`): groups for signup steps due,
  registration closing and event follow-ups overdue, plus a footnote listing degraded feeds.

Interview Prep, the daily AI recap card and the collapse controls were removed in PR #22.
`learningAttention` and `fetchDailyRecap` still exist, but Today no longer calls them.

A fresh account sees `onboarding/GettingStarted.jsx` instead of "all clear": the live Gmail
first-scan state (`lib/gmailScan.js`) plus rows that open the tracker and LinkedIn importers.

- **Awaiting Reply** (`awaitingReply`): the contact's last Email/LinkedIn interaction was
  Outbound and 5+ days old with nothing back. Contacts with any Follow-Up Date are excluded, so
  they're never double-nagged. "They replied" logs an Inbound; "Draft nudge" uses `DraftPanel`'s
  `follow_up` kind.
- **Keep in Touch** (`lib/keepInTouch.js`): reconnect cadence per contact from tie strength
  (`affinity.js`) × `DEFAULT_CADENCE`. Moderate ties get the tightest interval. Excludes Closed
  contacts and anyone with a future Follow-Up Date.
- **Declutter** (`test/declutter.test.js`):
  - `trimActionItems` hides AI items already answered on the thread, long past due, or duplicated.
  - `todayPeople` (via `dedupeAcross`) keeps each contact in one People group. Priority: Overdue → Awaiting →
    Schedule → High Urgency → Keep in Touch, with Send a thank-you ahead of all of them. A group that's turned off is skipped, so its people show in the next one.
  - A row's ✕ snoozes it for 7 days, and a card's "Clear all" snoozes every row in the card.
    Snoozes live in `user_settings.today_prefs` (`lib/useTodayPrefs.js`), so they follow the account.
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
- Filters, columns, sort, grouping and Flow persist in `rec_sheet_prefs`.
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
- Real deadlines (`lib/deadlines.js`, `useJobDeadlines.js`): Exa `/contents` reads the apply page, and the AI reports a date only if the page states one. Cached forever in `rec_job_deadlines`. Sorted closest-deadline first (`urgencyComparator`).
- Hidden for non-tech tracks: there's no comparable public feed for IB or consulting.

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
