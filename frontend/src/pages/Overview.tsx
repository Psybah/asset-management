import { ArrowUpRight, CheckCircle, Cube, HandArrowUp, Warning } from '@phosphor-icons/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { Area } from '@/components/charts/area'
import { AreaChart } from '@/components/charts/area-chart'
import { Grid } from '@/components/charts/grid'
import { PieChart } from '@/components/charts/pie-chart'
import { PieCenter } from '@/components/charts/pie-center'
import { PieSlice } from '@/components/charts/pie-slice'
import { Ring } from '@/components/charts/ring'
import { RingCenter } from '@/components/charts/ring-center'
import { RingChart } from '@/components/charts/ring-chart'
import { ChartTooltip } from '@/components/charts/tooltip'
import { XAxis } from '@/components/charts/x-axis'
import { Counter, Metric, Page, PageHeader, Panel, Photo, PillSelect, Reveal, Skeleton, cx } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { ago, compact } from '@/lib/format'
import type { Asset, Dashboard, Status } from '@/lib/types'
import { useData } from '@/lib/useData'

const GREYS = ['#201515', '#4d4444', '#635b5b', '#847e7e', '#a6a1a1', '#c7c4c4', '#e2e1e1']
const STATUS_TONE: Record<Status, string> = { assigned: '#201515', available: '#847e7e', maintenance: '#c7c4c4', retired: '#e2e1e1' }
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
  const data = rows.filter((r) => r.count > 0).map((r, i) => ({ label: r.name, value: r.count, color: GREYS[i % GREYS.length] }))
  return (
    <div className="mx-auto aspect-square w-full max-w-[190px]">
      <PieChart data={data} innerRadius={58} padAngle={0.025} cornerRadius={4}>
        {data.map((_, i) => <PieSlice key={i} index={i} />)}
        <PieCenter defaultLabel="Assets" valueClassName="text-2xl font-medium tracking-[-0.04em]" labelClassName="text-[11px] text-ash" />
      </PieChart>
    </div>
  )
}

const RANGES = [
  { value: '6', label: '6M' },
  { value: '12', label: '1Y' },
  { value: '36', label: '3Y' },
  { value: '60', label: '5Y' },
] as const
type Range = (typeof RANGES)[number]['value']

function BookValue({ t }: { t?: Dashboard['totals'] }) {
  const [range, setRange] = useState<Range>('12')
  const { data: pts } = useData<{ date: string; value: number }[]>('/dashboard/value-trend/', { months: range })
  const series = (pts ?? []).map((p) => ({ date: new Date(p.date), value: Math.round(p.value) }))
  return (
    <Panel
      title="Book value"
      className="h-full"
      action={
        <div className="flex items-center gap-2">
          {t && <span className="hidden text-xs text-ash sm:inline">of ₦{compact(t.purchase_value)}</span>}
          <PillSelect value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.value, label: r.label }))} />
        </div>
      }
      bodyClassName="flex flex-col px-1 pb-1 pt-4"
    >
      <p className="px-4 text-[1.75rem] font-medium leading-none tracking-[-0.04em]">₦{t ? <Counter value={t.current_value} format={(n) => compact(n)} /> : '—'}</p>
      {series.length > 1 ? (
        <AreaChart key={range} data={series} xDataKey="date" aspectRatio="auto" className="mt-1 min-h-52 flex-1" margin={{ top: 14, right: 16, bottom: 26, left: 16 }}>
          <Grid horizontal numTicksRows={3} />
          <Area dataKey="value" fill="var(--chart-1)" stroke="var(--chart-1)" fillOpacity={0.12} strokeWidth={2} />
          <XAxis numTicks={6} />
          <ChartTooltip />
        </AreaChart>
      ) : <div className="min-h-52 flex-1" />}
    </Panel>
  )
}

export default function Overview() {
  const { user } = useAuth()
  const { data: d } = useData<Dashboard>('/dashboard/')
  const { data: assets } = useData<Asset[]>('/assets/', { status: 'assigned' })
  const t = d?.totals
  const active = t ? t.assets - t.retired : 0
  const hour = new Date().getHours()

  return (
    <Page>
      <PageHeader
        docTitle="Overview"
        eyebrow={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={`Good ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, ${user?.name.split(' ')[0] ?? ''}`}
      />

      <div className="space-y-2">
        {/* Metrics: full width, one group */}
        <div className="grid grid-cols-2 gap-2 rounded-[1.4rem] bg-[#e2e2e2] p-2 lg:grid-cols-4">
          {!t ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />) : <>
            <Link to="/assets"><Metric label="Assets" value={t.assets} icon={<Cube size={15} />} hint={`₦${compact(t.purchase_value)} purchase value`} /></Link>
            <Link to="/assets?status=assigned"><Metric label="In use" value={t.assigned} icon={<HandArrowUp size={15} />} hint={`${Math.round((t.assigned / Math.max(1, active)) * 100)}% of active`} delay={0.05} /></Link>
            <Link to="/assets?status=available"><Metric label="Available" value={t.available} icon={<CheckCircle size={15} />} hint="Ready to assign" delay={0.1} /></Link>
            <Link to="/maintenance"><Metric label="Overdue jobs" value={t.overdue_maintenance} icon={<Warning size={15} />} hint={`${t.maintenance} in progress`} delay={0.15} /></Link>
          </>}
        </div>

        {/* Charts: book value (wider, two rows tall) | utilisation | department; status split spans the last two columns */}
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Reveal className="min-w-0 lg:row-span-2">
            <BookValue t={t} />
          </Reveal>

          <Reveal delay={0.04} className="min-w-0">
            <Panel title="Utilisation" className="h-full" bodyClassName="grid place-items-center p-3">
              {t ? (
                <RingChart
                  size={176}
                  strokeWidth={10}
                  ringGap={4}
                  baseInnerRadius={44}
                  data={[
                    { label: 'In use', value: t.assigned, maxValue: active, color: '#201515' },
                    { label: 'Available', value: t.available, maxValue: active, color: '#847e7e' },
                    { label: 'Maintenance', value: t.maintenance, maxValue: active, color: '#c7c4c4' },
                  ]}
                >
                  <Ring index={0} />
                  <Ring index={1} />
                  <Ring index={2} />
                  <RingCenter defaultLabel="Active" />
                </RingChart>
              ) : <Skeleton className="size-44 rounded-full bg-white" />}
            </Panel>
          </Reveal>

          <Reveal delay={0.06} className="min-w-0">
            <Panel title="By department" className="h-full" bodyClassName="grid place-items-center p-3">
              {d ? <DepartmentPie rows={d.by_department} /> : <Skeleton className="size-44 rounded-full bg-white" />}
            </Panel>
          </Reveal>

          <Reveal delay={0.08} className="min-w-0 lg:col-span-2">
            <Panel title="Status split" action={t && <span className="text-xs text-ash tabular">{t.assets} assets</span>} bodyClassName="p-3">
              {d ? <StatusBar rows={d.by_status} /> : <Skeleton className="h-16 bg-white" />}
            </Panel>
          </Reveal>
        </div>

        {/* Activity + assets in use, side by side */}
        <div className="grid gap-2 lg:grid-cols-2">
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
