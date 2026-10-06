// Loads the company-tagged LeetCode problem lists (lib/learning/companyProblems.js) for the
// companies this track should prep for: every live Pipeline application at an interview
// stage or with an OA due soon, plus any the user pinned (track.config.prepCompanies).
//
// Folder listing goes through the auth-gated /gh-api proxy (GitHub contents API — uses the
// user's BYOK GitHub token when present); the CSVs come straight from
// raw.githubusercontent.com (CORS-open, no rate limit). Both cache a week per browser.
import { useState, useEffect, useMemo } from 'react'
import { authHeader } from '../supabaseClient.js'
import { lsGet, lsSet } from '../scopedStorage.js'
import { COMPANY_REPO, parseCompanyCsv, matchCompanyFolder } from './companyProblems.js'
import { trackDemand } from './mastery.js'

const RAW_BASE = `https://raw.githubusercontent.com/${COMPANY_REPO}/main`
// The dataset's windows aren't cumulative (each is its own LeetCode bucket, and "All" is
// often shorter than "Three Months"). Take the most recent window with enough problems to be
// useful, else whichever window has the most.
const FILES = ['2. Three Months.csv', '3. Six Months.csv', '5. All.csv']
const MIN_RECENT = 15
const CACHE_MS = 7 * 86400000
const INDEX_KEY = 'rec_lc_company_index'
const SET_KEY = folder => `rec_lc_company:${folder}`

function cached(key) {
  try {
    const v = lsGet(key)
    return v && Date.now() - v.at < CACHE_MS ? v.data : null
  } catch { return null }
}
function store(key, data) { try { lsSet(key, { at: Date.now(), data }) } catch { /* quota / private mode */ } }

export async function fetchCompanyIndex() {
  const hit = cached(INDEX_KEY)
  if (hit) return hit
  const res = await fetch(`/gh-api/repos/${COMPANY_REPO}/contents/`, { headers: await authHeader() })
  if (!res.ok) throw new Error(`Company list unavailable (${res.status})`)
  const folders = (await res.json()).filter(e => e.type === 'dir').map(e => e.name)
  store(INDEX_KEY, folders)
  return folders
}

export async function fetchCompanyProblems(folder) {
  const hit = cached(SET_KEY(folder))
  if (hit) return hit
  let problems = []
  for (const file of FILES) {
    const res = await fetch(`${RAW_BASE}/${encodeURIComponent(folder)}/${encodeURIComponent(file)}`)
    if (!res.ok) continue
    const got = parseCompanyCsv(await res.text())
    if (got.length > problems.length) problems = got
    if (problems.length >= MIN_RECENT) break
  }
  store(SET_KEY(folder), problems)
  return problems
}

// Which companies to prep for, deduped by name: [{ company, why: 'interview'|'oa'|'pinned' }].
export function prepCompanies(track, apps, now = Date.now()) {
  if (!track) return []
  const { interviews, oas } = trackDemand(track, apps, { now })
  const out = new Map()
  const add = (company, why) => {
    const k = (company || '').trim().toLowerCase()
    if (k && !out.has(k)) out.set(k, { company: company.trim(), why })
  }
  for (const a of oas) add(a.company, 'oa')
  for (const a of interviews) add(a.company, 'interview')
  for (const c of track.config?.prepCompanies || []) add(c, 'pinned')
  return [...out.values()]
}

// → { sets: [{ company, why, folder, problems }], unmatched: [company], folders, loading, error }
export default function useCompanyPrep(track, apps, { enabled = true } = {}) {
  const wanted = useMemo(() => prepCompanies(track, apps), [track, apps])
  const wantedKey = wanted.map(w => `${w.company}|${w.why}`).join(',')
  const [state, setState] = useState({ sets: [], unmatched: [], folders: [], loading: false, error: null })

  useEffect(() => {
    if (!enabled || !track) return
    let cancelled = false
    setState(s => ({ ...s, loading: true, error: null }))
    ;(async () => {
      try {
        const folders = await fetchCompanyIndex()
        const sets = []; const unmatched = []
        await Promise.all(wanted.map(async w => {
          const folder = matchCompanyFolder(w.company, folders)
          if (!folder) { unmatched.push(w.company); return }
          try {
            const problems = await fetchCompanyProblems(folder)
            if (problems.length) sets.push({ ...w, folder, problems })
            else unmatched.push(w.company)
          } catch { unmatched.push(w.company) }
        }))
        const order = new Map(wanted.map((w, i) => [w.company, i]))
        sets.sort((a, b) => order.get(a.company) - order.get(b.company))
        if (!cancelled) setState({ sets, unmatched, folders, loading: false, error: null })
      } catch (e) {
        if (!cancelled) setState(s => ({ ...s, loading: false, error: e.message }))
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, track?.id, wantedKey])

  return state
}
