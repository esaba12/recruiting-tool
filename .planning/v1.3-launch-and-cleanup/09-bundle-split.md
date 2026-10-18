# 09 — Split the bundle by tab

**Who:** 🤖. **Needs from owner:** nothing. **Status:** done on `feat/bundle-split` (2026-10-18); results at the bottom.

## Why

`vite build` emits one JS file: `index-*.js`, **1,985 KB min / 585 KB gzip** (measured
2026-10-18). Every visitor downloads Learn, Job Boards, the force graph and all of Recharts
before Today paints, including `/demo` visitors from a shared link.

Biggest contributors (source bytes from the sourcemap, so relative, not exact):

| Piece | ~KB | Who needs it |
|---|---|---|
| `recharts` (+ redux toolkit, immer, es-toolkit, decimal.js-light, react-redux) | ~1,180 | Today's charts, Pipeline Sankey, Learn widgets, Job Boards stats |
| `motion` | 493 | Today's page-load stagger (one of the 3 animation moments) |
| `@supabase/*` | ~790 | everything (auth gate) |
| `src/lib/learning` + `src/components/learning` + `ts-fsrs` | ~260 | Learn only |
| `force-graph` + `bezier-js` + `@tweenjs/tween.js` + `tinycolor2` | ~185 | Network → Graph view only |
| `src/components/jobBoards` | 64 | Pipeline → Job Boards only |

Today itself imports Recharts (`BarChart`, `DonutChart`, `TrendChart` via `components/charts/`),
so lazy tabs alone won't take Recharts off the landing path. The charts need their own boundary.

## Changes

1. **Lazy tabs.** In `App.jsx`, `React.lazy` every tab except Today: `NetworkGraphTab`,
   `GrowTab`, `PipelineTab`, `InboxTab`, `LearnTab`, `CalendarTab`, `OutboxTab`, `SettingsTab`.
   Both `AppInner` and `DemoApp` render them, so wrap each tab body in one `<Suspense>` with a
   quiet fallback (the existing loading style, not a spinner flash: delay it ~150 ms).
   - `PipelineTab.jsx` also exports `DEMO_PIPELINE_VIEWS` and `pipelineViewsFor`, which
     `App.jsx` uses eagerly. Move them to `components/pipelineViews.js` so the import doesn't
     defeat the split.
   - Check the other lazy candidates for named exports `App.jsx` imports the same way.
2. **Lazy charts.** `components/charts/*.jsx` keep their default exports. Add
   `components/charts/lazy.js` exporting `React.lazy` wrappers, and have the chart *consumers*
   (TodayTab, NetworkingFlowPanel, ApplicationFlowPanel, learning widgets, RepoStats) import from
   there. The fallback is a block of the chart's own height, so nothing shifts when it loads.
3. **Lazy graph.** `NetworkGraphView` (the only `react-force-graph-2d` importer) lazy-loads
   inside the Network tab, so Network → Table doesn't pay for it.
4. **Idle prefetch.** After Today's first paint, `requestIdleCallback` (with a `setTimeout`
   fallback for Safari) calls the tab `import()`s, so switching tabs stays instant on a
   warm session. Nothing prefetches during the auth or onboarding screens.
5. **Vendor chunk.** `build.rollupOptions.output.manualChunks`: put `react`/`react-dom` and
   `@supabase/*` in a `vendor` chunk, so app-code deploys don't invalidate them. Leave the rest
   to Rollup.

**Not touching:** `motion` stays eager (it's in Today's first paint). Sentry stays as is.

## Checks

- **Numbers.** Record the before/after `vite build` table in the PR. Target: the entry chunk
  (what Today needs) is at least 40% smaller than 1,985 KB min, and the 500 KB warning is
  gone or applies only to the `vendor` chunk.
- **CSP.** The prod CSP's `script-src` must allow same-origin chunks (it should, via `'self'`).
  Verify on a Vercel preview deploy, not just `npm run dev`: dev doesn't chunk.
- **Browser, `/demo` and signed in:** open every tab and sub-view cold (hard reload on that
  tab), and confirm no blank flash longer than the fallback and no console errors. Throttle to
  "Fast 4G" once to see the fallbacks are tidy.
- `npm test && npm run build`. No unit tests: this is build config and import wiring.

## Done when

The PR shows the before/after table, every tab loads cold on a preview deploy, and the build
warning is gone or explained.

## Result (2026-10-18)

| | Before | After |
|---|---|---|
| Entry `index-*.js` | 1,985 KB (585 gzip) | 497 KB (154 gzip) |
| `vendor-*.js` (react, supabase) | in entry | 357 KB (101 gzip) |
| **What Today downloads** | **1,985 KB (585 gzip)** | **853 KB (255 gzip), −57%** |
| Build warning | yes | none |

Beyond the plan: the Network table (`@tanstack/table`, 136 KB src), the three quick-add
modals and the onboarding wizard are lazy too, and animated elements moved to `m.*` under
`<LazyMotion>` with the features loaded async (`lib/motionFeatures.js`). `Reorder` in Learn's
CustomizePanel still uses full `motion`, which now lives in the Learn chunk.

Checked on `vite preview` (the prod build) at `/demo`: every tab and sub-view (Network
Table/Cards/Graph/Flow, Pipeline Applications/Sheet) renders, the idle prefetch loads all
chunks, the side panel animates, and the console is clean (only the preview's missing favicon).
**Not checked:** the signed-in-only tabs (Grow, Settings, Outbox, Job Boards) render through the
same lazy wrappers, but they need a session; check them on the Vercel preview, along with the CSP.
