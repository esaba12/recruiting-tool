// When a contact's follow-up counts as done (v1.5 spec 01). Shared by Today (client) and the
// Gmail scan (api/_lib/emailPipeline.js), so a follow-up you sent clears in both places by the
// same rule: you wrote to them no more than FOLLOW_UP_EARLY_DAYS before the due date, or any
// time after it. Writing earlier than that doesn't count, since you may have planned a second touch.

export const FOLLOW_UP_EARLY_DAYS = 3

// Interaction types that count as reaching out. 'Other' is what "Done" logs, but Done also
// clears the date, so it never needs to count here.
const TOUCH_TYPES = ['Email', 'LinkedIn', 'Call', 'Meeting']

function shiftDay(day, days) {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Both arguments are 'YYYY-MM-DD' (or anything starting with one).
export function followUpSatisfied(followUpDate, sentDay) {
  if (!followUpDate || !sentDay) return false
  return String(sentDay).slice(0, 10) >= shiftDay(String(followUpDate).slice(0, 10), -FOLLOW_UP_EARLY_DAYS)
}

// True when an Outbound touch to this contact already satisfies their follow-up date.
export function followedUp(contact, interactions = []) {
  if (!contact?.followUpDate) return false
  return interactions.some(i =>
    i.contactId === contact.id && i.direction === 'Outbound' && TOUCH_TYPES.includes(i.type) &&
    followUpSatisfied(contact.followUpDate, i.date))
}
