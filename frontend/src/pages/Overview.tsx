import { ArrowUpRight, CheckCircle, Cube, HandArrowUp, Warning } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { Area } from '@/components/charts/area'
import { AreaChart } from '@/components/charts/area-chart'
import { Grid } from '@/components/charts/grid'
import { PieChart } from '@/components/charts/pie-chart'
import { PieSlice } from '@/components/charts/pie-slice'
import { Ring } from '@/components/charts/ring'
import { RingCenter } from '@/components/charts/ring-center'
import { RingChart } from '@/components/charts/ring-chart'
import { ChartTooltip } from '@/components/charts/tooltip'
import { XAxis } from '@/components/charts/x-axis'
import { Counter, Metric, Page, PageHeader, Panel, Photo, Reveal, Skeleton, cx } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { ago, compact } from '@/lib/format'
import type { Asset, Dashboard, Status } from '@/lib/types'
import { useData } from '@/lib/useData'

const GREYS = ['#0a0a0a', '#3a3a3a', '#5e5e5e', '#828282', '#a6a6a6', '#c6c6c6', '#e0e0e0']
const STATUS_TONE: Record<Status, string> = { assigned: '#0a0a0a', available: '#8a8a8a', maintenance: '#c4c4c4', retired: '#e4e4e4' }
const STATUS_LABEL: Record<Status, string> = { assigned: 'In use', available: 'Available', maintenance: 'Maintenance', retired: 'Retired' }

