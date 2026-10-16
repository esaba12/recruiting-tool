# Stack Research

**Domain:** UI/UX reskin + IA consolidation for an existing React+Vite recruiting CRM dashboard (industrial/control-panel aesthetic direction)
**Researched:** 2026-08-15
**Confidence:** MEDIUM

> Scope note: this is a *subsequent-milestone* stack research pass. The existing stack (React 18, Vite, Tailwind v4, framer-motion, recharts, lucide-react, hand-rolled shadcn-shaped `ui/` primitives, Space Grotesk/Public Sans/IBM Plex Mono) is already validated and is NOT re-recommended from scratch here. This file only answers: what, if anything, needs to be added or changed to execute the reskin + nav consolidation.

## Recommended Stack (additions/changes only)

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `motion` (npm package, import `motion/react`) | 13.1.0 (current) | Successor package to `framer-motion` — same maintainer, same API, same version line (both currently 13.1.0) | Framer Motion rebranded to **Motion** in 2024–2025; `motion` is the forward path, `framer-motion` is now a compatibility re-export of the identical code. Since this milestone touches every screen's motion anyway (staggered reveals, nav transitions, panel enter/exit), it's the right moment to migrate import paths (`framer-motion` → `motion/react`) at effectively zero cost — no API changes, purely an import swap, can be done incrementally file-by-file. **Do not add a second animation library** — Motion's `transition:{when,delayChildren:stagger(n)}` orchestration, `layout`/`layout="position"` props, `AnimatePresence`, and `whileInView`/`useInView` already cover every animation this milestone needs (staggered KPI-tile reveals, orchestrated page-load sequences, nav-destination transitions, panel/drawer enter-exit). Confidence: MEDIUM (Context7-sourced docs, cross-referenced with a web search confirming the rebrand timeline). |
| React Router (`react-router`, declarative/library mode — NOT framework mode) | react-router@8.3.0 / react-router-dom@7.18.2 (current) | Give each of the ~4-5 consolidated destinations (and their merged sub-views, e.g. the Explore→Coverage→Discover funnel) a real URL | The app currently has **zero routing** — tab state lives in `App.jsx` component state, and `/demo` is special-cased via a raw `window.location.pathname` string check. That's fine at 8 flat tabs; it gets fragile once destinations gain internal sub-navigation (a merged Explore/Coverage/Discover flow, a unified "attention" front door) that still needs to be deep-linkable, back/forward-able, and shareable (e.g. a link straight to "Pipeline → Duplicates" or "Attention → overdue follow-ups"). Use React Router in **declarative mode only**: `BrowserRouter` + `Routes`/`Route`/`Link`/`useNavigate`, no `@react-router/dev` Vite plugin, no SSR, no route-file conventions — this layers directly onto the existing `vite.config.js`/`mountApiHandler()` setup with zero changes to the API-proxy/build pipeline. This is explicitly a routing-*library* addition, not a framework migration. Confidence: MEDIUM. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required for fonts | — | Industrial/control-panel typography | See "Font Direction" below — the recommendation is to **re-weight usage of the fonts already installed**, not add a new font family. If a mono upgrade is wanted later, `@fontsource-variable/jetbrains-mono` (self-hosted variable font, single file/multiple weights) is the lowest-friction drop-in — but it's optional, not required for this milestone. |
| None required for background patterns | — | Grid-line/blueprint/scanline instrument-panel textures | Build with native Tailwind v4 arbitrary values (`bg-[image:repeating-linear-gradient(...)]`) backed by a `@theme` custom property, not a plugin — see Tailwind v4 Patterns below. Only reach for `tailwindcss-bg-patterns` or `@nauverse/tailwind-dot-grid-backgrounds` if the hand-rolled gradient approach turns out to need more variety than 2-3 fixed patterns can cover (unlikely for one aesthetic direction). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| None new | — | This is a visual/IA layer change on an already-configured build. No new dev tooling (linters, bundler plugins, test runners) is warranted by the reskin itself. |

## Installation

```bash
# Motion (rebrand of framer-motion) — swap the import path, optionally the dependency
cd app && npm install motion
# then: replace `from "framer-motion"` with `from "motion/react"` across app/src (mechanical find/replace, API-identical)
# framer-motion can be removed from package.json once all imports are migrated — not required to do this in the same pass

# React Router (declarative/library mode)
cd app && npm install react-router
# do NOT install @react-router/dev or reactRouter() Vite plugin — that's framework mode, not needed here
```

