import { ArrowUpRight, HandArrowDown, Wrench, Warning } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'
import { Area } from '@/components/charts/area'
import { AreaChart } from '@/components/charts/area-chart'
import { Bar } from '@/components/charts/bar'
import { BarChart } from '@/components/charts/bar-chart'
import { BarXAxis } from '@/components/charts/bar-x-axis'
import { Grid } from '@/components/charts/grid'
import { Ring } from '@/components/charts/ring'
import { RingCenter } from '@/components/charts/ring-center'
import { RingChart } from '@/components/charts/ring-chart'
import { ChartTooltip } from '@/components/charts/tooltip'
import { XAxis } from '@/components/charts/x-axis'
import { Counter, Page, PageHeader, Panel, Photo, Reveal, Skeleton, StatusMark, cx, ease } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { ago, compact, shortDate } from '@/lib/format'
import type { Asset, Assignment, Dashboard } from '@/lib/types'
import { useData } from '@/lib/useData'

function Stat({ label, value, tone = 'paper', delay = 0, to }: { label: string; value: number; tone?: 'paper' | 'ink' | 'mist'; delay?: number; to: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease, delay }}>
      <Link
        to={to}
        className={cx(
          'group flex h-28 flex-col items-center justify-center rounded-[1.5rem] transition-colors duration-300',
          tone === 'ink' && 'bg-ink text-white',
          tone === 'paper' && 'bg-white hover:bg-white/70',
          tone === 'mist' && 'bg-canvas outline-2 outline-dashed -outline-offset-2 outline-fog hover:bg-white/50',
        )}
      >
        <span className="text-[2rem] font-medium leading-none tracking-[-0.04em]"><Counter value={value} /></span>
        <span className={cx('mt-2 text-xs', tone === 'ink' ? 'text-white/55' : 'text-smoke')}>{label}</span>
      </Link>
    </motion.div>
  )
}

type Upcoming = { id: string; kind: 'care' | 'return'; date: string; title: string; detail: string; overdue: boolean; to: string }

