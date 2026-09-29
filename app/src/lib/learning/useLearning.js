import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  fetchLearning, createTrackWithTopics, updateTrack, addTopics as dbAddTopics, updateTopic as dbUpdateTopic,
  reorderTopics as dbReorderTopics, deleteTopic as dbDeleteTopic, upsertLearningItems, updateLearningItem,
  addLearningLog, deleteLearningLog, getUserSetting,
} from '../../db.js'
import { lsGet, lsSet } from '../scopedStorage.js'
import { todayStr } from '../ingest/scheduler.js'
import { instantiateTemplate } from './templates.js'
import { syncLeetcode, SNAPSHOT_KEY } from './leetcodeImport.js'
import { PROBLEM_BY_SLUG, slugFromLeetcodeUrl, titleFromSlug } from './problemBank.js'
import { scheduleAttempt } from './review.js'
import { deriveTrack } from './derive.js'

export { deriveTrack }

const SYNC_META_KEY = 'rec_leetcode_sync' // { [trackId]: 'YYYY-MM-DD' }

// Everything the Learn tab (and Today's learning attention items) reads. Mounted once in
// AppInner, same shape as useRecruitingEvents: loads rows, exposes mutation actions that
// update local state optimistically-after-write, and runs the once-per-browser-day
// LeetCode sync for every track that has a username configured.
export default function useLearning({ enabled = true } = {}) {
  const [data, setData] = useState({ tracks: [], topics: [], items: [], logs: [] })
  const [snapshot, setSnapshot] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(null)
  const [syncing, setSyncing] = useState(null) // trackId while a LeetCode sync runs
  const syncRanRef = useRef(false)

  const load = useCallback(async () => {
    try {
      const [d, snap] = await Promise.all([fetchLearning(), getUserSetting(SNAPSHOT_KEY).catch(() => null)])
      setData(d); setSnapshot(snap); setError(null)
    } catch (e) { setError(e.message) }
    finally { setLoaded(true) }
  }, [])

  useEffect(() => { if (enabled) load() }, [enabled, load])

  // ── Tracks ──
  async function createTrack(templateKey, { name } = {}) {
    const inst = instantiateTemplate(templateKey, { name })
    const res = await createTrackWithTopics(inst, data.tracks.length)
    setData(d => ({ ...d, tracks: [...d.tracks, res.track], topics: [...d.topics, ...res.topics] }))
    return res.track
  }

  async function saveTrack(id, fields) {
    await updateTrack(id, fields)
    setData(d => ({ ...d, tracks: d.tracks.map(t => (t.id === id ? { ...t, ...fields } : t)) }))
  }

  async function archiveTrack(id) {
    await updateTrack(id, { archivedAt: new Date().toISOString() })
    setData(d => ({ ...d, tracks: d.tracks.filter(t => t.id !== id) }))
  }

  // ── Topics ──
  async function addTopics(trackId, topics) {
    const base = data.topics.filter(t => t.trackId === trackId).length
    const rows = await dbAddTopics(trackId, topics.map((t, i) => ({ source: 'user', sort: base + i, ...t })))
    setData(d => ({ ...d, topics: [...d.topics, ...rows] }))
    return rows
  }

  async function updateTopic(id, fields) {
    setData(d => ({ ...d, topics: d.topics.map(t => (t.id === id ? { ...t, ...fields } : t)) }))
    await dbUpdateTopic(id, fields)
  }

  async function reorderTopics(orderedIds) {
    const rows = orderedIds.map((id, sort) => ({ id, sort }))
    setData(d => ({ ...d, topics: d.topics.map(t => { const r = rows.find(x => x.id === t.id); return r ? { ...t, sort: r.sort } : t }) }))
    await dbReorderTopics(rows)
  }

  async function deleteTopic(id) {
    await dbDeleteTopic(id)
    setData(d => ({ ...d, topics: d.topics.filter(t => t.id !== id) }))
  }

  // ── Logging ──
  // log: { trackId, kind, topicIds, outcome, minutes, confidence, score, notes, difficulty, title,
  //        problem (LeetCode URL/slug or free-text title), applicationId, source, occurredAt }
  async function logAttempt(log) {
    let item = null
    let itemPatch = null
    if (log.kind === 'problem' && log.problem) {
      const slug = slugFromLeetcodeUrl(log.problem)
      const bank = slug ? PROBLEM_BY_SLUG.get(slug) : null
      const ref = slug || `manual:${log.problem.trim().toLowerCase().slice(0, 100)}`
      const [saved] = await upsertLearningItems([{
        source: slug ? 'leetcode' : 'manual',
        externalRef: ref,
        title: bank?.title || (slug ? titleFromSlug(slug) : log.problem.trim()),
        url: bank?.url || (slug ? `https://leetcode.com/problems/${slug}/` : null),
        difficulty: log.difficulty || bank?.difficulty || null,
        tags: bank?.tags || [],
      }])
      item = data.items.find(i => i.id === saved.id) || saved
      const sched = scheduleAttempt(item, log)
      if (sched) {
        await updateLearningItem(item.id, sched)
        itemPatch = sched
      }
    }
    const { problem, ...rest } = log
    const row = await addLearningLog({
      ...rest,
      itemId: item?.id || null,
      title: log.title || item?.title || null,
      difficulty: log.difficulty || item?.difficulty || null,
    })
    setData(d => {
      let items = d.items
      if (item) {
        const merged = { ...item, ...(itemPatch || {}) }
        items = d.items.some(i => i.id === item.id) ? d.items.map(i => (i.id === item.id ? merged : i)) : [...d.items, merged]
      }
      return { ...d, items, logs: [row, ...d.logs] }
    })
    return row
  }

  async function removeLog(id) {
    await deleteLearningLog(id)
    setData(d => ({ ...d, logs: d.logs.filter(l => l.id !== id) }))
  }

  // Drop an item from the re-solve queue without logging an attempt.
  async function dismissReview(itemId) {
    await updateLearningItem(itemId, { srs: null, dueAt: null })
    setData(d => ({ ...d, items: d.items.map(i => (i.id === itemId ? { ...i, srs: null, dueAt: null } : i)) }))
  }

  // ── LeetCode ──
  async function runLeetcodeSync(track) {
    const username = track?.config?.leetcodeUsername
    if (!username) return null
    setSyncing(track.id)
    try {
      const res = await syncLeetcode({ username, trackId: track.id })
      const meta = lsGet(SYNC_META_KEY) || {}
      lsSet(SYNC_META_KEY, { ...meta, [track.id]: todayStr() })
      await load()
      return res
    } finally { setSyncing(null) }
  }

  // Once per browser-day per track with a username — fail-soft (the manual ↻ surfaces errors).
  useEffect(() => {
    if (!enabled || !loaded || syncRanRef.current) return
    syncRanRef.current = true
    const meta = lsGet(SYNC_META_KEY) || {}
    const due = data.tracks.filter(t => t.config?.leetcodeUsername && meta[t.id] !== todayStr())
    ;(async () => { for (const t of due) { try { await runLeetcodeSync(t) } catch { /* retry tomorrow or via ↻ */ } } })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loaded])

  return {
    ...data, snapshot, loaded, error, syncing, reload: load,
    createTrack, saveTrack, archiveTrack,
    addTopics, updateTopic, reorderTopics, deleteTopic,
    logAttempt, removeLog, dismissReview, runLeetcodeSync,
  }
}

export function useTrackView(learning, trackId, apps) {
  const track = learning.tracks.find(t => t.id === trackId) || learning.tracks[0] || null
  return useMemo(
    () => deriveTrack(learning, track, apps),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [learning.tracks, learning.topics, learning.items, learning.logs, learning.snapshot, track, apps],
  )
}
