import { parseJobDate } from './helpers.js'
import { BarChart } from '../charts/lazy.jsx'
import { regionCounts, UNSPECIFIED } from '../../lib/locations.js'

export default function RepoStats({ jobs }) {
  const now     = new Date()
  const weekAgo = new Date(now - 7 * 86400000)

  const newThisWeek = jobs.filter(j => { const d = parseJobDate(j.dateAdded); return d && d >= weekAgo })
  const remote      = jobs.filter(j => /remote|anywhere|usa only|worldwide|us only/i.test(j.location || ''))

  // Regions, not raw strings, so "SF" and "San Francisco, CA" count as one place.
  const places  = regionCounts(jobs).filter(([r]) => r !== UNSPECIFIED && r !== 'Remote')
  const topLocs = places.slice(0, 8)

  const companyCounts = {}
  jobs.forEach(j => { if (j.company) companyCounts[j.company] = (companyCounts[j.company] || 0) + 1 })
  const multiRole = Object.entries(companyCounts).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 6)

  return (
    <div className="space-y-3">
      {/* Stat readouts: unboxed on purpose (a bordered tile reads as a clickable card) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-surface rounded-md p-4 border border-ink-300">
        {[
          { label: 'Total Listings',  value: jobs.length,          sub: 'in this repo' },
          { label: 'New This Week',   value: newThisWeek.length,   sub: 'recently posted', accent: true },
          { label: 'Remote-Friendly', value: remote.length,        sub: `${Math.round((remote.length/jobs.length)*100)}% of listings` },
          { label: 'Cities',          value: places.length,        sub: 'unique metros' },
        ].map(s => (
          <div key={s.label}>
            <p className="text-xs font-medium text-ink-400 uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.accent ? 'text-link' : 'text-ink-900'}`}>{s.value}</p>
            <p className="text-xs text-ink-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* New this week */}
      {newThisWeek.length > 0 && (
        <div className="bg-accent-50 border border-accent-100 rounded-md p-4">
          <p className="text-xs font-semibold text-accent-700 mb-2">🆕 Added this week</p>
          <div className="flex flex-wrap gap-1.5">
            {newThisWeek.slice(0, 16).map((j, i) => (
              <span key={i} className="px-2.5 py-1 bg-surface border border-accent-200 text-accent-800 text-xs rounded-sm font-medium">
                {j.company}
              </span>
            ))}
            {newThisWeek.length > 16 && <span className="text-xs text-accent-400 self-center">+{newThisWeek.length - 16} more</span>}
          </div>
        </div>
      )}

      {/* Top locations */}
      {topLocs.length > 0 && (
        <div className="bg-surface rounded-md p-4 border border-ink-300">
          <p className="text-xs font-semibold text-ink-500 mb-3">Top Locations</p>
          <BarChart
            data={topLocs.map(([loc, count]) => ({ label: loc, value: count }))}
            orientation="horizontal"
            height={Math.max(topLocs.length * 36, 120)}
          />
        </div>
      )}

      {/* Companies hiring for multiple roles */}
      {multiRole.length > 0 && (
        <div className="bg-surface rounded-md p-4 border border-ink-300">
          <p className="text-xs font-semibold text-ink-500 mb-2">Hiring Most Roles</p>
          <div className="flex flex-wrap gap-2">
            {multiRole.map(([co, n]) => (
              <span key={co} className="px-2.5 py-1 bg-ink-100 text-ink-700 text-xs rounded-sm">
                {co} <span className="font-bold text-link">{n}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

