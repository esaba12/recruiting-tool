# Phase 1: Visual Foundation — Industrial Design Tokens & Primitives - Research

**Researched:** 2026-08-15
**Domain:** Tailwind v4 `@theme` token-value reskin + shared React UI primitive restyling + dataviz contrast validation, for an existing live single-tenant-per-user React/Vite dashboard
**Confidence:** HIGH

## Summary

This phase is a token-*value* swap, not a token-*schema* change, and Tailwind v4's `@theme` model genuinely supports that with zero call-site edits — confirmed directly against Tailwind's own docs (`--color-*` custom properties are what utility classes like `text-ink-500` resolve against; redefining the property's value inside `@theme` requires no change anywhere `ink-500`/`accent-600`/etc. is used). The real risk in this phase isn't Tailwind mechanics, it's that **the token system doesn't cover the whole app today**: a codebase-wide grep found 61 hardcoded stock-Tailwind color-class usages (`orange-`, `purple-`, `gray-`, etc.) across 15 files, and critically, `shared.jsx` — the single source of truth for `STATUS_COLOR`/`STAGE_COLOR`/`TYPE_COLOR` consumed by `Badge` everywhere in the app — hardcodes `orange-100/800` (Champion status, Technical stage, Meeting interaction type) and `purple-100/700/800` (LinkedIn interaction type, Onsite stage) instead of the app's own token scale. These will **not** pick up the new industrial palette after the `@theme` value swap, producing exactly the "half-reskinned" look Pitfall 5 (milestone PITFALLS.md) warns about, on some of the most frequently-seen badges in the app (every applied job shows a Stage badge; every contact can show a Champion badge). This is squarely relevant to success criterion 4 ("no regressions from reusing the same token names with new values") and should be treated as in-scope remediation, not deferred to Phase 7's full reskin — Phase 7 is about *extending* the industrial look to every screen, not about *fixing tokens that don't move at all* today.

The `dataviz` skill's validator is two different tools depending on the color role, and conflating them will produce a wrong pass/fail. Its six-check `validate_palette.js` categorical-palette validator is scoped to **chart series identity colors** (`STATUS_CHART_COLORS` in `charts/theme.js`) — lightness band, chroma floor, CVD separation (protan/deutan simulated + normal-vision floor), and a ≥3:1 mark-vs-surface contrast check. For **text-on-background UI pairs** (a Badge's `text-success-800` on `bg-success-100`, a Button's white text on `bg-accent-500`, body text on the new canvas color), the correct check is the same script's exported `contrast(a, b)` WCAG ratio function against the standard 4.5:1 (normal text) / 3:1 (large text/UI components) thresholds — not the six-check categorical tool, which will report irrelevant/misleading results (e.g. "chroma floor FAIL") on text colors that were never meant to pass a mark-identity check. The codebase's own prior validator run (documented in `charts/theme.js`'s comments) already found a contrast WARN on `warning-500`/`accent-500` against the light canvas under the *current, lighter* palette — a darker/denser industrial direction raises this risk further and both checks need to be run and passed (or WARN-mitigated with visible labels, per the skill's rule that a contrast WARN is not dismissable) before new values ship.

**Primary recommendation:** Swap `@theme` custom-property *values* only (verified zero-call-site-edit in Tailwind v4), run the resulting Badge/Button/status text-background pairs through `validate_palette.js`'s exported `contrast()` WCAG check and the categorical chart palette through its six-check tool, fix the 10 shared.jsx off-token hardcoded colors as part of this phase (not deferred), and introduce a small reusable typographic pattern (a `.data-mono` utility or thin `<Mono>`/`<DataText>` wrapper) for IBM Plex Mono + tabular-nums rather than sprinkling `font-mono` per call site — `fmt()` in `shared.jsx` is already the single date-formatting choke point most dense fields flow through, but it returns a plain string, so the mono treatment has to be applied at the JSX call site (table `<td>`, badge, stat number), not inside `fmt()` itself.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIS-02 | IBM Plex Mono applied systematically to numeric/data fields (dates, counts, deadlines, status codes) across dense tables and panels, replacing its current "reserved, barely used" state | Pattern 3 (systematic mono rollout via utility/wrapper, not manual sprinkling) + Pitfall 4 (scope discipline vs. headline stats) + Validation Architecture's REQ→Test map; concrete current-state evidence (13 existing `font-mono` uses, none on dense table data) confirms the baseline VIS-02 describes |
| VIS-03 | New token values pass a contrast validation check (via the repo's existing `dataviz` skill validator) before being applied app-wide | Pattern 2 (which of the skill's two contrast tools applies to which color role) + Package/Code Examples sections showing exact invocation + Pitfall 2 (wrong-tool risk) + Pitfall 3 (charts/theme.js sync scope decision) |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives extracted from `./CLAUDE.md` and `~/.claude/CLAUDE.md` that this phase's plan must honor:

- **Same token names, new values, zero call-site edits** — PROJECT.md/ROADMAP.md's explicit constraint, verified achievable in Tailwind v4 (see Pattern 1). The plan must not introduce new token *families* or rename existing ones (`ink`, `accent`, `success`, `warning`, `danger`) as part of this phase.
- **Tailwind v4 via `@tailwindcss/vite`, no `tailwind.config.js`** — all token edits belong in `app/src/index.css`'s `@theme` block, per CLAUDE.md's "Design System" section.
- **Files-touched boundary** — per PROJECT.md's Constraints and milestone PITFALLS.md's Pitfall 4, this phase's diff should stay within `app/src/index.css`, `app/src/components/ui/`, and `app/src/shared.jsx` (for the off-token color fix) — no `supabase/migrations/`, `api/`, or backend files.
- **Global frontend-aesthetics directive** (`~/.claude/CLAUDE.md`): commit explicitly to one aesthetic direction (industrial/control-panel, already locked by PROJECT.md), avoid generic defaults (Inter font, purple-on-white gradients — not a risk here since the existing Space Grotesk/Public Sans/IBM Plex Mono system is being re-weighted, not replaced), and **render + screenshot the result against the stated direction before declaring the phase done** — this is a hard verification requirement, not optional polish, and should appear as an explicit step in the plan's verification loop.
- **`framer-motion` migration to `motion` is explicitly out of scope for this phase** (ROADMAP.md assigns it to Phase 7) — do not touch `ui/Modal.jsx`'s animation imports here even though the file is otherwise in scope for restyling.
- **`dataviz` skill's "run the validator, don't eyeball" discipline** — CLAUDE.md's Charts section documents this repo already following this discipline once (`charts/theme.js`'s comments); this phase must extend the same discipline to the new UI token values, not treat it as optional given the explicit VIS-03 requirement.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Design token values (`@theme` CSS custom properties) | Browser / Client | — | Pure CSS, compiled by Vite/Tailwind at build time, served static; no server involvement |
| Shared `ui/` primitives (Button, Badge, Card, Tabs, Input, Select, Modal, EmptyState) | Browser / Client | — | Client-rendered React components, no data fetching of their own — pure presentation over props |
| IBM Plex Mono rollout to dense data fields | Browser / Client | — | Presentational typography choice applied at render time in existing table/card/panel components; no data-shape change |
| Contrast validation (`dataviz` skill) | Build/Dev tooling (offline) | — | Runs as a Node script against hex strings during development, not part of the shipped runtime — output informs which token values are chosen, doesn't run in the browser |
| `charts/theme.js` hex mirror | Browser / Client | — | Consumed by Recharts (client-rendered); explicitly out of this phase's success criteria (Phase 7 owns the full chart-color pass) but flagged here since it reads the same `STATUS_CHART_COLORS` values that `shared.jsx`'s `STATUS_COLOR` badges use — see Regression Risk below for why these two are easy to desync |

No API/backend/database tier involvement — this phase touches `app/src/index.css` and `app/src/components/` only, consistent with PROJECT.md's stated file boundary.

## Standard Stack

### Core
No new libraries required. This phase re-weights the already-installed stack.

| Library | Version (verified installed) | Purpose | Why Standard |
|---------|------|---------|--------------|
| `tailwindcss` | `^4.3.2` [VERIFIED: app/package.json] | `@theme` token engine | Already the project's CSS build; `@theme` custom-property override is a first-class, documented Tailwind v4 feature — see Code Examples |
| `@tailwindcss/vite` | `^4.3.2` [VERIFIED: app/package.json] | Vite plugin wiring Tailwind's CSS-first config into the existing build | Already installed; no config changes needed for a value-only token swap |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `framer-motion` | `^12.42.2` [VERIFIED: app/package.json] | `ui/Modal.jsx`'s open/close transition | Unchanged this phase — the `motion` package migration is explicitly scoped to Phase 7 per ROADMAP.md; do not touch it here |
| `lucide-react` | (installed, version not re-checked — unchanged by this phase) | Icons inside Badge/Button/EmptyState | Icon `strokeWidth`/`size` props already parameterized; no icon-library change needed for a token/typography phase |

### Alternatives Considered
Not applicable — no new dependency decisions this phase. See milestone-level STACK.md for the full "what NOT to add" table (already ruled out a second font family, a Tailwind background-pattern plugin, and any new animation library for this milestone).

**Installation:** None required.

**Version verification:** `tailwindcss@^4.3.2` and `@tailwindcss/vite@^4.3.2` confirmed directly from `app/package.json` [VERIFIED: app/package.json] — matches STACK.md's milestone-level registry check (`tailwindcss@4.3.3` current on npm as of 2026-08-15). No action needed.

## Package Legitimacy Audit

**Not applicable — this phase installs no new packages.** All work is CSS token values, existing React component restyling, and Node-script-based (dataviz skill, already present) validation using the already-installed, already-verified stack.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  app/src/index.css                                                      │
│  @theme { --color-ink-*, --color-accent-*, --color-success/warning/     │
│           danger-*, --font-heading/body/mono }                          │
│  ─── VALUE CHANGE ONLY — names unchanged ───                            │
└───────────────────────────────┬───────────────────────────────────────-┘
                                 │ Tailwind build-time class generation
                                 │ (utility classes bind to CSS vars, not
                                 │  literal hex — verified via Context7)
                 ┌───────────────┼────────────────────────┐
                 ▼               ▼                        ▼
   ┌─────────────────────┐ ┌──────────────────┐ ┌────────────────────────┐
   │ ui/ primitives       │ │ shared.jsx        │ │ Direct call sites       │
   │ Button Badge Card     │ │ STATUS_COLOR       │ │ (ContactsTable.jsx,     │
   │ Tabs Input Select     │ │ STAGE_COLOR        │ │  PipelineTab.jsx, etc.  │
   │ Modal EmptyState      │ │ TYPE_COLOR          │ │  — already use ink-*/  │
   │ ChipToggleGroup       │ │ REFERRAL_STATUS_COLOR│ │  accent-*/status-*)     │
   │ — all token-driven,   │ │ — 10/16 entries    │ │                         │
   │   0 hardcoded colors  │ │   token-driven,     │ │                         │
   │   found               │ │   6 hardcoded       │ │                         │
   │                       │ │   orange-*/purple-* │ │                         │
   └──────────┬────────────┘ └──────────┬─────────┘ └────────────┬────────────┘
              │                          │                        │
              ▼                          ▼                        ▼
   Every screen's Badge/Button/     Every Badge consumer      Every consumer of
   Card/Modal usage picks up        (Network table, Pipeline  ink-*/accent-*
   the new palette automatically    stage badges, interaction  classes picks up
                                    type chips) — orange/purple new values
                                    entries DO NOT update
                                                                      │
                                                                      ▼
                                                        charts/theme.js — hand-synced
                                                        hex mirror, must be updated in
                                                        lockstep or Recharts renders the
                                                        OLD palette after the CSS swap
                                                        (flagged out-of-scope for Phase 1
                                                        success criteria, but the two
                                                        color sources — STATUS_COLOR here
                                                        vs STATUS_CHART_COLORS there — will
                                                        visibly disagree if only one updates)
```

A reader can trace the primary path: `@theme` value change → Tailwind rebuilds utility CSS bound to the same class names → every existing `ink-*`/`accent-*`/`success/warning/danger-*` consumer re-renders in the new palette automatically, **except** the 6 hardcoded `orange-*`/`purple-*` entries in `shared.jsx`, which silently stay on Tailwind's stock default palette regardless of the `@theme` change.

### Recommended Project Structure
No new files/folders required structurally. Existing locations to touch:
```
app/src/
├── index.css                    # @theme token VALUES — the core deliverable
├── shared.jsx                   # STATUS_COLOR/STAGE_COLOR/TYPE_COLOR — fix 6 off-token hardcoded entries
└── components/ui/
    ├── Button.jsx                # restyle VARIANTS
    ├── Badge.jsx                 # default color prop, restyle
    ├── Card.jsx                  # border/shadow treatment
    ├── Tabs.jsx                  # active-state treatment
    ├── Input.jsx                 # border/focus treatment
    ├── Select.jsx                # border/focus treatment
    ├── Modal.jsx                 # overlay/surface treatment (motion untouched)
    ├── EmptyState.jsx             # typography treatment
    └── ChipToggleGroup.jsx        # active-state treatment (not in phase's named 8, but same file, same risk — flag for planner)
```

### Pattern 1: Token-value-only reskin (Tailwind v4 `@theme`)
**What:** Redefine `--color-ink-*`/`--color-accent-*`/`--color-success/warning/danger-*` hex values inside the existing `@theme { }` block in `index.css`. Token *names* stay identical.
**When to use:** Always, for this phase — this is the entire mechanism VIS-03's "same token names, new values, zero call-site edits" constraint depends on.
**Example:**
```css
/* Source: Tailwind CSS docs, "Overriding default theme variables" — https://tailwindcss.com/docs/theme */
@import "tailwindcss";
@theme {
  --color-gray-50: oklch(0.984 0.003 247.858);
  /* redefining an existing --color-* variable requires no change anywhere
     the corresponding utility class (e.g. text-gray-50) is used */
}
```
[VERIFIED: Tailwind CSS docs via Context7 — `/websites/tailwindcss`, "Override Default Tailwind Colors" + "Overriding default theme variables" sections] This confirms the project's own token names (`ink`, `accent`, `success`, `warning`, `danger`) can have their hex values redefined with zero edits to any of the ~50 files currently consuming `ink-500`/`accent-600`/etc., because Tailwind v4 generates utility classes that resolve against the CSS custom property, not a value baked in per-callsite.

### Pattern 2: WCAG text-contrast check vs. categorical six-check validator — use the right tool per color role
**What:** The `dataviz` skill ships one script, `scripts/validate_palette.js`, that does two distinct jobs depending on how it's invoked:
1. **Six-check categorical validator** (`validate(palette, {mode, surface, pairs})`, CLI: `node validate_palette.js "#hex,#hex,..." --mode light`) — validates a **set of colors used as chart-series identity marks** (this app's only current user: `STATUS_CHART_COLORS` in `charts/theme.js`, the 5-slot contact-status donut). Checks: OKLCH lightness band, chroma floor, CVD separation (adjacent-pair ΔE ≥ 8 target / ≥ 6 floor under simulated protanopia/deuteranopia), a normal-vision floor (ΔE ≥ 15, hard gate, no WARN band), and mark-vs-surface contrast ≥ 3:1.
2. **Exported `contrast(a, b)` WCAG ratio function** — the correct tool for **any single text-on-background pair**: Badge text/background (`text-success-800` on `bg-success-100`), Button text/background (`text-white` on `bg-accent-500`), body text on the new canvas color, focus rings. Per the skill's own docs: "For a single status or text color, run a WCAG *text*-contrast check (4.5:1 normal, 3:1 large) — `validate_palette.js` exports `contrast(a, b)` for exactly this." [CITED: dataviz skill `references/color-formula.md`]
**When to use which:** Run the six-check tool ONLY on the `STATUS_CHART_COLORS` 5-slot set (chart-series identity) — running it on a Badge's text color will FAIL irrelevant checks (chroma floor, CVD pairing) that don't apply to a lone text/background pair. Run `contrast(a,b)` ≥ 4.5:1 (normal-size UI text) / ≥ 3:1 (large text, ≥18px or ≥14px bold, and non-text UI components like input borders/icons per WCAG 1.4.11) for every other token pairing this phase touches: Button variants (`text-white`/`bg-accent-500`, `bg-accent-600`, `bg-danger-600`/`-700`), Badge variants (`text-success-800`/`bg-success-100`, `text-warning-800`/`bg-warning-100`, `text-danger-700`/`bg-danger-100`, `text-ink-500`/`bg-ink-100`), body text (`text-ink-900`/`bg-canvas`), and any new industrial-palette darker surfaces if the direction moves toward a denser canvas.
**Trade-offs:** Skipping this distinction risks either (a) under-validating text pairs by never running `contrast()` at all, or (b) wasting time "fixing" a Badge color to pass CVD/chroma checks that were never the actual risk for a single text/background pair.

### Pattern 3: Systematic mono-for-data via a shared utility/wrapper, not manual `font-mono` sprinkling
**What:** `fmt()` in `shared.jsx` is already the single date-formatting function most dense date fields call (`ContactsTable.jsx`'s "Last"/"Follow-Up" columns, `PipelineTab.jsx`, `CalendarTab.jsx`, etc.) — but it returns a plain string, not JSX, so it cannot itself apply a `font-mono` class. Grepping the codebase found `font-mono` currently applied in exactly 13 places, none of which are `ContactsTable.jsx`'s date/count columns or Pipeline's stage/deadline badges — confirming VIS-02's framing that IBM Plex Mono is "reserved, barely used" is accurate: the columns most in need of it (dates, counts, deadlines, status codes in tables) currently render in the default `Public Sans` body font.
**When to use:** Define one small, reusable primitive for this — either (a) a Tailwind `@utility` or plain CSS class in `index.css` (e.g. `.tabular-mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }`), applied directly at each `<td>`/`<span>` call site where a date/count/status-code renders, or (b) a tiny wrapper component (e.g. `ui/Mono.jsx`, mirroring the existing `Badge.jsx`/`EmptyState.jsx` pattern of small, single-purpose primitives) that call sites wrap dense values in. Given this repo's existing convention of small dedicated `ui/` primitives for repeated patterns (Badge, ChipToggleGroup), a `<Mono>` wrapper component is more consistent with the codebase's own style than a bare utility class, and gives future phases (Phase 7's per-screen sweep) one grep target (`<Mono>`) to audit for completeness rather than a string-matched Tailwind class.
**Trade-offs:** A CSS utility class is zero-JS-overhead and marginally faster to apply; a wrapper component is more greppable/auditable and can centralize the `tabular-nums` + mono pairing (Tailwind already ships `tabular-nums` as a built-in utility for `font-variant-numeric`, already used once in `ApplicationDetailModal.jsx`'s count display, but paired there with `font-heading`, not `font-mono` — worth reconciling which numeric displays are "headline stat" (Space Grotesk, per existing use) vs. "dense table/data field" (IBM Plex Mono, per VIS-02) rather than applying mono indiscriminately to every number in the app).
**Example call sites needing this treatment (found via direct file read, not exhaustive):**
```jsx
// Source: app/src/components/ContactsTable.jsx (current, no mono treatment)
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
    return <span className={overdue ? 'text-danger-600 font-medium' : ''}>{fmt(v)}</span>  // ← candidate for + ' font-mono tabular-nums' or <Mono>{fmt(v)}</Mono>
  },
  sortingFn: 'datetime',
}),
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Palette accessibility validation | A manual eyeball check or a custom contrast calculator | `dataviz` skill's `validate_palette.js` (already in the repo's skill set, already used once for `charts/theme.js`) | The skill's six checks (lightness band, chroma floor, CVD separation under simulated Machado-Oliveira-Fernandes protanopia/deuteranopia, normal-vision floor, contrast) encode real accessibility science; a WCAG-ratio-only eyeball check misses colorblind-safety entirely, which the repo has already needed once (the documented contrast WARN on `warning-500`/`accent-500`) |
| WCAG text contrast math | Hand-rolling relative-luminance/contrast-ratio formulas | The same script's exported `contrast(a, b)` function | Already implements the WCAG relative-luminance formula correctly (sRGB → linear → relative luminance → ratio) — reuse, don't reimplement |
| Data-density typography pattern | Sprinkling `font-mono`/`tabular-nums` by hand at 50+ call sites, inconsistently | One shared utility/wrapper (Pattern 3 above) | Manual sprinkling is exactly how the codebase ended up with IBM Plex Mono "reserved, barely used" in the first place — 13 scattered current uses with no consistent target set |