/** Thick segmented bar (after the alvastudio contributor progress bar). */
function StatusBar({ rows }: { rows: { status: Status; count: number }[] }) {
  const total = rows.reduce((n, r) => n + r.count, 0) || 1
  const order: Status[] = ['assigned', 'available', 'maintenance', 'retired']
  const segs = order.map((s) => ({ s, n: rows.find((r) => r.status === s)?.count ?? 0 })).filter((x) => x.n > 0)
  return (
    <div>
      <div className="flex h-10 w-full overflow-hidden rounded-md bg-mist">
        {segs.map(({ s, n }, i) => (
          <Link
            key={s}
            to={`/assets?status=${s}`}
            title={`${STATUS_LABEL[s]}: ${n}`}
            className={cx('h-full transition-[filter] duration-200 hover:brightness-110', i > 0 && 'border-l-2 border-white')}
            style={{ width: `${(n / total) * 100}%`, background: STATUS_TONE[s] }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {order.map((s) => {
          const n = rows.find((r) => r.status === s)?.count ?? 0
          return (
            <span key={s} className="flex items-center gap-2 text-xs text-smoke">
              <span className="size-2 shrink-0 rounded-full" style={{ background: STATUS_TONE[s] }} />
              {STATUS_LABEL[s]} <span className="font-medium text-ink tabular">{Math.round((n / total) * 100)}%</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function DepartmentPie({ rows }: { rows: { name: string; count: number }[] }) {
  const [hi, setHi] = useState<number | null>(null)
  const data = rows.filter((r) => r.count > 0).map((r, i) => ({ label: r.name, value: r.count, color: GREYS[i % GREYS.length] }))
  const total = data.reduce((n, d) => n + d.value, 0)
  return (
    <div className="flex h-full flex-col">
      <div className="mx-auto aspect-square w-full max-w-[220px]">
        <PieChart data={data} padAngle={0.02} cornerRadius={4} hoveredIndex={hi} onHoverChange={setHi}>
          {data.map((_, i) => <PieSlice key={i} index={i} />)}
        </PieChart>
      </div>
      <ul className="mt-3 space-y-1">
        {data.map((d, i) => (
          <li key={d.label} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}
            className={cx('flex items-center gap-2 rounded-full px-2 py-1 text-xs transition-colors', hi === i ? 'bg-white' : '')}>
            <span className="size-2 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="min-w-0 flex-1 truncate text-smoke">{d.label}</span>
            <span className="tabular">{d.value}</span>
            <span className="w-9 text-right text-ash tabular">{Math.round((d.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Overview() {
  const { user } = useAuth()
  const { data: d } = useData<Dashboard>('/dashboard/')
  const { data: assets } = useData<Asset[]>('/assets/', { status: 'assigned' })
  const t = d?.totals
  const active = t ? t.assets - t.retired : 0
  const trend = (d?.value_trend ?? []).map((v, i, arr) => ({ date: i === arr.length - 1 ? new Date() : new Date(v.year, 11, 31), value: Math.round(v.value) }))
  const hour = new Date().getHours()

  return (
    <Page>
      <PageHeader
        docTitle="Overview"
        eyebrow={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`Good ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, ${user?.name.split(' ')[0] ?? ''}`}
      />

      <div className="space-y-4">
        {/* Metrics: full width, one group */}
        <div className="grid grid-cols-2 gap-2 rounded-[1.4rem] bg-[#e2e2e2] p-2 lg:grid-cols-4">
          {!t ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />) : <>
            <Link to="/assets"><Metric label="Assets" value={t.assets} icon={<Cube size={15} />} hint={`₦${compact(t.purchase_value)} purchase value`} /></Link>
            <Link to="/assets?status=assigned"><Metric label="In use" value={t.assigned} icon={<HandArrowUp size={15} />} hint={`${Math.round((t.assigned / Math.max(1, active)) * 100)}% of active`} delay={0.05} /></Link>
            <Link to="/assets?status=available"><Metric label="Available" value={t.available} icon={<CheckCircle size={15} />} hint="Ready to assign" delay={0.1} /></Link>
            <Link to="/maintenance"><Metric label="Overdue jobs" value={t.overdue_maintenance} icon={<Warning size={15} />} hint={`${t.maintenance} in progress`} delay={0.15} /></Link>
          </>}
        </div>

        {/* Charts: one row. Column 1 stacks book value over the status bar; the row shares one height. */}
        <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <Reveal className="flex-1">
              <Panel title="Book value" action={t && <span className="text-xs text-ash">of ₦{compact(t.purchase_value)}</span>} className="h-full" bodyClassName="flex flex-col px-1 pb-1 pt-4">
                <p className="px-4 text-[1.75rem] font-medium leading-none tracking-[-0.04em]">₦{t ? <Counter value={t.current_value} format={(n) => compact(n)} /> : '—'}</p>
                {trend.length > 1 ? (
                  <AreaChart data={trend} xDataKey="date" aspectRatio="auto" className="mt-1 min-h-40 flex-1" margin={{ top: 14, right: 16, bottom: 26, left: 16 }}>
                    <Grid horizontal numTicksRows={3} />
                    <Area dataKey="value" fill="var(--chart-1)" stroke="var(--chart-1)" fillOpacity={0.12} strokeWidth={2} />
                    <XAxis numTicks={6} />
                    <ChartTooltip />
                  </AreaChart>
                ) : <div className="min-h-40 flex-1" />}
              </Panel>
            </Reveal>
            <Reveal delay={0.04}>
              <Panel title="Status split" action={t && <span className="text-xs text-ash tabular">{t.assets} assets</span>} bodyClassName="p-4">
                {d ? <StatusBar rows={d.by_status} /> : <Skeleton className="h-16 bg-white" />}
              </Panel>
            </Reveal>
          </div>

          <Reveal delay={0.06} className="min-w-0">
            <Panel title="Utilisation" className="h-full" bodyClassName="grid place-items-center p-4">
              {t ? (
                <RingChart
                  size={220}
                  strokeWidth={12}
                  ringGap={5}
                  baseInnerRadius={54}
                  data={[
                    { label: 'In use', value: t.assigned, maxValue: active, color: '#0a0a0a' },
                    { label: 'Available', value: t.available, maxValue: active, color: '#8a8a8a' },
                    { label: 'Maintenance', value: t.maintenance, maxValue: active, color: '#c4c4c4' },
                  ]}
                >
                  <Ring index={0} />
                  <Ring index={1} />
                  <Ring index={2} />
                  <RingCenter defaultLabel="Active" />
                </RingChart>
              ) : <Skeleton className="size-52 rounded-full bg-white" />}
            </Panel>
          </Reveal>

          <Reveal delay={0.08} className="min-w-0">
            <Panel title="By department" className="h-full" bodyClassName="p-4">
              {d ? <DepartmentPie rows={d.by_department} /> : <Skeleton className="aspect-square bg-white" />}
            </Panel>
          </Reveal>
        </div>

        {/* Activity + assets in use, side by side */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Reveal>
            <Panel title="Recent activity" action={<Link to="/activity" className="grid size-7 place-items-center rounded-full bg-mist transition-colors hover:bg-fog"><ArrowUpRight size={13} /></Link>} inset={false} className="h-full" bodyClassName="stack">
              {(d?.recent_activity ?? []).slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-center gap-3 bg-mist px-3 py-2.5 text-sm">
                  {a.actor_name ? <Avatar name={a.actor_name} className="size-7" /> : <span className="size-7" />}
                  <span className="min-w-0 flex-1 truncate">{a.summary}</span>
                  <span className="w-8 shrink-0 text-right text-xs text-ash tabular">{ago(a.timestamp)}</span>
                </div>
              ))}
              {!d && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-md bg-mist" />)}
            </Panel>
          </Reveal>
          <Reveal delay={0.05}>
            <Panel title="In people's hands" action={<Link to="/assets?status=assigned" className="grid size-7 place-items-center rounded-full bg-mist transition-colors hover:bg-fog"><ArrowUpRight size={13} /></Link>} inset={false} className="h-full" bodyClassName="grid grid-cols-3 gap-1.5">
              {(assets ?? []).slice(0, 6).map((a) => (
                <Link key={a.id} to={`/assets/${a.id}`} className="group relative overflow-hidden rounded-[1rem]">
                  <Photo src={a.image_url} icon={a.category_icon} alt={a.name} className="aspect-[4/3]" iconSize={28} />
                  <span className="absolute inset-x-1.5 bottom-1.5 flex items-center gap-1.5 truncate rounded-full bg-white/90 py-0.5 pl-0.5 pr-2 text-[10px] font-medium backdrop-blur-sm">
                    <Avatar name={a.assigned_to_name} className="size-5" />{a.assigned_to_name?.split(' ')[0]}
                  </span>
                </Link>
              ))}
              {!assets && [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="aspect-[4/3] bg-mist" />)}
            </Panel>
          </Reveal>
        </div>
      </div>
    </Page>
  )
}
