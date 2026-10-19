import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { Mail, Kanban, UserPlus, Crosshair, ArrowRight, Check, Loader2 } from 'lucide-react'
import Mono from '../ui/Mono.jsx'
import { fetchTargetCompanies } from '../../db.js'
import { useAuth } from '../../lib/AuthContext.jsx'
import useKeyStatus from '../../lib/useKeyStatus.js'
import { useGmailScan, scanGmailNow } from '../../lib/gmailScan.js'
import { gmailSetupState } from '../../lib/onboarding.js'

const ImportModal = lazy(() => import('../import/ImportPanel.jsx'))

// Today's empty state for a brand-new account (lib/onboarding.js's isFreshAccount) —
// replaces "Nothing needs your attention", which is wrong for someone who hasn't added
// anything yet. Rows deep-link via the same rec:navigate event NeedsKey uses, or open the
// v1.4 importers in place. The Gmail row shows the first inbox scan live (v1.4 spec 07):
// a mailbox connected but never scanned gets scanned now, not on the next cron tick.
const go = tab => window.dispatchEvent(new CustomEvent('rec:navigate', { detail: { tab } }))

const GMAIL_ROW = {
  loading:  { title: 'Connect Gmail', sub: 'Applications and contacts fill in from your inbox automatically.' },
  none:     { title: 'Connect Gmail', sub: 'Applications and contacts fill in from your inbox automatically.' },
  needsKey: { title: 'Gmail is connected, but needs an AI key', sub: 'Scanning classifies your mail with your Anthropic or OpenAI key. Add one in Settings.' },
  scanning: { title: 'Reading your inbox (last 45 days)…', sub: 'Applications and contacts appear here as they\'re found.' },
  waiting:  { title: 'First inbox scan in progress', sub: 'It finishes in the background. New mail is checked every ~10 minutes.' },
  done:     { title: 'Gmail connected and scanned', sub: 'New mail is checked every ~10 minutes.' },
}

export default function GettingStarted({ hasApps = false, hasContacts = false, apps = [], contacts = [] }) {
  const { user } = useAuth()
  const keys = useKeyStatus(user?.id)
  const scan = useGmailScan({ autoStart: true })
  const [targets, setTargets] = useState(null)
  const [importKind, setImportKind] = useState(null)
  const importedRef = useRef(false)
  useEffect(() => {
    fetchTargetCompanies().then(t => setTargets(t.length > 0)).catch(() => setTargets(false))
  }, [])

  const g = gmailSetupState({ connections: scan.connections, scanning: scan.scanning, anyAiKey: keys.anyAi, keyLoading: keys.loading })
  const rows = [
    { done: g.kind === 'loading' ? null : g.kind === 'done', busy: g.kind === 'scanning', icon: Mail, ...GMAIL_ROW[g.kind],
      onClick: g.kind === 'waiting' ? () => scanGmailNow() : g.kind === 'scanning' ? null : () => go('settings') },
    { done: hasApps, icon: Kanban, title: 'Import your tracker, or add an application', sub: 'A CSV or rows pasted from Sheets/Excel. Track every role from wishlist to offer.', onClick: () => setImportKind('tracker') },
    { done: hasContacts, icon: UserPlus, title: 'Import your LinkedIn connections', sub: 'See who you already know at every company. Or add people one at a time in Network.', onClick: () => setImportKind('linkedin') },
    { done: targets, icon: Crosshair, title: 'Pick target companies', sub: 'See where you have no contacts yet, and find people there.', onClick: () => go('grow') },
  ]

  return (
    <div className="bg-surface rounded-md border border-accent-200 p-5">
      <Mono className="text-link">GETTING STARTED</Mono>
      <h2 className="font-heading text-lg font-semibold text-ink-900 mt-0.5">Not much here yet. Start with any of these.</h2>
      <div className="mt-4 border-t border-l border-ink-200">
        {rows.map((r, i) => {
          const body = (
            <>
              <Mono className="text-ink-400 w-5">
                {r.busy ? <Loader2 size={13} className="animate-spin text-accent-600" />
                  : r.done ? <Check size={13} strokeWidth={3} className="text-success-600" /> : String(i + 1).padStart(2, '0')}
              </Mono>
              <r.icon size={16} className={r.done ? 'text-success-600' : 'text-ink-500'} />
              <span className="flex-1 min-w-0">
                <span className={`block text-sm font-medium ${r.done ? 'text-ink-400 line-through' : 'text-ink-900'}`}>{r.title}</span>
                <span className="block text-xs text-ink-400">{r.sub}</span>
              </span>
            </>
          )
          return r.onClick
            ? (
              <button key={r.title} onClick={r.onClick}
                className="w-full flex items-center gap-3 px-4 py-3 border-r border-b border-ink-200 text-left hover:bg-ink-50 group">
                {body}
                <ArrowRight size={14} className="text-ink-300 group-hover:text-link transition-colors" />
              </button>
            )
            : <div key={r.title} className="w-full flex items-center gap-3 px-4 py-3 border-r border-b border-ink-200">{body}</div>
        })}
      </div>
      {scan.error && <p className="text-xs text-danger-600 mt-2">{scan.error}</p>}
      {importKind && (
        <Suspense fallback={null}>
          {/* Refetch quietly on close (AppInner's rec:data-changed), not on import: new rows end
              the fresh-account state, which would unmount this card and the modal mid-confirmation. */}
          <ImportModal kind={importKind} apps={apps} contacts={contacts} onImported={() => { importedRef.current = true }}
            onClose={() => {
              setImportKind(null)
              if (importedRef.current) { importedRef.current = false; window.dispatchEvent(new CustomEvent('rec:data-changed')) }
            }} />
        </Suspense>
      )}
    </div>
  )
}
