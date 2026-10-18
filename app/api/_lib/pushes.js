// Push notifications for the serverless Gmail scan (v1.3 spec 08 item 1), ported from
// scripts/email-pipeline.js (sendPush, buildStatusPush, flushUpdatePushes, sendScheduledDigest,
// buildOaDigest, buildDailyRecap). Same three kinds of push, nothing else:
//   1./2. an 11am and a midnight digest (AI recap + open OAs + held updates), once per slot;
//   3.    updates (OA / interview / offer / rejection), queued during a tick and sent as ONE
//         push at its end, held during quiet hours (22:00–08:00) until the next digest or 08:00.
// Opt-in per user: Settings stores { ntfyTopic, timeZone } in user_settings 'push_settings'.
// The queue and the sent-slot marks live in user_settings 'push_state', so no schema change.
// Fail-soft everywhere: a push problem never fails the email scan.

const NTFY_BASE = 'https://ntfy.sh'
const PUSH_RETRY_ATTEMPTS = 3
const PUSH_RETRY_DELAY_MS = 1500
// A push should mean "this just happened": the first scan of a new mailbox walks 45 days of
// mail, and pushing all of that burns ntfy's free daily quota in seconds (the Apps Script hit
// exactly this). Records are still written regardless of age; only the push is gated.
const PUSH_STALE_THRESHOLD_MS = 2 * 86400000
const QUIET_START_HOUR = 22
const QUIET_END_HOUR = 8
const DIGEST_HOURS = { 11: 'am', 0: 'midnight' }
const PUSH_QUEUE_MAX = 40
const PRIORITY_RANK = { min: 0, low: 1, default: 2, high: 3, urgent: 4 }
const NTFY_PRIORITY = { min: 1, low: 2, default: 3, high: 4, urgent: 5 }
const DEFAULT_TIME_ZONE = 'America/New_York'
const RECAP_MODEL = 'claude-sonnet-4-6'

// ntfy topic names: letters, digits, _ and -, up to 64 chars. Anything else could reach a
// different ntfy path, so it's refused rather than escaped.
export function validTopic(topic) {
  return typeof topic === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(topic)
}

// ── Pure helpers ─────────────────────────────────────────────────────────────────────────

export function statusPush(data) {
  const company = data.company || 'Unknown company'
  const role = data.role || ''
  switch (data.type) {
    case 'OA_INVITE':
      return {
        title: `🧪 OA received — ${company}`,
        message: `${role || 'Online Assessment'}${data.oa_due_date ? `\nDue ${data.oa_due_date}` : '\nNo stated deadline — check the assessment page.'}${data.oa_link ? `\n${data.oa_link}` : ''}`,
        priority: 'high', tags: ['test_tube'],
      }
    case 'OA_COMPLETED':
      return { title: `✅ OA marked complete — ${company}`, message: `${role || 'Online Assessment'}\nNo more deadline reminders for this one.`, priority: 'default', tags: ['white_check_mark'] }
    case 'INTERVIEW_INVITE':
      return { title: `📞 Interview invite — ${company}`, message: `${role}${data.interview_date ? `\nScheduled ${data.interview_date}` : ''}`.trim(), priority: 'high', tags: ['phone'] }
    case 'OFFER':
      return { title: `🎉 Offer — ${company}!`, message: role || 'Offer received', priority: 'urgent', tags: ['tada'] }
    case 'REJECTION':
      return { title: `❌ Rejected — ${company}`, message: role || 'Rejection received', priority: 'default', tags: ['x'] }
    default:
      return null
  }
}

export function isFreshEnoughToPush(messageDate, now = Date.now()) {
  return now - new Date(messageDate).getTime() <= PUSH_STALE_THRESHOLD_MS
}

export function localClock(now, timeZone = DEFAULT_TIME_ZONE) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
  }).formatToParts(new Date(now)).map(p => [p.type, p.value]))
  return { hour: Number(parts.hour), date: `${parts.year}-${parts.month}-${parts.day}` }
}

export function isQuietHours(hour) {
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR
}

export function digestSlot(hour) {
  return DIGEST_HOURS[hour] || null
}

export function maxPriority(items) {
  const top = items.reduce((max, p) => Math.max(max, PRIORITY_RANK[p.priority] ?? 2), 0)
  return Object.keys(PRIORITY_RANK).find(k => PRIORITY_RANK[k] === top)
}

export function combineUpdates(queue) {
  if (queue.length === 1) return queue[0]
  return { title: `📬 ${queue.length} recruiting updates`, message: queue.map(p => p.title).join('\n'), priority: maxPriority(queue), tags: ['mailbox_with_mail'] }
}

