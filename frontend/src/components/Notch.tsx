import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A tab of the dark frame that dips into the light container. Its sides slant
 * outward in a smooth S-curve where they meet the edge (like a dock), drawn as
 * an SVG path sized to the content.
 * `edge="top"` hangs from the top edge; `edge="bottom"` rises from the bottom.
 */
export function Notch({ edge, children, className, bodyClassName, slant = 72 }: { edge: 'top' | 'bottom'; children: ReactNode; className?: string; bodyClassName?: string; slant?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { w, h } = size
  const s = slant
  // Outer width = content + a slant on each side. Curves: flat at the frame edge, flat at the tab face.
  const W = w + s * 2
  // Each side: a soft concave fillet off the frame edge, a straight slant, then a wide
  // convex radius into the face, so the face corners read as properly rounded.
  const left = (y0: number, y1: number) =>
    `Q${s * 0.32} ${y0} ${s * 0.42} ${y0 + (y1 - y0) * 0.36} L${s * 0.56} ${y0 + (y1 - y0) * 0.7} Q${s * 0.68} ${y1} ${s} ${y1}`
  const right = (y0: number, y1: number) =>
    `Q${W - s * 0.68} ${y1} ${W - s * 0.56} ${y0 + (y1 - y0) * 0.7} L${W - s * 0.42} ${y0 + (y1 - y0) * 0.36} Q${W - s * 0.32} ${y0} ${W} ${y0}`
  const d = edge === 'top'
    ? `M0 0 ${left(0, h)} L${W - s} ${h} ${right(0, h)} Z`
    : `M0 ${h} ${left(h, 0)} L${W - s} 0 ${right(h, 0)} Z`

  return (
    <div className={cn('absolute z-30 text-white', edge === 'top' ? 'top-0' : 'bottom-0', className)}>
      {w > 0 && (
        <svg aria-hidden width={W} height={h} viewBox={`0 0 ${W} ${h}`} className="pointer-events-none absolute top-0" style={{ left: -s }}>
          <path d={d} fill="var(--color-ink)" />
        </svg>
      )}
      <div ref={ref} className={cn('relative', bodyClassName)}>{children}</div>
    </div>
  )
}
