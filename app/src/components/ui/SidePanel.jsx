// Record-panel shell — a sibling of the centered-dialog primitive (ui/Modal.jsx),
// not a variant of it. The animated axis is chosen in JS because a CSS breakpoint
// cannot select which framer-motion transform values apply.
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '../../lib/cn.js'
import useMediaQuery from '../../lib/useMediaQuery.js'

export default function SidePanel({ open = true, onClose, children, className }) {
  const isDesktop = useMediaQuery('(min-width: 768px)')

  useEffect(() => {
    if (!onClose) return
    function onKeyDown(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const transform = isDesktop
    ? { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } }
    : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } }

  return (
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
              'bg-white w-full md:w-[480px] md:max-w-[92vw] rounded-t-2xl md:rounded-none shadow-2xl max-h-[90vh] md:max-h-none md:h-full overflow-y-auto',
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
  )
}
