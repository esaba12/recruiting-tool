import { useState } from 'react'
import { createEvent, addOneHour, CALENDAR_SLOTS } from '../googleCalendar.js'

export default function AddEventModal({ defaultDate, onClose, onCreated }) {
  const [title, setTitle]           = useState('')
  const [date, setDate]             = useState(defaultDate || new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime]   = useState('')
  const [endTime, setEndTime]       = useState('')
  const [location, setLocation]     = useState('')
  const [description, setDescription] = useState('')
  const [slot, setSlot]             = useState('personal')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  async function save() {
    if (!title.trim() || !date) { setError('Title and date are required'); return }
    setSaving(true); setError(null)
    try {
      await createEvent({
        title, date, startTime,
        endTime: endTime || (startTime ? addOneHour(startTime) : ''),
        location, description, slot,
      })
      onCreated()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-ink-900/40 z-50 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full md:max-w-md rounded-t-md md:rounded-md border border-ink-300 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-ink-100 px-5 py-4 rounded-t-md flex items-center justify-between">
          <h2 className="text-base font-bold text-ink-900">Add Event</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-ink-500 text-sm">✕</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {error && <div className="p-3 bg-danger-50 border border-danger-200 rounded-xl text-xs text-danger-700">{error}</div>}

          <div>
            <label className="block text-xs text-ink-400 mb-0.5">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
              className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
          </div>
          <div>
            <label className="block text-xs text-ink-400 mb-0.5">Calendar</label>
            <div className="flex border border-ink-200 rounded-lg overflow-hidden text-xs font-medium w-fit">
              {Object.entries(CALENDAR_SLOTS).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setSlot(key)}
                  className={`px-3 py-1.5 transition-colors ${slot === key ? 'bg-ink-900 text-white' : 'bg-white text-ink-500 hover:bg-ink-50'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-ink-400 mb-0.5">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
            </div>
            <div>
              <label className="block text-xs text-ink-400 mb-0.5">Start</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
            </div>
            <div>
              <label className="block text-xs text-ink-400 mb-0.5">End</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-ink-400 mb-0.5">Location</label>
            <input value={location} onChange={e => setLocation(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
          </div>
          <div>
            <label className="block text-xs text-ink-400 mb-0.5">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full px-2.5 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 resize-none" />
          </div>

          <button onClick={save} disabled={saving}
            className="w-full py-3 bg-accent-600 text-white text-sm rounded-xl hover:bg-accent-700 disabled:opacity-50 font-medium transition-colors">
            {saving ? 'Creating...' : '+ Create Event'}
          </button>
        </div>
      </div>
    </div>
  )
}
