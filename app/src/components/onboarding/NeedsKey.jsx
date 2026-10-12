import { cloneElement } from 'react'
import { KeyRound } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext.jsx'
import useKeyStatus from '../../lib/useKeyStatus.js'

// Wrap any button that triggers an AI (kind="ai") or Exa search (kind="exa") call —
// or both (kind={['ai', 'exa']}). With the
// key present it renders the child untouched; without it, the child is disabled before a
// click and a one-tap "add a key" link sits beside it — instead of the proxy's 400 surfacing
// as an error after the click.
export function openSettings() {
  window.dispatchEvent(new CustomEvent('rec:navigate', { detail: { tab: 'settings' } }))
}

export default function NeedsKey({ kind = 'ai', children, inline = true }) {
  const { user } = useAuth()
  const status = useKeyStatus(user?.id)
  const kinds = Array.isArray(kind) ? kind : [kind]
  const missing = kinds.filter(k => !status[k])
  if (!missing.length) return children
  const label = status.demo ? 'Sign up to use AI features'
    : missing.length > 1 ? 'Needs AI + Exa keys'
    : missing[0] === 'exa' ? 'Needs an Exa key for web search' : 'Needs an AI key'
  const child = cloneElement(children, { disabled: true, title: label, onClick: undefined })
  if (status.loading) return child
  // A full-width button keeps its width; the link drops below it instead of beside it.
  const block = !inline || /\bw-full\b/.test(children.props.className || '')
  return (
    <span className={block ? 'flex flex-col gap-1 w-full' : 'inline-flex items-center gap-2 flex-wrap'}>
      {child}
      {status.demo ? (
        <a href="/" className="text-[11px] text-accent-700 hover:underline inline-flex items-center gap-1">
          <KeyRound size={11} /> {label} →
        </a>
      ) : (
        <button type="button" onClick={openSettings}
          className="text-[11px] text-accent-700 hover:underline inline-flex items-center gap-1">
          <KeyRound size={11} /> {label} — add in Settings
        </button>
      )}
    </span>
  )
}