No other installs are required for this milestone's stack questions.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Keep `framer-motion`/`motion` for all orchestration | GSAP (`gsap`) | Only if the design later calls for scroll-scrubbed/timeline-synced sequences, SVG path morphing, or physics well beyond React-declarative animation (e.g. a literal animated instrument needle/gauge). Not warranted for stagger/layout/page-transition work — adding GSAP alongside Motion would mean two animation runtimes for overlapping use cases, which is exactly the kind of scope creep this milestone should avoid. |
| React Router, declarative mode | Wouter (3.10.0) | Wouter is a genuinely lighter (~1.5KB) alternative with a similar `<Route>` API, worth it *if* the only goal were "smallest possible router." Not recommended here because React Router is already the de facto ecosystem standard (far more Stack Overflow/LLM-training-data coverage for whoever maintains this next, e.g. `useSearchParams` for filter-state-in-URL, nested `<Outlet>` for the merged Explore/Coverage/Discover funnel), and the bundle-size delta is immaterial for an internal daily-use dashboard. |
| React Router, declarative mode | `@tanstack/react-router` (1.170.29) | Fully type-safe, file-based-optional router with excellent search-param typing — genuinely strong choice for a *new* app. Not recommended for this milestone because it has a steeper migration cost (its type-inference model wants to own route definitions more centrally) for marginal benefit over React Router's declarative mode, given this app is JS not TS-strict throughout. |
| Native Tailwind v4 arbitrary-value grid patterns | `tailwindcss-bg-patterns` / `tailwind-dot-grid-backgrounds` | Reach for these only if the instrument-panel background needs more than 2-3 pattern variants (e.g. dots AND grid AND diagonal hatch, each independently configurable per surface) — otherwise a plugin dependency for something 3-4 lines of `@theme` CSS already does is unnecessary weight. |
| Reuse Space Grotesk / Public Sans / IBM Plex Mono, re-weighted | New font pairing (e.g. Geist Sans + Geist Mono, or Monoforge) | Only if user testing/visual QA of the reskin shows the current pairing genuinely can't carry the industrial direction even after re-weighting mono usage. Space Grotesk already scores as having "monospace heritage" (squared terminals) in current type-pairing guidance, which is why it was picked originally — swapping it now would be churn without a demonstrated gap. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| Full React Router "framework mode" (`@react-router/dev`, SSR, file-based routes) | Replaces the Vite React plugin and adds a build-time routing/SSR layer this app doesn't need (it's a client-only SPA behind Vercel serverless API proxies) — would touch `vite.config.js`'s `mountApiHandler()` dev-proxy setup and risk the "one code path for dev/prod" guarantee documented in this repo's `CLAUDE.md` | React Router **declarative mode** (`BrowserRouter`, plain `npm install react-router`, no dev-plugin) |
| A second animation library (GSAP, react-spring, auto-animate) alongside Motion | Two animation runtimes with overlapping responsibility (stagger, layout, transitions) is unnecessary complexity and bundle weight for a reskin that explicitly should not become a rewrite | `motion`/`framer-motion` — already proven sufficient per its own orchestration APIs (stagger, layout, AnimatePresence, whileInView) |
| A new display/body font pairing that replaces Space Grotesk + Public Sans wholesale | Not a rewrite — the existing pairing already has technical/engineering-coded letterforms (Space Grotesk's monospace-heritage terminals); swapping risks re-litigating a decision that isn't actually broken, just under-leveraged (IBM Plex Mono is "reserved, barely used") | Re-weight the existing 3-font system — promote IBM Plex Mono to the primary instrument-panel/data typeface (see Font Direction) |
| Tailwind background-pattern plugins as a default reach | Adds a dependency for something native Tailwind v4 arbitrary-value + `@theme` CSS variables already do in ~3 lines | Native `bg-[image:repeating-linear-gradient(...)]` + `@theme` custom property |

## Stack Patterns by Variant

**Font direction (no new dependency — re-weighting existing choices):**
- Keep **Space Grotesk** for headings/display — its squared terminals and single-story forms already read as technical/engineered, which is why current type-pairing guidance groups it with monospace-heritage faces. This is already the right choice for "industrial," it just needs the rest of the system to lean into it rather than soften it with a generic body font everywhere.
- **Promote IBM Plex Mono from "reserved, barely used" to a first-class instrument-panel typeface.** This is the single highest-leverage, zero-new-dependency move for the industrial/control-panel direction: use it for stat-tile numerics, timestamps, table numeric columns, status/urgency badges, nav-item labels, and section eyebrows — anywhere the redesign wants a "dashboard instrument" feel. IBM Plex Mono ships 8 weights and no ligatures, which current guidance specifically cites as well-suited to data tables/financial-style interfaces (precise, not cold) — exactly the register this milestone wants.
- Keep **Public Sans** for body copy/prose (descriptions, notes fields, form labels) — the milestone's aesthetic direction is about density and instrument-feel in the *data surfaces*, not about making every sentence of prose mono; over-using mono for body text actively hurts readability and would read as a gimmick rather than a system.
- **If** a future pass wants an even more distinct mono identity (e.g. for the nav rail's destination labels specifically), `Space Mono` is the most-cited "deliberate style choice" option in current guidance — retro-technical detailing, good for headings/brand moments, not recommended as a body-mono replacement for IBM Plex Mono. This is optional/deferred, not part of this milestone's required stack changes.

**Tailwind v4 instrument-panel background patterns (no plugin needed):**
- Define pattern tokens as `@theme` custom properties in `app/src/index.css` (same file that already holds the `ink`/`accent` design tokens), e.g. a `--pattern-grid` CSS variable holding a `repeating-linear-gradient(...)` value sized to a small cell (8-16px), applied via Tailwind v4's arbitrary `bg-[image:var(--pattern-grid)]` / `bg-(--pattern-grid)`-style utilities documented for `background-image`.
- This keeps the pattern as a first-class design token (swappable/tunable in one place, consistent with how `ink`/`accent` already work) rather than a one-off plugin config living outside `@theme`.
- Use sparingly as a background texture on section containers/empty-states, not as a foreground pattern — a literal blueprint-grid backdrop on a card or panel header reinforces "control panel" without competing with data legibility.

**Routing migration approach (incremental, not a rewrite):**
- Wrap the existing `AppInner`/`AppShell` tree in `BrowserRouter` at the point `main.jsx`/`App.jsx` currently branches on `window.location.pathname.startsWith('/demo')` — this pathname check becomes a real `<Route path="/demo/*">` instead of a manual string test, which is a *simplification* of existing code, not new complexity.
- Convert the 4-5 consolidated top-level destinations into `<Route>` entries; keep sub-view state (e.g. which segment of a merged Explore/Coverage/Discover flow is active) as either nested routes or `useSearchParams` — both are native React Router primitives, no extra library.
- `Sidebar.jsx`'s nav items become `<Link>`/`NavLink` instead of `onClick` state setters — `NavLink`'s active-state styling hook is a direct replacement for whatever manual "is this tab active" comparison currently exists.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `motion@13.1.0` / `framer-motion@13.1.0` | React 18 (already in use) | Both current major versions support React 18 and 19; no React upgrade implied or required by this migration. |
| `react-router@8.3.0` (declarative mode) | Vite (already in use, no `@react-router/dev` plugin) | Declarative-mode React Router has no build-tool dependency beyond a bundler capable of standard ESM/JSX — the existing Vite config needs zero changes to support it. |
| Tailwind v4 (`4.3.3`, already in use) | `@theme`-defined pattern tokens | Arbitrary-value background utilities and CSS-variable-backed utilities used for pattern tokens are core Tailwind v4 features already available given the project's current Tailwind version — no Tailwind upgrade needed. |

## Sources

- Context7 `/websites/motion_dev` — Motion/React orchestration APIs (stagger, layout animations, AnimatePresence, whileInView/useInView). Confidence: MEDIUM.
- Context7 `/websites/tailwindcss` — Tailwind v4 background-image arbitrary values and `@theme`/CSS-variable-backed utility syntax. Confidence: MEDIUM.
- Context7 `/websites/reactrouter` — React Router declarative mode (`BrowserRouter`) vs framework mode (`@react-router/dev`, SSR config) distinction. Confidence: MEDIUM.
- `npm view` (live registry query, 2026-08-15) — current versions: `framer-motion@13.1.0`, `motion@13.1.0`, `tailwindcss@4.3.3`, `react-router@8.3.0`, `react-router-dom@7.18.2`, `@tanstack/react-router@1.170.29`, `wouter@3.10.0`, `recharts@3.10.1`, `lucide-react@1.31.0`. Confidence: HIGH (primary source, live registry).
- Web search — "Framer Motion becomes independent: introducing Motion" (fireup.pro) and Motion's own React upgrade guide, confirming the framer-motion → motion rebrand and import-path-only migration. Confidence: LOW-MEDIUM (aggregated web search, cross-checked against Context7 docs and matching live npm version data).
- Web search — industrial/monospace font pairing guidance (madegooddesigns.com, diversekit.com, fontfinds.com) for Space Grotesk/IBM Plex Mono/DM Mono/Geist Mono/Space Mono characterizations. Confidence: LOW (general web search, SEO-content sources, not primary type-foundry documentation — treat as directional inspiration, not authoritative fact).
- Web search — Tailwind v4 background-pattern plugin landscape (`tailwindcss-bg-patterns`, `tailwind-dot-grid-backgrounds`, magicui/Aceternity component examples). Confidence: LOW (web search of community plugins/component libraries).

---
*Stack research for: UI/UX reskin + IA consolidation, industrial/control-panel aesthetic*
*Researched: 2026-08-15*