// Every open OA, with urgency carried in the priority. `today` is the user's local date.
export function oaDigest(apps, today) {
  if (!apps?.length) return null
  const todayMs = Date.parse(today)
  const rows = apps.map(a => ({ ...a, daysUntil: Math.round((Date.parse(a.oa_due_date) - todayMs) / 86400000) }))
  const lines = rows.map(a => {
    const label = a.daysUntil < 0 ? `overdue by ${-a.daysUntil}d` : a.daysUntil === 0 ? 'due today' : `due in ${a.daysUntil}d`
    return `${a.company}${a.role ? ` (${a.role})` : ''} — ${label}`
  })
  const soonest = Math.min(...rows.map(a => a.daysUntil))
  return { lines, priority: soonest <= 1 ? 'urgent' : soonest <= 3 ? 'high' : 'default' }
}

export function buildDigest({ slot, recap, oa, updates = [], click }) {
  const sections = []
  if (recap) sections.push([recap.summary, ...(recap.todos || []).map(t => `• ${t}`)].join('\n'))
  if (oa) sections.push(`⏰ Open OAs\n${oa.lines.join('\n')}`)
  if (updates.length) sections.push(`📬 Updates\n${updates.map(p => p.title).join('\n')}`)
  if (!sections.length) return null
  return {
    title: slot === 'midnight' ? '🌙 Nightly recruiting digest' : '📋 Your recruiting digest',
    message: sections.join('\n\n'),
    priority: maxPriority([{ priority: oa ? oa.priority : 'default' }, ...updates]),
    tags: ['clipboard'],
    ...(click ? { click } : {}),
  }
}

// What this tick should do for one user → { action: 'digest'|'updates'|'hold'|'none', queue, slot?, slotKey? }
export function planPushes({ state = {}, newPushes = [], now = Date.now(), timeZone = DEFAULT_TIME_ZONE }) {
  const queue = [...(state.queue || []), ...newPushes].slice(-PUSH_QUEUE_MAX)
  const { hour, date } = localClock(now, timeZone)
  const slot = digestSlot(hour)
  const slotKey = slot && `${date}_${slot}`
  if (slot && !state.sentSlots?.[slotKey]) return { action: 'digest', slot, slotKey, queue }
  if (!queue.length) return { action: 'none', queue }
  return { action: isQuietHours(hour) ? 'hold' : 'updates', queue }
}

// "Who did I write to last, with no reply?" Same rule as lib/attention.js awaitingReply().
export function awaitingReply(contacts, interactions, now = Date.now()) {
  const latest = new Map()
  for (const i of interactions) if (i.contact_id && !latest.has(i.contact_id)) latest.set(i.contact_id, i)
  return contacts
    .filter(c => c.status !== '✅ Closed' && !c.follow_up_date)
    .map(c => {
      const last = latest.get(c.id)
      if (!last || last.direction !== 'Outbound') return null
      const days = Math.floor((now - Date.parse(last.date)) / 86400000)
      return days >= 5 ? { name: c.name, company: c.company, days } : null
    })
    .filter(Boolean)
}

// ── I/O ──────────────────────────────────────────────────────────────────────────────────

export async function sendPush(topic, { title, message = '', priority = 'default', tags = [], click }, { fetch = globalThis.fetch, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  if (!validTopic(topic)) return false
  // JSON publishing, not the Title/Tags headers the Apps Script used: Node's fetch refuses
  // non-Latin-1 header values, and every title here starts with an emoji.
  const body = JSON.stringify({ topic, title, message, priority: NTFY_PRIORITY[priority] ?? 3, tags, ...(click ? { click } : {}) })
  for (let attempt = 1; attempt <= PUSH_RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(NTFY_BASE, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } })
      if (res.ok) return true
      throw new Error(`ntfy ${res.status}`)
    } catch (e) {
      console.error(`push attempt ${attempt}/${PUSH_RETRY_ATTEMPTS} failed: ${e.message}`)
      if (attempt < PUSH_RETRY_ATTEMPTS) await sleep(PUSH_RETRY_DELAY_MS)
    }
  }
  return false
}

async function getSetting(db, userId, key) {
  const { data } = await db.from('user_settings').select('value').eq('user_id', userId).eq('key', key).maybeSingle()
  return data?.value ?? null
}

async function setSetting(db, userId, key, value) {
  const { error } = await db.from('user_settings').upsert({ user_id: userId, key, value }, { onConflict: 'user_id,key' })
  if (error) throw new Error(`save ${key}: ${error.message}`)
}

