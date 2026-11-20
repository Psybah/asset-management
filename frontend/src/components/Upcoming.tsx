import { CalendarDots, HandArrowDown, Wrench, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { shortDate } from '@/lib/format'
import type { Assignment, Dashboard } from '@/lib/types'
import { useData } from '@/lib/useData'
import { cn } from '@/lib/utils'
import { lenis } from './SmoothScroll'
import { ease } from './ui'

type Item = { id: string; kind: 'care' | 'return'; date: string; title: string; detail: string; overdue: boolean; to: string }

export function useUpcoming() {
  const { data: d } = useData<Dashboard>('/dashboard/')
  const { data: due } = useData<Assignment[]>('/assignments/', { active: true })
  const today = new Date().toISOString().slice(0, 10)
  const items: Item[] = [
    ...(d?.upcoming_maintenance ?? []).map((m) => ({
      id: `m${m.id}`, kind: 'care' as const, date: m.scheduled_date, title: m.title, detail: `${m.asset_tag} · ${m.asset_name}`, overdue: m.overdue, to: `/assets/${m.asset}`,
    })),
    ...(due ?? []).filter((a) => a.due_date).map((a) => ({
      id: `a${a.id}`, kind: 'return' as const, date: a.due_date!, title: a.asset_name, detail: `${a.asset_tag} · ${a.user_name}`, overdue: a.due_date! < today, to: `/assets/${a.asset}`,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date))
  return { items, loading: !d, overdue: items.filter((i) => i.overdue).length }
}

function Timeline({ items, onNavigate }: { items: Item[]; onNavigate: () => void }) {
  return (
    <ol className="relative">
      <span aria-hidden className="absolute bottom-5 left-[15px] top-5 w-px bg-fog" />
      {items.map((u, i) => {
        const I = u.kind === 'care' ? Wrench : HandArrowDown
        return (
          <motion.li key={u.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease, delay: Math.min(i, 12) * 0.03 }}>
            <Link to={u.to} onClick={onNavigate} className="group relative flex gap-3 rounded-[1rem] py-2.5 pr-2 transition-colors hover:bg-mist">
              <span className="relative z-10 grid size-[31px] shrink-0 place-items-center rounded-full bg-white text-ink ring-1 ring-fog"><I size={14} /></span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="flex items-center gap-1.5 text-[11px] text-ash tabular">
                  {u.overdue && <span className="rounded-full bg-ink px-1.5 py-px text-[10px] font-medium text-white">Overdue</span>}
                  {shortDate(u.date)}
                </p>
                <p className="mt-0.5 truncate text-sm">{u.title}</p>
                <p className="truncate text-xs text-ash">{u.kind === 'care' ? 'Maintenance' : 'Due back'} · {u.detail}</p>
              </div>
            </Link>
          </motion.li>
        )
      })}
    </ol>
  )
}

/** Floating button (beside the profile) that wiggles when something is overdue and opens a side panel. */
export function UpcomingButton() {
  const { items, loading, overdue } = useUpcoming()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    lenis.current?.stop()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => { lenis.current?.start(); window.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        aria-label={`Upcoming${overdue ? `, ${overdue} overdue` : ''}`}
        whileTap={{ scale: 0.92 }}
        animate={overdue ? { rotate: [0, -14, 12, -10, 8, -4, 0] } : { rotate: 0 }}
        transition={overdue ? { duration: 0.9, repeat: Infinity, repeatDelay: 3.2, ease: 'easeInOut' } : undefined}
        className="relative grid size-11 place-items-center rounded-full bg-white text-ink"
      >
        <CalendarDots size={19} />
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[10px] font-medium text-white tabular">
            {overdue || items.length}
          </span>
        )}
      </motion.button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <div className="fixed inset-0 z-50">
              <motion.div className="absolute inset-0 bg-ink/25" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
              <motion.aside
                role="dialog"
                aria-label="Upcoming"
                initial={{ x: '105%' }}
                animate={{ x: 0 }}
                exit={{ x: '105%' }}
                transition={{ duration: 0.55, ease }}
                className="absolute bottom-2 right-2 top-2 flex w-[min(400px,calc(100vw-1rem))] flex-col rounded-[1.75rem] bg-white p-1.5 md:bottom-3 md:right-3 md:top-3"
              >
                <header className="flex items-center justify-between px-4 pb-2 pt-3">
                  <div>
                    <h2 className="text-lg font-medium tracking-[-0.03em]">Upcoming</h2>
                    <p className="text-xs text-ash">{overdue ? `${overdue} overdue · ` : ''}{items.length} items</p>
                  </div>
                  <button onClick={() => setOpen(false)} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-mist hover:bg-fog"><X size={15} /></button>
                </header>
                <div data-lenis-prevent className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2')}>
                  {loading && <p className="px-2 py-6 text-center text-xs text-ash">Loading…</p>}
                  {!loading && items.length === 0 && <p className="px-2 py-6 text-center text-xs text-ash">Nothing scheduled</p>}
                  <Timeline items={items} onNavigate={() => setOpen(false)} />
                </div>
              </motion.aside>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
