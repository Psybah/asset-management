import { ChartBar, Copy, DownloadSimple, Gauge, Pulse, Users } from '@phosphor-icons/react'
import { Bar } from '@/components/charts/bar'
import { BarChart } from '@/components/charts/bar-chart'
import { BarXAxis } from '@/components/charts/bar-x-axis'
import { Grid } from '@/components/charts/grid'
import { ChartTooltip } from '@/components/charts/tooltip'
import { useToast } from '@/components/Toast'
import { Button, Empty, Metric, IconButton, Page, PageHeader, Panel, Reveal, Skeleton } from '@/components/ui'
import { API_URL, publicOrigin, token } from '@/lib/api'
import { useData } from '@/lib/useData'

type Share = { value: string; label: string; count: number; percent: number }
type Results = {
  n: number; mean: number | null; median: number | null; sd: number | null; min: number | null; max: number | null; benchmark: number
  grade_counts: { band: string; label: string; count: number; percent: number }[]
  histogram: { start: number; end: number; count: number }[]
  per_item: { item: number; text: string; positive: boolean; mean: number | null; counts: Record<string, number>; percents: Record<string, number> }[]
  tasks: { id: string; text: string; completed: number; percent: number; without_help: number; with_help: number; not_completed: number }[]
  demographics: Record<string, Share[]>
  adjectives: Share[]
  comparisons: Share[]
  comments: { id: number; created_at: string; sus_score: number; liked: string; improvements: string }[]
}

const fmt = (n: number | null, d = 1) => (n === null ? '—' : n.toFixed(d))

function Shares({ rows }: { rows: Share[] }) {
  return (
    <div className="stack">
      {rows.map((r) => (
        <div key={r.value} className="relative flex items-center justify-between overflow-hidden bg-mist px-4 py-2.5 text-sm">
          <span className="absolute inset-y-0 left-0 bg-fog transition-[width] duration-700" style={{ width: `${r.percent}%` }} />
          <span className="relative">{r.label}</span>
          <span className="relative text-xs text-smoke tabular">{r.count} · {r.percent}%</span>
        </div>
      ))}
    </div>
  )
}

