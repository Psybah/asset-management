import { animate, motion, useInView, useMotionValue, useTransform } from 'motion/react'
import { BorderBeam } from 'border-beam'
import {
  useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
} from 'react'
import { cn } from '@/lib/utils'
import type { Status } from '@/lib/types'
import { AssetIcon } from '@/lib/icons'

export const cx = cn
export const ease = [0.16, 1, 0.3, 1] as const
export const spring = { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 } as const

/* ------------------------------------------------------------------ */
/* Texture button — 1px gradient rim around a gradient face, fully     */
/* rounded, with a mono beam travelling the edge (after dailo).        */
/* ------------------------------------------------------------------ */

type Tone = 'ink' | 'paper' | 'ghost'
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

const rim: Record<Tone, string> = {
  ink: 'bg-linear-to-b from-[#5a5a5a] to-ink',
  paper: 'bg-linear-to-b from-white to-[#ebebeb]',
  ghost: 'bg-transparent',
}
const face: Record<Tone, string> = {
  ink: 'bg-linear-to-b from-[#3a3a3a] to-ink text-white hover:brightness-125 active:brightness-110',
  paper: 'bg-linear-to-b from-white to-[#f1f1f1] text-ink hover:brightness-[0.97] active:brightness-[0.94]',
  ghost: 'text-ink hover:bg-white active:bg-mist',
}
const sizes: Record<Size, string> = {
  sm: 'h-8 px-3.5 text-xs',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-[0.9375rem]',
  icon: 'size-11',
  'icon-sm': 'size-9',
}
const beamStyle = {
  light: { '--beam-stroke-opacity': 5, '--beam-inner-opacity': 1.6 },
  dark: { '--beam-stroke-opacity': 2.6, '--beam-inner-opacity': 1.4 },
} as Record<'light' | 'dark', CSSProperties>

type BtnProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  tone?: Tone
  size?: Size
  beam?: boolean
  className?: string
  faceClassName?: string
  label?: string
}

export function Button({ tone = 'ink', size = 'md', beam, className, faceClassName, children, type = 'button', disabled, label, ...rest }: BtnProps) {
  const showBeam = (beam ?? tone === 'ink') && !disabled
  const control = (
    <button
      type={type}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn('flex w-full rounded-full p-px transition duration-300 disabled:pointer-events-none disabled:opacity-40', rim[tone])}
      {...rest}
    >
      <span className={cn('flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[filter,background-color,scale] duration-200 active:scale-[0.97] [&_svg]:shrink-0', face[tone], sizes[size], faceClassName)}>
        {children}
      </span>
    </button>
  )
  if (!showBeam) return <span className={cn('inline-flex shrink-0 rounded-full', className)}>{control}</span>
  const theme = tone === 'ink' ? 'dark' : 'light'
  return (
    <BorderBeam size="sm" colorVariant="mono" theme={theme} borderRadius={999} className={cn('inline-flex shrink-0 rounded-full', className)} style={beamStyle[theme]}>
      {control}
    </BorderBeam>
  )
}

export function IconButton({ label, size = 'icon', tone = 'paper', ...rest }: BtnProps & { label: string }) {
  return <Button label={label} size={size} tone={tone} beam={false} {...rest} />
}

/* ------------------------------------------------------------------ */
/* Floating-label filled fields, no borders                            */
/* ------------------------------------------------------------------ */

const fieldBase =
  'peer w-full rounded-[inherit] bg-mist px-4 text-sm text-ink outline-none transition-colors placeholder:text-transparent hover:bg-fog/70 focus:bg-[#ececec]'
const labelBase = 'pointer-events-none absolute left-4 text-smoke transition-all duration-200 peer-focus:text-ink'

/** Stacks fields 2px apart: outer corners rounded, inner corners tight. */
export function FieldGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('stack', className)}>{children}</div>
}

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder'> & { label: string; trailing?: ReactNode }

export function Field({ label, id, className, value, onFocus, onBlur, trailing, type = 'text', ...rest }: FieldProps) {
  const gen = useId()
  const fid = id ?? gen
  const [focused, setFocused] = useState(false)
  const raised = focused || String(value ?? '').length > 0 || type === 'date'
  return (
    <div className={cn('relative rounded-2xl', className)}>
      <input
        id={fid}
        type={type}
        value={value}
        placeholder={label}
        className={cn(fieldBase, 'h-13 pt-4', trailing && 'pr-12')}
        onFocus={(e) => { setFocused(true); onFocus?.(e) }}
        onBlur={(e) => { setFocused(false); onBlur?.(e) }}
        {...rest}
      />
      <label htmlFor={fid} className={cn(labelBase, raised ? 'top-2 text-[10px] font-medium' : 'top-1/2 -translate-y-1/2 text-sm')}>{label}</label>
      {trailing ? <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div> : null}
    </div>
  )
}

