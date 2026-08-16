import { cn } from '../../lib/cn.js'

export default function Mono({ className, children }) {
  return (
    <span className={cn('font-mono text-xs font-normal tabular-nums tracking-wide', className)}>
      {children}
    </span>
  )
}
