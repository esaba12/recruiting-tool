import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ExternalLink, MailOpen, Mail, Search, Reply, CheckCircle2, Building2, Briefcase } from 'lucide-react'
import { EmptyState } from '../shared.jsx'
import { setThreadRead, completeActionItem } from '../db.js'
import { buildThreads, filterThreads, filterCounts, FILTERS, CATEGORY, snippet, messageTime, gmailThreadUrl } from '../lib/inbox.js'

// Recruiting + networking mail only — the pipelines never log what Claude marked UNRELATED,
// so everything in `interactions` with type='Email' is already the filtered inbox. See
// lib/inbox.js for grouping/classification and the 20261007000000_inbox migration for fields.

const TONE = {
  ink:     'bg-ink-100 text-ink-600',
  accent:  'bg-accent-50 text-accent-700',
  warning: 'bg-warning-50 text-warning-700',
  success: 'bg-success-50 text-success-700',
  danger:  'bg-danger-50 text-danger-600',
}

function CategoryTag({ category, group }) {
  const meta = CATEGORY[category]
  const label = meta?.label || (group === 'recruiting' ? 'Application' : 'Networking')
  return (
    <span className={`inline-block px-1.5 py-px rounded-sm text-[10px] font-semibold uppercase tracking-wide ${TONE[meta?.tone || 'ink']}`}>
      {label}
    </span>
  )
}

function when(ms, hasTime) {
  if (!ms) return ''
  const d = new Date(ms)
  const now = new Date()
  if (hasTime && d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString('en-US', d.getFullYear() === now.getFullYear()
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' })
}

function ThreadRow({ thread, active, index, onOpen }) {
  const last = thread.last
  return (
    <button onClick={() => onOpen(thread)}
      style={{ animationDelay: `${Math.min(index, 12) * 28}ms` }}
      className={`inbox-rise w-full text-left px-4 py-3 border-b border-ink-100 flex gap-3 transition-colors
        ${active ? 'bg-ink-900 text-white' : 'bg-white hover:bg-ink-50'}`}>
      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${thread.unread ? 'bg-accent-500' : 'bg-transparent'}`} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={`truncate text-sm ${thread.unread ? 'font-bold' : 'font-medium'} ${active ? 'text-white' : 'text-ink-900'}`}>
            {thread.counterpart}
          </span>
          {thread.company && <span className={`truncate text-xs ${active ? 'text-ink-300' : 'text-ink-400'}`}>{thread.company}</span>}
          <span className={`ml-auto shrink-0 font-mono text-[11px] ${active ? 'text-ink-300' : 'text-ink-400'}`}>
            {when(thread.lastAt, !!last.sentAt)}
          </span>
        </span>
        <span className={`block truncate text-sm mt-0.5 ${thread.unread ? 'font-semibold' : ''} ${active ? 'text-ink-100' : 'text-ink-700'}`}>
          {thread.subject}
        </span>
        <span className={`block truncate text-xs mt-0.5 ${active ? 'text-ink-300' : 'text-ink-400'}`}>
          {last.direction === 'Outbound' && <span className="font-medium">You: </span>}{snippet(last)}
        </span>
        <span className="flex items-center gap-2 mt-1.5">
          <CategoryTag category={thread.category} group={thread.group} />
          {thread.needsReply && (
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${active ? 'text-accent-300' : 'text-accent-600'}`}>
              <Reply size={11} strokeWidth={2.5} /> Needs a reply
            </span>
          )}
          {thread.messages.length > 1 && (
            <span className={`font-mono text-[10px] ${active ? 'text-ink-300' : 'text-ink-400'}`}>{thread.messages.length} msgs</span>
          )}
        </span>
      </span>
    </button>
  )
}

