# Hyperframes Composition Brief: Recruiting OS

## Objective
Short launch-style brag video for Recruiting OS.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: ~20 seconds

## Source Material
- Project root: `/Users/ethansaba/code/recruiter`
- Primary files read: `app/src/index.css` (theme tokens), `app/src/components/charts/theme.js` (exact status/graph colors), `app/src/components/NetworkGraphView.jsx` (graph mechanics), live demo at recruiting-os-phi.vercel.app
- Product name: Recruiting OS
- Tagline / strongest claim: "I got tired of manually tracking my own internship search, so I built an AI recruiting OS that reads my Gmail for me."
- Key UI/visual moments to recreate: Overview stat row (Contacts/Active Apps/Interviews/Offers), the Network Graph's glowing status-colored nodes and referral link.
- Copy that must appear verbatim: "Live demo · sample data", stat labels/numbers (7/7/1/1, "2 warm", "3 awaiting response", "Stripe", "Ramp"), status legend labels (🟢 Warm, 🟡 Cooling, 🔴 Cold, ⭐ Champion, ✅ Closed).

## Creative Direction
- Tone preset: `default`
- Creative direction: serious engineering, scrappy personal-origin hook
- Angle: mirrors the product's own light-app / dark-graph two-register design
- Hook: wordmark + hook line on light canvas
- Outro: hook claim resettles, credit line
- Avoid: generic SaaS language, abstract filler, inventing UI not in the real product

## Visual Identity
Light register: canvas `#fbf9f5`, ink `#16171d`→`#f6f6f7`, accent `#f2994a`/`#e17f26`, success `#3c9a46`, warning `#d9a02b`, danger `#c94a4a`. Display: Space Grotesk. Body: Public Sans. Mono: IBM Plex Mono.
Dark graph register: surface `#16171d`, node neutral `#d3d3d7`, label `#b0b0b7`, link thread `#e9e9eb` low-alpha, status colors unchanged, referral link `#e17f26`.

## Storyboard
Full storyboard in `brag-output/brag-plan.md`. Scene summary:
1. Hook — 3s — wordmark + hook line, light canvas
2. Overview stats — 5s — real stat row + funnel shape
3. Network Graph payoff — 9s — register-punch to dark graph canvas, nodes glow in by status, referral link (Marcus Chen → Devon Park) lights up beat-locked to 16.02s
4. Outro — 3s — back to light canvas, hook claim resettles + credit

## Audio
See `brag-plan.md` Audio direction section — `happy-beats-business-moves-vol-1-by-ende-dot-app.mp3`, beat-lock the referral-link light-up to the track's strong cue at 16.02s, subtle audio-reactive glow on graph nodes only, no visualizer graphics.

## Hyperframes Instructions
Load `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`, `hyperframes-cli`. Show real UI/copy from the source above. Keep all text readable. 15-25s total. Run `hyperframes check` before render.
