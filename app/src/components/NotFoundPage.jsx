import { motion } from 'motion/react'
import { ArrowLeft, Compass } from 'lucide-react'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
}

const rise = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
}

// A standalone route rendered outside AuthGate/AppInner — no sidebar, no auth check.
// The app has no client-side router (tabs are state, not URLs), so App.jsx treats any
// path outside "/" and "/demo*" as unknown and renders this directly.
export default function NotFoundPage({ path }) {
  return (
    <div className="min-h-screen bg-ink-900 text-ink-50 relative overflow-hidden flex items-center justify-center px-6 py-20">
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[560px] h-[560px] rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--color-accent-500), transparent 70%)' }}
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative w-full max-w-lg"
      >
        <motion.div variants={rise} className="flex items-center gap-3 mb-10 justify-center">
          <div className="h-px flex-1 bg-ink-700" />
          <span className="font-mono text-[11px] tracking-[0.25em] uppercase text-ink-400">
            Application Status
          </span>
          <div className="h-px flex-1 bg-ink-700" />
        </motion.div>

        <motion.div variants={rise} className="relative flex justify-center mb-2">
          <h1 className="font-heading font-bold text-[8.5rem] leading-none tracking-tight text-ink-50 select-none">
            404
          </h1>
          <div
            className="absolute -bottom-1 right-2 md:right-6 border-[3px] border-accent-500 text-accent-400 rounded-md px-3 py-1 rotate-[-9deg] font-mono text-[11px] md:text-xs font-medium tracking-[0.15em] uppercase bg-ink-900/80"
            style={{ boxShadow: '0 0 0 1px rgba(242,153,74,0.15)' }}
          >
            Closed · no longer accepting
          </div>
        </motion.div>

        <motion.p variants={rise} className="font-heading text-xl md:text-2xl font-semibold text-center mt-8 text-white">
          This role isn't open.
        </motion.p>
        <motion.p variants={rise} className="text-sm text-ink-400 text-center mt-3 max-w-sm mx-auto leading-relaxed">
          The page you're chasing got auto-triaged out of the pipeline before you could apply.
          Happens to the best of us.
        </motion.p>

        <motion.div
          variants={rise}
          className="mt-8 rounded-lg border border-ink-700 bg-ink-800/60 font-mono text-xs overflow-hidden"
        >
          <div className="px-4 py-2.5 flex items-center gap-3 border-b border-ink-700/70">
            <span className="text-ink-500 shrink-0">requested</span>
            <span className="text-ink-200 truncate">{path}</span>
          </div>
          <div className="px-4 py-2.5 flex items-center gap-3 border-b border-ink-700/70">
            <span className="text-ink-500 shrink-0">stage</span>
            <span className="text-ink-300 truncate">
              Sourced <span className="text-ink-600">→</span> Applied <span className="text-ink-600">→</span> Interview <span className="text-ink-600">→</span>{' '}
              <span className="text-danger-400">✕ Closed</span>
            </span>
          </div>
          <div className="px-4 py-2.5 flex items-center gap-3">
            <span className="text-ink-500 shrink-0">status</span>
            <span className="text-accent-400">404 NOT_FOUND</span>
          </div>
        </motion.div>

        <motion.div variants={rise} className="mt-10 flex items-center justify-center gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-accent-500 text-white hover:bg-accent-600 transition-colors px-4 py-2.5 text-sm font-medium"
          >
            <ArrowLeft size={15} strokeWidth={2.5} />
            Back to dashboard
          </a>
          <a
            href="/demo"
            className="inline-flex items-center gap-2 rounded-xl bg-transparent text-ink-300 hover:bg-ink-800 hover:text-white border border-ink-700 transition-colors px-4 py-2.5 text-sm font-medium"
          >
            <Compass size={15} strokeWidth={2.5} />
            View live demo
          </a>
        </motion.div>

        <motion.p variants={rise} className="mt-12 text-center font-mono text-[11px] tracking-widest uppercase text-ink-600">
          Recruiting OS — no offers were rescinded in the making of this error
        </motion.p>
      </motion.div>
    </div>
  )
}
