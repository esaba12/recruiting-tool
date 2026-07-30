# Video Brief: Recruiting OS

## Research (from source + live demo)

- **Directory:** `/Users/ethansaba/code/recruiter` (package name `recruiting-os`, remote `esaba12/recruiting-tool`). Live demo confirmed at `https://recruiting-os-phi.vercel.app/demo` — banner reads "Live demo · sample data," with a real "Sign up free" CTA and "Changes reset on reload."
- **Real palette** (`app/src/index.css` `@theme`): canvas `#fbf9f5` (light app bg), ink scale (`ink-900 #16171d` sidebar/dark surface, `ink-50 #f6f6f7` sidebar text, `ink-300/400` secondary text), accent orange (`accent-500 #f2994a`, `accent-600 #e17f26`), success green `#3c9a46`, warning yellow `#d9a02b`, danger red `#c94a4a`.
- **Real fonts:** Space Grotesk (heading), Public Sans (body), IBM Plex Mono (mono/labels).
- **Real Overview data** (from the live demo, `app/src/components`): stat cards — Contacts 7 ("2 warm"), Active Apps 7 ("3 awaiting response"), Interviews 1 ("Stripe"), Offers 1 ("Ramp"). Application Funnel: Wishlist 0 → Applied 1 (300%) → Phone Screen 3 (33%) → Technical 1 (0%) → Onsite → Offer. "Needs Attention" list includes real-feeling sample entries (Amara Osei @ Vercel, Marcus Chen @ Notion, Priya Shah @ Stripe).
- **Real Network by Status breakdown:** 🟢 Warm 2, 🟡 Cooling 2, 🔴 Cold 1, ✅ Closed 1, ⭐ Champion 1 — across 7 contacts / 7 companies.
- **Real Network Graph** (`components/NetworkGraphView.jsx` + `components/charts/theme.js`): a self-contained **dark canvas** (`GRAPH_SURFACE_DARK = #16171d`) distinct from the rest of the light app — an intentional "dark island," same idea as the sidebar. Contact nodes are colored by `STATUS_CHART_COLORS` (the exact hexes above); company nodes are neutral `ink-200 #d3d3d7`. Every node gets a soft radial "halo" glow (`ctx.shadowBlur`) — described in the code comment as "the synapse glow." Node size scales with connection degree (more-linked = bigger, "like Obsidian's graph"). "referred-by" links render in accent orange (`#e17f26`); ordinary "works-at" links are faint ink-100 threads at low alpha — "a quiet connective web, not grid lines." Real referral chain in the sample data: Devon Park @ Ramp was referred by Marcus Chen @ Notion.
- **Origin story** (from `CLAUDE.local.md`, gitignored/never published): built by the user to run his own Fall-2026 internship search near-zero-touch, later generalized to multi-tenant BYOK. The engineering (RLS, AES-256-GCM encrypted keys, JWT-verified proxy) is legitimately production-grade for something that started as a personal tool.

## Tone / hook

- Tone: serious engineering, but leaning into the scrappy/personal origin as the hook — the irony of building real infrastructure to manage one job search.
- Hook: **"I got tired of manually tracking my own internship search, so I built an AI recruiting OS that reads my Gmail for me."**
- Secondary line (real product copy, can reinforce mid-video): "Live demo · sample data."

## Show-the-thing (non-negotiable visual sequence)

1. Light-canvas hook scene — wordmark + hook line (Space Grotesk).
2. Real Overview stat row: Contacts 7 / Active Apps 7 / Interviews 1 · Stripe / Offers 1 · Ramp, cutting into the Application Funnel shape.
3. **The Network Graph** — the single most distinctive visual in the product. Punch from the light canvas into the dark `#16171d` graph register; nodes glow in by status color (warm green, cooling yellow, cold red, champion orange, closed gray), company nodes neutral gray, and the real Marcus Chen → Devon Park referral link lights up in accent orange as the payoff beat.
4. Outro — hook line resettles, credit line.

## Format / duration

Landscape, ~19-20s. Beats: Hook 3s → Overview 5s → Network Graph reveal 8s (needs the most room — it's the payoff) → Outro 3s.

## Next step

Run `/brag` from `/Users/ethansaba/code/recruiter`, feeding it this brief as creative direction. No live screenshots needed — all colors/data/mechanics above were pulled directly from `app/src/index.css`, `components/charts/theme.js`, and `components/NetworkGraphView.jsx`, plus the live demo's real sample data at `/demo`.
