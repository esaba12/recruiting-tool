// Everything Today lists, derived once (v1.5 spec 02). TodayTab renders it and the sidebar
// badge counts it, so the two can't disagree. Pure: the layout and snoozes come in as arguments,
// and lib/useTodayAttention.js wires them to user_settings.
import {
  staleApplications, oaDue, oaNeedsCheck, needsReviewApps, openActionItems, trimActionItems,
  todayPeople, offerDecisions, upcomingInterviews, PEOPLE_GROUPS,
} from './attention.js'
import { enabledGroups, settingValue } from './todayCards.js'
import { deriveEventAttention } from '../components/today/EventAttentionSections.jsx'

// Snooze key per list: `${list}:${SNOOZE_KEY[list](row)}` (user_settings.today_prefs.snoozed).
export const SNOOZE_KEY = {
  thankYou: x => x.id, overdue: c => c.id, awaiting: x => x.contact.id, schedule: c => c.id, urgent: c => c.id,
  keepInTouch: x => x.contact.id, stale: a => a.id, review: a => a.id, oa: a => a.id, oaCheck: a => a.id,
  replies: d => d.id, interview: a => a.id, decisions: a => a.id,
}

export const snoozeKey = (list, row) => `${list}:${SNOOZE_KEY[list](row)}`

const total = groups => Object.values(groups).reduce((n, rows) => n + rows.length, 0)

export function deriveTodayAttention(
  { contacts = [], apps = [], interactions = [], actionItems = [], emailDrafts = [], eventPool = null },
  { layout, ctx, isSnoozed = () => false, now = Date.now() },
) {
  const placed = Object.fromEntries(layout.cards.map(c => [c.id, c]))
  const groupsOn = id => (placed[id] ? enabledGroups(placed[id], ctx) : [])

  // AI action items that already resolved themselves (replied on the thread, long expired,
  // duplicates) never reach the list.
  const trimmed = trimActionItems(openActionItems(actionItems), interactions, { now })
  // A contact shows up in one people group only, the first one that's on.
  const peopleOn = groupsOn('people')
  const people = todayPeople(contacts, interactions, {
    off: PEOPLE_GROUPS.filter(g => !peopleOn.includes(g)),
    awaitingDays: placed.people ? settingValue(placed.people, 'awaitingDays') : undefined,
    apps, now,
  })
  // Rows the user hid (✕ / Clear all) stay hidden until their snooze ends.
  let snoozedHidden = 0
  const visible = (id, rows) => {
    const out = rows.filter(r => !isSnoozed(snoozeKey(id, r)))
    snoozedHidden += rows.length - out.length
    return out
  }

  const openItems = placed.email ? trimmed.items : []
  const replyDrafts = placed.replies ? visible('replies', emailDrafts) : []
  const peopleGroups = Object.fromEntries(PEOPLE_GROUPS.map(id => [id, visible(id, people[id])]))
  const appsOn = groupsOn('apps')
  const staleDays = placed.apps ? settingValue(placed.apps, 'staleDays') : 14
  const decisions = placed.decisions ? visible('decisions', offerDecisions(apps, now)) : []
  const appRows = {
    interview: () => upcomingInterviews(apps, { now }),
    oa: () => oaDue(apps),
    stale: () => staleApplications(apps, { days: staleDays }),
    review: () => needsReviewApps(apps),
    oaCheck: () => oaNeedsCheck(apps),
  }
  const appGroups = Object.fromEntries(Object.entries(appRows).map(([id, rows]) => [id, appsOn.includes(id) ? visible(id, rows()) : []]))
  // Recruiting events (v1.1): empty when there's no pool or no campus picked yet.
  const eventAttention = deriveEventAttention(placed.events ? eventPool : null, now)

  // Counts cover the cards and lists that are on, so a hidden list never inflates the total.
  const counts = {
    decisions: decisions.length, replies: replyDrafts.length, email: openItems.length,
    people: total(peopleGroups), apps: total(appGroups), events: eventAttention.count,
  }
  const openCount = Object.values(counts).reduce((a, b) => a + b, 0)

  return {
    placed, trimmed, openItems, replyDrafts, peopleGroups, appGroups, decisions, eventAttention,
    staleDays, counts, openCount, snoozedHidden,
  }
}
