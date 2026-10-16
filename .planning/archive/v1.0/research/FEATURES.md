# Feature Research: IA Consolidation + Industrial/Control-Panel Reskin

**Domain:** Navigation/IA patterns for consolidating a sprawling CRM-style dashboard, and industrial/control-panel visual design in production SaaS/dev-tools
**Researched:** 2026-08-15
**Confidence:** MEDIUM (cross-corroborated across multiple independent web searches; individual CSS/token values should be spot-verified against live sites before copying literally — see Gaps)

## Feature Landscape

### Table Stakes (This App Should Definitely Adopt)

Patterns proven across CRM/dashboard products and job-search CRM competitors specifically. Missing these = the reskin doesn't actually solve the stated "too many tabs" problem.

| Pattern | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Collapse to 4-5 top-level destinations that mirror **workflow**, not feature inventory | 5-8 primary nav items is the practical ceiling before a sidebar feels overwhelming; SaaS UX research explicitly frames CRM navigation as needing to mirror how a user actually moves between Contacts/Deals/Activities in one workflow, not expose every internal feature as its own tab | LOW-MEDIUM | Pure routing/IA work — no backend change. Directly matches PROJECT.md's "collapse 8 tabs to ~4-5" requirement. |
| One Pipeline surface with **Kanban + Table + Calendar as views over the same object**, not separate destinations | Attio's model: "a view allows you to customize how your data is displayed... pipelines are simply one view layered on top" of the same record type. Huntr's and Teal's job trackers are built the same way — Kanban is the default view, table/list is a toggle, not a different app section | MEDIUM | Applications data model is already unified; this is a view-switcher UI, not new data plumbing. Directly reusable for merging Pipeline + Job Boards' card-grid into one surface. |
| Shared **record side-panel** pattern (click a card → detail panel, not a full-page nav or a bespoke modal per entity) | The "Split Pane" SaaS pattern: side panel opens with card/record details rather than navigating away, "maximizing screen real estate... without losing context of the main screen." Attio's "Record Sidebar" is explicitly a clean vertical overlay with integrated field editing + activity log | MEDIUM | Consolidates `ContactDetailModal.jsx`, `JobDetailModal.jsx`, and application-detail UI into one shared `DetailPanel` component/pattern instead of 3 divergent modals. |
| Single **unified "attention" feed** replacing scattered nudges | Direct analog to Linear Triage: "a holding inbox that catches everything incoming and keeps it out of the real backlog until a person decides." Maps 1:1 onto this app's fragmentation across Overview nudges, Actions tab, Keep in Touch queue, Job Boards "Needs Review," and TimelineFindsPanel | MEDIUM-HIGH | No schema change needed (all 5 sources already compute from existing tables) — this is a UI aggregation layer merging `keepInTouch.js`, `isUntriaged()`, `timelineFinder.js`, and follow-up-date logic into one ranked, typed, sortable list. Highest-value single consolidation per PROJECT.md's explicit "fragmented 5 ways" complaint. |
| Merge company-discovery funnel (Explore → Coverage → Discover) into **one destination with internal filters**, not 3 places | Cross-referencing Huntr/Teal/Simplify: none of them expose "gap analysis" or "people discovery" as top-level nav — these are contextual filters/suggestions *inside* the tracker/contacts view. Attio's model of "views + filters over one object" applies here too: companies, gap status, and candidate people are really one funnel (interest → target → gap → person), best expressed as one screen with a state, not 3 screens | MEDIUM | Mostly UI-shell work reusing existing `lib/discovery.js`, `lib/companyFinder.js`, `ReferralCoverageTab.jsx` logic. |
| **Command palette (Cmd/Ctrl-K)** as the escape valve for anything not in top-level nav | Described across every source as "table stakes for power users" and "the defining pattern of 2026's power tools" — present in Linear, Superhuman, Notion, Attio (`cmd+k` for commands, `/` for search), Vercel, Cursor. Lets users "say what they want instead of remembering where it lives," which is the direct antidote to a 15-destination nav tree | MEDIUM | This app already ships a free-text AI action router (Quick Capture) — extending that into a global "jump to X / do X" palette reuses an existing backend rather than building new AI plumbing. |
| Near-invisible borders/dividers, not heavy rules | Raycast: `rgba(255,255,255,.06)` borders, "barely visible, structurally essential." Vercel/Geist: uses a `box-shadow: 0 0 0 1px rgba(0,0,0,.08)` "shadow-as-border" trick instead of literal CSS borders specifically so adjacent edges don't double up. Attio's dense Spreadsheet Grid still uses "1px borders" but relies on spacing/contrast, not thickness, for structure | LOW | A CSS-token-level change in `index.css`. Important nuance for "industrial": the reference products read as precision-machined via restraint, not via thick/brutalist black rules — see Anti-Features. |
| Deploy the already-reserved **mono companion font for actual data**, not just as an unused reserve | Every reference product pairs a display/UI sans with a technical monospace used systematically for numbers, timestamps, IDs, code/status labels: Linear → Berkeley Mono, Raycast → GeistMono, Vercel → Geist Mono, PostHog → ui-monospace/Source Code Pro. Independently, font-pairing research names **Space Grotesk / Space Mono (or IBM Plex Mono)** specifically as "ideal for AI tools... dashboards" | LOW | This app already has Space Grotesk (headings) and IBM Plex Mono loaded but "reserved, barely used" per PROJECT.md — the reskin should systematically apply it (`font-mono tabular-nums`) to dates, counts, deadlines, status codes across dense tables/panels, not add a new font. |
| Tabular numerals, right-aligned numeric columns, frozen headers/zebra striping for dense tables | Called out explicitly as "baseline, not optional" for data-dense dashboards (Vercel/Geist reference); Attio's grid is described the same way | LOW-MEDIUM | Applies to Pipeline table view and Job Boards grid — mostly Tailwind utility + `ContactsTable.jsx`'s existing `@tanstack/react-table` config. |

