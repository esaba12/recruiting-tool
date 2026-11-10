import { useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { LOCATION_ICON } from '../../lib/icons.js'
import Mono from './Mono.jsx'

// Multi-select region chips with counts (regions from lib/locations.js regionCounts).
// The most common regions show inline; the rest sit behind "+N more". A selected region
// always stays visible, even when it's in the overflow, so the active filter is never hidden.
export default function LocationFilter({ counts, value = [], onChange, inline = 8, size = 'md' }) {
  const [open, setOpen] = useState(false)
  if (!counts.length) return null
  const toggle = r => onChange(value.includes(r) ? value.filter(x => x !== r) : [...value, r])
  const shown = counts.filter(([r], i) => i < inline || value.includes(r))
  const rest = counts.filter(([r], i) => i >= inline && !value.includes(r))
  const pad = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'

  const chip = ([region, n]) => {
    const on = value.includes(region)
    return (
      <button key={region} type="button" onClick={() => toggle(region)} aria-pressed={on}
        className={`${pad} shrink-0 rounded-sm text-xs border transition-colors flex items-center gap-1
          ${on ? 'bg-accent-600 text-on-accent border-accent-600' : 'bg-surface text-ink-600 border-ink-200 hover:border-accent-300'}`}>
        {region}
        <Mono className={on ? 'text-on-accent opacity-75' : 'text-ink-400'}>{n}</Mono>
      </button>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <LOCATION_ICON size={13} className="text-ink-400 shrink-0" aria-hidden />
      {shown.map(chip)}
      {rest.length > 0 && (
        <div className="relative">
          <button type="button" onClick={() => setOpen(o => !o)}
            className={`${pad} rounded-sm text-xs border border-ink-200 bg-surface text-ink-500 hover:bg-ink-50 flex items-center gap-0.5`}>
            +{rest.length} more <ChevronDown size={12} />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
              <div className="absolute left-0 mt-1 z-40 w-56 max-h-72 overflow-y-auto bg-surface border border-ink-300 rounded-sm shadow-lg py-1">
                {rest.map(([region, n]) => (
                  <button key={region} type="button" onClick={() => { toggle(region); setOpen(false) }}
                    className="w-full flex items-center justify-between px-3 py-1 text-xs text-ink-700 hover:bg-ink-50">
                    {region} <Mono className="text-ink-400">{n}</Mono>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {value.length > 0 && (
        <button type="button" onClick={() => onChange([])}
          className="flex items-center gap-0.5 text-xs text-ink-400 hover:text-ink-700 ml-0.5">
          <X size={12} /> clear
        </button>
      )}
    </div>
  )
}
