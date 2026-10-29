// Today's card registry and layout logic (v1.4 spec 08). Pure, no React: TodayTab renders the
// cards, TodayEditor edits the layout, and useTodayLayout saves it to user_settings.
//
// A layout is { v: 1, cards: [{ id, size, cap, off, settings }], seen: [id…] }. Order is array
// order; a card that's absent is removed. `off` lists a card's groups the user turned off.
// `seen` is every registry id the user has been offered, so a card added to the registry later
// shows up once for everyone, and a card the user removed stays removed.
import { usesTechSources } from './tracks.js'

export const SIZES = ['third', 'half', 'full']
export const SIZE_LABEL = { third: '1/3', half: '1/2', full: 'Full' }
export const CAPS = [3, 5, 10]

// `kind` groups the Add-cards drawer. `groups` are the attention lists inside an action card,
// each one a toggle; their ids are the snooze keys TodayTab already uses.
export const TODAY_CARDS = [
  { id: 'decisions', title: 'Decisions', kind: 'act', size: 'half', rows: true, description: 'Offers waiting on your answer, soonest deadline first.' },
  { id: 'pipeline', title: 'Pipeline', kind: 'glance', size: 'third', description: 'How many you have applied to, the stage funnel and your next deadline.' },
  { id: 'network', title: 'Network', kind: 'glance', size: 'third', description: 'Contacts by warmth.' },
  { id: 'outreach', title: 'Outreach', kind: 'glance', size: 'third', description: 'Logged interactions per week, this week against last.' },
  { id: 'rates', title: 'Rates', kind: 'glance', size: 'full', description: 'Response, OA, interview, offer and rejection rates of what you sent.' },
  { id: 'replies', title: 'Replies drafted', kind: 'act', size: 'half', rows: true, description: 'Replies the Gmail scan wrote for you, with call times.' },
  { id: 'email', title: 'From your email', kind: 'act', size: 'half', rows: true, description: 'To-dos the email scan pulled out of your inbox.' },
  {
    id: 'people', title: 'People', kind: 'act', size: 'half', rows: true,
    description: 'Follow-ups, unanswered messages and people to keep in touch with.',
    groups: [
      { id: 'overdue', label: 'Overdue follow-up' },
      { id: 'awaiting', label: 'Awaiting reply' },
      { id: 'urgent', label: 'High urgency' },
      { id: 'schedule', label: 'Want to schedule' },
      { id: 'keepInTouch', label: 'Keep in touch' },
    ],
    settings: [{ key: 'awaitingDays', label: 'Awaiting reply after', unit: 'd', options: [3, 5, 7, 10, 14], default: 5 }],
  },
  {
    id: 'apps', title: 'Applications', kind: 'act', size: 'half', rows: true,
    description: 'Upcoming interviews, OAs due, applications gone quiet and job-board listings to triage.',
    groups: [
      { id: 'interview', label: 'Interviews coming up' },
      { id: 'oa', label: 'OA due' },
      { id: 'stale', label: 'Stale' },
      { id: 'review', label: 'Job boards to review', available: ctx => usesTechSources(ctx.profile) || 'SWE and PM tracks only' },
      { id: 'oaCheck', label: 'OA deadline unknown' },
    ],
    settings: [{ key: 'staleDays', label: 'Stale after', unit: 'd', options: [7, 14, 21, 30], default: 14 }],
  },
  {
    id: 'events', title: 'Events', kind: 'act', size: 'half', rows: true,
    description: 'Campus event signup steps, closing registrations and follow-ups.',
    available: ctx => ctx.hasEvents || 'needs a campus with an events feed',
  },
]

export const KIND_LABEL = { act: 'Act now', glance: 'Glance' }

const BY_ID = new Map(TODAY_CARDS.map(c => [c.id, c]))
export const cardDef = id => BY_ID.get(id)

// true, or the reason the card can't be placed for this user.
export function cardAvailable(id, ctx) {
  const def = BY_ID.get(id)
  if (!def) return 'unknown card'
  return def.available ? def.available(ctx) : true
}

function groupAvailable(group, ctx) {
  return group.available ? group.available(ctx) : true
}

// The group ids of a placed card that are on: available for this user and not turned off.
export function enabledGroups(card, ctx) {
  const def = BY_ID.get(card.id)
  return (def?.groups || []).filter(g => groupAvailable(g, ctx) === true && !(card.off || []).includes(g.id)).map(g => g.id)
}

export function settingValue(card, key) {
  const s = BY_ID.get(card.id)?.settings?.find(x => x.key === key)
  return card.settings?.[key] ?? s?.default
}

