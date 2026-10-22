import { RowCap } from '../ui/Section.jsx'
import Mono from '../ui/Mono.jsx'
import { cn } from '../../lib/cn.js'

// Today's dashboard shell (instrument-panel look): every card is a mono caps label with a
// status LED, an optional count, and a body. Metric cards put a big readout above a chart;
// action cards stack several attention lists as labeled groups, so one card covers a whole
// category (people, applications, email, events) instead of one Section per list.

const LED = {
  danger: 'bg-danger-500',
  warning: 'bg-warning-500',
  accent: 'bg-accent-500',
  ink: 'bg-ink-400',
  success: 'bg-success-500',
}

export function Label({ tone = 'ink', children, className }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-ink-500', className)}>
      <span className={cn('size-1.5 rounded-full shrink-0', LED[tone] || LED.ink)} />
      {children}
    </span>
  )
}

export function DashCard({ label, tone, icon: Icon, count, actions, className, children }) {
  return (
    <section className={cn('h-full bg-surface border border-ink-200 rounded-md px-4 pt-3 pb-4 min-w-0', className)}>
      <header className="flex items-center gap-3 min-h-6">
        <Label tone={tone}>{label}</Label>
        {count != null && <Mono className="text-ink-900 font-semibold">{String(count).padStart(2, '0')}</Mono>}
        <span className="ml-auto flex items-center gap-3">
          {actions}
          {Icon && <Icon size={14} strokeWidth={2} className="text-ink-300" aria-hidden />}
        </span>
      </header>
      {children}
    </section>
  )
}

// Big read-only number (Space Grotesk via h-level font) + its unit line.
export function Readout({ value, unit, className }) {
  return (
    <div className={cn('flex items-baseline gap-2 mt-2', className)}>
      <span className="font-heading text-4xl font-semibold tabular-nums leading-none text-ink-900">{value}</span>
      {unit && <span className="text-xs text-ink-500">{unit}</span>}
    </div>
  )
}

// One attention list inside an action card: a hairline-ruled sub-label, then capped rows.
export function Group({ label, tone, items, renderItem, onHide, cap }) {
  if (!items.length) return null
  return (
    <div className="mt-3 first-of-type:mt-2">
      <div className="flex items-center gap-2 border-b border-ink-100 pb-1">
        <Label tone={tone} className="text-[10px] tracking-[0.12em]">{label}</Label>
        <Mono className="text-ink-400 text-[10px]">{items.length}</Mono>
      </div>
      <RowCap items={items} cap={cap} tier={tone} renderItem={renderItem} onHide={onHide} />
    </div>
  )
}
