import { useState } from 'react'
import { ListChecks } from 'lucide-react'
import { KIND, nextUp, itemTitle as titleOf } from '../../lib/actionQueue.js'
import SnoozeMenu from './SnoozeMenu.jsx'
import { fmt } from '../../shared.jsx'
import Mono from '../ui/Mono.jsx'
import { DashCard } from './DashCard.jsx'

// The Now strip (v1.5 spec 03, cut down 2026-11-11 on owner feedback): under the charts, only
// what's overdue or due today (lib/actionQueue.js's Now tier), NOW_CAP rows then "+N more".
// Rows are Today's existing row components (TodayTab's `renderRow`), each tagged with its kind.

const NOW_CAP = 5

const itemTitle = i => titleOf(i.kind, i.row)

function QueueRow({ item, renderRow, onHide }) {
  const kind = KIND[item.kind]
  return (
    <div className="group flex items-start gap-3">
      <span className="hidden sm:block w-[4.75rem] shrink-0 pt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-400 truncate" title={kind?.label}>
        {kind?.short}
      </span>
      <div className="flex-1 min-w-0">{renderRow(item)}</div>
      {kind?.list
        ? <SnoozeMenu item={item} title={itemTitle(item)} onPick={until => onHide(item, until)} />
        : <span className="w-[21px] shrink-0" aria-hidden />}
    </div>
  )
}

function Tier({ items, cap, renderRow, onHide }) {
  const [expanded, setExpanded] = useState(false)
  if (!items.length) return null
  const shown = cap && !expanded ? items.slice(0, cap) : items
  return (
    <div className="mt-1">
      <div className="divide-y divide-ink-100">
        {shown.map(i => <QueueRow key={i.key} item={i} renderRow={renderRow} onHide={onHide} />)}
      </div>
      {cap && items.length > cap && (
        <button onClick={() => setExpanded(e => !e)} className="mt-1 text-xs text-link hover:underline">
          {expanded ? 'Show fewer' : `+${items.length - cap} more`}
        </button>
      )}
    </div>
  )
}

export default function UpNext({ queue, renderRow, onHide }) {
  const { now } = queue
  const next = !now.length ? nextUp(queue) : null
  return (
    <DashCard label="Now" tone={now.length ? 'danger' : 'success'} icon={ListChecks} count={now.length || null}>
      {now.length
        ? <Tier items={now} cap={NOW_CAP} renderRow={renderRow} onHide={onHide} />
        : (
          <p className="mt-2 text-sm text-ink-600">
            Nothing overdue or due today.
            {next && <> Next: <span className="font-medium text-ink-900">{itemTitle(next)}</span> <Mono className="text-ink-500">{fmt(new Date(next.due))}</Mono></>}
          </p>
        )}
    </DashCard>
  )
}
