# 06 — Prune + refactor

**Status:** everything marked ✅ is done on `chore/v1.3-cleanup` (406 tests and `vite build` pass).
Items marked **owner** or **later** are written up, not done.

How the list was built: imports were checked for every file under `app/src` and `app/api`
(including `import()` and the tests), every `export` was checked for uses outside its own file,
every dependency in both `package.json`s was grepped, and the rest of the repo was checked for
references into each top-level folder.

## A. ✅ Dead code in the app

| Removed | Why it was dead |
|---|---|
| `components/KeepInTouchTab.jsx` | Its rows moved into Today in v1.0 phase 2. Nothing imported it; two comments still pointed at it, now reworded. |
| `components/ui/Card.jsx`, `components/ui/Select.jsx` | Primitives from the July design pass that no screen ever adopted; native `<select>` and plain `div`s won. |
| `googleCalendar.js` `getEvent`, `getCachedRecruitingCalendarId` | Never called. `ensureRecruitingCalendar` reads the cache itself. |
| `shared.jsx` `AFFINITY_OPTIONS_DEFAULT` | Replaced by `affinityOptionsFor(profile)` during de-personalization; the constant stayed behind. |
| `lib/ai.js` `getAiProvider` | Nothing reads it; the label goes through `aiProviderLabel()`. |
| `lib/icons.js` `EXTERNAL_LINK_ICON`, `SEARCH_ICON`, plus their lucide imports | Call sites import `ExternalLink`/`Search` from lucide directly. |
| `lib/theme.js` `getAppearance` | Components use the `useAppearance` subscription. |
| `lib/conflicts.js` `bestFragment` | The day plan (`planDay`) packs every fragment, so it never needed a single best one. |

Not removed: about 70 exports used only inside their own module (`normalizeTitle`, `hashUrls`,
prompt headers and so on). They're exported for tests or for clarity and do no harm.

## B. ✅ Legacy top-level folders (Notion / Gumloop / Cowork era, June–July 2026)

| Removed | What it was |
|---|---|
| `cowork/` (5 prompt files) | Claude Desktop scheduled-task prompts. Abandoned in July (CLAUDE.md → "Abandoned"). |
| `gumloop/email-flow-spec.md` | Gumloop flow; abandoned ($37/mo BYOK). |
| `dashboard/` | The pre-Vite single-file dashboard and a LeetCode→Notion userscript, replaced by `app/` and Learn's LeetCode sync. |
| `plans/` (9 files) | The original 8-phase plan (Granola, Cowork, Notion foundation…). Every phase is shipped, abandoned or superseded. `.planning/` is the plan of record. |
| `prompts/` (3 files) | Gumloop-node prompts. The live prompts are inline in `scripts/email-pipeline.js` and `api/_lib/emailPipeline.js` and have moved well past these. |
| `master-build-plan.md` | July "Status & Roadmap" describing the Notion-hub architecture. |
| `google-calendar/get-refresh-token.js` | Single-tenant refresh-token script, superseded by Settings → Connect Calendar. |
| `notion/*.js` (9 one-off setup/patch scripts) | They created and patched the legacy Notion DBs. **`notion/schema.md` is kept**: `migrate-notion-to-supabase.js` documents its field mapping against it. |
| `transcripts/`, `jds/` (`.gitkeep` only, plus their `.gitignore` rules) | Granola-era drop folders; nothing reads them. |
| root dependency `@notionhq/client` | Nothing requires it; the migration script calls the Notion REST API with `fetch`. Root `package.json` now says it exists for the migration script and has `npm run migrate:notion`. |

All of it is in git history if ever needed (`git show d94c9fc:<path>`).

## C. ✅ Planning-folder archive

`.planning/phases/` (≈100 GSD plan/summary/review files), `STATE.md` (frozen at phase 7, Aug 21),
`REQUIREMENTS.md`, `research/` and the GSD `config.json` → `.planning/archive/v1.0/`.
`v1.1-HANDOFF.md` → `.planning/archive/`; its one open item is now [03](03-recruiting-calendar-roundtrip.md).
`PROJECT.md` and `ROADMAP.md` stay at the top level and now point at v1.3.

## D. Local worktrees and branches

There were 15 worktrees. Removed: the 9 whose branch is merged into `main` and that had no
uncommitted work. The only dirt was untracked `node_modules`/`.playwright-mcp`. Their branches were
deleted with `git branch -d`, which refuses anything unmerged, along with 6 more merged local branches
(`feat/color-schemes`, `feat/events-ui`, `feat/sheet-sankey`, `feat/practice-import`, `fix/leetcode-sync`, `fix/settings-return-tab`).

**owner, decide:**
- `worktree-skeleton-loading` (`09c68ac`, Aug 28): skeleton loading screens, never merged.
  Seven weeks behind `main` across a full reskin. Either rebase and finish it, or `git branch -D` it.
- `.worktrees/{cowork-setup,dashboard,email-pipeline,notion-setup}`: all four sit on
  `5de887a`, the original scaffolding commit. It isn't in `main`'s history (history was
  rewritten at open-sourcing) and only has content B just removed. Safe to delete:
  `for b in cowork-setup dashboard email-pipeline notion-setup; do git worktree remove .worktrees/$b && git branch -D $b; done`
- `feat/demo-refresh`: handled by [01](01-merge-demo-refresh.md).
- **Remote branches**, all merged. Deleting them is outward-facing, so the command is here and wasn't run:
  `git push origin --delete docs/email-pipeline-invites feat/color-schemes feat/events-ui feat/sheet-sankey feature/custom-404-page feature/schedule-queue fix/leetcode-sync fix/settings-return-tab v1.2-friends-launch worktree-email-pipeline-fix worktree-personal-crm-pivot-research`

## E. Later (written up, not done)

- **`api/_lib/emailPipeline.js` and `scripts/email-pipeline.js` duplicate the classifier
  prompt** (`INTERVIEW_VS_NETWORKING` is hand-kept in sync). The real fix is retiring the
  Apps Script → [08](08-email-pipeline-consolidation.md).
- **The `VITE_AI_PROVIDER` build-time switch** is now only a default; `lib/aiProvider.js`
  switches at runtime from Settings. Docs updated in [07](07-docs-restructure.md). The env
  var still works and costs nothing, so the code is unchanged.
- **The 18 `rec_*` localStorage keys** (the soft v1.0 goal). No consolidation pass yet. Worth
  doing only if cross-device sync becomes a goal; then move them to `user_settings` as one change.
- **Bundle size:** `vite build` warns about a chunk over 500 KB. Lazy-load Learn, the Graph
  view (`react-force-graph-2d`) and Recharts with `React.lazy` per tab. A measured win, but
  its own change.
