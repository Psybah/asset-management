import { ArrowUpRight, Warning } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Area, Bars, Ring } from '../components/Charts'
import { Counter, Page, Reveal, Skeleton, cx, ease } from '../components/ui'
import { useAuth } from '../lib/auth'
import { ago, compact, naira, shortDate } from '../lib/format'
import { AssetIcon } from '../lib/icons'
import type { Dashboard } from '../lib/types'
import { useData } from '../lib/useData'

function Tile({ children, className, tone = 'mist', delay = 0, to }: { children: ReactNode; className?: string; tone?: 'mist' | 'ink' | 'paper'; delay?: number; to?: string }) {
  const body = (
    <motion.div
      whileHover={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cx(
        'group relative overflow-hidden rounded-[2.25rem] p-6 md:p-7',
        tone === 'mist' && 'bg-mist',
        tone === 'ink' && 'bg-ink text-paper',
        tone === 'paper' && 'bg-paper',
        className,
      )}
    >
      {children}
      {to && <ArrowUpRight size={18} className="absolute right-6 top-6 opacity-0 transition-all duration-500 group-hover:opacity-100" />}
    </motion.div>
  )
  return <Reveal delay={delay}>{to ? <Link to={to}>{body}</Link> : body}</Reveal>
}

const Cap = ({ children, invert }: { children: ReactNode; invert?: boolean }) => (
  <p className={cx('text-xs', invert ? 'text-paper/50' : 'text-smoke')}>{children}</p>
)

