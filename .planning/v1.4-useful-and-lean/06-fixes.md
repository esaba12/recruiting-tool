# 06 — Fixes from the review

**Status:** ✅ done 2026-10-19. A and B in `e323879`, C after 05 (also fixed stale Outbox/Timeline Finds references in three other docs).

**Who:** 🤖. **Migration:** none. Land first: small, and A is a bug friends would hit.

## A. Quick Add never flags target companies

`QuickAddContactModal.jsx:50` reads `lsGet('rec_target_companies')`. The list moved to
`user_settings` in `42dc3f0` (`lib/useTargetCompanies.js`), and nothing writes that key any more.
So for every account created since then, `targetMatch` is always false: no "at a target company"
tag, and no Professional default.
- Use `useTargetCompanies()` in the modal and delete `TARGETS_KEY`.
- In the same function, seed the affinity profile from the user's profile (school, grad year)
  the way `DiscoverTab.jsx:45` does. Today a user who has never opened Discover gets no alum tag.
- Test: `enrichContact` gets the hook's targets (mock `fetchTargetCompanies`), and a contact at a
  target company comes back with `targetMatch: true`.

## B. Gmail scan ignores OpenAI keys

`scanConnection` returns `skipped: 'no_anthropic_key'` (`api/_lib/emailPipeline.js:660`), and the
classifier and recap call `api.anthropic.com` directly. A user who picked OpenAI in Settings
connects Gmail and gets nothing, apart from a warning line.
- Add `api/_lib/llm.js`: `completeJSON({ userId, prompt, tier })`. It reads the user's
  `profiles.ai_provider` and their key, and calls Anthropic or OpenAI with the same request shapes
  `lib/ai.js` uses on the client (see `docs/architecture/ai-provider.md`).
- Route `classifyEmail` and `pushes.js`'s recap through it. Replace the hard-coded models with
  tier names (classifier = mini, recap = standard).
- Skip only when the user has *neither* key. Update the Settings warning to match, and return
  the skip reason in scan results, since [07](07-onboarding.md)'s "waiting for a key" state reads it.
- Tests: provider selection, with a mocked fetch for each provider's response shape. The existing
  classifier tests still pass on the Anthropic path.

## C. `docs/architecture/dashboard-features.md` describes a different app

It's 28 KB and still talks about Notion round-trips, `KeepInTouchTab.jsx`,
`ContactDetailModal`, Overview/Actions tabs and "Ethan's résumé" (the repo is public). Agents
read it as context.
- Rewrite it as current state, one short section per tab.
- Move the dated history into a single "History" list at the bottom, or drop it, since git has it.
- Do it after 05, so it documents the post-cut app.

## Checks

`npm test && npm run build`. In the browser, Quick Add a person at a company on your target
list and see the tag. An OpenAI-only test account, after a manual scan, gets interactions logged.

## Done when

All three are merged.
