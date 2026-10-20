import { useMemo } from 'react'
import { WEEKDAYS, SLOT_LENGTHS, suggestSlots, formatSlot, normalizeAvailability } from '../../lib/availability.js'

const HOURS = Array.from({ length: 25 }, (_, h) => h)
const hourLabel = h => h === 0 || h === 24 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const COMMON_ZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix', 'Europe/London', 'Asia/Kolkata', 'Asia/Shanghai']

// When you're open to calls (v1.4 spec 10). Shared by the onboarding Calendar step and
// Settings; reply drafts offer free slots inside this window. Controlled: the parent saves.
export default function AvailabilityEditor({ value, onChange, disabled = false }) {
  const set = patch => onChange({ ...value, ...patch })
  const toggleDay = d => set({ days: value.days.includes(d) ? value.days.filter(x => x !== d) : [...value.days, d] })
  const valid = normalizeAvailability(value)
  const preview = useMemo(() => valid ? suggestSlots({ availability: valid }) : [], [valid?.days.join(), valid?.start, valid?.end, valid?.slotMin, valid?.timeZone])
  const zones = COMMON_ZONES.includes(value.timeZone) ? COMMON_ZONES : [value.timeZone, ...COMMON_ZONES]
  const select = 'px-2 py-1 border border-ink-100 rounded-md text-xs bg-surface text-ink-800 focus:outline-none focus:border-accent-400'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Days">
        {DAY_ORDER.map(d => {
          const on = value.days.includes(d)
          return (
            <button key={d} type="button" disabled={disabled} onClick={() => toggleDay(d)} aria-pressed={on}
              className={`w-11 py-1.5 font-mono text-[11px] border rounded-sm transition-colors disabled:opacity-50 ${
                on ? 'bg-ink-900 text-on-fill border-ink-900' : 'bg-surface text-ink-500 border-ink-200 hover:border-accent-300'}`}>
              {WEEKDAYS[d].toUpperCase()}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-600">
        <select aria-label="From" value={value.start} disabled={disabled} onChange={e => set({ start: Number(e.target.value) })} className={select}>
          {HOURS.slice(0, 24).map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}
        </select>
        <span>to</span>
        <select aria-label="Until" value={value.end} disabled={disabled} onChange={e => set({ end: Number(e.target.value) })} className={select}>
          {HOURS.slice(1).map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}
        </select>
        <span className="ml-2">calls of</span>
        <select aria-label="Call length" value={value.slotMin} disabled={disabled} onChange={e => set({ slotMin: Number(e.target.value) })} className={select}>
          {SLOT_LENGTHS.map(m => <option key={m} value={m}>{m} min</option>)}
        </select>
      </div>
      <select aria-label="Time zone" value={value.timeZone} disabled={disabled} onChange={e => set({ timeZone: e.target.value })} className={select}>
        {zones.map(z => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
      </select>
      {valid
        ? preview.length > 0 && (
            <div className="text-[11px] text-ink-400">
              <p>A reply would offer times like:</p>
              <ul className="font-mono mt-0.5">{preview.map(s => <li key={s.start}>{formatSlot(s, valid.timeZone)}</li>)}</ul>
              <p className="mt-0.5">With a calendar connected, anything already on it is skipped.</p>
            </div>
          )
        : <p className="text-[11px] text-warning-700">Pick at least one day and an end time after the start.</p>}
    </div>
  )
}
