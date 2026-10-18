import { useMemo } from 'react'
import { buildApplicationFlow, flowSummary, GHOST_DAYS } from '../lib/applicationFlow.js'
import { SankeyChart } from './charts/lazy.jsx'
import Mono from './ui/Mono.jsx'

// Headline numbers + the outcome Sankey. Shared by Pipeline → Sheet (where clicking a
// band filters the grid) and Today (read-only, links through to the Sheet).
export default function ApplicationFlowPanel({ apps, onSelect, selectedLabel, height = 280, footer }) {
  const flow = useMemo(() => buildApplicationFlow(apps), [apps])
  const s = useMemo(() => flowSummary(flow), [flow])

  if (!flow.total) {
    return <p className="text-sm text-ink-400 py-6">Nothing applied to yet — the flow fills in as applications leave Wishlist.</p>
  }

  const stats = [
    ['Applied', s.applied],
    ['Heard back', `${s.responseRate}%`],
    ['Interviewed', s.interviewed],
    ['Offers', s.offers],
    ['Rejected', s.rejected],
    ['Ghosted', s.ghosted],
  ]

  return (
    <div>
      <dl className="flex flex-wrap gap-x-6 gap-y-2 mb-3">
        {stats.map(([label, v]) => (
          <div key={label}>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">{label}</dt>
            <dd><Mono className="text-lg font-semibold text-ink-900">{v}</Mono></dd>
          </div>
        ))}
      </dl>
      <SankeyChart flow={flow} height={height} onSelect={onSelect} selectedLabel={selectedLabel} />
      <p className="mt-2 text-[11px] text-ink-400 flex flex-wrap gap-x-3">
        <span>Ghosted = still open with no activity for {GHOST_DAYS}+ days.</span>
        {flow.estimated > 0 && (
          <span><Mono>{flow.estimated}</Mono> of <Mono>{flow.total}</Mono> paths are estimated from the current stage (history before tracking started).</span>
        )}
        {footer}
      </p>
    </div>
  )
}
