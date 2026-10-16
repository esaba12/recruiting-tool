# 01 — Merge `feat/demo-refresh`

**Who:** owner (auto-mode blocks merges to `main`). **Size:** one commit.

## What it is

Commit `43929ef` (2026-10-13) is the only branch with work that isn't on `main`. `/demo` is the
"look before you sign up" link in the invite, so this should ship before the invite goes out.

- The demo's Learn tab showed three empty panels: Company prep ("load for signed-in accounts"),
  Languages ("add your LeetCode username") and 0% readiness. The commit seeds a fictional
  LeetCode snapshot in `db.js` and gives `LearnTab` fixed company-prep sets for the demo
  Pipeline's Rippling OA and Stripe/Anthropic interviews, in place of the auth-gated `/gh-api` fetch.
- Skips auto-sync and the manual sync button on `/demo`, and hides the pin-a-company input there.
- Ticks the four items in `.planning/v1.2-launch/08-ops-checklist.md` that are already done (the
  PR #6 merge, the prod re-check, `clasp push`, the demo refresh).

`git merge-tree` against `main` (`d94c9fc`) reports no conflicts. It touches `LearnTab.jsx`,
`db.js`, `demoData.js` and the 08 checklist. `chore/v1.3-cleanup` doesn't touch any of those, so
the two branches merge in either order.

## Steps

1. `! git push -u origin feat/demo-refresh && gh pr create --base main --head feat/demo-refresh --fill`
2. Check the preview: `/demo` → Learn shows Company prep, Languages and a readiness above 0%,
   with no console errors and no `/gh-api` request (it would 401).
3. Merge in the GitHub UI, or with `! gh pr merge <n> --merge`.
4. Remove the worktree: `git worktree remove .claude/worktrees/demo-refresh && git branch -d feat/demo-refresh`.

## Done when

Prod `/demo` → Learn shows no empty panels.