### Differentiators (Bolder Moves, Worth Considering Given the Industrial Commitment)

Not required to fix the nav-sprawl problem, but genuinely distinguish this app from Huntr/Teal/Simplify given the "Recruiting OS" branding and the industrial direction already chosen.

| Pattern | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Literal "instrument panel" Overview — stat tiles as gauge-like readouts with mono digits (funnel counts, days-to-deadline countdowns, activity sparkline) instead of generic KPI cards | Every job-CRM competitor (Huntr, Teal, Simplify) uses soft consumer-app card grids for their dashboard home. A true "control panel" home screen is a real, ownable visual identity difference, not just a color swap | MEDIUM | Recharts is already wired (Overview funnel/donut/trend exist) — this is a restyle + reframing of existing chart real estate as "readouts," not new data work. |
| Global command bar that doubles as **Quick Capture entry point + fuzzy navigator + action executor**, not search-only | Goes beyond typical Cmd+K "jump to page" (Linear/Attio/Vercel) into "type anything, AI routes it" — since the app already built the AI action-routing backend for Quick Capture, this is a differentiator none of the job-CRM competitors have (they have no AI command bar at all) | MEDIUM-HIGH | Builds directly on the existing Quick Capture action router described in PROJECT.md's Validated list — extend its trigger surface, not its backend. |
| "Panel light" status iconography — small square/LED-style indicators instead of soft rounded pill badges, for stage/urgency/deadline | Reinforces the control-panel metaphor at the micro-interaction level; distinguishes from every competitor's rounded-badge convention | LOW | App already has `STATUS_COLOR`/`STAGE_COLOR` design tokens — this is a shape/rendering change to existing `Badge` primitives, not new state. |
| Dense, right-aligned log/ledger-style list rows as the default list style (not just tables) with trailing mono timestamps | A deliberate density bet none of Huntr/Teal (card-based, looser lists) make — reads as "engineer's tool," matching the "Recruiting OS" brand voice more than a consumer job app | LOW-MEDIUM | Mostly a shared list-row component + typography treatment; pairs with the mono-for-data table-stakes item above. |

### Anti-Features (Things to Deliberately NOT Do)