export default function Overview() {
  const { user } = useAuth()
  const { data: d } = useData<Dashboard>('/dashboard/')
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'

  const t = d?.totals
  const active = t ? t.assets - t.retired : 0
  const util = t && active ? t.assigned / active : 0
  const lost = t ? t.purchase_value - t.current_value : 0

  return (
    <Page>
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6 md:mb-16">
        <div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mb-4 pl-1 text-sm text-smoke">
            {greet}, {user?.name.split(' ')[0]}
          </motion.p>
          <h1 className="text-[clamp(3.5rem,11vw,11rem)] leading-[0.85] tracking-[-0.065em]">
            {t ? <Counter value={t.assets} /> : '—'}
            <motion.sup initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="ml-2 align-super text-[0.18em] tracking-normal text-ash">assets</motion.sup>
          </h1>
        </div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="max-w-[14rem] text-right text-sm text-ash">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </motion.p>
      </header>

      {!d ? (
        <div className="masonry wide">
          {[280, 180, 340, 220, 260, 200, 300, 180].map((h, i) => <div key={i} style={{ height: h }}><Skeleton className="h-full w-full" /></div>)}
        </div>
      ) : (
        <div className="masonry wide">
          {/* Book value */}
          <Tile tone="ink" className="pb-0 md:pb-0">
            <Cap invert>Book value</Cap>
            <p className="mt-2 text-5xl tracking-[-0.05em] lg:text-6xl">
              ₦<Counter value={t!.current_value} format={(n) => compact(n)} />
            </p>
            <p className="mt-1 text-xs text-paper/40">of {naira(t!.purchase_value)}</p>
            <div className="-mx-7 mt-6">
              <Area invert height={130} data={d.value_trend.map((v) => ({ x: v.year, y: v.value }))} format={(n) => `₦${compact(n)}`} />
            </div>
          </Tile>

          {/* Utilisation */}
          <Tile delay={0.05} to="/assets">
            <div className="flex items-center justify-between">
              <div>
                <Cap>In use</Cap>
                <p className="mt-2 text-6xl tracking-[-0.05em]"><Counter value={util * 100} />%</p>
              </div>
              <Ring value={util} size={96} />
            </div>
          </Tile>

          {/* Status split */}
          <Tile delay={0.1} tone="paper" className="!px-0">
            <div className="flex h-14 w-full gap-1 overflow-hidden rounded-full">
              {d.by_status.filter((s) => s.count > 0).map((s, i) => (
                <motion.div
                  key={s.status}
                  initial={{ flexGrow: 0 }}
                  whileInView={{ flexGrow: s.count }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.2, ease, delay: 0.2 + i * 0.08 }}
                  className={cx(
                    'group/s relative flex min-w-[3.5rem] basis-0 items-center justify-center rounded-full text-xs',
                    s.status === 'assigned' && 'bg-ink text-paper',
                    s.status === 'available' && 'bg-mist',
                    s.status === 'maintenance' && 'grain bg-fog',
                    s.status === 'retired' && 'bg-fog text-ash',
                  )}
                  title={s.status}
                >
                  <span className="tabular">{s.count}</span>
                </motion.div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-2 text-[11px] text-ash">
              {d.by_status.filter((s) => s.count > 0).map((s) => <span key={s.status} className="capitalize">{s.status}</span>)}
            </div>
          </Tile>

          {/* Categories as icon cloud */}
          <Tile delay={0.15} to="/library">
            <Cap>Kinds</Cap>
            <div className="mt-5 flex flex-wrap gap-2">
              {d.by_category.map((c, i) => {
                const max = Math.max(...d.by_category.map((x) => x.count))
                const s = 44 + (c.count / max) * 36
                return (
                  <motion.div
                    key={c.name}
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 + i * 0.04 }}
                    className="group/c relative grid place-items-center rounded-full bg-paper"
                    style={{ width: s, height: s }}
                    title={`${c.name} · ${c.count}`}
                  >
                    <AssetIcon name={c.icon} size={s * 0.4} />
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[10px] text-paper">{c.count}</span>
                  </motion.div>
                )
              })}
            </div>
          </Tile>

          {/* Overdue care */}
          <Tile delay={0.2} tone={t!.overdue_maintenance ? 'ink' : 'mist'} to="/maintenance">
            <div className="flex items-start gap-3">
              {t!.overdue_maintenance > 0 && <Warning size={20} weight="fill" className="mt-1" />}
              <div>
                <p className="text-6xl tracking-[-0.05em]"><Counter value={t!.overdue_maintenance} /></p>
                <Cap invert={!!t!.overdue_maintenance}>Overdue care</Cap>
              </div>
            </div>
          </Tile>

          {/* Departments */}
          <Tile delay={0.25}>
            <Cap>By department</Cap>
            <div className="mt-10">
              <Bars data={d.by_department.map((x) => ({ label: x.name, value: x.count }))} height={150} />
            </div>
            <div className="mt-3 flex justify-between text-[10px] text-ash">
              {d.by_department.map((x) => <span key={x.name} className="w-0 flex-1 truncate text-center">{x.name.slice(0, 3)}</span>)}
            </div>
          </Tile>

          {/* Upcoming care */}
          <Tile delay={0.3} tone="paper" className="!p-0">
            <div className="flex flex-col gap-1.5">
              {d.upcoming_maintenance.slice(0, 5).map((m, i) => (
                <Reveal key={m.id} delay={0.05 * i} y={12}>
                  <Link to={`/assets/${m.asset}`} className={cx('flex h-14 items-center justify-between gap-3 rounded-full px-5 text-sm transition-colors', m.overdue ? 'bg-ink text-paper' : 'bg-mist hover:bg-fog')}>
                    <span className="truncate">{m.title}</span>
                    <span className={cx('shrink-0 text-xs', m.overdue ? 'text-paper/60' : 'text-ash')}>{shortDate(m.scheduled_date)}</span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </Tile>

          {/* Depreciation */}
          <Tile delay={0.35}>
            <Cap>Depreciated</Cap>
            <p className="mt-2 text-4xl tracking-[-0.04em]">₦<Counter value={lost} format={(n) => compact(n)} /></p>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-paper">
              <motion.div
                className="h-full rounded-full bg-ink"
                initial={{ width: 0 }}
                whileInView={{ width: `${t!.purchase_value ? (lost / t!.purchase_value) * 100 : 0}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1.4, ease }}
              />
            </div>
          </Tile>

          {/* Activity */}
          <Tile delay={0.4} tone="ink" to="/activity">
            <Cap invert>Lately</Cap>
            <ul className="mt-5 space-y-4">
              {d.recent_activity.slice(0, 6).map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <span className="w-8 shrink-0 text-paper/40 tabular">{ago(a.timestamp)}</span>
                  <span className="line-clamp-2 text-paper/90">{a.summary}</span>
                </li>
              ))}
            </ul>
          </Tile>

          {/* Free */}
          <Tile delay={0.45} to="/assets?status=available">
            <p className="text-6xl tracking-[-0.05em]"><Counter value={t!.available} /></p>
            <Cap>Ready to assign</Cap>
          </Tile>
        </div>
      )}
    </Page>
  )
}
