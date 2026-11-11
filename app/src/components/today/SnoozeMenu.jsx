import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { snoozeOptions } from '../../lib/snooze.js'

// The queue row's hide control (v1.5 spec 04): a clock that opens "Tomorrow / Monday / Next
// week / After the interview". Arrow keys move, Enter picks, Esc closes.
export default function SnoozeMenu({ item, title, onPick }) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState([])
  const itemsRef = useRef([])
  const buttonRef = useRef(null)

  useEffect(() => { if (open) itemsRef.current[0]?.focus() }, [open])

  function toggle() {
    if (!open) setOptions(snoozeOptions(item))
    setOpen(o => !o)
  }
  function close(refocus = true) {
    setOpen(false)
    if (refocus) buttonRef.current?.focus()
  }
  function onKey(e) {
    const i = itemsRef.current.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); itemsRef.current[(i + 1) % options.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); itemsRef.current[(i - 1 + options.length) % options.length]?.focus() }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'Tab') close(false)
  }

  return (
    <div className="relative shrink-0">
      <button ref={buttonRef} onClick={toggle} aria-haspopup="menu" aria-expanded={open}
        title="Hide until…" aria-label={`Hide until…: ${title}`}
        className={`mt-2.5 p-1 rounded text-ink-300 hover:text-ink-700 hover:bg-ink-50 focus:opacity-100 transition-opacity ${open ? 'opacity-100 text-ink-700' : 'sm:opacity-0 sm:group-hover:opacity-100'}`}>
        <Clock size={13} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => close(false)} />
          <div role="menu" aria-label={`Hide ${title} until`} onKeyDown={onKey}
            className="absolute right-0 top-full mt-1 z-40 w-48 bg-surface border border-ink-300 rounded-sm shadow-lg py-1">
            <p className="px-3 pt-1 pb-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-400">Hide until</p>
            {options.map((o, i) => (
              <button key={o.id} role="menuitem" ref={el => { itemsRef.current[i] = el }}
                onClick={() => { onPick(o.until); setOpen(false) }}
                className="w-full text-left px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-50 focus:bg-ink-50 focus:outline-none">
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