| Anti-Feature | Why It's Tempting | Why Problematic | Alternative |
|--------------|--------------------|--------------------|-------------|
| Adding a new top-level "Command Center" / "Attention" tab **alongside** the old Overview/Actions/Keep-in-Touch/Needs-Review surfaces | Feels like the safe, additive move — build the new thing, leave the old things in case they're still needed | Directly defeats the milestone's stated goal (net reduction from 15+ destinations); the whole value is that the unified feed *replaces* the 5 fragmented surfaces, not sits as a 9th destination on top of them | The merged Attention feed must delete/redirect Overview's nudge section, the standalone Actions tab, Keep in Touch's queue view, and TimelineFindsPanel — not add a new item while leaving those live |
| Building a full user-configurable "saved views" engine (arbitrary filters/columns like Attio's object-based view builder) | Attio and other reference CRMs support it, so it looks like the "complete" version of the views pattern | This is a data-modeling-level feature; PROJECT.md's Out of Scope explicitly rules out backend/schema restructuring this milestone, and it's disproportionate for what is currently a single-user (soon small-multi-tenant) tool | A fixed Kanban/Table/Calendar view switcher per entity is enough — ship that, not a configurable view builder |
| Copying Linear's or Raycast's typography literally (Inter everywhere) because they're the cited "industrial/precision" references | Both are the most-repeated "tight, precision-machined UI" examples in the research | The user's own global frontend-aesthetics directive explicitly forbids Inter as a generic default; copying it here would undercut the very "distinctive, not AI-slop" standard the reskin is meant to satisfy | Take Linear/Raycast's *density and restraint* lessons (tight line-height, negative tracking at display sizes, minimal border radius, subtle borders) but keep this app's own validated pairing: Space Grotesk (display) + IBM Plex Mono (data) — independently confirmed as a strong dashboard/AI-tool pairing in font research, not a downgrade |
| Removing the persistent sidebar in favor of command-palette-only navigation | The palette is positioned as the "future of navigation" in several sources, so it's tempting to go all-in | Every single reference product that has a command palette (Linear, Attio, Vercel, Raycast) *also* keeps a small persistent visible nav — the palette supplements power users, it doesn't replace discoverable structure for casual/mobile use. This app is used solo, often quickly, and has an existing mobile bottom-bar pattern that a keyboard-driven palette can't serve | Keep the collapsed 4-5-item sidebar/bottom-bar as the discoverable default; layer the command bar on top as an accelerator, not a replacement |
| Rebuilding every modal (Contact/Application/Job/LogInteraction) into the shared side-panel pattern in one pass | The end-state (one consistent DetailPanel) is clearly correct and it's tempting to do it all at once for consistency | High regression risk for a solo developer touching 4+ divergent modal implementations simultaneously, with no dedicated QA — a partial pass leaves the app in a confusing "some things are panels, some are modals" state for longer than necessary if scoped wrong | Sequence it: land the Kanban+Table view-switcher assuming a shared panel component from day one (build it once, correctly), then migrate the remaining modals into it as a deliberate follow-on step, not all four simultaneously |
| Literal skeuomorphic "gauge/dial" widgets, faux-metal textures, or drop-shadows mimicking physical control panels | "Industrial/control-panel" as a direction invites literal dashboard-instrument imagery | None of the actual production references (Linear, Vercel, Raycast, PostHog) achieve their "instrument panel" feel through skeuomorphism — it comes from typography, density, and restraint. Literal skeuomorphism is the AI-slop failure mode in the opposite direction: over-committing to a metaphor at the cost of usability and looking dated fast | Express "industrial" through mono digits, tight grids, subtle 1px structural borders, and sharp-not-rounded corners — not through rendering fake gauges or metal textures |

## Feature Dependencies

```
Collapsed top-level nav (4-5 destinations)
    └──enables/simplifies──> Command palette index (fewer destinations = simpler palette)

Shared record side-panel component
    └──required by──> Pipeline Kanban+Table+Calendar view-switcher (clicking a card must open one consistent panel, not per-view bespoke modals)

Unified Attention/Triage feed
    ──independent of──> Explore/Coverage/Discover funnel merge (both are consolidations of existing UI, don't block each other)

Design token pass (borders, mono-for-data, color/typography)
    └──should precede──> New shared components (DetailPanel, view-switcher, Attention feed)
                              (style once in the final system, don't skin components twice)
```

### Dependency Notes

- **Nav collapse enables the command palette:** a palette indexing 4-5 destinations plus records is simple; indexing the current 15+ destinations would itself need sub-grouping, so doing the collapse first makes the palette a smaller, cleaner build.
- **Side-panel component is a prerequisite for the Pipeline view-switcher:** if the Kanban/Table/Calendar views are built assuming three different detail-view implementations, that's the exact modal-sprawl problem being fixed, just relocated. Build the shared panel first (or concurrently, as one plan), then wire all three views to it.
- **Token pass should land early:** every new shared component (DetailPanel, Attention feed, view-switcher, command bar) should be built once against final design tokens rather than styled generically now and re-skinned later — matches PROJECT.md's requirement to visually verify against the industrial direction before any UI-facing phase is marked done.

## MVP Definition

Framed against this milestone's phase boundaries (IA consolidation + reskin only; backend/schema untouched per PROJECT.md's Out of Scope).

