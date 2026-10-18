import { lazy, Suspense } from 'react'

// Recharts (+ redux toolkit, immer, decimal.js) is the biggest thing in the bundle, and
// Today renders charts below the fold, so chart consumers import these instead of the
// wrappers directly (v1.3 spec 09). Each fallback reserves the chart's own box, so
// nothing shifts when the chunk lands. All four share one chunk.
const loadBar = () => import('./BarChart.jsx')
const loadDonut = () => import('./DonutChart.jsx')
const loadTrend = () => import('./TrendChart.jsx')
const loadSankey = () => import('./SankeyChart.jsx')

function withFallback(load, defaultHeight, box) {
  const Chart = lazy(load)
  return function LazyChart(props) {
    const height = props.height ?? defaultHeight
    return (
      <Suspense fallback={<div aria-hidden style={box(height, props)} />}>
        <Chart {...props} />
      </Suspense>
    )
  }
}

export const BarChart = withFallback(loadBar, 200, h => ({ height: h }))
export const DonutChart = withFallback(loadDonut, 200, h => ({ height: h }))
export const TrendChart = withFallback(loadTrend, 180, h => ({ height: h }))
export const SankeyChart = withFallback(loadSankey, 300, (h, p) => ({ height: h, minWidth: p.minWidth ?? 600 }))

export function preloadCharts() {
  return Promise.all([loadBar(), loadDonut(), loadTrend(), loadSankey()])
}
