// Per-track derived view for the Learn tab and Today — pure (no db/React imports) so
// lib/attention.js and tests can use it without pulling in the Supabase client.
import { masteryByTopic, rankGaps, trackDemand, goalProgress, streak } from './mastery.js'
import { companyTopicDemand } from './companyProblems.js'

// companySets — [{ company, folder, problems }] loaded for this track (see useCompanyPrep);
// their topic mix sharpens the demand term in rankGaps.
export function deriveTrack(learning, track, apps, now = Date.now(), { companySets = [] } = {}) {
  if (!track) return null
  const itemsById = new Map(learning.items.map(i => [i.id, i]))
  const topics = learning.topics.filter(t => t.trackId === track.id).sort((a, b) => a.sort - b.sort)
  const logs = learning.logs.filter(l => l.trackId === track.id || !l.trackId)
    .sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
  // The LeetCode snapshot belongs to whichever track holds the matching username.
  const snap = learning.snapshot && track.config?.leetcodeUsername
    && learning.snapshot.username?.toLowerCase() === track.config.leetcodeUsername.toLowerCase()
    ? learning.snapshot.tagCounts : null
  const mastery = masteryByTopic(topics, logs, { now, itemsById, snapshot: snap })
  const visible = topics.filter(t => !t.hidden)
  const demand = { ...trackDemand(track, apps, { now }), companyTopics: companyTopicDemand(companySets, visible) }
  const gaps = rankGaps(visible, mastery, { demand })
  const goals = (track.config?.goals || []).map(g => ({ goal: g, progress: goalProgress(g, { logs, topics: visible, mastery, itemsById, now }) }))
  // Review items belong to a track if any of its logs reference them.
  const trackItemIds = new Set(logs.map(l => l.itemId).filter(Boolean))
  const items = learning.items.filter(i => trackItemIds.has(i.id))
  return { track, topics, visible, logs, items, itemsById, mastery, demand, gaps, goals, streak: streak(logs, now), companySets }
}