**Key insight:** Both the color-accessibility and the typography-consistency problems in this phase have a "just eyeball it" failure mode that the existing tooling and the codebase's own precedent already show doesn't scale — the `dataviz` skill exists specifically because this repo already hit a contrast WARN once under a *lighter* palette than what's being proposed now.

## Common Pitfalls

### Pitfall 1: Treating this as purely a CSS-file change and missing shared.jsx's off-token hardcoded colors
**What goes wrong:** The `@theme` value swap in `index.css` is applied, screenshots of `ContactsTable`/`PipelineTab`/`Badge` usage of `ink-*`/`accent-*`/`success/warning/danger-*` look correctly reskinned — but Champion-status contacts, Technical/Onsite pipeline stages, and LinkedIn/Meeting interaction-type chips still render in Tailwind's stock default orange/purple, because `shared.jsx`'s `STATUS_COLOR`, `STAGE_COLOR`, and `TYPE_COLOR` maps hardcode `bg-orange-100 text-orange-800` / `bg-purple-100 text-purple-800` / `bg-purple-100 text-purple-700` for those specific entries (6 of 16 total color-map entries across those three objects) instead of referencing the app's token scale.
**Why it happens:** These hardcoded values were presumably added at a time the codebase's `success`/`warning`/`danger` 3-color status system didn't have enough distinct slots for a 5th/6th semantic meaning (Champion, Technical, Onsite, LinkedIn, Meeting), so the original author reached for Tailwind's stock palette rather than extending the token system — a reasonable shortcut at the time that becomes a token-reskin trap now.
**How to avoid:** Grep `shared.jsx` for `orange-` and `purple-` before starting (2 exact locations: `STATUS_COLOR['⭐ Champion']`, `STAGE_COLOR.Technical`, `STAGE_COLOR.Onsite`, `TYPE_COLOR.LinkedIn`, `TYPE_COLOR.Meeting` — 5 distinct map entries using orange/purple across the two colors) and decide explicitly whether to (a) remap them onto the existing `ink`/`accent`/`success`/`warning`/`danger` scale (simplest, but reduces the number of distinguishable badge colors from ~7 to 5), or (b) this is exactly the kind of "genuinely new visual primitive" ARCHITECTURE.md's Pattern 3 flags as schema-change territory — worth flagging to the user during the phase's UI-SPEC gate whether a 6th/7th token family (e.g. a dedicated `accent-2`/`purple` industrial-panel token) is wanted, rather than silently deciding either way in research.
**Warning signs:** Post-reskin screenshot of the Pipeline stage funnel or Network table shows some stage/status badges in the new industrial palette and others still in generic Tailwind orange/purple.
**Phase to address:** This phase (Phase 1) — it's a direct instance of success criterion 4 ("no regressions from reusing the same token names with new values"), not a Phase 7 concern, because these badges are visible on the highest-traffic surfaces (Network table, Pipeline) from day one after this phase ships.

