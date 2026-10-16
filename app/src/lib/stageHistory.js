// Application stage history — attaches the application_stage_events rows (see
// supabase/migrations/20261016000000_application_stage_events.sql) to each app and
// derives "days in stage" from the latest change instead of the applied date.
//
// synthesizeStageEvents mirrors the migration's SQL backfill: when no history
// exists (demo mode, or the table isn't there yet), rebuild the simplest path that
// reaches the current stage and mark it estimated.
import { daysSince } from './dates.js'

export function synthesizeStageEvents(app) {
  const created = app.createdTime || app.appliedDate || null
  if (!app.stage || app.stage === 'Wishlist') {
    return [{ fromStage: null, toStage: 'Wishlist', changedAt: created, source: 'backfill' }]
  }
  const appliedAt = app.appliedDate || created
  const events = [{ fromStage: null, toStage: 'Applied', changedAt: appliedAt, source: 'backfill' }]
  if (app.stage !== 'Applied') {
    const movedAt = app.closedDate || app.lastActivity || appliedAt
    events.push({
      fromStage: 'Applied', toStage: app.stage,
      changedAt: movedAt && appliedAt && String(movedAt) < String(appliedAt) ? appliedAt : movedAt,
      source: 'backfill',
    })
  }
  return events
}

const byTime = (a, b) => new Date(a.changedAt) - new Date(b.changedAt)

// events: [{ applicationId, fromStage, toStage, changedAt, source }] or null when the
// table couldn't be read — then every app gets synthesized history.
export function attachStageHistory(apps, events, now = Date.now()) {
  const byApp = new Map()
  for (const e of events || []) {
    if (!byApp.has(e.applicationId)) byApp.set(e.applicationId, [])
    byApp.get(e.applicationId).push(e)
  }
  return apps.map(app => {
    let stageEvents = (byApp.get(app.id) || []).slice().sort(byTime)
    if (stageEvents.length === 0) stageEvents = synthesizeStageEvents(app)
    const last = stageEvents[stageEvents.length - 1]
    const stageChangedAt = last?.toStage === app.stage ? last.changedAt : null
    return {
      ...app,
      stageEvents,
      stageChangedAt,
      historyEstimated: stageEvents.some(e => e.source === 'backfill'),
      daysInStage: stageChangedAt ? daysSince(stageChangedAt, now) : app.daysInStage ?? null,
    }
  })
}

// Stages an application has actually passed through, in order, deduped. Moves
// backward (e.g. Onsite → Phone Screen after a correction) keep the first visit only.
export function stagePath(app) {
  const path = []
  for (const e of app.stageEvents || []) {
    if (e.toStage && !path.includes(e.toStage)) path.push(e.toStage)
  }
  if (app.stage && !path.includes(app.stage)) path.push(app.stage)
  return path
}

// The latest real stage move within `hours` (backfilled history never counts), for the
// Sheet's "changed recently" marker and filter. null when nothing moved.
export function recentStageChange(app, now = Date.now(), hours = 48) {
  const events = app.stageEvents || []
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]
    if (e.source === 'backfill' || !e.changedAt) continue
    const ago = (now - new Date(e.changedAt).getTime()) / 36e5
    if (ago < 0 || ago > hours) return null
    if (!e.fromStage) return null // creation, not a move
    return { fromStage: e.fromStage, toStage: e.toStage, hoursAgo: Math.floor(ago), source: e.source }
  }
  return null
}

export function describeStageChange(c) {
  const when = c.hoursAgo < 1 ? 'just now' : c.hoursAgo < 24 ? `${c.hoursAgo}h ago` : `${Math.floor(c.hoursAgo / 24)}d ago`
  const via = c.source === 'pipeline' ? ' · from email' : c.source === 'user' ? '' : ` · ${c.source}`
  return `${c.fromStage} → ${c.toStage} · ${when}${via}`
}
