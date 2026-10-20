# Dashboard features (tab by tab)

> Current state as of 2026-10-19 (rewritten in v1.4 spec 06 C). History lives in git and
> `.planning/`. If a detail here disagrees with the code, the code wins.

Dev server: `cd app && npm run dev` → http://localhost:3001. Tabs come from `NAV_ITEMS` in
`components/layout/Sidebar.jsx`. Settings sits in the sidebar footer. `/demo` renders every tab
on seed data (`demoData.js`).

## Today (`TodayTab.jsx`, logic in `lib/attention.js`)

The attention stack. Sections, in order:
- "Replies drafted" card (v1.4 spec 10, first in the attention stacks): replies the Gmail scan wrote for you, each opening its Inbox thread
- Action Items (AI-flagged from email)
- Overdue Follow-Ups
- Stale Applications (14+ days without movement)
- OA Due
- Awaiting Reply
- High Urgency Contacts
- Want to Schedule
- Keep in Touch
- Job Boards Needs-Review (tech tracks)
- OA Needs Check
- The Recruiting Events sections (signup steps, registration closing, event follow-ups, feed health)
- Interview Prep (from Learn)
- Activity: three stat tiles (`StatTileRow.jsx`): Funnel, Next Deadline, weekly Activity

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
  - `dedupeAcross` keeps each contact in one people section. Priority: Overdue → Awaiting →
    Schedule → High Urgency → Keep in Touch.
  - Rows and sections snooze for 7 days. Snoozes and collapsed state live in `user_settings.today_prefs`
    (`lib/useTodayPrefs.js`), so they follow the account.
- The charts that used to sit under Activity moved in v1.4 spec 05 D:
  - The funnel → Pipeline → Sheet → Flow.
  - Network status and the weekly trend → Network → Flow (`charts/ActivityCharts.jsx`).

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
practice import (sheet, paste, screenshot), coach. Today's Interview Prep reads it through
`learningAttention`.

## Pipeline (`PipelineTab.jsx`, views in `pipelineViews.js`)

Views:
- **Applications:** a board plus `DuplicatesPanel`.
- **Sheet:** `ApplicationsSheet.jsx`.
- **Job Boards:** tech tracks only.

Applications open in `panels/ApplicationPanelBody.jsx`, with stage timeline, OA fields (editable),
referrer (`referred_by_id`, never overwritten once set) and warm paths (`lib/warmIntro.js`).

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
