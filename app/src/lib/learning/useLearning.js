import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  setUserSetting,
  fetchLearning, createTrackWithTopics, updateTrack, addTopics as dbAddTopics, updateTopic as dbUpdateTopic,
  reorderTopics as dbReorderTopics, deleteTopic as dbDeleteTopic, upsertLearningItems, updateLearningItem,
  addLearningLog, deleteLearningLog, getUserSetting,
} from '../../db.js'
import { lsGet, lsSet } from '../scopedStorage.js'
import { instantiateTemplate } from './templates.js'
import { syncLeetcode, syncDue, resolveQuestionMeta, importLeetcodeHistory, SNAPSHOT_KEY } from './leetcodeImport.js'
import { PROBLEM_BY_SLUG, slugFromLeetcodeUrl, titleFromSlug } from './problemBank.js'
import { scheduleAttempt } from './review.js'
import { deriveTrack } from './derive.js'

export { deriveTrack }

const SYNC_META_KEY = 'rec_leetcode_sync' // { [trackId]: epoch ms of the last sync on this browser }

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
  const syncInFlightRef = useRef(false)
  const snapshotRef = useRef(snapshot)
  snapshotRef.current = snapshot
  const dataRef = useRef(data)
  dataRef.current = data

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
      // Off-bank LeetCode problems (company lists, anything pasted) get their real tags so
      // they count toward topic mastery — fail-soft to an untagged item.
      const meta = slug && !bank && !window.location.pathname.startsWith('/demo') ? (await resolveQuestionMeta([slug]).catch(() => null))?.get(slug) : null
      const [saved] = await upsertLearningItems([{
        source: slug ? 'leetcode' : 'manual',
        externalRef: ref,
        title: bank?.title || meta?.title || (slug ? titleFromSlug(slug) : log.problem.trim()),
        url: bank?.url || (slug ? `https://leetcode.com/problems/${slug}/` : null),
        difficulty: log.difficulty || bank?.difficulty || meta?.difficulty || null,
        tags: bank?.tags || meta?.tags || [],
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
      const res = await syncLeetcode({ username, trackId: track.id, prev: snapshotRef.current })
      const meta = lsGet(SYNC_META_KEY) || {}
      lsSet(SYNC_META_KEY, { ...meta, [track.id]: Date.now() })
      snapshotRef.current = res.snapshot
      // Nothing new → nothing was written, so there's nothing to re-read either.
      if (!res.unchanged) await load()
      return res
    } finally { setSyncing(null) }
  }

  // Save a track's LeetCode username and sync it right away, instead of waiting for the next
  // browser-day. Merges into the *current* config (the panel may call this while unmounting,
  // with a stale render's config). Returns the sync result; a sync failure is rethrown so the
  // caller can show it, but the username is already saved.
  async function setLeetcodeUsername(trackId, username) {
    const track = dataRef.current.tracks.find(t => t.id === trackId)
    if (!track) return null
    const config = { ...(track.config || {}), leetcodeUsername: username }
    await saveTrack(trackId, { config })
    if (!username) return null
    return runLeetcodeSync({ ...track, config })
  }

  // One-off full history import with a pasted LEETCODE_SESSION (never stored). Problems that
  // already have a LeetCode solve logged are skipped so recent solves aren't double-counted.
  async function importHistory(track, session, onProgress) {
    const slugById = new Map(data.items.filter(i => i.source === 'leetcode').map(i => [i.id, i.externalRef]))
    const skipSlugs = new Set(data.logs.filter(l => l.source === 'leetcode' && l.outcome === 'solved').map(l => slugById.get(l.itemId)).filter(Boolean))
    setSyncing(track.id)
    try {
      const res = await importLeetcodeHistory({ session, trackId: track.id, expectUsername: track.config?.leetcodeUsername, skipSlugs, onProgress })
      if (snapshot && snapshot.username?.toLowerCase() === res.username.toLowerCase()) {
        const next = { ...snapshot, historyImportedAt: new Date().toISOString(), historySolved: res.solved }
        await setUserSetting(SNAPSHOT_KEY, next).catch(() => {})
      }
      await load()
      return res
    } finally { setSyncing(null) }
  }

  // Every SYNC_INTERVAL_MS per track with a username: on load, and again when the tab comes
  // back into view (a long-open tab would otherwise let the 20-submission window overflow).
  // Fail-soft — the manual ↻ surfaces errors.
  useEffect(() => {
    if (!enabled || !loaded) return
    async function syncDueTracks() {
      if (syncInFlightRef.current) return
      const meta = lsGet(SYNC_META_KEY) || {}
      const due = dataRef.current.tracks.filter(t => t.config?.leetcodeUsername && syncDue(meta[t.id]))
      if (!due.length) return
      syncInFlightRef.current = true
      try { for (const t of due) { try { await runLeetcodeSync(t) } catch { /* retry next interval or via ↻ */ } } }
      finally { syncInFlightRef.current = false }
    }
    syncDueTracks()
    const onVisible = () => { if (document.visibilityState === 'visible') syncDueTracks() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, loaded])

  return {
    ...data, snapshot, loaded, error, syncing, reload: load,
    createTrack, saveTrack, archiveTrack,
    addTopics, updateTopic, reorderTopics, deleteTopic,
    logAttempt, removeLog, dismissReview, runLeetcodeSync, setLeetcodeUsername, importHistory,
  }
}

export function activeTrack(learning, trackId) {
  return learning.tracks.find(t => t.id === trackId) || learning.tracks[0] || null
}

export function useTrackView(learning, trackId, apps, companySets) {
  const track = activeTrack(learning, trackId)
  return useMemo(
    () => deriveTrack(learning, track, apps, Date.now(), { companySets }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [learning.tracks, learning.topics, learning.items, learning.logs, learning.snapshot, track, apps, companySets],
  )
}
