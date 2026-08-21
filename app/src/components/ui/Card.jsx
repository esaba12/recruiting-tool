import { cn } from '../../lib/cn.js'

export default function Card({ className, children, ...rest }) {
  return (
    <div className={cn('bg-white rounded-md border border-ink-300', className)} {...rest}>
      {children}
    </div>
  )
}
