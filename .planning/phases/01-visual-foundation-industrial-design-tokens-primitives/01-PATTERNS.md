# Phase 1: Visual Foundation — Pattern Map

**Mapped:** 2026-08-15
**Files analyzed:** 11 (1 config, 8 existing primitives, 1 constants file, 1 new primitive)
**Analogs found:** 11 / 11 (10 are direct edits to existing files; 1 new file has 3 strong sibling analogs)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|---------------|
| `app/src/index.css` | config (design tokens) | transform (CSS var value swap) | itself (edit in place) | exact |
| `app/src/components/ui/Button.jsx` | component (primitive) | transform (props→className) | itself (edit in place) | exact |
| `app/src/components/ui/Badge.jsx` | component (primitive) | transform | itself (edit in place) | exact |
| `app/src/components/ui/Card.jsx` | component (primitive) | transform | itself (edit in place) | exact |
| `app/src/components/ui/Tabs.jsx` | component (primitive) | transform | itself (edit in place) | exact |
| `app/src/components/ui/Input.jsx` | component (primitive) | transform | itself (edit in place) | exact |
| `app/src/components/ui/Select.jsx` | component (primitive) | transform | itself (edit in place) | exact |
| `app/src/components/ui/Modal.jsx` | component (primitive) | transform | itself (edit in place) — motion untouched | exact |
| `app/src/components/ui/EmptyState.jsx` | component (primitive) | transform | itself (edit in place) | exact |
| `app/src/components/ui/ChipToggleGroup.jsx` | component (primitive) | transform | itself (edit in place) | exact (flagged extra by research, same file/risk class) |
| `app/src/components/ui/Mono.jsx` (**new file**) | component (primitive) | transform (string→styled span wrapper) | `app/src/components/ui/Badge.jsx` (small, single-purpose, `cn`-driven `<span>` wrapper) | exact — UI-SPEC gives the literal implementation already |
| `app/src/shared.jsx` (`STATUS_COLOR`/`STAGE_COLOR`/`TYPE_COLOR`/`URGENCY_COLOR`/`REFERRAL_STATUS_COLOR`) | model/constants (color-map lookup tables) | transform (string literal swap) | itself (edit in place) | exact |
| `app/src/components/ContactsTable.jsx` (Mono call sites: `lastInteraction`, `followUpDate` columns) | component (data table) | CRUD-display (read-only render of fetched rows) | itself — already has the exact `fmt(v)` call sites named in RESEARCH.md Pattern 3 | exact |
| `app/src/components/PipelineTab.jsx` (Mono call sites: `fmt(a.createdTime)`, `fmt(a.appliedDate)`, `fmt(a.closedDate)`, stage-age `days`) | component (data table/panel) | CRUD-display | itself | exact |
| `app/src/components/jobBoards/*` (posting-date/deadline badges) | component (data card/panel) | CRUD-display | `PipelineTab.jsx`'s date-badge pattern (same `fmt()`-in-`<span>` shape) | role-match |

## Pattern Assignments

### `app/src/index.css` (config, token values)

**Analog:** itself — this is a value-only edit inside the existing `@theme` block, not a new file.

**Current full block** (lines 1-73, already read in full — reproduced here as the literal diff target):
```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-heading: "Space Grotesk", sans-serif;
  --font-body: "Public Sans", sans-serif;
  --font-mono: "IBM Plex Mono", monospace;

  --color-canvas: #fbf9f5;                 /* → #f2f3f4 per UI-SPEC */

  --color-ink-50: #f6f6f7;   /* → #f1f2f3 */
  --color-ink-100: #e9e9eb;  /* → #e1e3e6 */
  --color-ink-200: #d3d3d7;  /* → #c7cbd0 */
  --color-ink-300: #b0b0b7;  /* → #a2a7af */
  --color-ink-400: #86868f;  /* → #666c74 */
  --color-ink-500: #64646d;  /* → #4f555d */
  --color-ink-600: #4a4a52;  /* → #3a3f45 */
  --color-ink-700: #37373d;  /* → #2a2e33 */
  --color-ink-800: #24242a;  /* → #1a1c20 */
  --color-ink-900: #16171d;  /* → #101215 */

  --color-accent-50 … 900   /* full 10-step ramp → UI-SPEC's accent ramp (accent-500 #f2680a … 900 #5c2308) */
  --color-success-50 … 900  /* → UI-SPEC's success ramp */
  --color-warning-50 … 800  /* → UI-SPEC's warning ramp */
  --color-danger-50 … 700   /* → UI-SPEC's danger ramp */
}

body { font-family: var(--font-body); }
h1, h2, h3 { font-family: var(--font-heading); }
```
**Action:** replace each `--color-*` hex literal in place with the UI-SPEC "Token values" table's exact hex strings (full ramps given verbatim in UI-SPEC.md). Token *names* (`--color-ink-50`…`900`, `--color-accent-*`, `--color-success-*`, `--color-warning-*`, `--color-danger-*`, `--color-canvas`) are unchanged — every existing `ink-500`/`accent-600`/etc. utility class recompiles against the new value with zero edits elsewhere (verified Tailwind v4 mechanic, RESEARCH.md Pattern 1). Do not touch `--font-*` or the `@custom-variant dark` line. `body`/`h1,h2,h3` font-family rules are untouched (heading sizing/weight for h1-h3 is frozen this phase per UI-SPEC).

