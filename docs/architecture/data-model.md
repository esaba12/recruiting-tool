# Data model (Supabase, legacy Notion)

> Moved out of CLAUDE.md on 2026-10-16 (v1.3 spec 07). Dated "shipped" notes are history; check the code before trusting a detail.

## Data Model — Supabase (current) vs. Notion (legacy)

The live app's tables are `contacts`, `applications`, `calls`, `interactions` in Supabase Postgres (`supabase/migrations/*.sql`), each with a `user_id` column + RLS policy scoping every read/write to `auth.uid() = user_id`. Column names are snake_case; `db.js` maps them to the same camelCase JS shapes the app has always used.

The table below is the **original Notion schema** — still accurate as the *field mapping reference* for `scripts/migrate-notion-to-supabase.js` (and for anyone migrating their own old workspace), but these Notion DBs are no longer read/written by the deployed app itself.

| Notion DB | ID | Purpose | Maps to |
|---|---|---|---|
| Contacts | `6f941973-1fce-40c3-943c-4c908940e2a8` | Master CRM. Has a `Referred By` self-relation (who introduced whom) used by the Graph tab. | `contacts` table |
| Calls | `8ddef121-1744-45d2-aa52-7699a727e9c0` | Call notes, linked to contact | `calls` table |
| Applications | `49011c2e-8165-4373-a41b-f913b02d1052` | One row per company/role | `applications` table |
| LC Problems | `9fc96722-d155-4333-9770-41130fb59a39` | LeetCode auto-sync | Not ported — superseded by Learn's LeetCode sync (`learning_*` tables) |
| Interactions | `39753135-a476-819e-96b4-dc41ecab6364` | Universal touchpoint ledger — one row per email/LinkedIn/call/meeting, regardless of whether a richer artifact (e.g. a Calls DB entry) also exists. | `interactions` table |

See `notion/schema.md` for full field-level detail and `supabase/migrations/*.sql` for the current Postgres schema.