/** Vertical timeline of what's coming up: maintenance jobs and assets due back. */
function Timeline({ items }: { items: Upcoming[] }) {
  return (
    <ol className="relative">
      <span aria-hidden className="absolute bottom-4 left-[15px] top-4 w-px bg-fog" />
      {items.map((u, i) => {
        const I = u.kind === 'care' ? Wrench : HandArrowDown
        return (
          <Reveal key={u.id} delay={i * 0.04} y={10}>
            <li>
              <Link to={u.to} className="group relative flex gap-3 rounded-[1.1rem] py-2.5 pl-0 pr-2 transition-colors hover:bg-mist">
                <span className={cx('relative z-10 grid size-[31px] shrink-0 place-items-center rounded-full', u.overdue ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-fog')}>
                  <I size={14} />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className={cx('text-[11px] tabular', u.overdue ? 'font-medium text-ink' : 'text-ash')}>{u.overdue ? 'Overdue · ' : ''}{shortDate(u.date)}</p>
                  <p className="mt-0.5 truncate text-sm">{u.title}</p>
                  <p className="truncate text-xs text-ash">{u.kind === 'care' ? 'Maintenance' : 'Due back'} · {u.detail}</p>
                </div>
              </Link>
            </li>
          </Reveal>
        )
      })}
    </ol>
  )
}

export default function Overview() {
  const { user } = useAuth()
  const { data: d } = useData<Dashboard>('/dashboard/')
  const { data: due } = useData<Assignment[]>('/assignments/', { active: true })
  const { data: assets } = useData<Asset[]>('/assets/', { status: 'assigned' })
  const t = d?.totals
  const today = new Date().toISOString().slice(0, 10)

  const upcoming: Upcoming[] = [
    ...(d?.upcoming_maintenance ?? []).map((m) => ({
      id: `m${m.id}`, kind: 'care' as const, date: m.scheduled_date, title: m.title, detail: `${m.asset_tag} · ${m.asset_name}`, overdue: m.overdue, to: `/assets/${m.asset}`,
    })),
    ...(due ?? []).filter((a) => a.due_date).map((a) => ({
      id: `a${a.id}`, kind: 'return' as const, date: a.due_date!, title: a.asset_name, detail: `${a.asset_tag} · ${a.user_name}`, overdue: a.due_date! < today, to: `/assets/${a.asset}`,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7)

  const active = t ? t.assets - t.retired : 0
  const trend = (d?.value_trend ?? []).map((v, i, arr) => ({ date: i === arr.length - 1 ? new Date() : new Date(v.year, 11, 31), value: Math.round(v.value) }))

  return (
    <Page>
      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${user?.name.split(' ')[0] ?? ''}`}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          {/* Stats */}
          {!t ? (
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              <Stat label="Assets" value={t.assets} to="/assets" />
              <Stat label="In use" value={t.assigned} tone="ink" delay={0.05} to="/assets?status=assigned" />
              <Stat label="Available" value={t.available} delay={0.1} to="/assets?status=available" />
              <Stat label="Overdue care" value={t.overdue_maintenance} tone="mist" delay={0.15} to="/maintenance" />
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            {/* Book value */}
            <Reveal>
              <Panel
                tone="ink"
                title="Book value"
                action={t && <span className="text-xs text-white/45">of ₦{compact(t.purchase_value)}</span>}
                bodyClassName="on-ink flex flex-col px-1 pb-1 pt-4"
              >
                <p className="px-4 text-[2rem] font-medium leading-none tracking-[-0.04em]">₦{t ? <Counter value={t.current_value} format={(n) => compact(n)} /> : '—'}</p>
                {trend.length > 1 ? (
                  <AreaChart data={trend} xDataKey="date" aspectRatio="auto" className="mt-2 h-48" margin={{ top: 16, right: 16, bottom: 28, left: 16 }}>
                    <Grid horizontal numTicksRows={3} />
                    <Area dataKey="value" fill="var(--chart-1)" stroke="var(--chart-1)" fillOpacity={0.18} strokeWidth={2} />
                    <XAxis numTicks={6} />
                    <ChartTooltip />
                  </AreaChart>
                ) : <div className="h-48" />}
              </Panel>
            </Reveal>

            {/* Status ring */}
            <Reveal delay={0.05}>
              <Panel title="Status" bodyClassName="grid place-items-center p-4">
                {t ? (
                  <RingChart
                    size={210}
                    strokeWidth={11}
                    ringGap={5}
                    baseInnerRadius={52}
                    data={[
                      { label: 'In use', value: t.assigned, maxValue: active, color: '#0a0a0a' },
                      { label: 'Available', value: t.available, maxValue: active, color: '#8f8f8f' },
                      { label: 'Maintenance', value: t.maintenance, maxValue: active, color: '#c7c7c7' },
                    ]}
                  >
                    <Ring index={0} />
                    <Ring index={1} />
                    <Ring index={2} />
                    <RingCenter defaultLabel="Active" />
                  </RingChart>
                ) : <Skeleton className="size-52 rounded-full!" />}
              </Panel>
            </Reveal>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            {/* Departments */}
            <Reveal>
              <Panel title="By department" bodyClassName="px-1 pt-3">
                {d ? (
                  <BarChart data={d.by_department.map((x) => ({ name: x.name.split(' ')[0], count: x.count }))} xDataKey="name" aspectRatio="auto" className="h-56" margin={{ top: 12, right: 12, bottom: 30, left: 12 }} barGap={0.35}>
                    <Grid horizontal numTicksRows={3} />
                    <Bar dataKey="count" fill="var(--chart-1)" lineCap="round" />
                    <BarXAxis showAllLabels />
                    <ChartTooltip />
                  </BarChart>
                ) : <div className="h-56" />}
              </Panel>
            </Reveal>

            {/* Recently assigned — photos */}
            <Reveal delay={0.05}>
              <Panel title="In people's hands" action={<Link to="/assets?status=assigned" className="grid size-7 place-items-center rounded-full bg-mist transition-colors hover:bg-fog"><ArrowUpRight size={13} /></Link>} inset={false} bodyClassName="grid grid-cols-3 gap-1.5">
                {(assets ?? []).slice(0, 6).map((a) => (
                  <Link key={a.id} to={`/assets/${a.id}`} className="group relative overflow-hidden rounded-[1.1rem]">
                    <Photo src={a.image_url} icon={a.category_icon} alt={a.name} className="aspect-square" iconSize={28} />
                    <span className="absolute inset-x-1.5 bottom-1.5 truncate rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium backdrop-blur-sm">{a.assigned_to_name?.split(' ')[0]}</span>
                  </Link>
                ))}
                {!assets && [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="aspect-square bg-mist" />)}
              </Panel>
            </Reveal>
          </div>

          {/* Activity */}
          <Reveal>
            <Panel title="Recent activity" action={<Link to="/activity" className="text-xs text-ash hover:text-ink">All</Link>} inset={false} bodyClassName="stack">
              {(d?.recent_activity ?? []).slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center gap-4 bg-mist px-4 py-3 text-sm">
                  <span className="w-8 shrink-0 text-xs text-ash tabular">{ago(a.timestamp)}</span>
                  <span className="min-w-0 flex-1 truncate">{a.summary}</span>
                  <span className="hidden shrink-0 text-xs text-ash sm:block">{a.actor_name}</span>
                </div>
              ))}
            </Panel>
          </Reveal>
        </div>

        {/* Right column: upcoming timeline */}
        <aside className="min-w-0 space-y-4">
          <div className="rounded-[1.6rem] bg-white p-1.5">
            <div className="flex items-center justify-between px-3 pb-1.5 pt-1.5">
              <h2 className="text-[13px] font-medium text-smoke">Upcoming</h2>
              {upcoming.some((u) => u.overdue) && <Warning size={14} weight="fill" />}
            </div>
            <div className="px-2 pb-1">
              {!d && [0, 1, 2].map((i) => <Skeleton key={i} className="my-2 h-14 bg-mist" />)}
              {d && upcoming.length === 0 && <p className="px-1 py-6 text-center text-xs text-ash">Nothing scheduled</p>}
              <Timeline items={upcoming} />
            </div>
          </div>
          {d && (
            <div className="rounded-[1.6rem] bg-white p-1.5">
              <p className="px-3 pb-2 pt-2 text-xs font-medium text-smoke">Status split</p>
              <div className="stack">
                {d.by_status.map((s) => (
                  <Link key={s.status} to={`/assets?status=${s.status}`} className="flex items-center justify-between bg-mist px-4 py-2.5 text-sm transition-colors hover:bg-fog">
                    <StatusMark status={s.status} />
                    <span className="tabular">{s.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </Page>
  )
}
