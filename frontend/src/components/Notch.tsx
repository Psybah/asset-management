import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A tab of the dark frame that dips into the light container, with concave
 * (inverted) corners where it meets the edge — like the logo tab and the dock.
 * `edge="top"` hangs from the top edge; `edge="bottom"` rises from the bottom.
 */
export function Notch({ edge, children, className, r = 22 }: { edge: 'top' | 'bottom'; children: ReactNode; className?: string; r?: number }) {
  const top = edge === 'top'
  const flare = (side: 'left' | 'right') => ({
    width: r,
    height: r,
    [side]: -r + 0.5,
    [top ? 'top' : 'bottom']: 0,
    background: `radial-gradient(circle at ${side === 'left' ? '0' : '100%'} ${top ? '100%' : '0'}, transparent ${r - 0.5}px, var(--color-ink) ${r}px)`,
  })
  return (
    <div className={cn('absolute z-30 bg-ink text-white', top ? 'top-0 rounded-b-[1.4rem]' : 'bottom-0 rounded-t-[1.6rem]', className)}>
      <span aria-hidden className="pointer-events-none absolute" style={flare('left')} />
      <span aria-hidden className="pointer-events-none absolute" style={flare('right')} />
      {children}
    </div>
  )
}
