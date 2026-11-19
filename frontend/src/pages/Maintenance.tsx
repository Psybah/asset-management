import { ArrowRight, Check, Warning } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { Page, Skeleton, Title, cx, ease } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { compact, shortDate } from '../lib/format'
import type { Maintenance as M } from '../lib/types'
import { invalidate, useData } from '../lib/useData'

const lanes: { key: M['status']; label: string; next?: M['status'] }[] = [
  { key: 'scheduled', label: 'Next', next: 'in_progress' },
  { key: 'in_progress', label: 'Now', next: 'done' },
  { key: 'done', label: 'Done' },
]

export default function Maintenance() {
  const { data, reload } = useData<M[]>('/maintenance/')
  const { canWrite } = useAuth()
  const toast = useToast()

  const advance = async (m: M, status: M['status']) => {
    try {
      await api.patch(`/maintenance/${m.id}/`, { status })
      invalidate(); reload()
      toast(status === 'done' ? 'Done' : 'Started')
    } catch (e) { toast((e as Error).message) }
  }

  const overdue = data?.filter((m) => m.overdue).length ?? 0

  return (
    <Page>
      <div className="mb-12 flex items-end justify-between gap-4">
        <Title>Care</Title>
        {overdue > 0 && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.6 }} className="mb-3 flex h-11 shrink-0 items-center gap-2 rounded-full bg-ink px-5 text-sm text-paper">
            <Warning size={16} weight="fill" /> {overdue}
          </motion.span>
        )}
      </div>

      {/* Horizontal lanes — snap scroll on mobile */}
      <div data-lenis-prevent-wheel className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        {lanes.map((lane, li) => {
          const items = (data ?? [])
            .filter((m) => m.status === lane.key)
            .sort((a, b) => (lane.key === 'done' ? b.scheduled_date.localeCompare(a.scheduled_date) : a.scheduled_date.localeCompare(b.scheduled_date)))
          return (
            <motion.section
              key={lane.key}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease, delay: 0.15 + li * 0.1 }}
              className={cx('w-[85vw] shrink-0 snap-center md:w-auto', li === 1 && 'md:mt-24', li === 2 && 'md:mt-48')}
            >
              <div className="mb-4 flex items-baseline justify-between px-3">
                <h2 className="text-2xl tracking-[-0.04em]">{lane.label}</h2>
                <span className="text-sm text-ash tabular">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {!data && [0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
                <AnimatePresence mode="popLayout">
                  {items.slice(0, lane.key === 'done' ? 12 : 50).map((m) => (
                    <motion.article
                      key={m.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.25 } }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      className={cx('group rounded-[2rem] p-5', m.overdue ? 'bg-ink text-paper' : lane.key === 'done' ? 'bg-mist/60' : 'bg-mist')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={cx('text-[15px] leading-snug', lane.key === 'done' && 'text-smoke')}>{m.title}</p>
                          <Link to={`/assets/${m.asset}`} className={cx('mt-1 block truncate text-xs hover:underline', m.overdue ? 'text-paper/50' : 'text-ash')}>
                            {m.asset_tag} · {m.asset_name}
                          </Link>
                        </div>
                        {canWrite && lane.next && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => advance(m, lane.next!)}
                            aria-label={lane.next === 'done' ? 'Mark done' : 'Start'}
                            className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-full', m.overdue ? 'bg-paper text-ink' : 'bg-paper')}
                          >
                            {lane.next === 'done' ? <Check size={16} /> : <ArrowRight size={16} />}
                          </motion.button>
                        )}
                      </div>
                      <div className={cx('mt-5 flex items-center gap-2 text-xs', m.overdue ? 'text-paper/60' : 'text-ash')}>
                        <span className={cx('rounded-full px-2.5 py-1', m.overdue ? 'bg-paper/10' : 'bg-paper')}>{shortDate(m.completed_date ?? m.scheduled_date)}</span>
                        <span className={cx('rounded-full px-2.5 py-1 capitalize', m.overdue ? 'bg-paper/10' : 'bg-paper')}>{m.kind}</span>
                        {m.cost ? <span className="ml-auto tabular">₦{compact(m.cost)}</span> : null}
                      </div>
                    </motion.article>
                  ))}
                </AnimatePresence>
              </div>
            </motion.section>
          )
        })}
      </div>
    </Page>
  )
}
