// Record-panel shell — a sibling of the centered-dialog primitive (ui/Modal.jsx),
// not a variant of it. The animated axis is chosen in JS because a CSS breakpoint
// cannot select which motion transform values apply.
import { useEffect, useRef, createContext, useContext } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cn } from '../../lib/cn.js'
import useMediaQuery from '../../lib/useMediaQuery.js'

// Lets a nested, portaled dialog (e.g. LogInteractionModal, rendered via
// createPortal to escape this panel's transformed containing block) tell the
// enclosing SidePanel to ignore Escape while it's the topmost dialog. Without
// this, SidePanel's own window-level Escape listener and the nested dialog's
// both fire on the same keydown, closing the panel underneath (and discarding
// any unsaved edits) instead of just the topmost dialog (WR-02).
const SidePanelEscapeContext = createContext(null)

export function useSuppressSidePanelEscape(suppress) {
  const ctx = useContext(SidePanelEscapeContext)
  useEffect(() => {
    if (!ctx) return
    ctx.setSuppressed(suppress)
    return () => ctx.setSuppressed(false)
  }, [ctx, suppress])
}

export default function SidePanel({ open = true, onClose, children, className }) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const suppressedRef = useRef(false)
  const ctxValueRef = useRef(null)
  if (!ctxValueRef.current) {
    ctxValueRef.current = { setSuppressed: v => { suppressedRef.current = v } }
  }

  useEffect(() => {
    if (!onClose) return
    function onKeyDown(e) { if (e.key === 'Escape' && !suppressedRef.current) onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const transform = isDesktop
    ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }
    : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }

  return (
    <SidePanelEscapeContext.Provider value={ctxValueRef.current}>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 bg-ink-900/40 z-50 flex items-end md:items-stretch md:justify-end"
            onClick={e => e.target === e.currentTarget && onClose?.()}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              className={cn(
                'bg-white w-full md:w-[480px] md:max-w-[92vw] rounded-t-md md:rounded-none border border-ink-300 max-h-[90vh] md:max-h-none md:h-full overflow-y-auto',
                className,
              )}
              {...transform}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </SidePanelEscapeContext.Provider>
  )
}
