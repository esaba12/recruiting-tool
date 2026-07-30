# Brag Plan: Recruiting OS

## The 9-question rubric

1. **What is the app?** A near zero-touch recruiting operating system — a Notion-backed contact CRM with a React dashboard, plus AI pipelines that watch Gmail for recruiting emails and auto-extract contacts/applications/interview events with Claude. Live demo at recruiting-os-phi.vercel.app.
2. **Funniest/most impressive claim:** Built real production-grade security (RLS, AES-256-GCM encrypted BYOK keys, JWT-verified proxy) just to manage one internship search — the irony is the hook.
3. **Visual hook:** The Network Graph — a self-contained dark canvas where contact nodes glow by relationship status and referral links light up in accent orange, described in the app's own code comments as a "synapse glow."
4. **What to show from the UI:** Real Overview stat row (Contacts 7, Active Apps 7, Interviews 1 · Stripe, Offers 1 · Ramp) and the real Network Graph with its real status-color legend and a real referral chain (Devon Park referred by Marcus Chen).
5. **Shortest satisfying video:** ~20s — hook, stats, graph payoff, outro.
6. **Tone:** preset `default` — confident, clean, postable; direction: "serious engineering with a scrappy personal-origin hook."
7. **Audio:** `happy-beats-business-moves-vol-1-by-ende-dot-app.mp3` — this track's strong-cue cluster starts around t=16s (its build releases late), which conveniently lines up with our graph-reveal payoff scene rather than the early hook.
8. **Share caption:** "I got tired of manually tracking my own internship search, so I built an AI recruiting OS that reads my Gmail for me. Real Notion CRM, real referral graph, real Claude-powered email pipeline."
9. **User flow worth showing:** entry (Overview stat row) → key action (the graph revealing the real network) → result (a real referral link lighting up — proof the relationship data is real, not decorative).

## The angle

The video mirrors the product's own two-register design: a light "canvas" app register for the Overview stats, and a hard cut into the app's own intentional dark "graph canvas" register for the network payoff — the same dark-island treatment the app's own code comments describe. The hook leans into the honest origin story (built for one person's own job search) before the visuals prove the engineering is real.

## Hook (first 2-3s)
Light canvas (`#fbf9f5`), Space Grotesk wordmark "Recruiting OS" settles, eyebrow "Live demo · sample data" (real product copy), then the hook line types/settles: "I got tired of manually tracking my own internship search, so I built an AI recruiting OS that reads my Gmail for me."

## Key moments (the middle)
- Real Overview stat row: Contacts 7 ("2 warm"), Active Apps 7 ("3 awaiting response"), Interviews 1 ("Stripe"), Offers 1 ("Ramp") landing in sequence, cutting to a compact Application Funnel shape.
- Hard register-punch into the dark Network Graph canvas (`#16171d`). Nodes glow in one by one, colored by real status (warm green, cooling yellow, cold red, champion orange, closed gray), company nodes neutral gray. The real Marcus Chen → Devon Park referral link lights up in accent orange as the payoff, beat-locked to the track's own strong cue at 16.02s.

## Outro / punchline
Cut back to the light canvas. Hook line's core claim resettles as a closing statement, credit line beneath.

## Tone
- Preset: `default`
- Creative direction: "serious engineering, scrappy personal-origin hook — confidence comes from showing the real graph and real numbers, not hype language."
- Interpretation: clean fast cuts, Space Grotesk for display moments, Public Sans/IBM Plex Mono for data, one hard register-punch (light → dark graph canvas) as the structural pivot.

## Format: landscape — 1920x1080
## Duration: ~20s

## Visual identity (from the project)
**Light/app register:** canvas `#fbf9f5`; ink scale `#16171d`(900)…`#f6f6f7`(50); accent `#f2994a`/`#e17f26`; success `#3c9a46`; warning `#d9a02b`; danger `#c94a4a`. Display: Space Grotesk. Body: Public Sans. Mono: IBM Plex Mono.
**Dark graph register:** surface `#16171d`; node neutral `#d3d3d7`; label text `#b0b0b7`; link thread `#e9e9eb` at low alpha; status colors unchanged (warm `#3c9a46`, cooling `#d9a02b`, cold `#c94a4a`, champion `#f2994a`, closed `#86868f`); referral links `#e17f26`.

## Share copy (draft)
I got tired of manually tracking my own internship search, so I built an AI recruiting OS that reads my Gmail for me. Real Notion CRM, real referral graph, real Claude-powered email pipeline.

## Audio direction
- Role: confident, clean bed under the whole video; the graph payoff gets the one beat-lock
- Music: `happy-beats-business-moves-vol-1-by-ende-dot-app.mp3`
- Music treatment: enters at 0.3 under the hook, stays present through Overview, holds through the graph build-in, and the referral-link light-up locks to the track's strong cue at **16.02s** (`// beat-locked: 16.02s`) — the track's own build genuinely lands there. Fades for the outro.
- Music cue guidance: bundled preset `assets/music/cues/happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.json`. Strong-cue cluster starts ~16s; nothing usable earlier, so only the late payoff is beat-locked — early scenes use natural timing.
- SFX posture: soft interface ticks on stat-card arrivals; one `drop_001` on the register-punch (loudest cut); node glow-ins get subtle individual accents; the referral-link light-up gets `impactSoft_medium_000` layered under the beat-locked moment; outro gets one restrained settle accent.
- Audio-reactive treatment: subtle — graph node halo brightness may breathe faintly with RMS during the graph scene only; no waveform/equalizer graphics.
