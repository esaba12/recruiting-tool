import { STATUS_COLOR, isUntriaged } from '../../shared.jsx'
import { funnelConversions, weeklyTrend } from '../../lib/attention.js'
import { BarChart, DonutChart, TrendChart } from './lazy.jsx'
import { useChartTheme } from './theme.js'

// Full-size versions next to the Sankey they explain: the funnel on Pipeline → Sheet → Flow,
// the network status donut and weekly trend on Network → Flow. Today shows compact ones in
// its metric cards (today/MetricCards.jsx).

const FUNNEL_BARS = ['Wishlist', 'Applied', 'Phone Screen', 'Technical', 'Onsite', 'Offer']

export function ApplicationFunnel({ apps }) {
  const triaged = (apps || []).filter(a => !isUntriaged(a))
  if (!triaged.length) return null
  const stageCounts = {}
  triaged.forEach(a => { stageCounts[a.stage] = (stageCounts[a.stage] || 0) + 1 })
  const data = FUNNEL_BARS.map(stage => ({ label: stage, value: stageCounts[stage] || 0 }))
  // Cumulative reached-stage conversion (see funnelConversions): raw per-stage counts can exceed 100%.
  const conversions = funnelConversions(triaged)
  return (
    <div className="pb-3 mb-3 border-b border-ink-200">
      <h3 className="text-xs font-semibold text-ink-500 mb-3">Application Funnel</h3>
      <BarChart data={data} height={180} />
      {conversions.length > 0 && (
        <p className="text-xs text-ink-400 mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {conversions.map(c => (
            <span key={c.to}>{c.from} → {c.to}: <span className="font-medium text-ink-600">{c.pct}%</span></span>
          ))}
        </p>
      )}
      {(stageCounts.Rejected || stageCounts.Accepted) && (
        <p className="text-xs text-ink-400 mt-2">
          {[stageCounts.Rejected && `${stageCounts.Rejected} rejected`, stageCounts.Accepted && `${stageCounts.Accepted} accepted`].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  )
}

export function NetworkCharts({ contacts, interactions }) {
  const chartTheme = useChartTheme()
  const donutData = Object.keys(STATUS_COLOR)
    .map(status => ({ label: status, value: contacts.filter(c => c.status === status).length, color: chartTheme.status[status] }))
    .filter(d => d.value > 0)
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 mt-4 border-t border-ink-200">
      <div>
        <h3 className="text-xs font-semibold text-ink-500 mb-3">Network by Status</h3>
        {contacts.length === 0
          ? <p className="text-sm text-ink-400">No contacts yet.</p>
          : <DonutChart data={donutData} centerLabel="contacts" />}
      </div>
      <div>
        <h3 className="text-xs font-semibold text-ink-500 mb-3">Networking Activity</h3>
        {interactions.length === 0
          ? <p className="text-sm text-ink-400">No logged interactions yet. Use "+ Log Interaction" above.</p>
          : <TrendChart data={weeklyTrend(interactions)} />}
      </div>
    </div>
  )
}
