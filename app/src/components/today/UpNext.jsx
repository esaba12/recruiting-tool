import { useState } from 'react'
import { ChevronRight, ListChecks } from 'lucide-react'
import { KIND, QUEUE_KINDS, backlogSummary, nextUp, itemTitle as titleOf } from '../../lib/actionQueue.js'
import SnoozeMenu from './SnoozeMenu.jsx'
import { fmt } from '../../shared.jsx'
import Mono from '../ui/Mono.jsx'
import { DashCard, Label } from './DashCard.jsx'

// "Up next" (v1.5 spec 03): Today's one ranked list. Now shows everything, This week shows
// WEEK_CAP then "+N more", and the Backlog folds into one line until opened. Rows are Today's
// existing row components (TodayTab's `renderRow`), each tagged with its kind.

const WEEK_CAP = 5

// "Stale applications" → "stale applications", but "OA deadline unknown" keeps its acronym.
const lowerFirst = s => s.replace(/^([A-Z])(?=[a-z])/, c => c.toLowerCase())

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

function Tier({ label, tone, items, cap, renderRow, onHide }) {
  const [expanded, setExpanded] = useState(false)
  if (!items.length) return null
  const shown = cap && !expanded ? items.slice(0, cap) : items
  return (
    <div className="mt-3 first-of-type:mt-2">
      <div className="flex items-center gap-2 border-b border-ink-100 pb-1">
        <Label tone={tone} className="text-[10px] tracking-[0.12em]">{label}</Label>
        <Mono className="text-ink-400 text-[10px]">{items.length}</Mono>
      </div>
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

function Backlog({ items, renderRow, onHide }) {
  const [open, setOpen] = useState(false)
  if (!items.length) return null
  const parts = backlogSummary(items)
  return (
    <div className="mt-4 pt-2 border-t border-ink-200">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center gap-2 text-left py-1 text-xs text-ink-500 hover:text-ink-800">
        <ChevronRight size={13} strokeWidth={2.25} className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-600">Backlog</span>
        <Mono className="text-ink-400 text-[10px]">{items.length}</Mono>
        <span className="truncate">{parts.map(p => `${p.count} ${lowerFirst(p.label)}`).join(' · ')}</span>
      </button>
      {open && QUEUE_KINDS.filter(k => parts.some(p => p.kind === k.id)).map(k => (
        <Tier key={k.id} label={k.label} tone="ink" cap={5}
          items={items.filter(i => i.kind === k.id)} renderRow={renderRow} onHide={onHide} />
      ))}
    </div>
  )
}

export default function UpNext({ queue, renderRow, onHide, footer }) {
  const { now, week, later } = queue
  const tone = now.length ? 'danger' : week.length ? 'warning' : 'success'
  const next = !now.length && !week.length ? nextUp(queue) : null
  return (
    <DashCard label="Up next" tone={tone} icon={ListChecks} count={now.length + week.length}
      actions={(now.length > 0 || week.length > 0) && (
        <span className="text-[11px] text-ink-400">
          <Mono className={now.length ? 'text-danger-600 font-semibold' : 'text-ink-400'}>{now.length}</Mono> now
          {' · '}<Mono className="text-ink-500">{week.length}</Mono> this week
        </span>
      )}>
      {!now.length && !week.length && (
        <p className="mt-3 text-sm text-ink-600">
          {next
            ? <>Nothing due. Next: <span className="font-medium text-ink-900">{itemTitle(next)}</span> <Mono className="text-ink-500">{fmt(new Date(next.due))}</Mono></>
            : later.length ? 'Nothing due. The backlog can wait.' : "✓ All clear. Nothing needs you right now."}
        </p>
      )}
      <Tier label="Now" tone="danger" items={now} renderRow={renderRow} onHide={onHide} />
      <Tier label="This week" tone="warning" items={week} cap={WEEK_CAP} renderRow={renderRow} onHide={onHide} />
      <Backlog items={later} renderRow={renderRow} onHide={onHide} />
      {footer}
    </DashCard>
  )
}
