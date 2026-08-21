import { useState } from 'react'
import Mono from './Mono.jsx'

// Shared tier-key -> heading-text-color lookup, read by both Section (its own heading) and
// RowCap (its "Show N more" control, styled in the section's own tier color).
const HEADING_COLOR = { danger: 'text-danger-700', warning: 'text-warning-700', ink: 'text-ink-700', accent: 'text-accent-700' }

// Section wrapper shared by every attention-feed section — re-keyed from the former Actions
// tab's off-token red/orange/yellow/indigo accents onto Phase 1's 4 locked color families.
// Extracted from TodayTab.jsx so Grow's 3 sections (and any future page) can reuse the exact
// same shell without duplicating it — see 03-PATTERNS.md.
function Section({ title, subtitle, accent, icon: Icon, step, children }) {
  const border = { danger: 'border-danger-200', warning: 'border-warning-200', ink: 'border-ink-200', accent: 'border-accent-200' }[accent] || 'border-ink-200'
  const heading = HEADING_COLOR[accent] || 'text-ink-700'
  return (
    <div className={`bg-white rounded-md p-5 border ${border}`}>
      <h2 className={`text-sm font-semibold ${heading} mb-1 flex items-center gap-1.5`}>
        {step && <Mono className="text-ink-500">{step}</Mono>}
        {Icon && <Icon size={16} strokeWidth={2} />} {title}
      </h2>
      {subtitle && <p className="text-xs text-ink-400 mb-3">{subtitle}</p>}
      <div className="divide-y divide-ink-100">{children}</div>
    </div>
  )
}

// Per-section row cap — shows the first `cap` rows, with a "+N more — Show all" / "Show
// fewer" toggle below when there are more. New interactive behavior (CalendarTab.jsx's
// FEED_LATER_CAP hint is static text only) layered on the section's own tier color.
function RowCap({ items, cap = 5, tier, renderItem }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, cap)
  return (
    <div>
      <div className="divide-y divide-ink-100">{visible.map(renderItem)}</div>
      {items.length > cap && (
        <button onClick={() => setExpanded(e => !e)}
          className={`text-xs font-medium hover:underline pt-2 text-center w-full ${HEADING_COLOR[tier] || 'text-ink-700'}`}>
          {expanded ? 'Show fewer' : `+${items.length - cap} more — Show all`}
        </button>
      )}
    </div>
  )
}

export { Section, RowCap, HEADING_COLOR }