function freshCard(id) {
  return { id, size: BY_ID.get(id).size, cap: CAPS[0], off: [], settings: {} }
}

export function defaultLayout(ctx) {
  return {
    v: 1,
    cards: TODAY_CARDS.filter(d => cardAvailable(d.id, ctx) === true).map(d => freshCard(d.id)),
    seen: TODAY_CARDS.map(d => d.id),
  }
}

function clampCard(raw) {
  const def = BY_ID.get(raw.id)
  const groupIds = new Set((def.groups || []).map(g => g.id))
  const settings = {}
  for (const s of def.settings || []) {
    const v = raw.settings?.[s.key]
    if (v !== undefined && v !== s.default) settings[s.key] = s.options.includes(v) ? v : s.default
  }
  return {
    id: raw.id,
    size: SIZES.includes(raw.size) ? raw.size : def.size,
    cap: CAPS.includes(raw.cap) ? raw.cap : CAPS[0],
    off: [...new Set((raw.off || []).filter(g => groupIds.has(g)))],
    settings,
  }
}

// Brings a saved layout in line with the registry and this user's availability (see the
// header comment). Anything unreadable falls back to the default layout.
export function reconcileLayout(saved, ctx) {
  if (!saved || saved.v !== 1 || !Array.isArray(saved.cards)) return defaultLayout(ctx)
  const placed = new Set()
  const cards = []
  for (const raw of saved.cards) {
    if (!raw || !BY_ID.has(raw.id) || placed.has(raw.id) || cardAvailable(raw.id, ctx) !== true) continue
    placed.add(raw.id)
    cards.push(clampCard(raw))
  }
  const seen = new Set(Array.isArray(saved.seen) ? saved.seen : [])
  TODAY_CARDS.forEach((def, i) => {
    if (seen.has(def.id) || placed.has(def.id) || cardAvailable(def.id, ctx) !== true) return
    // After the nearest registry predecessor that's placed; first if there's none.
    let at = 0
    for (let j = i - 1; j >= 0; j--) {
      const k = cards.findIndex(c => c.id === TODAY_CARDS[j].id)
      if (k >= 0) { at = k + 1; break }
    }
    cards.splice(at, 0, freshCard(def.id))
    placed.add(def.id)
  })
  return { v: 1, cards, seen: TODAY_CARDS.map(d => d.id) }
}

// Reducers. Each returns a new layout (or the same one when nothing changes).
const mapCard = (layout, id, fn) => ({ ...layout, cards: layout.cards.map(c => (c.id === id ? fn(c) : c)) })

export function moveCard(layout, from, to) {
  if (from === to || from < 0 || to < 0 || from >= layout.cards.length || to >= layout.cards.length) return layout
  const cards = [...layout.cards]
  const [c] = cards.splice(from, 1)
  cards.splice(to, 0, c)
  return { ...layout, cards }
}

export function moveBy(layout, id, delta) {
  const i = layout.cards.findIndex(c => c.id === id)
  return i < 0 ? layout : moveCard(layout, i, i + delta)
}

export function addCard(layout, id) {
  if (!BY_ID.has(id) || layout.cards.some(c => c.id === id)) return layout
  return { ...layout, cards: [...layout.cards, freshCard(id)] }
}

export const removeCard = (layout, id) => ({ ...layout, cards: layout.cards.filter(c => c.id !== id) })
export const setSize = (layout, id, size) => (SIZES.includes(size) ? mapCard(layout, id, c => ({ ...c, size })) : layout)
export const setCap = (layout, id, cap) => (CAPS.includes(cap) ? mapCard(layout, id, c => ({ ...c, cap })) : layout)
export const toggleGroup = (layout, id, group) => mapCard(layout, id, c => ({
  ...c, off: (c.off || []).includes(group) ? c.off.filter(g => g !== group) : [...(c.off || []), group],
}))
export const setSetting = (layout, id, key, value) => mapCard(layout, id, c => ({ ...c, settings: { ...c.settings, [key]: value } }))

// Consecutive cards of one size render together: thirds in a 3-up grid, halves in two
// balanced columns, a full card on its own.
export function layoutBands(cards) {
  const bands = []
  for (const c of cards) {
    const last = bands[bands.length - 1]
    if (last && last.size === c.size && c.size !== 'full') last.cards.push(c)
    else bands.push({ size: c.size, cards: [c] })
  }
  return bands
}

// TodayTab's availability context.
// `school` is the event pool's campus (the demo has one without a profile row).
export function layoutContext(profile, school) {
  return { profile, hasEvents: !!(profile?.school_id || school) }
}