### Launch With (Core IA + Reskin)

- [ ] Collapsed top-level nav to ~4-5 destinations mirroring workflow (not feature inventory) — the literal ask, table stakes across every reference
- [ ] Unified Attention/Triage feed replacing Overview nudges + Actions tab + Keep in Touch queue + Job Boards Needs Review + TimelineFindsPanel — highest-value single consolidation, directly named in PROJECT.md
- [ ] Merged Explore→Coverage→Discover funnel as one destination with internal state/filters
- [ ] Design token pass: subtle 1px structural borders (not heavy rules), systematic mono-for-data application, tabular numerals on dense tables — all LOW-complexity, all foundational to the visual system every other component will be styled against

### Add After Validation (Once Core IA Is Stable)

- [ ] Shared record side-panel component, then migrate Contact/Application/Job/LogInteraction modals onto it one at a time
- [ ] Pipeline Kanban+Table+Calendar view-switcher (depends on the side panel existing)
- [ ] Global command bar extending Quick Capture's existing AI action router into full navigate+act palette

### Future Consideration (Polish, Once IA + Reskin Are Both Settled)

- [ ] Instrument-panel Overview micro-visualizations (gauge-style stat tiles) — differentiator, not required for the core problem
- [ ] Panel-light status iconography replacing rounded badges — pure polish, low risk to defer
- [ ] Dense ledger-style list rows as the app-wide default — nice-to-have density bet, easiest to layer in last since it touches the most surface area

## Feature Prioritization Matrix

| Pattern | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Collapsed 4-5 top-level nav | HIGH | LOW-MEDIUM | P1 |
| Unified Attention/Triage feed | HIGH | MEDIUM-HIGH | P1 |
| Merged Explore/Coverage/Discover funnel | HIGH | MEDIUM | P1 |
| Design token pass (borders, mono-for-data) | MEDIUM | LOW | P1 |
| Shared record side-panel | MEDIUM | MEDIUM | P2 |
| Pipeline Kanban+Table+Calendar view-switcher | MEDIUM | MEDIUM | P2 |
| Command palette / global bar | MEDIUM | MEDIUM-HIGH | P2 |
| Instrument-panel micro-visualizations | LOW-MEDIUM | MEDIUM | P3 |
| Panel-light status iconography | LOW | LOW | P3 |
| Ledger-style dense list rows app-wide | LOW-MEDIUM | LOW-MEDIUM | P3 |

**Priority key:**
- P1: Directly resolves the stated nav-sprawl/attention-fragmentation problem — should anchor early phases
- P2: Structural UI patterns that make the P1 consolidations coherent and extensible — natural next phases
- P3: Differentiating polish — sequence after P1/P2 are visually verified against the industrial direction

## Competitor Feature Analysis

| Dimension | Huntr | Teal | Simplify Copilot | This App's Approach |
|-----------|-------|------|-------------------|----------------------|
| Primary/anchor destination | Kanban Job Tracker (drag-and-drop stage columns) | "Job Tracker" tab, funnel stages as clickable filter chips at top of the same view | Single dashboard combining applications + referrals + notes + resumes | Pipeline as Kanban (default) + Table + Calendar views over one Applications object |
| Contacts/networking | Not a distinct top-level destination — folded into the tracker context | Networking CRM present but attached to tracker context, not a fully parallel nav tree | Referrals/contacts shown alongside jobs in the one dashboard, not separately | Network tab retained as one of the 4-5 destinations, but its 7 sub-views (Table/Cards/Graph/Keep in Touch/Coverage/Outbox/Discover) get folded into fewer views + the merged discovery funnel |
| Discovery/gap-analysis features | Not present as nav | Not present as nav | Not present as nav | Merge Explore+Coverage+Discover into one destination with internal state, matching how competitors keep this kind of feature contextual rather than a top-level tab |
| Utility tools (resume builder, autofill, reviews) | Separate destinations, clearly secondary to the tracker | Separate tools, clearly secondary to the tracker | Reached via Chrome extension / modal, not full top-level tabs | This app has no resume-builder equivalent; the analogous "secondary utility" entry points are Quick Capture and +Event, already handled as floating actions rather than tabs — validates keeping them that way |
| "What needs attention" surface | Not a distinct unified surface in available documentation | Reorder by follow-up date / excitement is a sort option within the tracker, not a separate destination | Not a distinct unified surface in available documentation | None of the three competitors expose a distinct "attention" destination — this app's planned unified Attention/Triage feed is more sophisticated than any direct competitor, closer to Linear Triage's model borrowed from developer tools rather than job-search tools |