function Message({ m, contactName }) {
  const mine = m.direction === 'Outbound'
  const name = mine ? 'You' : (m.fromName || contactName || m.fromAddress || 'Unknown sender')
  const text = (m.body || m.summary || '').replace(/^📅 Meeting link: \S+\s*/, '')
  const meeting = (m.summary || '').match(/^📅 Meeting link: (\S+)/)?.[1]
  return (
    <article className={`border-l-2 pl-4 py-1 ${mine ? 'border-ink-300 ml-6' : 'border-accent-400'}`}>
      <header className="flex items-baseline gap-2 flex-wrap">
        <span className="text-sm font-semibold text-ink-900">{name}</span>
        {!mine && m.fromAddress && <span className="text-xs text-ink-400">{m.fromAddress}</span>}
        <span className="ml-auto font-mono text-[11px] text-ink-400">
          {m.sentAt
            ? new Date(m.sentAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
            : when(messageTime(m), false)}
        </span>
      </header>
      {meeting && (
        <a href={meeting} target="_blank" rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-accent-600 hover:underline">
          📅 Join meeting <ExternalLink size={11} />
        </a>
      )}
      <p className="mt-2 text-[14px] leading-relaxed text-ink-700 whitespace-pre-wrap break-words">
        {text || <span className="italic text-ink-400">(no text — open in Gmail to see it)</span>}
      </p>
    </article>
  )
}

function Reader({ thread, onBack, onToggleRead, onCompleteItem }) {
  return (
    <div key={thread.id} className="inbox-rise h-full overflow-y-auto">
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-ink-100 px-6 py-3 flex items-center gap-2">
        <button onClick={onBack} className="md:hidden -ml-2 p-1.5 rounded text-ink-500 hover:bg-ink-100" aria-label="Back to inbox">
          <ArrowLeft size={18} />
        </button>
        <button onClick={() => onToggleRead(thread, thread.unread)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-ink-600 border border-ink-200 hover:border-ink-400">
          {thread.unread ? <><MailOpen size={13} /> Mark read</> : <><Mail size={13} /> Mark unread</>}
        </button>
        <a href={gmailThreadUrl(thread)} target="_blank" rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold bg-accent-500 text-white hover:bg-accent-600">
          <Reply size={13} /> Reply in Gmail
        </a>
      </div>

      <div className="px-6 py-6 max-w-2xl">
        <div className="flex items-center gap-2 mb-2">
          <CategoryTag category={thread.category} group={thread.group} />
          {thread.mailbox && <span className="font-mono text-[11px] text-ink-400">{thread.mailbox}</span>}
        </div>
        <h2 className="text-2xl font-semibold text-ink-900 leading-tight">{thread.subject}</h2>

        {(thread.contact || thread.application) && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
            {thread.contact && (
              <span className="inline-flex items-center gap-1.5">
                <Building2 size={13} /> {thread.contact.name}{thread.contact.company ? ` · ${thread.contact.company}` : ''}
              </span>
            )}
            {thread.application && (
              <span className="inline-flex items-center gap-1.5">
                <Briefcase size={13} /> {thread.application.role || thread.application.company}
                <span className="font-semibold text-ink-700">— {thread.application.stage}</span>
              </span>
            )}
          </div>
        )}

        {thread.actionItems.length > 0 && (
          <div className="mt-5 border border-accent-200 bg-accent-50 rounded-md px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-accent-700 mb-1.5">What to do</p>
            {thread.actionItems.map(item => (
              <div key={item.id} className="flex items-start gap-2 py-1">
                <span className="flex-1 text-sm text-ink-800">
                  {item.summary}
                  {item.dueDate && <span className="ml-2 font-mono text-[11px] text-accent-700">by {item.dueDate}</span>}
                </span>
                <button onClick={() => onCompleteItem(item)}
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-ink-600 hover:text-success-600">
                  <CheckCircle2 size={14} /> Done
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 space-y-6">
          {thread.messages.map(m => <Message key={m.id} m={m} contactName={thread.contact?.name} />)}
        </div>
      </div>
    </div>
  )
}

export default function InboxTab({ contacts, apps, interactions, actionItems = [], onRefresh, demoMode = false }) {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState(null)
  // Optimistic overlays so read toggles and "Done" feel instant without a full reload.
  const [readOverride, setReadOverride] = useState({})
  const [doneItems, setDoneItems] = useState(() => new Set())

  const threads = useMemo(() => {
    const items = actionItems.filter(i => !doneItems.has(i.id))
    return buildThreads({ interactions, contacts, apps, actionItems: items })
      .map(t => (t.id in readOverride ? { ...t, unread: !readOverride[t.id] } : t))
  }, [interactions, contacts, apps, actionItems, readOverride, doneItems])

  const counts = filterCounts(threads)
  const visible = filterThreads(threads, filter, query)
  const open = threads.find(t => t.id === openId) || null

  // Desktop: land on the newest thread so the reading pane is never blank.
  useEffect(() => {
    if (!openId && visible.length && window.matchMedia('(min-width: 768px)').matches) setOpenId(visible[0].id)
  }, [openId, visible])

  async function toggleRead(thread, read) {
    setReadOverride(o => ({ ...o, [thread.id]: read }))
    try { await setThreadRead(thread.id, read) }
    catch { setReadOverride(o => ({ ...o, [thread.id]: !read })) }
  }

  function openThread(thread) {
    setOpenId(thread.id)
    if (thread.unread) toggleRead(thread, true)
  }

  async function completeItem(item) {
    setDoneItems(s => new Set(s).add(item.id))
    try { await completeActionItem(item.id); onRefresh?.() }
    catch { setDoneItems(s => { const n = new Set(s); n.delete(item.id); return n }) }
  }

  if (!threads.length) {
    return (
      <EmptyState msg={demoMode
        ? 'No sample emails in this demo.'
        : 'No recruiting or networking emails yet. Connect Gmail in Settings and they\'ll show up here automatically — everything else in your inbox is filtered out.'} />
    )
  }

  const unreadCount = threads.filter(t => t.unread).length

  return (
    <div>
      <div className="pb-0 border-b border-ink-200">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-ink-900">Inbox</h1>
            <p className="text-sm text-ink-500 mt-0.5">
              Only the emails about your job search — applications, interviews, and people you're talking to.
              {unreadCount > 0 && <span className="font-mono text-accent-600 ml-2">{unreadCount} unread</span>}
            </p>
          </div>
          <label className="ml-auto relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search people, companies, text…"
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-ink-200 rounded text-sm focus:outline-none focus:border-accent-400" />
          </label>
        </div>
        <div className="flex gap-1 mt-4 overflow-x-auto">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => { setFilter(f.key); setOpenId(null) }}
              className={`shrink-0 px-3 py-2 text-xs font-semibold border-b-2 transition-colors
                ${filter === f.key ? 'border-accent-500 text-ink-900' : 'border-transparent text-ink-400 hover:text-ink-700'}`}>
              {f.label}
              <span className={`ml-1.5 font-mono ${filter === f.key ? 'text-accent-600' : 'text-ink-300'}`}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex h-[calc(100vh-15rem)] min-h-[420px] border border-ink-200 rounded-md overflow-hidden bg-white">
        <div className={`${open ? 'hidden md:block' : 'block'} w-full md:w-[380px] shrink-0 overflow-y-auto border-r border-ink-200 bg-white`}>
          {visible.length === 0
            ? <p className="px-4 py-10 text-sm text-ink-400 text-center">Nothing here.</p>
            : visible.map((t, idx) => (
              <ThreadRow key={t.id} thread={t} index={idx} active={t.id === openId} onOpen={openThread} />
            ))}
        </div>
        <div className={`${open ? 'block' : 'hidden md:block'} flex-1 min-w-0 bg-white`}>
          {open
            ? <Reader thread={open} onBack={() => setOpenId(null)} onToggleRead={toggleRead} onCompleteItem={completeItem} />
            : <p className="h-full flex items-center justify-center text-sm text-ink-400">Pick a conversation.</p>}
        </div>
      </div>
    </div>
  )
}