export async function pushSettingsFor(db, userId) {
  const s = await getSetting(db, userId, 'push_settings')
  return validTopic(s?.ntfyTopic) ? { ntfyTopic: s.ntfyTopic, timeZone: s.timeZone || DEFAULT_TIME_ZONE } : null
}

async function openOas(db, userId) {
  const { data } = await db.from('applications').select('company, role, oa_due_date')
    .eq('user_id', userId).not('oa_due_date', 'is', null).eq('oa_completed', false).eq('archived', false)
    .order('oa_due_date', { ascending: true })
  return data || []
}

// One Sonnet call over the day's raw facts → { summary, todos }, also written to daily_recaps
// for Today's recap card. Null when there's nothing to recap.
async function dailyRecap(db, userId, apiKey, { now, today, fetch }) {
  const since = new Date(now - 86400000).toISOString()
  const cutoff = new Date(now - 60 * 86400000).toISOString().slice(0, 10)
  const q = (table, cols) => db.from(table).select(cols).eq('user_id', userId)
  const [contacts, newContacts, newApplications, openActionItems, interactions, oaDueSoon] = await Promise.all([
    q('contacts', 'id, name, company, status, follow_up_date').eq('archived', false),
    q('contacts', 'name, company').gte('created_at', since),
    q('applications', 'company, role, stage').gte('created_at', since),
    q('email_action_items', 'summary, priority, due_date').is('completed_at', null).is('dismissed_at', null),
    q('interactions', 'contact_id, direction, date').in('type', ['Email', 'LinkedIn']).gte('date', cutoff).order('date', { ascending: false }),
    openOas(db, userId).then(data => ({ data })),
  ].map(p => Promise.resolve(p).then(r => r.data || [])))
  const overdueFollowUps = contacts.filter(c => c.follow_up_date && c.follow_up_date < today && c.status !== '✅ Closed')
    .map(c => ({ name: c.name, company: c.company, followUpDate: c.follow_up_date }))
  const bundle = { newContacts, newApplications, openActionItems, oaDueSoon, overdueFollowUps, awaitingReply: awaitingReply(contacts, interactions, now) }
  if (!Object.values(bundle).some(a => a.length)) return null

  const prompt = `You are summarizing one day of recruiting-related activity for a job-searching student. Return ONLY valid JSON, no explanation, no markdown.

{
  "summary": "2-4 sentence recap of what happened and what matters most right now, written directly to the student ('you applied to...', 'you're waiting on...').",
  "todos": ["3-7 short, specific, prioritized action items — most important first. Each one under 15 words."]
}

Today's raw data (JSON):
${JSON.stringify(bundle)}`
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: RECAP_MODEL, max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`recap: Claude ${res.status}`)
  const text = (await res.json()).content?.[0]?.text || ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('recap: no JSON in response')
  const { summary, todos = [] } = JSON.parse(match[0])
  await db.from('daily_recaps').upsert({ user_id: userId, date: today, summary_text: summary, todo_json: todos }, { onConflict: 'user_id,date' })
  return { summary, todos }
}

// One user's pushes for this cron tick. `newPushes` are the update pushes the scan built.
export async function runUserPushes(db, userId, newPushes, { anthropicKey, click, now = Date.now(), fetch = globalThis.fetch, sleep } = {}) {
  const settings = await pushSettingsFor(db, userId)
  if (!settings) return { skipped: 'no_topic' }
  const state = (await getSetting(db, userId, 'push_state')) || {}
  const plan = planPushes({ state, newPushes, now, timeZone: settings.timeZone })
  const send = push => sendPush(settings.ntfyTopic, push, { fetch, sleep })
  let queue = plan.queue
  let sentSlots = state.sentSlots || {}

  if (plan.action === 'none') return { action: 'none' }
  if (plan.action === 'updates') {
    if (await send(combineUpdates(queue))) queue = []
  } else if (plan.action === 'digest') {
    const today = localClock(now, settings.timeZone).date
    const oa = oaDigest(await openOas(db, userId), today)
    let recap = null
    if (anthropicKey) {
      try { recap = await dailyRecap(db, userId, anthropicKey, { now, today, fetch }) } catch (e) { console.error(e.message) }
    }
    const push = buildDigest({ slot: plan.slot, recap, oa, updates: queue, click })
    const sent = push ? await send(push) : true
    if (sent) {
      queue = []
      // Keep only the last few marks; the slot key carries the date.
      sentSlots = Object.fromEntries([...Object.entries(sentSlots), [plan.slotKey, true]].slice(-6))
    }
  }
  await setSetting(db, userId, 'push_state', { queue, sentSlots })
  return { action: plan.action, queued: queue.length }
}