export default function Insights() {
  const { data: r } = useData<Results>('/survey/results/')
  const toast = useToast()
  const link = `${publicOrigin}/survey`

  return (
    <Page>
      <PageHeader
        eyebrow="System Usability Scale"
        title="Usability"
        actions={<>
          <IconButton label="Download responses (CSV)" onClick={() => window.open(`${API_URL}/reports/survey.csv?token=${token.get()}`, '_blank')}><DownloadSimple size={16} /></IconButton>
          <Button onClick={() => { navigator.clipboard?.writeText(link); toast('Survey link copied') }}><Copy size={15} /> Copy survey link</Button>
        </>}
      />

      {!r ? (
        <div className="grid gap-2 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : r.n === 0 ? (
        <Panel title="No responses yet" bodyClassName="p-6">
          <p className="max-w-md text-sm leading-relaxed text-smoke">Share <span className="text-ink">{link}</span> with participants. Results appear here as responses arrive and fill Tables 4.5–4.11 of the report.</p>
        </Panel>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 rounded-[1.4rem] bg-[#e2e2e2] p-2 md:grid-cols-4">
            <Metric label="Responses" value={r.n} icon={<Users size={15} />} hint="participants" />
            <Metric label="Mean SUS score" value={r.mean ?? 0} format={(n) => n.toFixed(1)} icon={<Gauge size={15} />} hint={`Benchmark ${r.benchmark}`} delay={0.05} />
            <Metric label="Median" value={r.median ?? 0} format={(n) => n.toFixed(1)} icon={<ChartBar size={15} />} hint={`Range ${fmt(r.min)}–${fmt(r.max)}`} delay={0.1} />
            <Metric label="Std. deviation" value={r.sd ?? 0} format={(n) => n.toFixed(1)} icon={<Pulse size={15} />} hint="sample SD" delay={0.15} />
          </div>

          <div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Reveal>
              <Panel title="Distribution of SUS scores" action={<span className="text-xs text-ash">min {fmt(r.min)} · max {fmt(r.max)}</span>} bodyClassName="px-1 pt-3">
                <BarChart data={r.histogram.map((h) => ({ name: `${h.start}–${h.end}`, count: h.count }))} xDataKey="name" aspectRatio="auto" className="h-56" margin={{ top: 12, right: 12, bottom: 30, left: 12 }} barGap={0.25}>
                  <Grid horizontal numTicksRows={3} />
                  <Bar dataKey="count" fill="var(--chart-1)" lineCap="round" />
                  <BarXAxis showAllLabels />
                  <ChartTooltip />
                </BarChart>
              </Panel>
            </Reveal>
            <Reveal delay={0.05}>
              <Panel title="Grade bands" inset={false} bodyClassName="stack">
                {r.grade_counts.map((g) => (
                  <div key={g.band} className="flex items-center justify-between bg-mist px-4 py-3 text-sm">
                    <span><span className="mr-2 text-xs text-ash tabular">{g.band}</span>{g.label}</span>
                    <span className="text-xs text-smoke tabular">{g.count} · {g.percent}%</span>
                  </div>
                ))}
              </Panel>
            </Reveal>
          </div>

          <Reveal>
            <Panel title="Responses per SUS item (1 = strongly disagree, 5 = strongly agree)" inset={false} bodyClassName="stack">
              {r.per_item.map((i) => (
                <div key={i.item} className="grid items-center gap-3 bg-mist px-4 py-3 md:grid-cols-[1fr_260px_48px]">
                  <p className="text-sm"><span className="mr-2 text-xs text-ash tabular">{i.item}</span>{i.text}</p>
                  <div className="flex h-6 overflow-hidden rounded-full bg-white">
                    {['1', '2', '3', '4', '5'].map((k, j) => (
                      i.percents[k] > 0 && <span key={k} title={`${k}: ${i.counts[k]} (${i.percents[k]}%)`} className="grid place-items-center text-[9px] text-white" style={{ width: `${i.percents[k]}%`, background: ['#d4d4d4', '#a8a8a8', '#7a7a7a', '#3d3d3d', '#201515'][j] }}>{i.percents[k] >= 10 ? k : ''}</span>
                    ))}
                  </div>
                  <span className="text-right text-sm tabular">{fmt(i.mean, 2)}</span>
                </div>
              ))}
            </Panel>
          </Reveal>

          <div className="grid gap-2 lg:grid-cols-2">
            <Reveal>
              <Panel title="Task completion" inset={false} bodyClassName="stack">
                {r.tasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-4 bg-mist px-4 py-3 text-sm">
                    <span className="min-w-0"><span className="mr-2 text-xs text-ash">{t.id}</span>{t.text}</span>
                    <span className="shrink-0 text-xs text-smoke tabular">{t.percent}%</span>
                  </div>
                ))}
              </Panel>
            </Reveal>
            <Reveal delay={0.05}>
              <Panel title="Overall rating" inset={false}><Shares rows={r.adjectives} /></Panel>
            </Reveal>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(r.demographics).map(([k, rows]) => (
              <Reveal key={k}><Panel title={k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())} inset={false}><Shares rows={rows} /></Panel></Reveal>
            ))}
          </div>

          <Reveal>
            <Panel title="Comments" inset={false} bodyClassName="stack">
              {r.comments.filter((c) => c.liked || c.improvements).length === 0 && <Empty>No comments yet</Empty>}
              {r.comments.filter((c) => c.liked || c.improvements).map((c) => (
                <div key={c.id} className="bg-mist px-4 py-3 text-sm">
                  {c.liked && <p><span className="mr-2 text-xs text-ash">Liked</span>{c.liked}</p>}
                  {c.improvements && <p className="mt-1"><span className="mr-2 text-xs text-ash">Improve</span>{c.improvements}</p>}
                  <p className="mt-1 text-[11px] text-ash tabular">SUS {c.sus_score}</p>
                </div>
              ))}
            </Panel>
          </Reveal>
        </div>
      )}
    </Page>
  )
}
