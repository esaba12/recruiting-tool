import { useState } from 'react'
import { ChevronRight, X } from 'lucide-react'
import Mono from './Mono.jsx'

// Shared tier-key -> heading-text-color lookup, read by both Section (its own heading) and
// RowCap (its "Show N more" control, styled in the section's own tier color).
const HEADING_COLOR = { danger: 'text-danger-700', warning: 'text-warning-700', ink: 'text-ink-700', accent: 'text-accent-700' }

// Section wrapper shared by every attention-feed section — re-keyed from the former Actions
// tab's off-token red/orange/yellow/indigo accents onto Phase 1's 4 locked color families.
// Extracted from TodayTab.jsx so Grow's 3 sections (and any future page) can reuse the exact
// same shell without duplicating it — see 03-PATTERNS.md.
// Optional: `onToggle` makes the heading a collapse control (`collapsed` hides the body and
// subtitle), `actions` renders right-aligned in the heading row (e.g. "Clear all").
function Section({ title, subtitle, accent, icon: Icon, step, collapsed = false, onToggle, actions, children }) {
  const border = { danger: 'border-danger-200', warning: 'border-warning-200', ink: 'border-ink-200', accent: 'border-accent-200' }[accent] || 'border-ink-200'
  const heading = HEADING_COLOR[accent] || 'text-ink-700'
  const label = (
    <>
      {onToggle && <ChevronRight size={14} strokeWidth={2.25} className={`shrink-0 transition-transform duration-150 ${collapsed ? '' : 'rotate-90'}`} />}
      {step && <Mono className="text-ink-500">{step}</Mono>}
      {Icon && <Icon size={15} strokeWidth={2} className="shrink-0" />} <span className="truncate">{title}</span>
    </>
  )
  return (
    <div className={`bg-surface rounded-md border ${border} ${collapsed ? 'px-4 py-2.5' : 'px-4 py-3.5'}`}>
      <div className="flex items-center gap-2 min-w-0">
        {onToggle
          ? <button onClick={onToggle} aria-expanded={!collapsed}
              className={`min-w-0 flex-1 text-left text-sm font-semibold ${heading} flex items-center gap-1.5 hover:opacity-80`}>{label}</button>
          : <h2 className={`min-w-0 flex-1 text-sm font-semibold ${heading} flex items-center gap-1.5`}>{label}</h2>}
        {actions && !collapsed && <div className="shrink-0 flex items-center gap-3">{actions}</div>}
      </div>
      {!collapsed && (
        <>
          {subtitle && <p className="text-xs text-ink-400 mt-0.5 mb-2">{subtitle}</p>}
          <div className={`divide-y divide-ink-100 ${subtitle ? '' : 'mt-1'}`}>{children}</div>
        </>
      )}
    </div>
  )
}

// Small text button for a Section's `actions` slot.
function SectionAction({ onClick, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="text-[11px] font-medium text-ink-400 hover:text-ink-700 hover:underline disabled:opacity-40">
      {children}
    </button>
  )
}

// Per-section row cap — shows the first `cap` rows, with a "+N more" / "Show fewer" toggle
// below when there are more. `onHide(item)` adds a small ✕ per row (Today uses it to
// snooze a row for a week).
function RowCap({ items, cap = 3, tier, renderItem, onHide, hideLabel = 'Hide for 7 days' }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, cap)
  return (
    <div>
      <div className="divide-y divide-ink-100">
        {visible.map((item, i) => {
          const el = renderItem(item)
          if (!onHide) return el
          return (
            <div key={el?.key ?? i} className="group flex items-start gap-1">
              <div className="flex-1 min-w-0">{el}</div>
              <button onClick={() => onHide(item)} title={hideLabel} aria-label={hideLabel}
                className="mt-2.5 p-1 rounded text-ink-300 hover:text-ink-700 hover:bg-ink-50 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity">
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
      {items.length > cap && (
        <button onClick={() => setExpanded(e => !e)}
          className={`text-[11px] font-medium hover:underline pt-1.5 ${HEADING_COLOR[tier] || 'text-ink-700'}`}>
          {expanded ? 'Show fewer' : `+${items.length - cap} more`}
        </button>
      )}
    </div>
  )
}

export { Section, SectionAction, RowCap, HEADING_COLOR }
