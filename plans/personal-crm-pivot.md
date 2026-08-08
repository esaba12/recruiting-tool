# Recruiting OS → Personal CRM & Networking Tracker: Pivot Research

**Status:** Research complete, no code changed. Written in worktree `personal-crm-pivot-research` (independent of the concurrent `network-hub-research` worktree — see note at bottom).
**Date:** 2026-08-07/08

## The core finding

This codebase is closer to "general personal CRM with a recruiting module bolted on" than it looks from the outside. The relationship-intelligence layer — `interactions`, `calls`, `affinity.js`, `keepInTouch.js`, `networkGraph.js` — is **already domain-agnostic in its mechanics**. What makes the app feel recruiting-only is concentrated in a small number of places: hardcoded vocabularies (`ROLE_OPTIONS`, `AFFINITY_OPTIONS`), one hardcoded persona string injected into every AI prompt, a `target_companies` localStorage key standing in for a more general "who am I underinvested in" concept, and a flat nav/Overview/Actions layout with no module boundary. None of that is deep — it's the kind of thing that's expensive to *notice* but cheap to fix once mapped.

The market research reinforces this is the right kind of pivot to attempt (vertical → same-user-more-use-cases is the lower-risk expansion direction per the "wedge and expand" literature), and surfaces one clear structural upgrade worth making while we're in here: generalizing the single `referred_by_id` self-relation into a typed, directed relationship graph (Monica's model) — which would upgrade three features at once (multi-context contacts, the Graph tab, and a new warm-intro path-finder) for one schema change.

---

## Part 1 — Codebase audit: what's generic vs. recruiting-specific

### (A) Already generic, reusable as-is
- `interactions` and `calls` tables (`supabase/migrations/20260723000000_init.sql`) — no recruiting fields.
- `db.js`'s `addInteraction`/`fetchInteractions`.
- `lib/networkGraph.js` — structural graph builder, only the "works-at" edge label is recruiting-flavored.
- `lib/affinity.js`'s `tieStrengthBucket`/`affinityScore` — math only keys on interaction count + tag count.
- `lib/keepInTouch.js` — the inverted-U cadence engine (moderate ties get tightest interval) is fully generic and, per the market research, is a genuinely well-grounded design already validated by Granovetter/Contactually precedent.
- `KeepInTouchTab.jsx` — copy is already relationship-neutral.
- `lib/discoveryScheduler.js` — cooldown/budget/priority scheduling mechanism is domain-agnostic; only what it's scheduling (target companies) is recruiting-specific.

### (B) Generic shape, recruiting-flavored naming/defaults (cheap to fix)
- `contacts.status`, `contacts.affinity`, `contacts.referral_status`, `contacts.is_school_alum` — structurally fine, named for recruiting.
- `shared.jsx`'s `ROLE_OPTIONS` (`SWE/PM/Recruiter/Alumni/Referral/Other`), `SOURCE_OPTIONS`, `AFFINITY_OPTIONS` (hardcodes `'UMich'` into a shared constant) — need to become free-text or per-module configurable vocab.
- `lib/drafting.js:27` — `const student = 'a CS student targeting SWE internships'` is interpolated into **every** AI-drafted message app-wide (cold-opens, follow-ups, from Actions/Coverage/Discover). Biggest single "this is clearly a recruiting tool" tell in the AI layer.
- `LogInteractionModal.jsx` extraction prompts hardcode the same persona + force role-type into recruiting buckets.
- `profiles.school/grad_year/focus` shown to every user in Settings regardless of whether they touch recruiting.
- The `isUMichAlum` ↔ `'UMich'` affinity-tag sync — one recruiting-era special case wired into the schema (`is_school_alum` column) and touched in 7+ files, instead of being just another generic tag.

### (C) Structurally recruiting-specific — keep as their own module
- `applications` table + `PipelineTab`, `ApplicationDetailModal`, `DuplicatesPanel`.
- All of `components/jobBoards/*`, `lib/deadlines.js`, `scripts/email-pipeline.js`.
- `lib/companyFinder.js`, `ExploreTab.jsx`, `CompanyOnboarding.jsx`, `lib/ycDirectory.js`.
- These have no generic-CRM analog and shouldn't be forced into one — they're the recruiting module, full stop.

