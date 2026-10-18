import { useEffect, useState } from 'react'
import EmptyState from './EmptyState.jsx'

// Suspense fallback for lazy tabs (v1.3 spec 09). Renders nothing for the first ~150 ms, so a
// warm (prefetched) chunk swaps in with no "Loading…" flash; a cold one on a slow link still
// says something.
export default function DelayedFallback({ msg = 'Loading…', delay = 150 }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay)
    return () => clearTimeout(t)
  }, [delay])
  return show ? <EmptyState msg={msg} /> : null
}