## Sources

- [SaaS Navigation UX Patterns: Sidebar, Top Bar & Menu Design](https://www.saasui.design/blog/saas-navigation-ux-patterns)
- [A curated list of SaaS UI workflow patterns (GitHub gist)](https://gist.github.com/mpaiva-cc/d4ef3a652872cb5a91aa529db98d62dd)
- [Retool Blog — Designing Retool's Command Palette](https://retool.com/blog/designing-the-command-palette)
- [How to build a remarkable command palette (Superhuman)](https://blog.superhuman.com/how-to-build-a-remarkable-command-palette/)
- [You Should Be Adopting (Copying) Notion's UI for Your Software](https://dashibase.com/blog/notion-ui/)
- [Attio UI Design Examples - CRM UX Patterns (SaaSUI)](https://www.saasui.design/application/attio)
- [Introduction to navigating Attio (Attio Help Center)](https://attio.com/help/reference/attio-101/introduction-to-navigating-attio)
- [Understanding records (Attio Help Center)](https://attio.com/help/reference/attio-101/attios-data-model/understanding-records)
- [Linear design system — DESIGN.md + live preview (Open Design)](https://opendesigner.io/design-systems/linear-app)
- [Linear Design Tokens, Typography & CSS Variables (DesignMD)](https://designmd.cc/benchmarks/linear)
- [How we redesigned the Linear UI (part II)](https://linear.app/now/how-we-redesigned-the-linear-ui)
- [Raycast design system — Colors, Typography & Tokens](https://oh-my-design.kr/design-systems/raycast)
- [awesome-design-md — Raycast DESIGN.md (VoltAgent)](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/raycast/DESIGN.md)
- [Vercel Design System for React — Ink, Geist](https://www.shadcn.io/design/vercel)
- [Vercel Design Tokens, Typography & CSS Variables (DesignMD)](https://designmd.cc/benchmarks/vercel)
- [Dashboard Data Density Patterns: How Much Is Too Much](https://artofstyleframe.com/blog/dashboard-data-density-patterns/)
- [awesome-claude-design — PostHog DESIGN.md (data-dense)](https://github.com/rohitg00/awesome-claude-design/blob/main/design-md/data-dense/posthog.md)
- [Linear Triage: A Practical Guide to the Incoming Issue Queue](https://www.issuelinker.com/blog/linear-triage)
- [62 SaaS Side Panel UI Design Examples (SaaSFrame)](https://www.saasframe.io/patterns/side-panel)
- [Job Application Tracker & CRM (Huntr product page)](https://huntr.co/product/job-tracker)
- [Job Tracker (Huntr Help Center)](https://help.huntr.co/en/articles/9883324-job-tracker)
- [Your Huntr Dashboard (Huntr Help Center)](https://help.huntr.co/en/articles/10393367-your-huntr-dashboard)
- [Job Application Tracker — Track & Organize Your Job Search (Teal)](https://www.tealhq.com/tools/job-tracker)
- [Teal Review 2026: Walkthrough, Alternatives, and FAQs](https://jobright.ai/blog/teal-review-2026-walkthrough-alternatives-and-faqs/)
- [Simplify Copilot — Autofill Job Apps & AI Resumes](https://simplify.jobs/copilot)
- [Simplify Copilot Chrome Web Store listing](https://chromewebstore.google.com/detail/simplify-copilot-autofill/pbanhockgagggenencehbnadejlgchfc?hl=en)
- [Best fonts for dashboards (data-legible UI)](https://madegooddesigns.com/best-fonts-for-dashboards/)

---
*Feature research for: IA consolidation + industrial/control-panel visual reskin*
*Researched: 2026-08-15*
