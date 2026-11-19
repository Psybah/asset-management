import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A tab of the dark frame that dips into the light container. Its sides slant
 * outward in a smooth S-curve where they meet the edge (like a dock), drawn as
 * an SVG path sized to the content.
 * `edge="top"` hangs from the top edge; `edge="bottom"` rises from the bottom.
 */
export function Notch({ edge, children, className, bodyClassName, slant = 68 }: { edge: 'top' | 'bottom'; children: ReactNode; className?: string; bodyClassName?: string; slant?: number }) {
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
  // Each side is one smooth S-curve: it leaves the frame edge tangentially (a soft
  // concave fillet into the straight line) and arrives at the face tangentially (a
  // generously rounded convex corner). A wide slant keeps both curves gentle.
  const k1 = 0.55 // pull at the frame edge
  const k2 = 0.42 // pull at the face — smaller = rounder top corner
  const d = edge === 'top'
    ? `M0 0 L${W} 0 C${W - s * k1} 0 ${W - s * (1 - k2)} ${h} ${W - s} ${h} L${s} ${h} C${s * (1 - k2)} ${h} ${s * k1} 0 0 0 Z`
    : `M0 ${h} L${W} ${h} C${W - s * k1} ${h} ${W - s * (1 - k2)} 0 ${W - s} 0 L${s} 0 C${s * (1 - k2)} 0 ${s * k1} ${h} 0 ${h} Z`

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
