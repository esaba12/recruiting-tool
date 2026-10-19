import { STATUS_COLOR, URGENCY_COLOR, REFERRAL_STATUS_COLOR, daysUntil, fmt, Badge, isOverdue } from '../shared.jsx'
import { statusIconFor, URGENCY_ICON } from '../lib/icons.js'
import MetButton from './MetButton.jsx'
import Mono from './ui/Mono.jsx'

// Network's contact list below `md`, where ContactsTable's wide grid would scroll sideways.
// Was the "Cards" toggle until v1.4 spec 05 E; now it's simply the phone layout.
export default function ContactCards({ contacts, onEdit, onMet }) {
  return (
    <div className="space-y-2">
      {contacts.map(c => {
        const overdue = isOverdue(c)
        return (
          <div key={c.id} onClick={() => onEdit(c)}
            className={`bg-surface rounded-md px-4 py-3 border cursor-pointer hover:bg-ink-50 transition-colors ${overdue ? 'border-danger-200' : 'border-ink-200'}`}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-ink-900">{c.name}</span>
                  {c.company && <span className="text-sm text-ink-500">@ {c.company}</span>}
                  {c.role && <span className="text-xs text-ink-400">· {c.role}</span>}
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Badge label={c.status} color={STATUS_COLOR[c.status]} icon={statusIconFor(c.status)} />
                  {c.urgency && c.urgency !== 'LOW' && <Badge label={c.urgency} color={URGENCY_COLOR[c.urgency]} icon={URGENCY_ICON[c.urgency]} />}
                  {c.referredByName && <Badge label={`↩ ${c.referredByName}`} color="bg-ink-100 text-ink-700" />}
                  {c.referralStatus && c.referralStatus !== 'Not Asked' && <Badge label={c.referralStatus} color={REFERRAL_STATUS_COLOR[c.referralStatus]} />}
                  {c.email && (
                    <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()} className="text-xs text-link hover:underline">{c.email}</a>
                  )}
                  {c.linkedin && (
                    <a href={c.linkedin} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-link hover:underline">LinkedIn ↗</a>
                  )}
                </div>
                {c.whatTheyDid && <p className="text-xs text-ink-500 mt-1 line-clamp-1 italic">"{c.whatTheyDid}"</p>}
                {!c.whatTheyDid && c.notes && <p className="text-xs text-ink-400 mt-1 line-clamp-1">{c.notes}</p>}
              </div>
              <div className="text-right shrink-0 space-y-1 text-xs">
                {c.lastInteraction && <p className="text-ink-400">Last <Mono>{fmt(c.lastInteraction)}</Mono></p>}
                {c.followUpDate && (
                  <p className={`font-medium ${overdue ? 'text-danger-600' : 'text-ink-500'}`}>
                    {overdue
                      ? <><Mono>{Math.abs(daysUntil(c.followUpDate))}d</Mono> overdue</>
                      : <>Due <Mono>{fmt(c.followUpDate)}</Mono></>}
                  </p>
                )}
                <MetButton contact={c} onMet={onMet} className="mt-1" />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