### Pitfall 2: Running the wrong dataviz check on the wrong color role
**What goes wrong:** Someone runs the six-check categorical `validate_palette.js` tool against a Badge's `text-success-800`/`bg-success-100` pair (a single text-on-background pair, not a set of chart-series identity marks) expecting a pass/fail verdict, and either gets confused by irrelevant FAILs (chroma floor, CVD pairing don't meaningfully apply to one color against one background) or — worse — treats a categorical PASS as sufficient WCAG text-contrast clearance when the tool never checked the 4.5:1 text threshold at all (its contrast check is ≥3:1, the *mark*-vs-surface threshold, not the *text*-vs-background threshold).
**Why it happens:** The skill's README-level framing ("run the six checks") is written for chart-palette work, and this phase's success criterion 2 just says "the `dataviz` skill's contrast validator" without specifying which of the skill's two contrast-relevant tools (six-check categorical vs. exported `contrast()`) applies to UI-primitive text pairs vs. `charts/theme.js`'s categorical set.
**How to avoid:** Use Pattern 2 above — six-check tool only for `STATUS_CHART_COLORS` (if touched this phase; it's technically a Phase 7 file per ARCHITECTURE.md's Sequencing Priorities, though the *token values* it derives from do change this phase, so a re-run is prudent even if the file edit itself is deferred), `contrast(a,b)` ≥ 4.5:1/3:1 for every Button/Badge/body-text pair.
**Warning signs:** A phase plan or verification step says "ran the dataviz validator" without specifying which check, or without listing the actual text/background hex pairs checked.
**Phase to address:** This phase, at token-definition and UI-primitive-styling time.

