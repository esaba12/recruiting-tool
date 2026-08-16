---
phase: 01-visual-foundation-industrial-design-tokens-primitives
reviewed: 2026-08-16T13:29:42Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - app/src/index.css
  - app/src/shared.jsx
  - app/src/components/ui/Mono.jsx
  - app/src/components/ui/Button.jsx
  - app/src/components/ui/Badge.jsx
  - app/src/components/ui/Tabs.jsx
  - app/src/components/ContactsTable.jsx
  - app/src/components/PipelineTab.jsx
  - app/src/components/jobBoards/JobCard.jsx
  - app/src/components/jobBoards/JobDetailModal.jsx
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-08-16T13:29:42Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed the token-value reskin (`index.css`), the badge-color remapping (`shared.jsx`), the new `Mono` typography primitive and its rollout across dense-data columns (`ContactsTable.jsx`, `PipelineTab.jsx`, `JobCard.jsx`, `JobDetailModal.jsx`), and the three shared UI primitives (`Button.jsx`, `Badge.jsx`, `Tabs.jsx`).

Scope discipline is good: the actual diff (`git diff 4ba63a0..HEAD`) touches only `@theme` hex values, `Mono` import/wrap additions, and class-string edits (`font-medium`→`font-semibold`, `bg-orange-100`→`bg-accent-100`, etc.) — no data-layer, auth, or business-logic code was touched in any of the 10 files. No scope creep found in the diff itself.

Two classes of issues surfaced during full-file review (not all introduced by this diff, but worth surfacing since this is exactly the phase whose job was to finish the token migration and the `Mono` rollout):

1. A real accessibility regression carried by the newly-chosen token values — a badge that uses `warning-400` text-on-white fails WCAG AA contrast, and the new hex value doesn't fix it (a pre-existing failure, now at a still-failing 2.09:1).
2. The phase's stated goal of removing hardcoded stock-Tailwind colors was only completed in `shared.jsx` — `PipelineTab.jsx` and `JobDetailModal.jsx` still use hardcoded `orange-*`/`indigo-*` classes that live entirely outside the new `@theme` token system.

Also flagging two pre-existing, out-of-diff-scope issues found opportunistically while reading the files (a stale-closure bug in `ContactsTable.jsx` and stale "Notion" copy in `PipelineTab.jsx`) — neither was introduced by this phase, but both are real and sit inside files this phase modified.

## Warnings

### WR-01: New `warning-400` token value still fails WCAG contrast when paired with white text

**File:** `app/src/components/jobBoards/JobCard.jsx:6-7` (also `app/src/index.css:51`)
**Issue:** `DEADLINE_BADGE.soon` renders as `bg-warning-400 text-white` for the "closes soon" deadline badge. The new `--color-warning-400` value chosen in this phase (`index.css:51`, `#e0ab28`) produces a **2.09:1** contrast ratio against white text — well below WCAG AA's 4.5:1 minimum for normal text (and below the relaxed 3:1 floor for large/UI text too). This isn't a new failure introduced by this diff (the old value, `#e3b559`, was even worse at ~1.9:1), but the phase re-picked every token's hex value and this pairing was not re-validated — the badge is still effectively unreadable gold-on-white, on a component whose entire purpose is to flag an approaching deadline.
**Fix:** Either flip the badge to dark text (`text-warning-900`) on `warning-400`, or use a darker shade as the background — `warning-600` (`#9c690d`) measures 4.73:1 against white and passes.
```jsx
// JobCard.jsx
const DEADLINE_BADGE = {
  urgent: 'bg-danger-500 text-white',
  soon:   'bg-warning-600 text-white', // was warning-400 — failed contrast
  known:  'bg-ink-100 text-ink-600',
}
```

### WR-02: "Remove hardcoded stock-Tailwind colors" goal left incomplete — `orange-*`/`indigo-*` remain outside the token system

