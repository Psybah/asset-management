import { motion } from 'motion/react'
import { useId, useState } from 'react'
import { ease } from './ui'

/** Smooth area line. No axes, no gridlines — hover reveals a value. */
export function Area({ data, height = 160, format = String, invert = false }: { data: { x: string | number; y: number }[]; height?: number; format?: (n: number) => string; invert?: boolean }) {
  const id = useId()
  const [hi, setHi] = useState<number | null>(null)
  if (data.length < 2) return <div style={{ height }} />
  const W = 600
  const H = height
  const max = Math.max(...data.map((d) => d.y)) * 1.1 || 1
  const pts = data.map((d, i) => [(i / (data.length - 1)) * W, H - (d.y / max) * (H - 16) - 8] as const)
  const path = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M${x},${y}`
    const [px, py] = pts[i - 1]
    const cx = (px + x) / 2
    return `${acc} C${cx},${py} ${cx},${y} ${x},${y}`
  }, '')
  const fg = invert ? '#fff' : '#0a0a0a'
  return (
    <div className="relative" onMouseLeave={() => setHi(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full" style={{ height }}>
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={fg} stopOpacity="0.14" />
            <stop offset="1" stopColor={fg} stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path d={`${path} L${W},${H} L0,${H} Z`} fill={`url(#${id})`} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, delay: 0.4 }} />
        <motion.path
          d={path}
          fill="none"
          stroke={fg}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.8, ease }}
        />
      </svg>
      <div className="absolute inset-0 flex">
        {data.map((_, i) => <div key={i} className="flex-1" onMouseEnter={() => setHi(i)} />)}
      </div>
      {hi !== null && (
        <>
          <span
            className={`pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ${invert ? 'bg-paper' : 'bg-ink'}`}
            style={{ left: `${(hi / (data.length - 1)) * 100}%`, top: `${(pts[hi][1] / H) * 100}%` }}
          />
          <span
            className={`pointer-events-none absolute -translate-x-1/2 rounded-full px-3 py-1 text-[11px] whitespace-nowrap ${invert ? 'bg-paper text-ink' : 'bg-ink text-paper'}`}
            style={{ left: `clamp(48px, ${(hi / (data.length - 1)) * 100}%, calc(100% - 48px))`, top: `calc(${(pts[hi][1] / H) * 100}% - 36px)` }}
          >
            {data[hi].x} · {format(data[hi].y)}
          </span>
        </>
      )}
    </div>
  )
}

/** Rounded vertical bars that grow in. */
export function Bars({ data, height = 140, invert = false }: { data: { label: string; value: number }[]; height?: number; invert?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((d, i) => (
        <div key={d.label} className="group relative flex h-full flex-1 items-end">
          <motion.div
            initial={{ height: 0 }}
            whileInView={{ height: `${Math.max(8, (d.value / max) * 100)}%` }}
            viewport={{ once: true }}
            transition={{ duration: 1.1, ease, delay: i * 0.05 }}
            className={`w-full rounded-full transition-opacity duration-300 group-hover:opacity-100 ${invert ? 'bg-paper opacity-80' : 'bg-ink opacity-90'}`}
          />
          <span className={`pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-1 text-[10px] whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100 ${invert ? 'bg-paper text-ink' : 'bg-ink text-paper'}`}>
            {d.label} · {d.value}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Concentric ring meter. */
export function Ring({ value, size = 120, invert = false }: { value: number; size?: number; invert?: boolean }) {
  const r = 44
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke={invert ? 'rgba(255,255,255,.15)' : '#e8e8e8'} strokeWidth="6" />
      <motion.circle
        cx="50" cy="50" r={r} fill="none" stroke={invert ? '#fff' : '#0a0a0a'} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        whileInView={{ strokeDashoffset: c * (1 - Math.min(1, Math.max(0, value))) }}
        viewport={{ once: true }}
        transition={{ duration: 1.6, ease }}
      />
    </svg>
  )
}
