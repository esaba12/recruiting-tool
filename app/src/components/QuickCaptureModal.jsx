import { useState, useRef, useEffect } from 'react'
import { Sparkles, Loader2, Send } from 'lucide-react'
import { addContact, updateContact, addInteraction, addCallEntry, addApplication, updateApplication, updateApplicationTriage } from '../db.js'
import { parseQuickCapture, bestContactMatches, bestApplicationMatches, TYPE_OPTIONS, TRIAGE_OPTIONS } from '../lib/quickCapture.js'
import { ROLE_OPTIONS, STATUS_OPTIONS, REFERRAL_STATUS_OPTIONS, STAGE_ORDER } from '../shared.jsx'
import { normalizeCompanyName } from '../lib/networkGraph.js'
import { useTargetCompanies } from '../lib/useTargetCompanies.js'
import Modal from './ui/Modal.jsx'
import Button from './ui/Button.jsx'

const EXAMPLES = [
  '"justin aronwald just said he\'d recommend me"',
  '"need to apply to this https://boards.greenhouse.io/..."',
  '"mark the stripe application as phone screen"',
  '"add anthropic to my target companies"',
  '"mark the recruiter from datadog as closed, went cold"',
]

let nextId = 1
const uid = () => nextId++

// The chatbot-style entry point: say what you want in plain English, and
// quickCapture.js's parseQuickCapture() routes it to whichever CRM action it implies —
// log an interaction, update or create a contact, add or update a Pipeline application,
// or add a target company. Nothing is written until the user reviews the draft card and
// hits Confirm — same "AI drafts, human confirms" shape as QuickAddContactModal's
// enrichment review step, just chat-shaped and able to take more than one kind of action.
export default function QuickCaptureModal({ contacts = [], apps = [], onClose, onSaved }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef(null)
  const { targets, setTargets } = useTargetCompanies()

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  function patch(id, fields) {
    setMessages(msgs => msgs.map(m => m.id === id ? { ...m, ...fields } : m))
  }
  function patchDraft(id, fields) {
    setMessages(msgs => msgs.map(m => m.id === id ? { ...m, draft: { ...m.draft, ...fields } } : m))
  }

  async function send() {
    const text = input.trim()
    if (!text || thinking) return
    setInput('')
    setMessages(msgs => [...msgs, { id: uid(), role: 'user', text }])
    const thinkingId = uid()
    setMessages(msgs => [...msgs, { id: thinkingId, role: 'assistant', kind: 'thinking' }])
    setThinking(true)
    try {
      const draft = await parseQuickCapture(text, contacts, apps)
      if (draft.action === 'unclear') {
        setMessages(msgs => msgs.map(m => m.id === thinkingId
          ? { ...m, kind: 'text', text: draft.clarifyingQuestion || "I couldn't tell what to do with that — try adding more detail." }
          : m))
      } else {
        setMessages(msgs => msgs.map(m => m.id === thinkingId ? { ...m, kind: 'draft', draft, status: 'pending' } : m))
      }
    } catch (e) {
      setMessages(msgs => msgs.map(m => m.id === thinkingId ? { ...m, kind: 'error', text: e.message } : m))
    } finally {
      setThinking(false)
    }
  }

  async function confirm(msgId, draft) {
    patch(msgId, { status: 'saving' })
    try {
      if (draft.action === 'add_application') {
        await addApplication({ company: draft.company, role: draft.role, jdLink: draft.jdLink, location: draft.location })
        patch(msgId, { status: 'saved', savedInfo: { name: draft.company, company: draft.role, isApplication: true } })
        onSaved?.()
        return
      }

      if (draft.action === 'update_application') {
        const app = apps.find(a => a.id === draft.resolvedApplicationId)
        if (!app) throw new Error('Pick which application this is about')
        if (draft.stage) await updateApplication(app.id, { stage: draft.stage })
        if (draft.triage) await updateApplicationTriage(app.id, draft.triage, draft.stage || app.stage)
        if (draft.notesAppend) {
          const merged = app.notes ? `${app.notes}\n${draft.notesAppend}` : draft.notesAppend
          await updateApplication(app.id, { notes: merged })
        }
        patch(msgId, { status: 'saved', savedInfo: { name: app.company, company: draft.stage || draft.triage || 'updated', isApplicationUpdate: true } })
        onSaved?.()
        return
      }

      if (draft.action === 'add_target_company') {
        const already = targets.some(t => normalizeCompanyName(t) === normalizeCompanyName(draft.company))
        if (!already) setTargets([...targets, draft.company])
        patch(msgId, { status: 'saved', savedInfo: { name: draft.company, alreadyTargeted: already, isTargetCompany: true } })
        return
      }

      let contactId = draft.resolvedContactId
      let created = false
      if (!contactId) {
        contactId = (await addContact({ name: draft.contactName, company: draft.company, role: draft.roleGuess })).id
        created = true
      }

      if (draft.action === 'log_interaction' && draft.interactionType) {
        await addInteraction({
          contactId, contactName: draft.contactName, type: draft.interactionType, direction: 'N/A',
          summary: draft.summary || undefined, body: draft.rawText,
        })
        if (draft.interactionType === 'Call') {
          await addCallEntry({ contactId, contactName: draft.contactName, company: draft.company, summary: draft.summary })
        }
      }

      const cpatch = {}
      if (draft.referralStatus) cpatch.referralStatus = draft.referralStatus
      if (draft.statusBump) cpatch.status = draft.statusBump
      if (draft.notesAppend) {
        const existing = contacts.find(c => c.id === contactId)
        const prevNotes = existing?.notes || ''
        cpatch.notes = prevNotes ? `${prevNotes}\n${draft.notesAppend}` : draft.notesAppend
      }
      if (Object.keys(cpatch).length > 0) await updateContact(contactId, cpatch)

      patch(msgId, { status: 'saved', savedInfo: { name: draft.contactName, company: draft.company, created } })
      onSaved?.()
    } catch (e) {
      patch(msgId, { status: 'error', error: e.message })
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <Modal onClose={onClose} size="lg">
      <div className="sticky top-0 bg-white border-b border-ink-100 px-5 py-4 flex items-center justify-between z-10 rounded-t-2xl">
        <h2 className="text-base font-heading font-semibold text-ink-900 flex items-center gap-2">
          <Sparkles size={16} className="text-accent-500" /> Quick Capture
        </h2>
        <button onClick={onClose} className="w-7 h-7 rounded-full bg-ink-100 hover:bg-ink-200 flex items-center justify-center text-ink-500 text-sm">✕</button>
      </div>

      <div className="flex flex-col h-[70vh] md:h-[560px]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-ink-500 mb-3">Say what you want, in plain English — log a touchpoint, add or update an application, target a company. I'll figure out what to do.</p>
              <div className="space-y-1.5">
                {EXAMPLES.map(ex => (
                  <p key={ex} className="text-xs text-ink-400 italic">{ex}</p>
                ))}
              </div>
            </div>
          )}

          {messages.map(m => (
            <MessageBubble key={m.id} m={m} contacts={contacts} apps={apps}
              onPatchDraft={fields => patchDraft(m.id, fields)}
              onConfirm={() => confirm(m.id, m.draft)} />
          ))}
        </div>

        <div className="border-t border-ink-100 p-3 flex items-end gap-2 bg-white rounded-b-2xl">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="justin aronwald just said he'd recommend me..."
            rows={1}
            autoFocus
            className="flex-1 px-3 py-2.5 border border-ink-200 rounded-xl text-sm focus:outline-none focus:border-accent-400 resize-none max-h-24"
          />
          <Button onClick={send} disabled={thinking || !input.trim()} className="shrink-0 flex items-center gap-1.5">
            {thinking ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function MessageBubble({ m, contacts, apps, onPatchDraft, onConfirm }) {
  if (m.role === 'user') {
    return <div className="ml-auto max-w-[80%] bg-accent-500 text-white rounded-2xl rounded-tr-sm px-3.5 py-2 text-sm">{m.text}</div>
  }
  if (m.kind === 'thinking') {
    return (
      <div className="max-w-[80%] bg-ink-50 border border-ink-100 rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm text-ink-400 flex items-center gap-1.5">
        <Loader2 size={13} className="animate-spin" /> Thinking...
      </div>
    )
  }
  if (m.kind === 'text') {
    return <div className="max-w-[80%] bg-ink-50 border border-ink-100 rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm text-ink-700">{m.text}</div>
  }
  if (m.kind === 'error') {
    return <div className="max-w-[85%] bg-danger-50 border border-danger-200 rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm text-danger-700">{m.text}</div>
  }
  if (m.kind === 'draft') {
    if (m.status === 'saved') {
      if (m.savedInfo.isApplication) {
        return (
          <div className="max-w-[90%] bg-success-50 border border-success-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-success-700">
            ✓ Added to Pipeline — <strong>{m.savedInfo.name}</strong>{m.savedInfo.company ? ` — ${m.savedInfo.company}` : ''}.
          </div>
        )
      }
      if (m.savedInfo.isApplicationUpdate) {
        return (
          <div className="max-w-[90%] bg-success-50 border border-success-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-success-700">
            ✓ Updated <strong>{m.savedInfo.name}</strong> — {m.savedInfo.company}.
          </div>
        )
      }
      if (m.savedInfo.isTargetCompany) {
        return (
          <div className="max-w-[90%] bg-success-50 border border-success-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-success-700">
            {m.savedInfo.alreadyTargeted
              ? <>Already targeting <strong>{m.savedInfo.name}</strong>.</>
              : <>✓ Added <strong>{m.savedInfo.name}</strong> to target companies.</>}
          </div>
        )
      }
      return (
        <div className="max-w-[90%] bg-success-50 border border-success-200 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-success-700">
          ✓ Logged — {m.savedInfo.created ? 'created new contact' : 'updated'} <strong>{m.savedInfo.name}</strong>{m.savedInfo.company ? ` @ ${m.savedInfo.company}` : ''}.
        </div>
      )
    }
    if (m.draft.action === 'add_application') {
      return <ApplicationDraftCard draft={m.draft} status={m.status} error={m.error} onPatch={onPatchDraft} onConfirm={onConfirm} />
    }
    if (m.draft.action === 'update_application') {
      return <ApplicationUpdateDraftCard draft={m.draft} status={m.status} error={m.error} apps={apps} onPatch={onPatchDraft} onConfirm={onConfirm} />
    }
    if (m.draft.action === 'add_target_company') {
      return <TargetCompanyDraftCard draft={m.draft} status={m.status} error={m.error} onPatch={onPatchDraft} onConfirm={onConfirm} />
    }
    return <DraftCard draft={m.draft} status={m.status} error={m.error} contacts={contacts} onPatch={onPatchDraft} onConfirm={onConfirm} />
  }
  return null
}

function ApplicationDraftCard({ draft, status, error, onPatch, onConfirm }) {
  const saving = status === 'saving'
  return (
    <div className="max-w-[90%] bg-white border border-ink-200 rounded-2xl rounded-tl-sm shadow-sm p-3.5 space-y-3">
      {error && <div className="p-2 bg-danger-50 border border-danger-200 rounded-lg text-xs text-danger-700">{error}</div>}
      {draft.importNote && <div className="p-2 bg-warning-50 border border-warning-200 rounded-lg text-xs text-warning-800">{draft.importNote}</div>}

      <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Add to Pipeline</p>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] text-ink-400 mb-0.5">Company</label>
          <input value={draft.company} onChange={e => onPatch({ company: e.target.value })}
            className="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
        </div>
        <div>
          <label className="block text-[11px] text-ink-400 mb-0.5">Role</label>
          <input value={draft.role} onChange={e => onPatch({ role: e.target.value })}
            className="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
        </div>
      </div>
      <div>
        <label className="block text-[11px] text-ink-400 mb-0.5">Location</label>
        <input value={draft.location} onChange={e => onPatch({ location: e.target.value })}
          className="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
      </div>
      <div>
        <label className="block text-[11px] text-ink-400 mb-0.5">Link</label>
        <input value={draft.jdLink} onChange={e => onPatch({ jdLink: e.target.value })}
          className="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
      </div>

      <Button onClick={onConfirm} disabled={saving || !draft.company.trim()} className="w-full">
        {saving ? 'Saving...' : '✓ Add to Pipeline'}
      </Button>
    </div>
  )
}

function ApplicationUpdateDraftCard({ draft, status, error, apps, onPatch, onConfirm }) {
  const scored = bestApplicationMatches(draft.applicationQuery, apps, 8)
  // Fall back to every open application if the text match came up empty — better to make
  // the user pick manually than to show an empty, unusable dropdown.
  const openApps = apps.filter(a => !['Rejected', 'Accepted'].includes(a.stage))
  const options = scored.length > 0 ? scored.map(s => s.app) : openApps
  const saving = status === 'saving'

  return (
    <div className="max-w-[90%] bg-white border border-ink-200 rounded-2xl rounded-tl-sm shadow-sm p-3.5 space-y-3">
      {error && <div className="p-2 bg-danger-50 border border-danger-200 rounded-lg text-xs text-danger-700">{error}</div>}

      <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Update application</p>

      <div>
        <label className="block text-[11px] text-ink-400 mb-0.5">Which application</label>
        <select value={draft.resolvedApplicationId} onChange={e => onPatch({ resolvedApplicationId: e.target.value })}
          className="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 bg-white">
          <option value="">— select —</option>
          {options.map(app => (
            <option key={app.id} value={app.id}>{app.company}{app.role ? ` — ${app.role}` : ''}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[11px] text-ink-400 mb-0.5">Stage</label>
          <select value={draft.stage} onChange={e => onPatch({ stage: e.target.value })}
            className="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 bg-white">
            <option value="">— no change —</option>
            {STAGE_ORDER.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-ink-400 mb-0.5">Triage</label>
          <select value={draft.triage} onChange={e => onPatch({ triage: e.target.value })}
            className="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 bg-white">
            <option value="">— no change —</option>
            {TRIAGE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[11px] text-ink-400 mb-0.5">Note</label>
        <textarea value={draft.notesAppend} onChange={e => onPatch({ notesAppend: e.target.value })} rows={2}
          placeholder="Anything else worth remembering"
          className="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 resize-none" />
      </div>

      <Button onClick={onConfirm} disabled={saving || !draft.resolvedApplicationId} className="w-full">
        {saving ? 'Saving...' : '✓ Update'}
      </Button>
    </div>
  )
}

function TargetCompanyDraftCard({ draft, status, error, onPatch, onConfirm }) {
  const saving = status === 'saving'
  return (
    <div className="max-w-[90%] bg-white border border-ink-200 rounded-2xl rounded-tl-sm shadow-sm p-3.5 space-y-3">
      {error && <div className="p-2 bg-danger-50 border border-danger-200 rounded-lg text-xs text-danger-700">{error}</div>}

      <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Add target company</p>

      <div>
        <label className="block text-[11px] text-ink-400 mb-0.5">Company</label>
        <input value={draft.company} onChange={e => onPatch({ company: e.target.value })}
          className="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
      </div>

      <Button onClick={onConfirm} disabled={saving || !draft.company.trim()} className="w-full">
        {saving ? 'Saving...' : '✓ Add to targets'}
      </Button>
    </div>
  )
}

function DraftCard({ draft, status, error, contacts, onPatch, onConfirm }) {
  const matches = bestContactMatches(draft.contactName, contacts, 8)
  const saving = status === 'saving'

  return (
    <div className="max-w-[90%] bg-white border border-ink-200 rounded-2xl rounded-tl-sm shadow-sm p-3.5 space-y-3">
      {error && <div className="p-2 bg-danger-50 border border-danger-200 rounded-lg text-xs text-danger-700">{error}</div>}

      <div>
        <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide mb-1">
          {draft.action === 'update_contact' ? 'Update contact' : 'Log interaction'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-ink-400 mb-0.5">Name</label>
            <input value={draft.contactName} onChange={e => onPatch({ contactName: e.target.value, resolvedContactId: '' })}
              className="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
          </div>
          <div>
            <label className="block text-[11px] text-ink-400 mb-0.5">Which contact</label>
            <select value={draft.resolvedContactId} onChange={e => onPatch({ resolvedContactId: e.target.value })}
              className="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 bg-white">
              <option value="">+ Create new contact</option>
              {matches.map(({ contact }) => (
                <option key={contact.id} value={contact.id}>{contact.name}{contact.company ? ` @ ${contact.company}` : ''}</option>
              ))}
            </select>
          </div>
        </div>
        {!draft.resolvedContactId && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <label className="block text-[11px] text-ink-400 mb-0.5">Company</label>
              <input value={draft.company} onChange={e => onPatch({ company: e.target.value })}
                className="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400" />
            </div>
            <div>
              <label className="block text-[11px] text-ink-400 mb-0.5">Role</label>
              <select value={draft.roleGuess} onChange={e => onPatch({ roleGuess: e.target.value })}
                className="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 bg-white">
                {ROLE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {draft.action === 'log_interaction' && (
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <label className="text-[11px] text-ink-400">Type</label>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-2 items-start">
            <select value={draft.interactionType} onChange={e => onPatch({ interactionType: e.target.value })}
              className="px-2 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 bg-white">
              {TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <textarea value={draft.summary} onChange={e => onPatch({ summary: e.target.value })} rows={2}
              placeholder="Summary"
              className="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 resize-none" />
          </div>
        </div>
      )}

      {(draft.referralStatus || draft.statusBump || draft.action === 'update_contact') && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-ink-400 mb-0.5">Referral status</label>
            <select value={draft.referralStatus} onChange={e => onPatch({ referralStatus: e.target.value })}
              className="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 bg-white">
              <option value="">— no change —</option>
              {REFERRAL_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-ink-400 mb-0.5">Status</label>
            <select value={draft.statusBump} onChange={e => onPatch({ statusBump: e.target.value })}
              className="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 bg-white">
              <option value="">— no change —</option>
              {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
      )}

      <div>
        <label className="block text-[11px] text-ink-400 mb-0.5">Note</label>
        <textarea value={draft.notesAppend} onChange={e => onPatch({ notesAppend: e.target.value })} rows={2}
          placeholder="Anything else worth remembering"
          className="w-full px-2 py-1.5 border border-ink-200 rounded-lg text-sm focus:outline-none focus:border-accent-400 resize-none" />
      </div>

      <Button onClick={onConfirm} disabled={saving || !draft.contactName.trim()} className="w-full">
        {saving ? 'Saving...' : '✓ Confirm'}
      </Button>
    </div>
  )
}