**File:** `app/src/components/PipelineTab.jsx:41,44,48,52,57,68,164,185`
**File:** `app/src/components/jobBoards/JobDetailModal.jsx:109`
**Issue:** `shared.jsx` was fully remapped in this same phase (`bg-orange-100`→`bg-accent-100`, `bg-purple-100`→`bg-warning-800`, etc. — see the diff), confirming this was a deliberate goal of the phase. But `PipelineTab.jsx`'s entire `DuplicatesPanel` (background, borders, buttons, text) and its stale-application indicator still use raw Tailwind `orange-50/100/200/600/700/800`, and `JobDetailModal.jsx`'s "Analyze →" button uses raw `indigo-50/100/600`. These are not derived from the `@theme` block at all — `orange-*` here is a different, un-synced hue from the newly-defined `accent` scale (which is itself "safety orange"), so this panel now visually diverges from the rest of the app's accent color while looking like it's trying to be the same color family. If the palette is retuned again later (e.g. a future dark-mode pass), these elements silently won't move with everything else.
**Fix:** Replace `orange-*` in `PipelineTab.jsx` with `accent-*` (primary-adjacent) or a dedicated semantic if "duplicate warning" needs to stay visually distinct from the accent CTA color, and replace `indigo-*` in `JobDetailModal.jsx` with an existing token (e.g. `accent-*`) so every color in these files traces back to `index.css`'s `@theme` block, consistent with the rest of the reskin.

### WR-03 (pre-existing, not introduced by this phase): stale `useMemo` dependency causes a stale tooltip

**File:** `app/src/components/ContactsTable.jsx:27,37,116`
**Issue:** `schoolLabel` (line 27) is derived from `profile.school` and used inside the memoized `name` column's cell renderer (line 37, `title={schoolLabel}`), but the `useMemo` that builds `columns` (line 116) only lists `[onMet]` as a dependency. If `profile.school` changes during the session (e.g. edited in Settings without a full remount of this table), the 🎓 tooltip keeps showing whatever school string was current at first mount. Not introduced by this phase's diff (which only added the `Mono` import/wrap two columns down), but it's a real closure bug sitting in a file this phase touched.
**Fix:** Add `schoolLabel` to the `useMemo` dependency array at line 116.

## Info

### IN-01: Pipeline stage badges collapsed onto one hue — reduced at-a-glance distinguishability

**File:** `app/src/shared.jsx:39-48` (`STAGE_COLOR`)
**Issue:** Phone Screen, Technical, and Onsite previously used three visually distinct hues (amber/orange/purple). The new mapping puts all three on the same `warning` amber ramp (`warning-100`, `warning-200`, `warning-600`), differing only by lightness/text color. `PipelineTab.jsx` renders these as inline badges in a scanning list of application cards (not a position-encoded axis like the funnel chart, where the codebase's own documented rationale for monochrome ramps applies — see `charts/theme.js`'s comments referenced in CLAUDE.md). In this context, "Phone Screen" and "Technical" now read as two very similar light-amber badges, which may make it harder to tell pipeline stages apart at a glance.
**Fix:** Consider giving Technical/Onsite a hue distinct from Phone Screen (e.g. one on the `accent` ramp) if quick visual stage differentiation in list/card view is a design goal for this phase; otherwise confirm the monochrome collapse is intentional.

### IN-02 (pre-existing, out of this phase's scope): stale "Notion" copy in user-facing text

**File:** `app/src/components/PipelineTab.jsx:55,155`
**Issue:** Per project docs, the app fully migrated off Notion onto Supabase for all live data (Notion is migration-script-only now). This file's duplicate-archive confirm dialog ("archives the rest in Notion (recoverable from Notion's trash)", line 55) and its empty-state message ("Add them in Notion or let the email pipeline populate them.", line 155) both still describe Notion as the live data store. This could mislead a user into thinking archived duplicates are recoverable via Notion's trash, which is no longer true. Not a token/typography issue and not touched by this phase's diff — flagged only because it was encountered while reading the file in scope.
**Fix:** Update both strings to reference Supabase/the app's own data model (tracked separately from this visual-foundation phase).

---

_Reviewed: 2026-08-16T13:29:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
