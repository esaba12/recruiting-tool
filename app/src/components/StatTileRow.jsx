import { motion } from 'motion/react'
import Mono from './ui/Mono.jsx'
import { nextDeadlines } from '../lib/statTiles.js'

// Self-contained stagger for the 3 tiles, independent of TodayTab's own Section-list
// stagger (which wraps this whole component in its own <motion.div variants={rise}>).
const container = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } }
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }

// Instrument-panel "dashboard glance" summary — 3 tiles, additive above ActivitySection's
// existing Funnel/Donut/Trend charts, built entirely on data pipelines the caller already
// computes (triagedApps, apps, trendData) plus the rec_job_deadlines cache. No new
// Supabase/AI calls (STAT-01).
export default function StatTileRow({ triagedApps, apps, trendData }) {
  const appliedOrBeyond = triagedApps.filter(a => a.stage !== 'Wishlist').length
  const pct = triagedApps.length ? Math.round((appliedOrBeyond / triagedApps.length) * 100) : 0

  const [soonest] = nextDeadlines(apps, 1)

  const last6 = trendData.slice(-6)
  const activityTotal = last6.reduce((sum, w) => sum + w.count, 0)
  const activityMax = Math.max(1, ...last6.map(w => w.count))

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 mb-4 border-b border-ink-200"
    >
      {/* Tile 1: Funnel */}
      <motion.div variants={item} className="rounded-md border border-ink-300 bg-white p-4">
        <p className="text-xs font-semibold text-ink-600">Funnel</p>
        <Mono className="block text-2xl mt-1">{appliedOrBeyond}</Mono>
        <p className="text-xs text-ink-400 mt-0.5">applied of {triagedApps.length} ({pct}%)</p>
        <div className="h-1 bg-ink-100 rounded-sm overflow-hidden mt-3">
          <div className="h-full bg-accent-600 rounded-sm" style={{ width: `${pct}%` }} />
        </div>
      </motion.div>

      {/* Tile 2: Next Deadline */}
      <motion.div variants={item} className="rounded-md border border-ink-300 bg-white p-4">
        <p className="text-xs font-semibold text-ink-600">Next Deadline</p>
        {soonest ? (
          <>
            <Mono className="block text-2xl mt-1">{soonest.days}d</Mono>
            <p className="text-xs text-ink-400 mt-0.5">{soonest.company}</p>
            <div className="h-1 bg-gradient-to-r from-danger-500 to-warning-500 rounded-sm mt-3"
              style={{ width: `${Math.max(4, Math.min(100, 100 - (soonest.days / 30) * 100))}%` }} />
          </>
        ) : (
          <p className="text-sm text-ink-400 mt-2">No known deadlines</p>
        )}
      </motion.div>

      {/* Tile 3: Activity */}
      <motion.div variants={item} className="rounded-md border border-ink-300 bg-white p-4">
        <p className="text-xs font-semibold text-ink-600">Activity</p>
        <Mono className="block text-2xl mt-1">{activityTotal}</Mono>
        <p className="text-xs text-ink-400 mt-0.5">last 6 weeks</p>
        <div className="flex items-end gap-1 h-6 mt-3">
          {last6.map((w, i) => (
            <div key={i} className="flex-1 bg-accent-400 rounded-sm"
              style={{ height: `${Math.max(15, (w.count / activityMax) * 100)}%` }} />
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
