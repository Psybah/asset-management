import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A tab of the dark frame that dips into the light container. Its sides slant
 * outward in a smooth S-curve where they meet the edge (like a dock), drawn as
 * an SVG path sized to the content.
 * `edge="top"` hangs from the top edge; `edge="bottom"` rises from the bottom.
 */
export function Notch({ edge, children, className, bodyClassName, slant = 46 }: { edge: 'top' | 'bottom'; children: ReactNode; className?: string; bodyClassName?: string; slant?: number }) {
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
  // Each side: a short concave fillet at the frame edge, then a long, soft convex
  // curve into the face, so the corners at the face read as generously rounded.
  const d = edge === 'top'
    ? `M0 0 L${W} 0 C${W - s * 0.3} 0 ${W - s * 0.25} ${h} ${W - s} ${h} L${s} ${h} C${s * 0.25} ${h} ${s * 0.3} 0 0 0 Z`
    : `M0 ${h} L${W} ${h} C${W - s * 0.3} ${h} ${W - s * 0.25} 0 ${W - s} 0 L${s} 0 C${s * 0.25} 0 ${s * 0.3} ${h} 0 ${h} Z`

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
