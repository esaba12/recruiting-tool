import { useState, useEffect, useCallback } from 'react'
import { fetchTargetCompanies, saveTargetCompanies } from '../db.js'

// Shared target-company list — Coverage, Discover, and Explore all read/write the same
// list. Backed by Supabase's user_settings table (see db.js's fetchTargetCompanies), so
// adding a target on one device shows up on every other device too, replacing the old
// rec_target_companies localStorage key that stayed stuck on whichever browser set it.
export function useTargetCompanies() {
  const [targets, setTargetsState] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchTargetCompanies()
      .then(list => { if (!cancelled) setTargetsState(list) })
      .finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [])

  // Optimistic: local state updates immediately, the save happens in the background.
  const setTargets = useCallback((next) => {
    setTargetsState(next)
    saveTargetCompanies(next).catch(() => { /* best-effort — UI already reflects the change */ })
  }, [])

  return { targets, setTargets, loaded }
}
