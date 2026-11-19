import { ArrowRight, Check } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { useToast } from '@/components/Toast'
import { Page, PageHeader, Skeleton, cx, ease } from '@/components/ui'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { compact, shortDate } from '@/lib/format'
import type { Maintenance as M } from '@/lib/types'
import { invalidate, useData } from '@/lib/useData'

const lanes: { key: M['status']; label: string; next?: M['status'] }[] = [
  { key: 'scheduled', label: 'Scheduled', next: 'in_progress' },
  { key: 'in_progress', label: 'In progress', next: 'done' },
  { key: 'done', label: 'Done' },
]

export default function Maintenance() {
  const { data, reload } = useData<M[]>('/maintenance/')
  const { canWrite } = useAuth()
  const toast = useToast()
  const overdue = data?.filter((m) => m.overdue).length ?? 0

  const advance = async (m: M, status: M['status']) => {
    try { await api.patch(`/maintenance/${m.id}/`, { status }); invalidate(); reload(); toast(status === 'done' ? 'Marked done' : 'Started') } catch (e) { toast((e as Error).message) }
  }

  return (
    <Page>
      <PageHeader eyebrow={overdue ? `${overdue} overdue` : 'All on schedule'} title="Maintenance" />
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        {lanes.map((lane, li) => {
          const items = (data ?? [])
            .filter((m) => m.status === lane.key)
            .sort((a, b) => (lane.key === 'done' ? b.scheduled_date.localeCompare(a.scheduled_date) : a.scheduled_date.localeCompare(b.scheduled_date)))
          return (
            <motion.section
              key={lane.key}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease, delay: 0.08 * li }}
              className="w-[82vw] shrink-0 snap-center rounded-[1.6rem] bg-white p-1.5 md:w-auto"
            >
              <header className="flex items-center justify-between px-3 pb-2 pt-1.5">
                <h2 className="text-[13px] font-medium text-smoke">{lane.label}</h2>
                <span className="grid h-6 min-w-6 place-items-center rounded-full bg-mist px-1.5 text-[11px] font-medium tabular">{items.length}</span>
              </header>
              <div className="flex flex-col gap-1">
                {!data && [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 bg-mist" />)}
                <AnimatePresence mode="popLayout">
                  {items.slice(0, lane.key === 'done' ? 10 : 50).map((m) => (
                    <motion.article
                      key={m.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                      className={cx('rounded-[1.15rem] p-4', m.overdue ? 'bg-ink text-white' : 'bg-mist')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={cx('text-sm leading-snug', lane.key === 'done' && 'text-smoke')}>{m.title}</p>
                          <Link to={`/assets/${m.asset}`} className={cx('mt-1 block truncate text-xs hover:underline', m.overdue ? 'text-white/50' : 'text-ash')}>{m.asset_tag} · {m.asset_name}</Link>
                        </div>
                        {canWrite && lane.next && (
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => advance(m, lane.next!)} aria-label={lane.next === 'done' ? 'Mark done' : 'Start'} className={cx('grid size-8 shrink-0 place-items-center rounded-full', m.overdue ? 'bg-white text-ink' : 'bg-white')}>
                            {lane.next === 'done' ? <Check size={14} /> : <ArrowRight size={14} />}
                          </motion.button>
                        )}
                      </div>
                      <div className={cx('mt-4 flex items-center gap-1.5 text-[11px]', m.overdue ? 'text-white/60' : 'text-ash')}>
                        <span className={cx('rounded-full px-2 py-0.5', m.overdue ? 'bg-white/10' : 'bg-white')}>{m.overdue ? 'Overdue · ' : ''}{shortDate(m.completed_date ?? m.scheduled_date)}</span>
                        <span className={cx('rounded-full px-2 py-0.5 capitalize', m.overdue ? 'bg-white/10' : 'bg-white')}>{m.kind}</span>
                        {m.cost ? <span className="ml-auto tabular">₦{compact(m.cost)}</span> : null}
                      </div>
                    </motion.article>
                  ))}
                </AnimatePresence>
                {data && items.length === 0 && <p className="px-3 py-6 text-center text-xs text-ash">Nothing here</p>}
              </div>
            </motion.section>
          )
        })}
      </div>
    </Page>
  )
}
