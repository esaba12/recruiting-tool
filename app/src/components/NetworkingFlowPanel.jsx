import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { buildNetworkingFlow, networkingSummary, COLD_DAYS } from '../lib/networkingFlow.js'
import { STATUS_COLOR, Badge } from '../shared.jsx'
import SankeyChart from './charts/SankeyChart.jsx'
import Mono from './ui/Mono.jsx'

// Networking twin of ApplicationFlowPanel: headline numbers + the outcome Sankey. On
// Network → Flow (`onOpenContact` set) clicking a band lists those contacts underneath;
// on Today it's read-only.
export default function NetworkingFlowPanel({ contacts, interactions, calls = [], height = 280, onOpenContact, footer }) {
  const flow = useMemo(() => buildNetworkingFlow(contacts, interactions, calls), [contacts, interactions, calls])
  const s = useMemo(() => networkingSummary(flow), [flow])
  const [sel, setSel] = useState(null) // { label, appIds }

  if (!flow.total) {
    return <p className="text-sm text-ink-400 py-6">No outreach logged yet — the flow fills in once you've emailed, messaged or met someone.</p>
  }

  const stats = [
    ['Contacted', s.contacted],
    ['Replied', `${s.replyRate}%`],
    ['Met', s.met],
    ['Asked', s.asked],
    ['Referrals', s.referrals],
    ['No reply', s.noReply],
  ]
  const picked = sel ? contacts.filter(c => sel.appIds.includes(c.id)) : []

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
      <SankeyChart flow={flow} height={height} palette="network" unit="contact"
        onSelect={onOpenContact ? x => setSel(cur => cur?.label === x.label ? null : x) : undefined}
        selectedLabel={sel?.label} />
      <p className="mt-2 text-[11px] text-ink-400 flex flex-wrap gap-x-3">
        <span>Gone cold = marked Cold/Closed, or quiet for {COLD_DAYS}+ days.</span>
        {flow.untouched > 0 && <span><Mono>{flow.untouched}</Mono> contacts with nothing logged yet aren't shown.</span>}
        {onOpenContact && !sel && <span>Click a band to see who's in it.</span>}
        {footer}
      </p>

      {sel && (
        <div className="mt-4 border border-ink-200 rounded-md">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-ink-100">
            <span className="text-xs font-semibold text-ink-700">{sel.label}</span>
            <Mono className="text-xs text-ink-400">{picked.length}</Mono>
            <button onClick={() => setSel(null)} className="ml-auto p-1 rounded text-ink-400 hover:text-ink-700 hover:bg-ink-50" aria-label="Clear selection">
              <X size={14} />
            </button>
          </div>
          <ul className="divide-y divide-ink-100 max-h-80 overflow-y-auto">
            {picked.map(c => (
              <li key={c.id}>
                <button onClick={() => onOpenContact(c)} className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-ink-50">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink-900 truncate">{c.name}</span>
                    <span className="block text-xs text-ink-500 truncate">{[c.company, c.role].filter(Boolean).join(' · ')}</span>
                  </span>
                  <Badge label={c.status} color={STATUS_COLOR[c.status]} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
