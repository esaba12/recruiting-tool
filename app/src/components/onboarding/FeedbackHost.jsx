import { useEffect, useState } from 'react'
import { MessageSquareText, Check } from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Mono from '../ui/Mono.jsx'
import { supabase } from '../../lib/supabaseClient.js'

// In-app feedback (v1.2 spec 07). Mounted once in AppInner; anything can open it with
// openFeedback() (Sidebar footer, Settings). Rows land in the insert-only `feedback`
// table — users can't read them back; the owner reads them in the Supabase dashboard.
export function openFeedback(page) {
  window.dispatchEvent(new CustomEvent('rec:feedback', { detail: { page } }))
}

export default function FeedbackHost() {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(null)
  const [message, setMessage] = useState('')
  const [state, setState] = useState('idle')   // idle | sending | sent | error
  const [err, setErr] = useState(null)

  useEffect(() => {
    const onOpen = e => { setPage(e.detail?.page || null); setOpen(true); setState('idle'); setErr(null) }
    window.addEventListener('rec:feedback', onOpen)
    return () => window.removeEventListener('rec:feedback', onOpen)
  }, [])

  async function send() {
    setState('sending'); setErr(null)
    const { error } = await supabase.from('feedback').insert({ message: message.trim().slice(0, 4000), page })
    if (error) { setState('error'); setErr(error.message); return }
    setState('sent'); setMessage('')
  }

  return (
    <Modal open={open} onClose={() => setOpen(false)} size="sm">
      <div className="p-5">
        <Mono className="text-accent-600">FEEDBACK</Mono>
        {state === 'sent' ? (
          <div className="mt-2">
            <p className="font-heading text-lg font-semibold text-ink-900 flex items-center gap-2"><Check size={18} className="text-success-600" /> Thanks, got it.</p>
            <p className="text-sm text-ink-500 mt-1">Every note gets read.</p>
            <div className="flex justify-end mt-4"><Button size="sm" onClick={() => setOpen(false)}>Close</Button></div>
          </div>
        ) : (
          <>
            <h2 className="font-heading text-lg font-semibold text-ink-900 mt-0.5 flex items-center gap-2"><MessageSquareText size={17} /> What's broken or missing?</h2>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} maxLength={4000} autoFocus
              placeholder="Bugs, confusing bits, features you wish existed…"
              className="mt-3 w-full px-2.5 py-2 border border-ink-200 rounded-md text-sm focus:outline-none focus:border-accent-400 resize-none" />
            {err && <p className="text-xs text-danger-600 mt-1">{err}</p>}
            <div className="flex items-center justify-end gap-2 mt-3">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={send} disabled={!message.trim() || state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send'}</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