### Pitfall 3: `charts/theme.js` silently drifting out of sync (deferred but must be tracked)
**What goes wrong:** `charts/theme.js`'s `STATUS_CHART_COLORS` currently mirrors the *same conceptual* 5 states as `shared.jsx`'s `STATUS_COLOR` (Warm/Cooling/Cold/Champion/Closed) but as literal hex strings for Recharts. If this phase changes `index.css`'s `--color-success-500`/`--color-warning-500`/etc. values but does not update `charts/theme.js`'s hardcoded hex mirror (explicitly out of this phase's stated success criteria — ARCHITECTURE.md assigns that file's reskin to Phase 7), the Overview donut chart will render the OLD palette while the Network table's status badges render the NEW palette for the exact same 5 semantic states, immediately post-Phase-1.
**Why it happens:** `charts/theme.js` is a manually-synced hex mirror by design (Recharts needs real hex, not CSS custom properties) — nothing enforces the two files staying in sync, and this phase's scope (per ROADMAP.md/success criteria) doesn't explicitly list `charts/theme.js`.
**How to avoid:** Even though `charts/theme.js`'s *file edit* is scoped to Phase 7 per the milestone roadmap, the planner should decide explicitly whether Phase 1 leaves a known, documented visual inconsistency (donut chart colors vs. badge colors disagreeing) for up to 6 phases, or whether updating `charts/theme.js`'s hex literals in lockstep is pulled into this phase's scope specifically because success criterion 2 already requires running the `dataviz` validator on the industrial token values — the marginal cost of also updating this one file's hex strings during that same validation pass is low. Flag as an explicit scope decision, not a silent gap.
**Warning signs:** Overview tab's "Network by Status" donut looks visually inconsistent with the Network table's status badges after this phase ships.
**Phase to address:** Decide explicitly in this phase's plan; default lands with ARCHITECTURE.md's Phase 7 assignment unless the planner/user chooses to pull it forward.