### (D) Entangled — the actual blockers to a clean pivot
1. **`App.jsx`'s `AppInner`** — one flat tab list and one root `counts` object mix recruiting (`explore`, `pipeline`) and generic (`overview`, `network`, `actions`) tabs with no module boundary to peel apart.
2. **`Sidebar.jsx`'s `NAV_ITEMS`** — a linear array with no grouping metadata; also hardcodes the title "Recruiting OS" and subtitle "Fall 2026" everywhere.
3. **`OverviewTab.jsx`** — a non-recruiting user permanently sees a broken-looking "Application Funnel" card with "No applications yet. Add them in Notion..." (stale copy too — the app hasn't used Notion since July).
4. **`ActionsTab.jsx`** — one undifferentiated queue merges generic follow-ups with recruiting-only stale-application nagging, no seam to omit the recruiting half.
5. **`lib/discovery.js`'s `roleCategory()`** — a job-title regex classifier reused by `enrichment.js` for *any* contact enrichment, including "add someone I already know." There is no "friend/family" bucket — everything non-career falls into `'Other'`. Adding your cousin runs them through a career classifier.
6. **`DEFAULT_PROFILE`/`affinityTagsFor`** — the only background/affinity signal model in the app is career-shaped (university, past employers, programs). A childhood friend has no signal model at all outside these fields.
7. **`rec_target_companies` localStorage key** — read/written by `ReferralCoverageTab`, `DiscoverTab`, and `ExploreTab` alike. "Target companies" is the entire substrate Coverage and Discover are built on; there's no generic "segment I'm underinvested in" concept underneath it.
8. **`profiles` table** bakes `school/grad_year/focus` onto the one row every signed-up user gets, not module-scoped.

Full file:line detail from the audit agent is preserved in this session if you want to drill into any specific item before scoping a phase.

---

## Part 2 — What the market already solved

- **No mainstream personal CRM forces a single category on a contact.** Clay, Dex, folk, Monica, and every Notion/Airtable template use many-to-many tags instead of a mutually-exclusive type. **folk's pattern is the cleanest fit here**: don't add a forced category to the schema — add a flexible multi-select "life domain" tag dimension, and let *views* (à la Coverage/Discover today) filter by it. Requires no migration of existing recruiting data.
- **Monica's contact-to-contact relationship model** generalizes exactly the piece this app already has a primitive version of (`applications.referred_by_id`) into a typed, directed graph (`X is-a-mentor-of Y`, `X referred Y to Company`, `X is-a-college-friend-of Y`). This single change would upgrade the Graph tab, unlock genuine multi-context contacts, and make a warm-intro path-finder (a well-established separate product category — Draftboard, Affinity, LinkedIn TeamLink) a straightforward weighted-shortest-path query over data the Graph tab already renders.
- **Streak (Gmail CRM) is the strongest architectural precedent for "recruiting stays a full module, not a bolt-on."** Streak's actual product is one generic pipeline/stage engine, configured differently per vertical (sales, recruiting, fundraising, real estate) with none privileged as "the" use case. The schema-level version of that here: generalize `applications`'s stage engine into a reusable `pipeline_items`-style model with "Job Applications" as the first built-in template — not required for a first pass, but the right end-state if more pipeline-shaped features show up later (e.g. tracking grad-school apps, or a personal project pipeline).
- **This app's LinkedIn-compliance stance (Exa public-search only, never scrape) is already stricter than at least one named mainstream competitor** (Dex openly scrapes LinkedIn without API approval, per its own docs) — worth stating as a real differentiator in any general-audience positioning, not just an internal engineering constraint.
- **Cautionary precedent, both directions:** Cloze pivoted hard into real estate and visibly starved its general-CRM users; Contactually — architecturally the closest historical analog to this app's Keep-in-Touch cadence engine — didn't survive as an independent horizontal product and was absorbed into a real-estate-specific tool. The lesson for a solo-maintained app: "recruiting stays first-class" needs to be an active choice each time the general side gets new features, not just a promise the code won't be deleted.
- **The `/demo` route's mode-based nav trimming already is the mechanism needed for a persona toggle.** `DEMO_NAV_ITEMS` and configurable `navItems`/`views` props on `Sidebar.jsx` are exactly what a "recruiting-focused vs. general-CRM-focused" default view needs — this is a config/reuse job on infrastructure that already exists, not new infrastructure.

---

## Part 3 — Proposed direction

**Framing:** don't "add a personal CRM to the recruiting app." Flip which one is the trunk. The trunk is: contacts, relationships, interactions, reconnect cadence. Recruiting (Pipeline, Job Boards, Explore, Coverage/Discover-as-scoped-to-companies) becomes **one full-featured module hanging off the trunk**, not diminished, just no longer the frame the whole app is presented in.

### Phase 1 — De-couple the AI/vocabulary layer (low risk, unblocks everything else)
- Pull the hardcoded persona (`lib/drafting.js`'s `const student = ...`) out into `profiles`, made optional, used only when drafting messages in a recruiting context.
- Turn `ROLE_OPTIONS`/`AFFINITY_OPTIONS`/`SOURCE_OPTIONS` into either free-text or a small default vocabulary that includes non-career buckets (Friend, Family, Mentor, Neighbor, Community) alongside the existing recruiting ones.
- Generalize the `isUMichAlum` special case into "shared background tag N of M" instead of a hardcoded schema column — remove the 7-file special-case sync.
- Fix the stale "Add them in Notion" copy while touching these files anyway.

### Phase 2 — Add a life-domain dimension to contacts (folk pattern)
- Add a multi-select `life_domains`/`contexts` tag on `contacts` (Professional/Recruiting, Friend, Family, Mentor, Community, Other) — additive migration, doesn't touch existing recruiting fields.
- `Network` becomes the true top-level hub for *all* relationships; recruiting contacts are just contacts tagged `Recruiting` (or auto-tagged when linked to an application).
- Give `Overview` and `Actions` a seam: render the recruiting-specific cards/queues only when the user has recruiting contacts/applications, instead of unconditionally.

### Phase 3 — Generalize the relationship graph (Monica pattern)
- New `contact_relationships` table: `(contact_id, related_contact_id, relationship_type, note, created_at)`, directed and typed.
- Migrate `applications.referred_by_id` into this as one relationship type among several (`referred_me_to`), keep the FK working for backward compat or a thin view.
- `NetworkGraphTab` renders edge types distinctly (already has the rendering surface — this is a data-source change, not a new visualization).
- This unlocks a **fourth Network view: "Path"** — given a target person or company, shortest weighted path through your own relationships to get there. New feature, but nearly free once the graph is typed.

### Phase 4 — Nav/IA restructure + persona onboarding
- Add grouping metadata to `Sidebar.jsx`'s nav (Network hub vs. Recruiting module vs. Settings), reusing the `/demo` mode-trimming mechanism rather than new infra.
- Rebrand the app shell copy generically ("Recruiting OS" title, "Fall 2026" subtitle) — recruiting module keeps its own recruiting-flavored copy inside itself.
- Optional: a 2-question onboarding ("What brings you here — job search, general networking, or both?") that sets which module is shown first, mirroring the persona-based-onboarding pattern from the research.

**Sequencing note:** Phases 1–2 alone would already make "add a friend, get a smart reconnect nudge, log a coffee chat" feel completely natural without touching recruiting at all. Phase 3 is the highest-leverage *new* capability but is also the most schema-invasive — worth doing as its own reviewed migration, not bundled with the cosmetic phases.

---

## Decisions (2026-08-07)
1. **Nav visibility:** always both visible — one unified nav, no hide-recruiting toggle. Phase 4's nav grouping work is about organizing sections, not gating them.
2. **Relationship graph (Phase 3):** deferred. Ship Phases 1–2 first; the typed `contact_relationships` graph + warm-intro path-finder becomes its own follow-up plan once the trunk (life-domain tags, de-hardcoded vocab/persona) is in.
3. **Rebrand naming:** not yet. Keep "Recruiting OS" as the placeholder title through this pivot; revisit copy once functionality lands so nothing gets thrown away mid-decision.

**Net effect on scope:** this plan now targets **Phases 1–2 only** — de-couple the hardcoded recruiting vocabulary/AI persona, then add a multi-select life-domain tag to `contacts` and give Overview/Actions a seam so non-recruiting activity doesn't sit next to a permanently-empty Application Funnel card. Phases 3–4 (relationship graph, nav restructure, rebrand) are explicitly out of scope until revisited.

---

*Note on the concurrent `network-hub-research` worktree: per your instruction this was done as an independent take without inspecting its in-progress files. Worth diffing the two once that session lands, in case it converged on a similar or complementary plan.*
