# 01 — Import what you already have

**Status:** ✅ done 2026-10-19 on `feat/v1.4-pre-invite`. Built as `lib/trackerImport.js` (pure, tested in
`test/trackerImport.test.js`) + `components/import/ImportPanel.jsx` (panel for 07's wizard, modal
for Pipeline → Sheet → **Import** and Network → **Import LinkedIn**). Deviations:
- No `.xlsx` reader: same as Learn's practice import, an Excel file gets "save as CSV or paste the rows".
  `lib/csv.js` gained `parseCsvRows` (quoted newlines) instead.
- `/demo` imports write to the in-memory demo store (reset on reload), so the portfolio shows the
  whole flow, rather than preview-only.
- `parseLooseDate` moved to `lib/dates.js` (Learn's `parsePracticeDate` is now an alias), and
  `roleToOption` moved to `lib/discovery.js` (shared with Quick Add).
- Imported apps' stage history starts at the import (a creation event, so not a "move");
  `applied_date`/`last_activity` carry the sheet's date.

**Who:** 🤖. **Migration:** none. **New serverless fn:** none (client-side parse, RLS writes).

## Why

New users show up with a spreadsheet tracker (Google Sheets/Excel/Notion export) and a LinkedIn
network. Today the app makes them retype both. Without Gmail and a key, there's no other way to
fill Pipeline or Network, and Coverage/warm paths (`lib/warmIntro.js`, `ReferralCoverageTab`) are
only as good as the contacts list. A LinkedIn import makes "who do I know at X" real on day one,
with zero AI cost.

## Changes

1. **Applications import** (Pipeline → Sheet toolbar, and a skippable wizard step):
   - Input: `.csv`, `.xlsx`, or a paste from a spreadsheet (TSV). Reuse the sheet/paste parsing
     `lib/learning/practiceImport.js` already does. Only add an `.xlsx` *reader* if the existing
     helpers don't cover it. `lib/xlsx.js` is writer-only.
   - Column mapping is deterministic first: match headers by synonyms (Company/Employer/Firm, Role/
     Position/Title, Status/Stage, Applied/Date Applied, Link/URL/Posting, Notes, Location). Map
     free-text statuses to `STAGE_ORDER` ("Rejected", "Interviewing" → Phone Screen, "Offer", blank
     → Applied if there's a date, else Wishlist). Show a mapping preview the user can correct.
     AI is only an optional "fix my headers" button behind `NeedsKey`.
   - Dedup against existing apps on `normalizeCompanyName(company)` + lowercased role. Show
     "N new, M already tracked".
   - Write in chunks of 50 through `db.js` (a new `addApplications(rows)` batch insert). Set
     `triage` so imported apps count as triaged (not Needs Review).
     `application_stage_events` gets its rows from the existing trigger. Mark them estimated, the way
     backfill does.
2. **LinkedIn connections import** (Network header, and the same wizard step):
   - LinkedIn's export (Settings → Data privacy → Get a copy → Connections) is a CSV with a few
     `Notes:` preamble lines before the header `First Name,Last Name,URL,Email Address,Company,
     Position,Connected On`. Skip lines until that header.
   - Dedup on LinkedIn URL, then on normalized name + company (`searchContactByName` logic).
   - Imported contacts: `source = 'LinkedIn DM'` is wrong (no DM happened), so add a `'LinkedIn
     import'` value to `SOURCE_OPTIONS`. `contacts.source` is free text, so no migration.
     Status Cold, `lifeDomain` Professional. **`last_interaction` stays null**: a connection isn't a
     conversation.
   - **Don't flood Today.** `keepInTouchQueue` surfaces every contact with no `lastInteraction`
     as `never: true` (`lib/keepInTouch.js:42,58`). Importing 400 connections would put 400 rows in
     Keep in Touch. Exclude `source === 'LinkedIn import'` contacts that have no interactions from
     `keepInTouchQueue` and the networking Sankey. They show up once you log anything with them.
3. **Wizard:** build the importers as standalone components (`components/import/`), so
   [07](07-onboarding.md) can host them in its "Bring your data" step. 01 only adds the
   Pipeline and Network entry points. Neither needs a key.
4. **`/demo`:** the import UIs open and parse a bundled sample file, but never write
   (`isDemoMode()` branch returns the preview only, with a "sign up to import" note).

## Tests first

- `test/applicationImport.test.js` (new, or extend the existing one for the paste-a-link import):
  - Header synonym mapping and status → stage mapping.
  - TSV paste vs CSV with quoted commas.
  - Dedup against existing apps.
  - Blank-row skipping.
- `test/linkedinImport.test.js`: preamble skipping, the real header, a row missing email/company,
  URL dedup, and name+company dedup.
- `test/keepInTouch.test.js`: an imported contact with no interactions is excluded; once one
  interaction is logged, it's included.

## Checks

- Import a 300-row CSV and a real `Connections.csv`. Pipeline Sheet shows the rows. Coverage
  shows contacts at target companies. Today's Keep in Touch count is unchanged.
- Import the same files again and you get 0 new rows.
- An IB-only account with no key imports both files from Pipeline and Network.

## Done when

Both imports work with no key, re-import is idempotent, and Today isn't flooded.
