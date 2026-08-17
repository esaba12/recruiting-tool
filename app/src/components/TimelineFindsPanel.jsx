import { CalendarSearch } from 'lucide-react'
import { timeAgo } from './jobBoards/helpers.js'
import { Badge, EmptyState } from '../shared.jsx'
import { AI_PROVIDER_LABEL } from '../lib/ai.js'
import Mono from './ui/Mono.jsx'

const SOURCE_LABEL = { application: 'Application notes', call: 'Call', interaction: 'Interaction' }

// Pure presentational chrome for Timeline Finds — the daily-scan trigger and all owned
// state (meta/pending/running/error) now live in ../lib/useTimelineFinds.js, called
// unconditionally by TodayTab above its allEmpty gate. This component only mounts when
// there's something to show, and only renders what it's handed via props.
export default function TimelineFindsPanel({ pending, running, error, meta, onScan, onDismiss, onUpdateField, onApprove }) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-accent-200">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold text-accent-700 mb-1 flex items-center gap-1.5">
          <CalendarSearch size={16} strokeWidth={2} />
          Timeline Finds ({pending.length}){running ? ' · scanning…' : ''}
        </h2>
        <button onClick={() => onScan({ force: true })} disabled={running}
          className="shrink-0 ml-3 px-2.5 py-1 bg-white border border-accent-200 rounded-full text-xs font-medium text-accent-700 hover:border-accent-400 disabled:opacity-40">
          ↻ Rescan
        </button>
      </div>

      <p className="text-xs text-ink-400 mb-3">
        Daily {AI_PROVIDER_LABEL} pass over Application notes, Calls, and Interactions for dates that aren't on your calendar yet. Nothing is created until you approve it below.
        {meta.lastRun && <> · Last scan <Mono>{timeAgo(new Date(meta.lastRun).toISOString())}</Mono></>}
      </p>

      {error && <div className="p-2 bg-danger-50 border border-danger-200 rounded-lg text-xs text-danger-700 mb-2">{error}</div>}

      <div className="space-y-2">
        {pending.length === 0
          ? <EmptyState msg={running ? 'Scanning your records…' : 'Nothing pending — you’re caught up.'} />
          : pending.map(item => (
              <div key={item.key} className="bg-white rounded-lg p-3 border border-ink-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <Badge label={SOURCE_LABEL[item.sourceType]} color="bg-indigo-50 text-indigo-600" />
                      {item.company && <span className="text-xs text-ink-500">{item.company}{item.role ? ` · ${item.role}` : ''}</span>}
                    </div>
                    <input value={item.title} onChange={e => onUpdateField(item.key, 'title', e.target.value)}
                      className="w-full px-2 py-1 border border-ink-200 rounded-lg text-sm font-medium focus:outline-none focus:border-accent-400 mb-1.5" />
                    <div className="flex gap-2">
                      <input type="date" value={item.date} onChange={e => onUpdateField(item.key, 'date', e.target.value)}
                        className="px-2 py-1 border border-ink-200 rounded-lg text-xs focus:outline-none focus:border-accent-400" />
                      <input type="time" value={item.startTime} onChange={e => onUpdateField(item.key, 'startTime', e.target.value)}
                        placeholder="all-day"
                        className="px-2 py-1 border border-ink-200 rounded-lg text-xs focus:outline-none focus:border-accent-400" />
                    </div>
                    {item.description && <p className="text-[11px] text-ink-400 mt-1.5">{item.description}</p>}
                  </div>
                  <div className="shrink-0 flex flex-col gap-1.5">
                    <button onClick={() => onApprove(item)} disabled={item.status === 'saving' || !item.date}
                      className="px-2.5 py-1 bg-accent-600 text-white rounded-full text-xs font-medium hover:bg-accent-700 disabled:opacity-40">
                      {item.status === 'saving' ? '…' : '+ Add to Calendar'}
                    </button>
                    <button onClick={() => onDismiss(item.key)}
                      className="px-2 py-1 bg-white border border-ink-200 rounded-full text-xs font-medium text-ink-400 hover:border-danger-300 hover:text-danger-600">
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ))}
      </div>
    </div>
  )
}
