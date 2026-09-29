// Re-solve queue — spaced repetition (FSRS via ts-fsrs) over problems you struggled on.
// A problem enters the queue the first time it's logged as hinted/failed (or solved with low
// confidence); every later attempt re-schedules it. Clean, confident first-try solves never
// enter the queue — the point is revisiting weak spots, not re-grinding everything.
import { fsrs, createEmptyCard, Rating } from 'ts-fsrs'

const scheduler = fsrs()
const DAY = 86400000
// FSRS "learning" steps can schedule a card minutes out; re-solving a LeetCode problem the
// same day teaches nothing, so the queue never schedules sooner than tomorrow.
const MIN_GAP_MS = DAY

export function ratingFor({ outcome, confidence }) {
  if (outcome === 'failed') return Rating.Again
  if (outcome === 'hinted') return Rating.Hard
  if ((confidence ?? 3) >= 4) return Rating.Easy
  return Rating.Good
}

// jsonb → ts-fsrs Card (dates come back as ISO strings).
export function reviveCard(srs) {
  if (!srs) return null
  return { ...srs, due: new Date(srs.due), last_review: srs.last_review ? new Date(srs.last_review) : undefined }
}

// → { srs, dueAt } to write on the item, or null when the attempt shouldn't enqueue it.
export function scheduleAttempt(item, attempt, now = new Date()) {
  const rating = ratingFor(attempt)
  if (!item?.srs && rating === Rating.Easy) return null
  const card = reviveCard(item?.srs) || createEmptyCard(now)
  const next = scheduler.next(card, now, rating).card
  const due = Math.max(next.due.getTime(), now.getTime() + MIN_GAP_MS)
  return {
    srs: { ...next, due: next.due.toISOString(), last_review: next.last_review ? new Date(next.last_review).toISOString() : null },
    dueAt: new Date(due).toISOString(),
  }
}

// Items due by `now` (plus `aheadDays` of look-ahead), soonest first.
export function reviewQueue(items, { now = Date.now(), aheadDays = 0 } = {}) {
  const cutoff = now + aheadDays * DAY
  return (items || [])
    .filter(i => i.dueAt && new Date(i.dueAt).getTime() <= cutoff)
    .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
}