---

### `app/src/components/ui/Button.jsx` (component, transform)

**Analog:** itself (11 lines currently).

**Current full file:**
```jsx
import { cn } from '../../lib/cn.js'

const VARIANTS = {
  primary:   'bg-accent-500 text-white hover:bg-accent-600 border border-transparent',
  secondary: 'bg-white text-ink-700 border border-ink-100 hover:bg-ink-50',
  ghost:     'bg-transparent text-ink-500 hover:bg-ink-50 border border-transparent',
  danger:    'bg-danger-600 text-white hover:bg-danger-700 border border-transparent',
}

const SIZES = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm' }

export default function Button({ variant = 'primary', size = 'md', className, children, ...rest }) {
  return (
    <button className={cn('rounded-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed', VARIANTS[variant], SIZES[size], className)} {...rest}>
      {children}
    </button>
  )
}
```
**Required edits (per UI-SPEC "Fixes beyond the reskin" #1 and Typography's weight bump):**
- `primary` variant: `bg-accent-500 ... hover:bg-accent-600` → `bg-accent-600 text-white hover:bg-accent-700 border border-transparent` (the WCAG fix — 4.59:1, not the old 2.23:1-failing accent-500).
- Base classes: `font-medium` → `font-semibold` (500→600 weight bump, applies to all 4 variants since it's on the shared base string, not per-variant).
- `secondary`/`ghost`/`danger` variant color classes: unchanged strings — they pick up new hex values automatically via the `index.css` token swap, no JSX edit needed. `danger-600`/`-700` already validated (8.17/10.81:1), no fix required.
- Spacing (`px-3 py-1.5`, `px-4 py-2.5`) stays exactly as-is — UI-SPEC explicitly defers non-4px-multiple chrome padding to Phase 7.

---

### `app/src/components/ui/Badge.jsx` (component, transform) — also the direct analog for the new `Mono.jsx`

**Analog:** itself.

**Current full file:**
```jsx
export default function Badge({ label, color = 'bg-ink-100 text-ink-600', icon: Icon }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {Icon && <Icon size={12} strokeWidth={2.5} />}
      {label}
    </span>
  )
}
```
**Required edits:** `font-medium` → `font-semibold` (Label role is 600 weight per UI-SPEC Typography table — Badge is explicitly listed under "Label"). The `color` prop default and all call-site `color` strings (`STATUS_COLOR`/`STAGE_COLOR`/etc. from `shared.jsx`) automatically pick up new hex values via the token swap — no change to Badge.jsx's structure otherwise. Note this file uses raw template-literal string concat, not `cn()` — leave that as-is, it's not in scope to refactor to `cn()` this phase.

**This is also the structural analog for the new `app/src/components/ui/Mono.jsx`** — same "single-purpose `<span>` wrapper, one style-string, optional `className` passthrough" shape. UI-SPEC gives the literal implementation to use:
```jsx
import { cn } from '../../lib/cn.js'
export default function Mono({ className, children }) {
  return <span className={cn('font-mono text-xs font-normal tabular-nums tracking-wide', className)}>{children}</span>
}
```
Use `cn()` (not raw template literal) for `Mono.jsx` — matches `Button.jsx`/`Card.jsx`/`Tabs.jsx`/`Input.jsx`/`Select.jsx`/`Modal.jsx`'s convention (6 of 8 existing primitives already use `cn()`; only `Badge.jsx` and `ChipToggleGroup.jsx` use raw template literals — `cn()` is the majority/current convention for anything accepting a `className` override prop, which `Mono` does per the exact spec given).

---

### `app/src/components/ui/Card.jsx`, `Tabs.jsx`, `Input.jsx`, `Select.jsx`, `Modal.jsx`, `EmptyState.jsx`, `ChipToggleGroup.jsx` (components, transform)

**Analog:** each is its own analog (edit in place) — all 7 share one mechanical pattern: **zero JSX/structural changes required**, because every color reference in these files already uses token-family utility classes (`ink-*`, `accent-*`, `white`) with no hardcoded stock-Tailwind color literals. Confirmed by direct read:
- `Card.jsx`: `bg-white rounded-xl shadow-sm border border-ink-100` — no edit needed structurally; picks up new `ink-100` automatically. UI-SPEC explicitly says **do not** tint Card's white toward `ink-50` this phase — leave `bg-white` literal alone.
- `Tabs.jsx`: `border-ink-100 ... bg-ink-900 text-white ... text-ink-500 hover:bg-ink-50` — all token-driven, no edit needed; validated pair `white`/`ink-900` = 18.76:1.
- `Input.jsx` / `Select.jsx`: `border-ink-100 ... focus:border-accent-400 focus:ring-accent-200 ... text-ink-400` (label) — all token-driven, no edit needed. Label text stays `text-ink-400` per current code (UI-SPEC doesn't flag this pair as one of its 3 "Fixes beyond the reskin," only `URGENCY_COLOR.LOW`/`REFERRAL_STATUS_COLOR['Not Asked']` in `shared.jsx` needed the `ink-400`→`ink-500` bump — leave `Input`/`Select` label color as-is).
- `Modal.jsx`: `bg-ink-900/40` overlay, `bg-white` surface — token-driven, no edit; **do not touch** the `framer-motion` import/transition props (explicitly out of scope, Phase 7 owns the `motion` migration).
- `EmptyState.jsx`: `text-ink-400` — token-driven, no edit needed to the file itself. (UI-SPEC's Copywriting Contract confirms: "only the wrapper's typography... changes" — but since `text-ink-400`/`text-sm` are unchanged literal classes and only the underlying hex moves, no JSX edit is actually required here either.)
- `ChipToggleGroup.jsx`: `bg-accent-600 text-white border-accent-600` (selected) / `bg-white text-ink-500 border-ink-200 hover:border-accent-300` (unselected) — token-driven, no edit needed; validated pair `white`/`accent-600` = 4.59:1 already covers this file's selected state (same fix as Button primary, already landing via the token swap since `accent-600`'s hex is what changes, not this file's class string).

**Net implication for the planner:** these 7 files likely need **no code diff at all** — the token-value swap in `index.css` is sufficient. Only `Button.jsx` (weight bump + variant hex-step change) and `Badge.jsx` (weight bump) need actual JSX edits among the 8 named primitives. Verify each visually per the mandatory screenshot pass regardless (a class-string audit isn't a substitute for the mandated render check), but do not manufacture edits to files with no required diff.

---

### `app/src/shared.jsx` (constants, transform) — off-token color-map fixes

**Analog:** itself. Current hardcoded off-token lines (exact, from direct read):
```jsx
// line 11
'⭐ Champion':'bg-orange-100 text-orange-800',
// line 16
MED:  'bg-warning-400 text-white',
// line 17
LOW:  'bg-ink-100 text-ink-400',
// line 23-24
Email: 'bg-accent-100 text-accent-700', LinkedIn: 'bg-purple-100 text-purple-700',
Call: 'bg-success-100 text-success-700', Meeting: 'bg-orange-100 text-orange-700', Other: 'bg-ink-100 text-ink-600',
// line 31
'Not Asked': 'bg-ink-100 text-ink-400',
// line 43-44
Technical:      'bg-orange-100 text-orange-800',
Onsite:         'bg-purple-100 text-purple-800',
```
**Exact required replacements (UI-SPEC "Open Questions Resolved #1" + "Fixes beyond the reskin" #2/#3 — apply verbatim, not approximated):**

| Map | Entry | Replace | With |
|---|---|---|---|
| `STATUS_COLOR` | `⭐ Champion` | `bg-orange-100 text-orange-800` | `bg-accent-100 text-accent-800` |
| `URGENCY_COLOR` | `MED` | `bg-warning-400 text-white` | `bg-warning-600 text-white` |
| `URGENCY_COLOR` | `LOW` | `bg-ink-100 text-ink-400` | `bg-ink-100 text-ink-500` |
| `TYPE_COLOR` | `LinkedIn` | `bg-purple-100 text-purple-700` | `bg-warning-800 text-warning-100` |
| `TYPE_COLOR` | `Meeting` | `bg-orange-100 text-orange-700` | `bg-ink-200 text-ink-700` |
| `REFERRAL_STATUS_COLOR` | `Not Asked` | `bg-ink-100 text-ink-400` | `bg-ink-100 text-ink-500` |
| `STAGE_COLOR` | `Technical` | `bg-orange-100 text-orange-800` | `bg-warning-200 text-warning-800` |
| `STAGE_COLOR` | `Onsite` | `bg-purple-100 text-purple-800` | `bg-warning-600 text-white` |

All other entries in these 5 maps (`STATUS_COLOR`'s Warm/Cooling/Cold/Closed, `URGENCY_COLOR.HIGH`, `TYPE_COLOR.Email/Call/Other`, `REFERRAL_STATUS_COLOR`'s Asked/Confirmed/Declined, `STAGE_COLOR`'s Wishlist/Applied/Phone Screen/Offer/Accepted/Rejected) are already token-driven strings — leave untouched, they pick up new hex automatically. **Verification:** `grep -n "orange-\|purple-" app/src/shared.jsx` must return zero matches after this edit (RESEARCH.md's Validation Architecture grep check).

---

### `app/src/components/ui/Mono.jsx` (new file, component, transform)

**Analog:** `app/src/components/ui/Badge.jsx` (structural sibling — see Badge section above for the full comparison and the exact code to write).

**File to create verbatim (from UI-SPEC.md, already locked, no design decision left open):**
```jsx
import { cn } from '../../lib/cn.js'
export default function Mono({ className, children }) {
  return <span className={cn('font-mono text-xs font-normal tabular-nums tracking-wide', className)}>{children}</span>
}
```

---

### `app/src/components/ContactsTable.jsx` (Mono rollout call sites)

**Analog:** itself — RESEARCH.md already identified the exact 2 call sites by direct read.

**Current code (lines 86-97, confirmed by direct grep+context read):**
```jsx
col.accessor('lastInteraction', {
  header: 'Last',
  cell: info => fmt(info.getValue()),   // ← plain string, default body font
  sortingFn: 'datetime',
}),
col.accessor('followUpDate', {
  header: 'Follow-Up',
  cell: info => {
    const v = info.getValue()
    const overdue = v && daysUntil(v) <= 0
    return <span className={overdue ? 'text-danger-600 font-medium' : ''}>{fmt(v)}</span>
  },
  sortingFn: 'datetime',
}),
```
**Required edit pattern:** wrap `fmt(v)` in `<Mono>`:
```jsx
cell: info => <Mono>{fmt(info.getValue())}</Mono>,
// and
return <Mono className={overdue ? 'text-danger-600 font-medium' : ''}>{fmt(v)}</Mono>
```
Note: the `overdue` styling (`text-danger-600 font-medium`) moves into `Mono`'s `className` prop rather than wrapping `<Mono>` in an outer `<span>` — `Mono` already forwards `className` via `cn()`, avoiding a redundant nested span. Add `import Mono from './ui/Mono.jsx'` (same relative-import convention as this file already uses for other `ui/` primitives — verify existing import path pattern before adding).

---

### `app/src/components/PipelineTab.jsx` (Mono rollout call sites)

**Analog:** itself.

**Current relevant lines (72, 158, 177, 180 — confirmed by direct grep):**
```jsx
// line 72 — duplicate-group row meta line
{j === 0 ? '✓ keep' : '✕ archive'} · {a.stage} · {a.triage}{a.sourceRepo ? ` · ${a.sourceRepo}` : ''} · {fmt(a.createdTime)}
// line 158 — stage age
const days = a.daysInStage ?? daysSince(a.lastActivity)
// line 177 — applied date
{a.appliedDate && <span className="text-xs text-ink-400">Applied {fmt(a.appliedDate)}</span>}
// line 180 — closed date + day count
Closed {fmt(a.closedDate)}{a.appliedDate ? ` (${daysBetween(a.appliedDate, a.closedDate)}d)` : ''}
```
**Required edit pattern:** wrap each `fmt(...)` output and the `days`/day-count numeric displays in `<Mono>` — e.g. line 177 becomes `<span className="text-xs text-ink-400">Applied <Mono>{fmt(a.appliedDate)}</Mono></span>` (keep the existing `text-ink-400` wrapper styling on the outer span; `Mono` only supplies the font/tabular-nums/tracking treatment, it isn't a color decision). Import `Mono` the same way as in `ContactsTable.jsx`. Do **not** touch the duplicate-count headline number in `ApplicationDetailModal.jsx` (out of scope, stays `font-heading` + `tabular-nums` per UI-SPEC's explicit exclusion — that file is not in this phase's file list).

---

### `app/src/components/jobBoards/*` (posting-date/deadline badges — role-match, not exact)

**Analog:** `PipelineTab.jsx`'s date-badge pattern above (same `fmt()`-in-`<span>` shape; RESEARCH.md names this directory as an in-scope VIS-02 target but did not enumerate exact line numbers). **Planner note:** grep `jobBoards/*.jsx` for `fmt(` and deadline-countdown renders (e.g. `useJobDeadlines.js` consumers, `JobCard.jsx`/`JobDetailModal.jsx`) before writing the plan's task list — apply the identical `<Mono>{...}</Mono>` wrap pattern used in `ContactsTable.jsx`/`PipelineTab.jsx`. Not read line-by-line in this pass (early-stopping — 3 strong analogs for the Mono rollout pattern is sufficient; this directory reuses the exact same wrap pattern, no new pattern category needed).

---

## Shared Patterns

### `cn()` className merge helper
**Source:** `app/src/lib/cn.js` (3 lines, `clsx` + `tailwind-merge`)
**Apply to:** `Mono.jsx` (new file) and any edited primitive that accepts a `className` override — 6 of 8 existing primitives (`Button`, `Card`, `Tabs`, `Input`, `Select`, `Modal`) already use it; `Badge`/`ChipToggleGroup` use raw template literals (legacy, not in scope to refactor this phase — only `Mono.jsx` is new and should use `cn()` per its exact UI-SPEC-given implementation).
```js
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs) { return twMerge(clsx(inputs)) }
```

### Token-name-stable `@theme` value swap
**Source:** `app/src/index.css`'s existing `@theme` block
**Apply to:** every file in this phase — the single mechanism by which 7 of 8 `ui/` primitives require zero code edits. No other file needs to import or reference new tokens; existing `ink-*`/`accent-*`/`success/warning/danger-*` class strings everywhere in the ~50-file app automatically repaint.

### Small single-purpose `ui/` primitive convention
**Source:** `app/src/components/ui/Badge.jsx`, `EmptyState.jsx` (both ≤9 lines, one style string, optional prop passthrough)
**Apply to:** `Mono.jsx` — matches this repo's established pattern for "one repeated small treatment → one dedicated component," rather than a bare Tailwind utility class or inline `font-mono` sprinkling (RESEARCH.md Pattern 3's stated rationale for choosing this approach).

## No Analog Found

None — every file in this phase's scope either has itself as the direct edit-in-place analog, or (for the one new file, `Mono.jsx`) a clear structural analog (`Badge.jsx`) already in the codebase.

## Metadata

**Analog search scope:** `app/src/index.css`, `app/src/shared.jsx`, `app/src/components/ui/*.jsx` (all 8 existing + 1 new), `app/src/components/ContactsTable.jsx`, `app/src/components/PipelineTab.jsx`, `app/src/lib/cn.js`, `app/src/components/jobBoards/` (scoped grep only, not line-by-line — early-stopping per pattern-mapper convention once 3 strong Mono-rollout analogs were established)
**Files scanned:** 14 read in full/near-full, 1 additional directory grepped
**Pattern extraction date:** 2026-08-15
