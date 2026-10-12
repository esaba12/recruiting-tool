import { useEffect, useState } from 'react'
import { Mail, Kanban, UserPlus, Crosshair, ArrowRight, Check } from 'lucide-react'
import Mono from '../ui/Mono.jsx'
import { listGmailConnections } from '../../lib/googleAuth.js'
import { fetchTargetCompanies } from '../../db.js'

// Today's empty state for a brand-new account (lib/onboarding.js's isFreshAccount) —
// replaces "Nothing needs your attention", which is wrong for someone who hasn't added
// anything yet. Each row deep-links via the same rec:navigate event NeedsKey uses.
const go = tab => window.dispatchEvent(new CustomEvent('rec:navigate', { detail: { tab } }))

export default function GettingStarted({ hasApps = false, hasContacts = false }) {
  const [gmail, setGmail] = useState(null)
  const [targets, setTargets] = useState(null)
  useEffect(() => {
    listGmailConnections().then(c => setGmail(c.length > 0)).catch(() => setGmail(false))
    fetchTargetCompanies().then(t => setTargets(t.length > 0)).catch(() => setTargets(false))
  }, [])

  const rows = [
    { done: gmail, icon: Mail, title: 'Connect Gmail', sub: 'Applications and contacts fill in from your inbox automatically.', tab: 'settings' },
    { done: hasApps, icon: Kanban, title: 'Add your first application', sub: 'Track every role from wishlist to offer.', tab: 'pipeline' },
    { done: hasContacts, icon: UserPlus, title: 'Add someone you know', sub: 'Recruiters, alumni, people you met at a fair.', tab: 'network' },
    { done: targets, icon: Crosshair, title: 'Pick target companies', sub: 'See where you have no contacts yet, and find people there.', tab: 'grow' },
  ]

  return (
    <div className="bg-white rounded-md border border-accent-200 p-5">
      <Mono className="text-accent-600">GETTING STARTED</Mono>
      <h2 className="font-heading text-lg font-semibold text-ink-900 mt-0.5">Not much here yet. Start with any of these.</h2>
      <div className="mt-4 border-t border-l border-ink-200">
        {rows.map((r, i) => (
          <button key={r.title} onClick={() => go(r.tab)}
            className="w-full flex items-center gap-3 px-4 py-3 border-r border-b border-ink-200 text-left hover:bg-ink-50 group">
            <Mono className="text-ink-400 w-5">{r.done ? <Check size={13} strokeWidth={3} className="text-success-600" /> : String(i + 1).padStart(2, '0')}</Mono>
            <r.icon size={16} className={r.done ? 'text-success-600' : 'text-ink-500'} />
            <span className="flex-1 min-w-0">
              <span className={`block text-sm font-medium ${r.done ? 'text-ink-400 line-through' : 'text-ink-900'}`}>{r.title}</span>
              <span className="block text-xs text-ink-400">{r.sub}</span>
            </span>
            <ArrowRight size={14} className="text-ink-300 group-hover:text-accent-600 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  )
}