### Pitfall 4: Applying IBM Plex Mono indiscriminately, blurring "headline stat" vs. "dense table data" typography roles
**What goes wrong:** `ApplicationDetailModal.jsx` already uses `font-heading` + `tabular-nums` (not `font-mono`) for its large duplicate-count display — a deliberate distinct treatment for a big headline number vs. a small dense table cell. If VIS-02's mono rollout is applied uniformly to every number in the app (headline stats AND table cells alike) without preserving this distinction, large stat numbers lose their current Space Grotesk display treatment and the visual hierarchy between "the one big number on this screen" and "a column of many small numbers" collapses.
**Why it happens:** "Apply mono to data fields" is easy to over-generalize to "apply mono to all numbers."
**How to avoid:** Scope IBM Plex Mono specifically to *dense, multi-row/multi-field* contexts (table cells, status codes, deadline countdowns, timestamps in lists/panels) per VIS-02's literal wording ("dense data fields... in tables and panels") — leave large single-hero-number displays (like `ApplicationDetailModal`'s duplicate count, and Phase 7's future gauge-style KPI tiles per STAT-01) on their existing `font-heading` treatment unless a later phase explicitly changes that.
**Warning signs:** A large stat number that used to read as a confident headline now reads as a small dense data-table value because it picked up `font-mono` at a small default weight/size.
**Phase to address:** This phase, when defining the mono utility/wrapper's intended call sites (Pattern 3).

