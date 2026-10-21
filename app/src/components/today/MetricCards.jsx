import { STATUS_COLOR, isUntriaged } from '../../shared.jsx'
import { weeklyTrend, pickNextDeadline, pipelineRates } from '../../lib/attention.js'
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

// Outcome rates as a share of applications sent: one gauge per outcome, all one hue because
// they measure the same thing (see pipelineRates for what counts).
const RATE_HINT = {
  response: 'Heard back at all: an OA, an interview, an offer or a rejection',
  oa: 'Got an online assessment',
  interview: 'Reached a phone screen, technical or onsite (offers count too)',
  offer: 'Got an offer, accepted or not',
  rejected: 'Ended in a rejection',
}

export function RatesCard({ apps }) {
  const { applied, rates } = pipelineRates(apps)
  if (!applied) return null
  return (
    <DashCard label="Rates" tone="accent" actions={<span className="text-xs text-ink-400">of <Mono className="text-ink-700">{applied}</Mono> applied</span>}>
      <dl className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-y-4">
        {rates.map(r => (
          <div key={r.key} title={RATE_HINT[r.key]} className="px-4 first:pl-0 border-l border-ink-100 first:border-l-0 max-sm:[&:nth-child(odd)]:border-l-0 max-sm:[&:nth-child(odd)]:pl-0 sm:max-lg:[&:nth-child(3n+1)]:border-l-0 sm:max-lg:[&:nth-child(3n+1)]:pl-0">
            <dt className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-500">{r.label}</dt>
            <dd>
              <span className="block mt-1 font-heading text-3xl font-semibold tabular-nums leading-none text-ink-900">
                {r.pct}<span className="text-base text-ink-400 ml-0.5">%</span>
              </span>
              <span className="mt-2 block h-1 rounded-full bg-ink-100 overflow-hidden" aria-hidden>
                <span className="block h-full rounded-full bg-accent-500" style={{ width: `${r.pct}%` }} />
              </span>
              <Mono className="mt-1.5 block text-[11px] text-ink-400">{r.n} / {applied}</Mono>
            </dd>
          </div>
        ))}
      </dl>
    </DashCard>
  )
}
