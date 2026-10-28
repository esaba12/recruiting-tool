// Offer decisions (v1.4 spec 04): what's still in play when an offer has a deadline, and
// the "can you expedite?" note for each. Pure, so the panel and the tests share it.
import { STAGE_ORDER, TERMINAL_STAGES, INTERVIEW_STAGES } from '../shared.jsx'
import { daysSince, parseDay } from './dates.js'
import { warmPathsToCompany } from './warmIntro.js'

// offer_details keys (v1.4 spec 02). Free text: comp is quoted every which way.
export const OFFER_DETAIL_FIELDS = [
  { key: 'base', label: 'Base', placeholder: '$50/hr' },
  { key: 'bonus', label: 'Bonus', placeholder: 'Signing, relocation' },
  { key: 'equity', label: 'Equity', placeholder: '—' },
  { key: 'location', label: 'Location', placeholder: 'City or remote' },
  { key: 'start', label: 'Start', placeholder: 'June 2027' },
  { key: 'notes', label: 'Notes', placeholder: 'Anything to weigh', wide: true },
]

const ACTIVE_APPLIED_DAYS = 30

// Every app past Applied that isn't decided yet, plus Applied ones that moved in the last
// 30 days (an older one is likely a silent rejection, not worth an expedite ask).
// Furthest stage first, since those are the ones that can realistically speed up.
export function inProcessApps(apps, { now = Date.now() } = {}) {
  const lastMoved = a => a.lastActivity || a.appliedDate
  return (apps || [])
    .filter(a => !TERMINAL_STAGES.includes(a.stage))
    .filter(a => INTERVIEW_STAGES.includes(a.stage)
      || (a.stage === 'Applied' && lastMoved(a) && daysSince(lastMoved(a), now) <= ACTIVE_APPLIED_DAYS))
    .sort((a, b) => STAGE_ORDER.indexOf(b.stage) - STAGE_ORDER.indexOf(a.stage)
      || (parseDay(lastMoved(b)) || 0) - (parseDay(lastMoved(a)) || 0))
}

// Each in-process app with the person to ask, if you know someone there.
export function inProcessRows(apps, contacts, relationships = [], opts) {
  return inProcessApps(apps, opts).map(app => ({
    app,
    contact: warmPathsToCompany(contacts || [], app.company, relationships)[0]?.contact || null,
  }))
}

function longDay(d) {
  return parseDay(d)?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) || null
}

// The AI prompt's context. It names the deadline but never the company that made the
// offer: that's the user's call to add, and leaving it out of the prompt is the only sure way.
export function expediteContext({ app, deadline }) {
  const when = longDay(deadline)
  return `Still in process: ${app.stage} for ${app.role || 'the role'} at ${app.company}. `
    + (when ? `The other offer has to be answered by ${when}.` : 'The other offer has a deadline coming up.')
}

// The no-key draft: a plain template the user edits before sending.
export function expediteTemplate({ contact, app, deadline }) {
  const first = contact?.name?.split(' ')[0] || 'there'
  const when = longDay(deadline)
  return `Hi ${first},

I wanted to share a quick update: I've received another internship offer, and I need to respond ${when ? `by ${when}` : 'soon'}. ${app.company} is still one of my top choices for the ${app.role || 'role'}, and I'd love to keep going in the process.

Is there any chance the next steps could move a little faster, so I can make my decision with every option in front of me? I understand if the timeline is fixed.

Thank you,
`
}
