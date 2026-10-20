import { STATUS_COLOR, isUntriaged } from '../../shared.jsx'
import { funnelConversions, weeklyTrend, pickNextDeadline } from '../../lib/attention.js'
import { nextDeadlines } from '../../lib/statTiles.js'
import { BarChart, DonutChart, TrendChart } from '../charts/lazy.jsx'
import { useChartTheme } from '../charts/theme.js'
import Mono from '../ui/Mono.jsx'
import { DashCard, Readout } from './DashCard.jsx'

// Today's top row: one card per area, each a headline number over the chart behind it, so
// the number and its chart aren't two separate sections saying the same thing. The full-size
// versions still live on Pipeline → Sheet → Flow and Network → Flow (charts/ActivityCharts.jsx).

const FUNNEL_BARS = ['Wishlist', 'Applied', 'Phone Screen', 'Technical', 'Onsite', 'Offer']
// Short axis labels so all six fit a third-width card (Recharts drops overlapping ticks).
const SHORT = { Wishlist: 'Wish', 'Phone Screen': 'Screen', Technical: 'Tech' }
const CHART_H = 150

function Empty({ children }) {
  return <p className="text-sm text-ink-400 flex items-center" style={{ height: CHART_H }}>{children}</p>
}

export function PipelineCard({ apps }) {
  const triaged = apps.filter(a => !isUntriaged(a))
  const applied = triaged.filter(a => a.stage !== 'Wishlist').length
  const pct = triaged.length ? Math.round((applied / triaged.length) * 100) : 0
  const counts = {}
  triaged.forEach(a => { counts[a.stage] = (counts[a.stage] || 0) + 1 })
  const data = FUNNEL_BARS.map(stage => ({ label: SHORT[stage] || stage, value: counts[stage] || 0 }))
  const conversions = funnelConversions(triaged)
  const soonest = pickNextDeadline(apps, nextDeadlines(apps, 1))
  return (
    <DashCard label="Pipeline" tone="accent">
      <Readout value={applied} unit={`applied of ${triaged.length} · ${pct}%`} />
      {triaged.length
        ? <div className="mt-3 -ml-2"><BarChart data={data} height={CHART_H} /></div>
        : <Empty>No applications yet.</Empty>}
      <dl className="mt-2 pt-2 border-t border-ink-100 space-y-1 text-xs">
        <div className="flex items-baseline gap-3">
          <dt className="text-ink-400 shrink-0">Next deadline</dt>
          <dd className="ml-auto min-w-0 truncate text-right text-ink-700">
            {soonest ? <>{soonest.label} <Mono className="text-ink-900 font-semibold">{soonest.days === 0 ? 'today' : `${soonest.days}d`}</Mono></> : '—'}
          </dd>
        </div>
        {conversions.slice(1, 2).map(c => (
          <div key={c.to} className="flex items-baseline gap-3">
            <dt className="text-ink-400">{c.from} → {c.to}</dt>
            <dd className="ml-auto"><Mono className="text-ink-900 font-semibold">{c.pct}%</Mono></dd>
          </div>
        ))}
      </dl>
    </DashCard>
  )
}

export function NetworkCard({ contacts }) {
  const chartTheme = useChartTheme()
  const data = Object.keys(STATUS_COLOR)
    .map(status => ({ label: status, value: contacts.filter(c => c.status === status).length, color: chartTheme.status[status] }))
    .filter(d => d.value > 0)
  const warm = contacts.filter(c => c.status === '🟢 Warm' || c.status === '⭐ Champion').length
  return (
    <DashCard label="Network" tone="success">
      <Readout value={contacts.length} unit={`contacts · ${warm} warm`} />
      <div className="mt-3">
        {contacts.length ? <DonutChart data={data} height={CHART_H} /> : <Empty>No contacts yet.</Empty>}
      </div>
    </DashCard>
  )
}

export function OutreachCard({ interactions, className }) {
  const trend = weeklyTrend(interactions)
  const total = trend.reduce((s, w) => s + w.count, 0)
  const thisWeek = trend[trend.length - 1]?.count || 0
  const lastWeek = trend[trend.length - 2]?.count || 0
  const delta = thisWeek - lastWeek
  return (
    <DashCard label="Outreach" tone="warning" className={className}>
      <Readout value={thisWeek} unit={<>this week · <Mono className={delta > 0 ? 'text-success-700' : delta < 0 ? 'text-danger-600' : 'text-ink-500'}>{delta > 0 ? '+' : ''}{delta}</Mono> vs last · {total} in 10 wks</>} />
      <div className="mt-3 -ml-2">
        {interactions.length ? <TrendChart data={trend} height={CHART_H} /> : <Empty>No logged interactions yet.</Empty>}
      </div>
    </DashCard>
  )
}
