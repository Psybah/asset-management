import { animate, motion, useInView, useMotionValue, useTransform, type HTMLMotionProps } from 'motion/react'
import { forwardRef, useEffect, useRef, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react'
import type { Status } from '../lib/types'

export const ease = [0.16, 1, 0.3, 1] as const
export const spring = { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 } as const

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
export { cx }

/* ---------- Buttons ---------- */

type BtnProps = HTMLMotionProps<'button'> & { tone?: 'ink' | 'mist' | 'paper' | 'ghost'; size?: 'sm' | 'md' | 'lg' }

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { tone = 'ink', size = 'md', className, children, ...rest }, ref,
) {
  return (
    <motion.button
      ref={ref}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      transition={spring}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap select-none transition-colors duration-300 disabled:opacity-30 disabled:pointer-events-none',
        tone === 'ink' && 'bg-ink text-paper',
        tone === 'mist' && 'bg-mist text-ink hover:bg-fog',
        tone === 'paper' && 'bg-paper text-ink',
        tone === 'ghost' && 'text-ink hover:bg-mist',
        size === 'sm' && 'h-9 px-4 text-[13px]',
        size === 'md' && 'h-12 px-6 text-sm',
        size === 'lg' && 'h-16 px-9 text-base',
        className,
      )}
      {...rest}
    >
      {children as ReactNode}
    </motion.button>
  )
})

export function IconButton({ className, tone = 'mist', label, ...rest }: BtnProps & { label: string }) {
  return <Button tone={tone} aria-label={label} title={label} className={cx('!px-0 aspect-square', className)} {...rest} />
}

/* ---------- Inputs ---------- */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cx('h-14 w-full rounded-full bg-mist px-6 text-[15px] transition-colors duration-300 focus:bg-fog', className)}
      {...rest}
    />
  )
})

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cx('h-14 w-full appearance-none rounded-full bg-mist px-6 pr-12 text-[15px] transition-colors duration-300 focus:bg-fog', className)}
        {...rest}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-ash">↓</span>
    </div>
  )
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-2 block pl-6 text-xs text-smoke">{label}</span>
      {children}
    </label>
  )
}

/* ---------- Chips & status ---------- */

export function Chip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'relative h-10 shrink-0 rounded-full px-5 text-[13px] transition-colors duration-300',
        active ? 'text-paper' : 'text-smoke hover:text-ink',
      )}
    >
      {active && <motion.span layoutId="chip" transition={spring} className="absolute inset-0 rounded-full bg-ink" />}
      <span className="relative capitalize">{children}</span>
    </button>
  )
}

/** `onPaper` = rendered on a white surface, so "available" needs a grey fill to stay visible. */
export function StatusMark({ status, className, onPaper }: { status: Status; className?: string; onPaper?: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[11px] capitalize',
        status === 'available' && (onPaper ? 'bg-mist text-ink' : 'bg-paper text-ink'),
        status === 'assigned' && 'bg-ink text-paper',
        status === 'maintenance' && 'bg-fog text-ink',
        status === 'retired' && 'bg-transparent text-ash line-through',
        className,
      )}
    >
      {status === 'maintenance' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink" />}
      {status}
    </span>
  )
}

/* ---------- Motion helpers ---------- */

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -12, filter: 'blur(6px)' }}
      transition={{ duration: 0.7, ease }}
      className={cx('mx-auto w-full max-w-[1800px] px-4 pb-40 pt-6 md:px-8 md:pt-10', className)}
    >
      {children}
    </motion.main>
  )
}

export function Reveal({ children, delay = 0, className, y = 28 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.9, ease, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** Big headline that slides up word by word. */
export function Title({ children, className }: { children: string; className?: string }) {
  return (
    <h1 className={cx('flex flex-wrap gap-x-[0.25em] overflow-hidden text-[clamp(3rem,9vw,9rem)] leading-[0.9] tracking-[-0.055em] font-normal', className)}>
      {children.split(' ').map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.08em]">
          <motion.span
            className="inline-block"
            initial={{ y: '105%' }}
            animate={{ y: 0 }}
            transition={{ duration: 1, ease, delay: 0.05 + i * 0.07 }}
          >
            {w}
          </motion.span>
        </span>
      ))}
    </h1>
  )
}

export function Counter({ value, format = (n) => Math.round(n).toLocaleString(), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const mv = useMotionValue(0)
  const text = useTransform(mv, format)
  useEffect(() => {
    if (!inView) return
    const c = animate(mv, value, { duration: 1.6, ease })
    return () => c.stop()
  }, [inView, value, mv])
  return <motion.span ref={ref} className={cx('tabular', className)}>{text}</motion.span>
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-[2rem] bg-mist', className)} />
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="flex h-64 items-center justify-center rounded-[2.5rem] bg-mist text-sm text-ash">{children}</div>
}