export function SelectField({ label, id, className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const gen = useId()
  const fid = id ?? gen
  return (
    <div className={cn('relative rounded-2xl', className)}>
      <select id={fid} className={cn(fieldBase, 'h-13 appearance-none pr-10 pt-4')} {...rest}>{children}</select>
      <label htmlFor={fid} className={cn(labelBase, 'top-2 text-[10px] font-medium')}>{label}</label>
      <svg className="pointer-events-none absolute right-4 top-1/2 size-3 -translate-y-1/2 text-ash" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Panel — a white wrap: title row on top, thin rim left/right/bottom  */
/* around an inset body.                                               */
/* ------------------------------------------------------------------ */

export function Panel({ title, action, children, className, bodyClassName, tone = 'paper', inset = true }: {
  title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; tone?: 'paper' | 'ink'; inset?: boolean
}) {
  return (
    <section className={cn('flex min-w-0 flex-col rounded-[1.6rem] p-1.5', tone === 'ink' ? 'bg-ink text-white' : 'bg-white', className)}>
      {(title || action) && (
        <header className="flex min-h-10 items-center justify-between gap-3 px-3 pb-1.5 pt-1.5">
          <h2 className={cn('truncate text-[13px] font-medium tracking-tight', tone === 'ink' ? 'text-white/70' : 'text-smoke')}>{title}</h2>
          {action}
        </header>
      )}
      <div className={cn('min-h-0 flex-1 rounded-[1.25rem]', inset && (tone === 'ink' ? 'bg-white/[0.06]' : 'bg-mist'), bodyClassName)}>{children}</div>
    </section>
  )
}

export function PageHeader({ eyebrow, title, actions }: { eyebrow?: ReactNode; title: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {eyebrow ? <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="mb-1 text-xs font-medium text-ash">{eyebrow}</motion.p> : null}
        <h1 className="overflow-hidden text-2xl font-medium tracking-[-0.03em] md:text-[1.75rem]">
          <motion.span className="block" initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ duration: 0.8, ease }}>{title}</motion.span>
        </h1>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Segmented pill tabs                                                 */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({ value, options, onChange, id }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; id: string }) {
  return (
    <div className="no-scrollbar inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-white p-1">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={cn('relative h-8 shrink-0 rounded-full px-3.5 text-xs font-medium capitalize transition-colors', value === o.value ? 'text-white' : 'text-smoke hover:text-ink')}>
          {value === o.value && <motion.span layoutId={id} transition={spring} className="absolute inset-0 rounded-full bg-ink" />}
          <span className="relative flex items-center gap-1.5">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function StatusMark({ status, className, onPaper }: { status: Status; className?: string; onPaper?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium capitalize',
        status === 'available' && (onPaper ? 'bg-mist text-ink' : 'bg-white text-ink'),
        status === 'assigned' && 'bg-ink text-white',
        status === 'maintenance' && 'bg-fog text-ink',
        status === 'retired' && 'bg-transparent text-ash line-through',
        className,
      )}
    >
      {status === 'maintenance' && <span className="size-1.5 animate-pulse rounded-full bg-ink" />}
      {status}
    </span>
  )
}

/** Asset photo, monochrome until hovered. Falls back to the category icon. */
export function Photo({ src, icon, alt, className, iconSize = 40, color = false }: { src?: string | null; icon?: string; alt: string; className?: string; iconSize?: number; color?: boolean }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={cn('relative grid place-items-center overflow-hidden bg-mist', className)}>
      {src && !failed ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn('size-full object-cover transition-[filter,scale] duration-700 ease-[cubic-bezier(.16,1,.3,1)]', !color && 'grayscale group-hover:grayscale-0', 'group-hover:scale-[1.04]')}
        />
      ) : (
        <AssetIcon name={icon} size={iconSize} weight="thin" className="text-ink/70" />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Motion helpers                                                      */
/* ------------------------------------------------------------------ */

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.55, ease }}
      className={cn('w-full', className)}
    >
      {children}
    </motion.main>
  )
}

export function Reveal({ children, delay = 0, className, y = 20 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }} transition={{ duration: 0.8, ease, delay }} className={className}>
      {children}
    </motion.div>
  )
}

export function Counter({ value, format = (n) => Math.round(n).toLocaleString(), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const mv = useMotionValue(0)
  const text = useTransform(mv, format)
  useEffect(() => {
    if (!inView) return
    const c = animate(mv, value, { duration: 1.4, ease })
    return () => c.stop()
  }, [inView, value, mv])
  return <motion.span ref={ref} className={cn('tabular', className)}>{text}</motion.span>
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-[1.25rem] bg-white/70', className)} />
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="flex h-48 items-center justify-center rounded-[1.25rem] bg-mist text-sm text-ash">{children}</div>
}
