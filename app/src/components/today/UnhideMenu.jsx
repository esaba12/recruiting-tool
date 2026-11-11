import { useState } from 'react'
import { itemTitle } from '../../lib/actionQueue.js'
import { backLabel } from '../../lib/snooze.js'
import Mono from '../ui/Mono.jsx'

// "Unhide N" in Today's header (v1.5 spec 04): what's hidden, when each comes back, and a way
// to bring any of them (or all) back now.
// Snooze list ids are queue kind ids (lib/actionQueue.js QUEUE_KINDS), so itemTitle reads them directly.
function rowTitle({ list, row }) {
  return list === 'replies' ? row.subject || 'Drafted reply' : itemTitle(list, row)
}

export default function UnhideMenu({ hidden, prefs }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="hover:text-ink-700 hover:underline">
        Unhide {hidden.length}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 w-80 max-w-[calc(100vw-2rem)] bg-surface border border-ink-300 rounded-sm shadow-lg py-1 text-left">
            <p className="px-3 pt-1 pb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-400">Hidden for now</p>
            <div className="max-h-72 overflow-y-auto">
              {hidden.map(h => {
                const until = prefs.untilOf(h.key)
                return (
                  <div key={h.key} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                    <span className="flex-1 min-w-0 truncate text-ink-800">{rowTitle(h)}</span>
                    {until && <Mono className="shrink-0 text-ink-400">{backLabel(until)}</Mono>}
                    <button onClick={() => prefs.unsnooze(h.key)} className="shrink-0 text-link hover:underline">Unhide</button>
                  </div>
                )
              })}
            </div>
            <button onClick={() => { prefs.clearSnoozes(); setOpen(false) }}
              className="w-full text-left px-3 pt-1.5 mt-1 border-t border-ink-100 text-[11px] text-link hover:underline">
              Unhide all
            </button>
          </div>
        </>
      )}
    </span>
  )
}