## Code Examples

### Tailwind v4 `@theme` value override (verified pattern)
```css
/* Source: Tailwind CSS docs via Context7 (/websites/tailwindcss), "theme" page */
@import "tailwindcss";
@theme {
  --color-ink-900: #16171d;    /* current warm charcoal — redefine to new industrial value */
  --color-accent-500: #f2994a; /* current warm amber — redefine to new industrial value */
  /* Every text-ink-900 / bg-accent-500 call site in app/src recompiles against
     the new value automatically — zero JSX edits required. */
}
```

### WCAG text-contrast check via the dataviz skill's exported function
```js
// Source: dataviz skill, scripts/validate_palette.js — exported `contrast(a, b)`
import { contrast } from './validate_palette.js' // path relative to the skill's scripts/ dir

// Badge: text-success-800 on bg-success-100 — check against WCAG 4.5:1 normal-text floor
console.log(contrast('#1c4f24', '#eef7ee')) // current success-800 / success-100 — verify new values the same way

// Button: white text on bg-accent-500
console.log(contrast('#ffffff', '#f2994a')) // current accent-500 — must clear 4.5:1 for body text weight, 3:1 if treated as large/UI text
```

### Six-check categorical validator (for `STATUS_CHART_COLORS` specifically, if pulled into this phase per Pitfall 3)
```bash
# Source: dataviz skill, references/color-formula.md — run once per mode
node scripts/validate_palette.js "#3c9a46,#d9a02b,#c94a4a,#f2994a,#86868f" --mode light
# current STATUS_CHART_COLORS values (success-500, warning-500, danger-500, accent-500, ink-400)
# — re-run with the NEW hex values once the industrial palette is chosen
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Tailwind v3 `tailwind.config.js` JS-based theme extension | Tailwind v4 CSS-first `@theme` directive in the stylesheet itself | Already the case in this repo (`app/package.json` shows `tailwindcss@^4.3.2`, no `tailwind.config.js` present) | Token *value* edits happen directly in `index.css`, no separate config-file round-trip; this is the mechanism this whole phase depends on |
| `font-mono` sprinkled ad hoc, 13 current uses, none on dense table data | Systematic mono-for-data treatment (this phase's deliverable) | This phase | Establishes the pattern every later phase (esp. Phase 7's per-screen sweep) extends, per VIS-02 |

**Deprecated/outdated:** None specific to this phase — the project's stack (Tailwind v4, React 18, hand-rolled `ui/` primitives) is current as of the milestone-level STACK.md research (2026-08-15) and this phase doesn't touch anything requiring a version bump.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A `<Mono>` wrapper component (vs. a bare CSS utility class) is the better-fit pattern for this codebase's existing conventions | Architecture Patterns, Pattern 3 | Low — both approaches are mechanically valid; this is a style/consistency judgment call the planner or UI-SPEC gate should confirm, not a functional risk |
| A2 | Industrial/control-panel color precedent research (Bloomberg Terminal-style dense data, amber-on-dark, IDE dark themes) drawn from a low-quality web search pass — treat as directional inspiration only, not verified fact | (referenced in additional_context but deliberately NOT included as a "Sources" citation above, since the search results read as SEO-aggregated/low-confidence, consistent with STACK.md's own LOW-confidence tagging of similar searches) | Low — exact palette values are a design decision made during the UI-SPEC gate with the `dataviz` validator as the acceptance bar, not sourced from this research; no plan should cite this search as authoritative |
| A3 | The 6 hardcoded `orange-*`/`purple-*` entries in `shared.jsx` should be fixed in Phase 1 rather than deferred to Phase 7 | Common Pitfalls, Pitfall 1 | Medium — if the user/planner instead decides to defer this (e.g., treating it as within Phase 7's "full per-screen reskin" scope since `shared.jsx` isn't literally one of the phase's 4 named success criteria), that's a legitimate alternative; flagging here because leaving it unaddressed risks a visibly half-reskinned high-traffic surface (Network table, Pipeline) for up to 6 phases, which conflicts with the "no regressions" spirit of success criterion 4 |

## Open Questions

1. **Should the 5 off-token `shared.jsx` badge-color entries (Champion/Technical/Onsite/LinkedIn/Meeting) be remapped onto the existing 5-token scale, or does the industrial direction want a 6th/7th token family?**
   - What we know: Tailwind v4's value-only reskin (Pattern 3, ARCHITECTURE.md) is free; adding a new token *family* is schema-change territory requiring call-site edits wherever it's introduced.
   - What's unclear: Whether the industrial aesthetic wants more than 5 distinguishable status/stage hues, or whether consolidating onto the existing 5 is an acceptable (even desirable) simplification.
   - Recommendation: Surface explicitly at the phase's UI-SPEC gate (per the phase's stated "UI hint: yes") rather than deciding silently either way during planning.

2. **Does Phase 1 pull `charts/theme.js`'s hex-literal update into its own scope, or leave the donut-chart/badge color disagreement live until Phase 7?**
   - What we know: ARCHITECTURE.md's Suggested Build Order explicitly assigns this file to Phase 7; this phase's 4 stated success criteria don't mention it.
   - What's unclear: Whether "no regressions" (success criterion 4) is read strictly (only the 8 named `ui/` primitives + IBM Plex Mono + contrast validation) or broadly (anything visibly inconsistent post-token-swap).
   - Recommendation: Default to ARCHITECTURE.md's Phase 7 assignment (matches the milestone roadmap's explicit sequencing decision already logged in STATE.md), but document the resulting known-inconsistency explicitly in this phase's plan so it isn't mistaken for an oversight later.

3. **Exact new hex/OKLCH values for the industrial palette** — not answered by this research (correctly so, per SUMMARY.md's own Gaps section: this is a design decision, not a research question). Resolve at the UI-SPEC gate using the validator (Pattern 2) as the acceptance test, informed by well-known real precedent (Bloomberg-Terminal-style dense/mono data displays, common dark-IDE-theme conventions like Dracula/Nord/Monokai's use of a near-black or deep-charcoal surface with one or two saturated accent hues) rather than the low-confidence web search noted in A2.

## Environment Availability

No external service/tool dependencies beyond what's already installed and verified above (Tailwind v4, the `dataviz` skill's Node-based validator script, which runs via the system's existing `node` runtime with no additional install). No environment audit gaps for this phase.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed [VERIFIED: `app/package.json` `scripts` block contains only `dev`/`build`, no `test` script; no test config files or test directories found in `app/`] |
| Config file | none — see Wave 0 |
| Quick run command | n/a (no automated test runner) |
| Full suite command | n/a |

This phase's success criteria are inherently visual/perceptual (token values "look industrial," primitives "visibly reflect" the new palette) plus two objectively-checkable gates (contrast validation, no-regression rendering) — neither of which a conventional unit-test suite is the natural tool for. The project's own standing directive (CLAUDE.local.md's global frontend-aesthetics rule: "render it, screenshot it, and check it against the stated aesthetic direction before declaring the task done") already supplies the verification method for the perceptual criteria.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIS-02 | Dense data fields (dates/counts/deadlines/status codes) render in IBM Plex Mono | manual visual + grep | `grep -rn "font-mono\|<Mono>" app/src/components/ContactsTable.jsx app/src/components/PipelineTab.jsx app/src/components/jobBoards/` (confirm new mono call sites exist in the target files) | ❌ Wave 0 (no automated visual regression tooling in repo) |
| VIS-03 | New token values pass the `dataviz` contrast validator | scripted (Node) | `node <dataviz-skill-path>/scripts/validate_palette.js "<hex list>" --mode light` for the categorical set, plus manual `contrast(a,b)` checks per Pattern 2 for text/background pairs | ✅ (script exists in the skill, runnable today, no repo changes needed) |
| VIS-02/VIS-03 (regression) | All existing tabs render without regressions after the token swap | manual smoke test | Load each of the 8 current top-level tabs + `/demo` in a browser, screenshot, compare against pre-change baseline | ❌ Wave 0 (no automated screenshot-diff tooling in repo) |
| — (Pitfall 1) | `shared.jsx`'s off-token colors don't silently stay stock-Tailwind | scripted (grep) | `grep -n "orange-\|purple-" app/src/shared.jsx` returns zero matches once fixed (or is explicitly deferred per Open Question 1) | ✅ (grep-based check works today) |

### Sampling Rate
- **Per task commit:** Run the grep checks above (fast, deterministic) after any token/badge-color edit.
- **Per wave merge:** Full manual visual pass — load every tab + `/demo`, screenshot, compare against the stated industrial direction (per the user's global aesthetic standard's mandatory render-and-screenshot step).
- **Phase gate:** Contrast validator run (Pattern 2) on the final chosen token values, zero-FAIL result (WARNs acceptable only with documented relief per the skill's rules), before `/gsd-verify-work`.

### Wave 0 Gaps
- No automated visual-regression/screenshot-diff tooling exists in this repo — acceptable given the project's explicit reliance on manual render-and-screenshot verification (a standing global directive, not a gap introduced by this phase), but the planner should not assume a `npm test` step will catch a missed token consumer; the grep-based checks above are the closest available automated signal.
- No existing test framework to extend — if a future phase wants automated coverage for visual regressions, that's a larger tooling decision (e.g. Playwright + screenshot comparison) out of scope for this phase.

## Security Domain

**Not applicable in any meaningful way — this phase touches only `app/src/index.css` (CSS custom properties) and presentational React components in `app/src/components/ui/` + `app/src/shared.jsx`'s color-constant maps.** No new input handling, authentication, session, or data-access code is introduced or modified.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Not touched — no auth code in scope |
| V3 Session Management | no | Not touched |
| V4 Access Control | no | Not touched — no RLS/route-guard code in scope |
| V5 Input Validation | no | No new user input surfaces introduced by a token/CSS/primitive-styling change |
| V6 Cryptography | no | Not touched |

### Known Threat Patterns for {stack}
None applicable — a CSS-token and presentational-component styling phase has no meaningful STRIDE-relevant attack surface. The one adjacent, already-mitigated risk from milestone-level PITFALLS.md (a consolidated nav accidentally exposing an authenticated-only view to `/demo`) doesn't apply here either, since this phase changes no nav structure or `DEMO_NAV_ITEMS`/`isDemoMode()` logic — token/primitive value changes render identically regardless of demo vs. authenticated mode.

## Sources

### Primary (HIGH confidence)
- Direct codebase reads: `app/src/index.css`, `app/src/components/ui/Button.jsx`, `Badge.jsx`, `Card.jsx`, `Tabs.jsx`, `Input.jsx`, `Select.jsx`, `Modal.jsx`, `EmptyState.jsx`, `ChipToggleGroup.jsx`, `app/src/shared.jsx`, `app/src/components/charts/theme.js`, `app/src/components/ContactsTable.jsx`, `app/src/lib/icons.js`, `app/package.json`, `.planning/config.json`
- `dataviz` skill (loaded live this session): `references/color-formula.md`, `scripts/validate_palette.js` — full six-check logic and exported `contrast()` function read directly, not summarized from memory
- Context7 `/websites/tailwindcss` — "Overriding default theme variables" / "Override Default Tailwind Colors" — confirms zero-call-site-edit claim for Tailwind v4 `@theme` value swaps
- Codebase-wide grep: stock-Tailwind color-class usage (61 matches / 15 files), `font-mono` usage (13 matches, none on dense table data)
- `.planning/research/ARCHITECTURE.md`, `PITFALLS.md`, `STACK.md`, `SUMMARY.md` (milestone-level research, already grounded in direct codebase reads per their own Sources sections)

### Secondary (MEDIUM confidence)
- None distinct from Primary this phase — no external documentation beyond Tailwind's own docs and the in-repo `dataviz` skill was needed for this phase's scope.

### Tertiary (LOW confidence, treat as directional)
- Web search on industrial/control-panel dashboard precedent (Bloomberg Terminal, dark IDE themes, amber/neon-accent conventions) — results read as SEO-aggregated and were not independently corroborated against primary design sources; documented in Assumptions Log (A2) as directional-only, not cited as fact anywhere in this document's prescriptive sections.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, versions verified directly from `package.json`
- Architecture (Tailwind token mechanism): HIGH — verified against Tailwind's own docs via Context7, not assumed from training data
- Regression risk findings (`shared.jsx` off-token colors, mono rollout gaps): HIGH — found via direct grep/read of this repo's actual files, not inferred
- Contrast-validator usage guidance: HIGH — read the skill's actual script and reference docs this session, not summarized from general dataviz knowledge
- Industrial palette aesthetic precedent: LOW — flagged explicitly, not treated as a research deliverable (correctly deferred to the UI-SPEC gate per milestone SUMMARY.md)

**Research date:** 2026-08-15
**Valid until:** 30 days (stable domain — Tailwind v4 token mechanics and this repo's own file structure aren't expected to shift meaningfully before this phase is planned/executed)
