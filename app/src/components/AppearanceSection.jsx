import { useState } from 'react'
import { Check, Monitor, Sun, Moon } from 'lucide-react'
import { SCHEMES, MODES, APPEARANCE_SETTING_KEY, setAppearance, useAppearance } from '../lib/theme.js'
import { setUserSetting } from '../db.js'

const MODE_ICON = { system: Monitor, light: Sun, dark: Moon }

// Settings → Appearance. Applies instantly (lib/theme.js), then saves to the account so the
// choice follows the user to other devices; a failed save leaves this browser themed anyway.
export default function AppearanceSection() {
  const appearance = useAppearance()
  const [saveError, setSaveError] = useState(null)

  function choose(next) {
    const value = setAppearance(next)
    setSaveError(null)
    setUserSetting(APPEARANCE_SETTING_KEY, value).catch(() => setSaveError("Couldn't save to your account — applied on this device only."))
  }

  return (
    <section className="bg-surface rounded-2xl border border-ink-100 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-ink-900">Appearance</h3>
          <p className="text-xs text-ink-400 mt-0.5">Color scheme and light/dark mode. Saved to your account.</p>
        </div>
        <div role="radiogroup" aria-label="Mode" className="inline-flex rounded-lg border border-ink-200 overflow-hidden text-xs font-medium">
          {MODES.map(m => {
            const Icon = MODE_ICON[m.id]
            const on = appearance.mode === m.id
            return (
              <button key={m.id} type="button" role="radio" aria-checked={on} onClick={() => choose({ mode: m.id })}
                className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${on ? 'bg-ink-900 text-on-fill' : 'bg-surface text-ink-500 hover:bg-ink-50'}`}>
                <Icon size={13} /> {m.label}
              </button>
            )
          })}
        </div>
      </div>

      <div role="radiogroup" aria-label="Color scheme" className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {SCHEMES.map(s => {
          const on = appearance.scheme === s.id
          return (
            <button key={s.id} type="button" role="radio" aria-checked={on} onClick={() => choose({ scheme: s.id })}
              className={`group text-left rounded-lg border p-1.5 transition-colors ${on ? 'border-accent-500 ring-2 ring-accent-500/30' : 'border-ink-200 hover:border-ink-300'}`}>
              {/* Mini sidebar + accent bar: the two things a scheme actually changes. */}
              <div className="flex h-12 rounded-md overflow-hidden" aria-hidden>
                <div className="w-1/3 p-1.5 flex flex-col gap-1" style={{ backgroundColor: s.ink }}>
                  <span className="h-1.5 rounded-sm" style={{ backgroundColor: s.accent }} />
                  <span className="h-1 w-3/4 rounded-sm bg-white/25" />
                  <span className="h-1 w-2/3 rounded-sm bg-white/25" />
                </div>
                <div className="flex-1 bg-canvas p-1.5 flex flex-col justify-end gap-1">
                  <span className="h-1 w-4/5 rounded-sm bg-ink-200" />
                  <span className="h-2.5 w-1/2 rounded-sm" style={{ backgroundColor: s.accent }} />
                </div>
              </div>
              <div className="flex items-center justify-between px-0.5 pt-1.5 pb-0.5">
                <span className="font-mono text-[11px] uppercase tracking-wide text-ink-700">{s.label}</span>
                {on && <Check size={13} className="text-link" />}
              </div>
            </button>
          )
        })}
      </div>
      {saveError && <p className="text-xs text-warning-700">{saveError}</p>}
    </section>
  )
}
