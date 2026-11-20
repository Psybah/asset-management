import { ChartBar, Copy, DownloadSimple, Gauge as GaugeIcon, Pulse, Quotes, Users } from '@phosphor-icons/react'
import { useEffect, useMemo, useState } from 'react'
import { Bar } from '@/components/charts/bar'
import { BarChart } from '@/components/charts/bar-chart'
import { BarXAxis } from '@/components/charts/bar-x-axis'
import { Gauge } from '@/components/charts/gauge'
import { Grid } from '@/components/charts/grid'
import { RadarArea } from '@/components/charts/radar-area'
import { RadarAxis } from '@/components/charts/radar-axis'
import { RadarChart } from '@/components/charts/radar-chart'
import { RadarGrid } from '@/components/charts/radar-grid'
import { RadarLabels } from '@/components/charts/radar-labels'
import { Ring } from '@/components/charts/ring'
import { RingChart } from '@/components/charts/ring-chart'
import { SankeyChart, SankeyLink, SankeyNode, SankeyTooltip } from '@/components/charts/sankey'
import { ChartTooltip } from '@/components/charts/tooltip'
import { useToast } from '@/components/Toast'
import { Button, IconButton, Metric, Page, PageHeader, Panel, Reveal, Skeleton } from '@/components/ui'
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

// Warm ramp from the accent (#201515) toward white.
const RAMP = ['#201515', '#4d4444', '#635b5b', '#847e7e', '#a6a1a1', '#c7c4c4', '#e2e1e1']
const fmt = (n: number | null, d = 1) => (n === null ? '—' : n.toFixed(d))
const T95: Record<number, number> = { 1: 12.71, 2: 4.3, 3: 3.18, 4: 2.78, 5: 2.57, 6: 2.45, 7: 2.36, 8: 2.31, 9: 2.26, 10: 2.23, 11: 2.2, 12: 2.18, 13: 2.16, 14: 2.14, 15: 2.13, 19: 2.09, 24: 2.06, 29: 2.05 }
const tval = (df: number) => T95[df] ?? (df > 29 ? 1.96 : T95[Object.keys(T95).map(Number).reduce((a, b) => (Math.abs(b - df) < Math.abs(a - df) ? b : a))])
const gradeOf = (x: number) => (x > 80.3 ? 'Excellent' : x >= 68 ? 'Good' : x >= 50 ? 'Marginal' : 'Not acceptable')
const SHORT: Record<number, string> = { 1: 'Use often', 2: 'Not complex', 3: 'Easy', 4: 'No tech help', 5: 'Integrated', 6: 'Consistent', 7: 'Quick to learn', 8: 'Not cumbersome', 9: 'Confident', 10: 'Little to learn' }

/** Minimal CSV parser (quoted fields, commas, newlines). */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') q = false; else cell += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [head, ...body] = rows.filter((r) => r.length > 1)
  const h = (head ?? []).map((x) => x.replace(/^﻿/, ''))
  return body.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])))
}

/** Department → current recording method → verdict on Ledger. */
function useSankey(r?: Results) {
  const [rows, setRows] = useState<Record<string, string>[] | null>(null)
  useEffect(() => {
    if (!r?.n) return
    fetch(`${API_URL}/reports/survey.csv?token=${token.get()}`).then((x) => x.text()).then((t) => setRows(parseCsv(t))).catch(() => setRows([]))
  }, [r?.n])
  return useMemo(() => {
    if (!r || !rows?.length) return null
    const lab = (field: string, v: string) => (field === 'comparison' ? r.comparisons : r.demographics[field] ?? []).find((x) => x.value === v)?.label ?? v
    const verdict = (v: string) => (v === 'much_easier' || v === 'easier' ? 'Easier with Ledger' : v === 'same' ? 'About the same' : 'Harder with Ledger')
    const cols: [string, (row: Record<string, string>) => string][] = [
      ['department', (row) => lab('department', row.department)],
      ['current_method', (row) => lab('current_method', row.current_method).split(' (')[0]],
      ['comparison', (row) => verdict(row.comparison)],
    ]
    const nodes: { name: string; category: 'source' | 'landing' | 'outcome' }[] = []
    const idx = new Map<string, number>()
    const node = (col: number, name: string) => {
      const key = `${col}:${name}`
      if (!idx.has(key)) { idx.set(key, nodes.length); nodes.push({ name, category: col === 0 ? 'source' : col === 1 ? 'landing' : 'outcome' }) }
      return idx.get(key)!
    }
    const links = new Map<string, { source: number; target: number; value: number }>()
    for (const row of rows) {
      const names = cols.map(([, f]) => f(row))
      for (let c = 0; c < names.length - 1; c++) {
        const s = node(c, names[c]), t = node(c + 1, names[c + 1]); const k = `${s}-${t}`
        links.set(k, { source: s, target: t, value: (links.get(k)?.value ?? 0) + 1 })
      }
    }
    // Put the people count in each label ("Engineering · 3") instead of the chart's default value label.
    const totals = nodes.map((_, i) => Math.max(
      [...links.values()].filter((l) => l.target === i).reduce((a, l) => a + l.value, 0),
      [...links.values()].filter((l) => l.source === i).reduce((a, l) => a + l.value, 0)))
    return { nodes: nodes.map((nd, i) => ({ ...nd, name: `${nd.name} · ${totals[i]}` })), links: [...links.values()] }
  }, [r, rows])
}

/** Task completion as large concentric rings; the centre shows the hovered task (or the average). */
function TaskRings({ tasks, n }: { tasks: Results['tasks']; n: number }) {
  const [hi, setHi] = useState<number | null>(null)
  const pct = (v: number) => Math.round((v / Math.max(1, n)) * 100)
  const avg = Math.round(tasks.reduce((a, t) => a + pct(t.without_help), 0) / Math.max(1, tasks.length))
  const t = hi !== null ? tasks[hi] : null
  const name = (x: Results['tasks'][number]) => x.text.split(' with the')[0].split(' using')[0]
  return (
    <div className="relative aspect-square w-full max-w-[330px]">
      <RingChart
        strokeWidth={12}
        ringGap={4}
        baseInnerRadius={68}
        hoveredIndex={hi}
        onHoverChange={setHi}
        data={tasks.map((x, i) => ({ label: `${x.id} ${name(x)}`, value: x.without_help, maxValue: n, color: RAMP[Math.min(i, RAMP.length - 2)] }))}
      >
        {tasks.map((_, i) => <Ring key={i} index={i} />)}
      </RingChart>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="w-[6.75rem] text-center">
          <p className="text-[1.75rem] font-medium leading-none tracking-[-0.04em] tabular">{t ? pct(t.without_help) : avg}%</p>
          <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-ash">{t ? `${t.id} · ${name(t)}` : 'average, all tasks'}</p>
        </div>
      </div>
    </div>
  )
}

export default function Insights() {
  const { data: r, reload } = useData<Results>('/survey/results/')
  // Live while open: new survey responses appear without a reload.
  const [updated, setUpdated] = useState(() => Date.now())
  const [, tick] = useState(0)
  useEffect(() => {
    const poll = setInterval(() => { if (document.visibilityState === 'visible') { reload(); setUpdated(Date.now()) } }, 15000)
    const clock = setInterval(() => tick((n) => n + 1), 5000)
    return () => { clearInterval(poll); clearInterval(clock) }
  }, [reload])
  const toast = useToast()
  const link = `${publicOrigin}/survey`
  const sankey = useSankey(r)

  const n = r?.n ?? 0
  const half = r && r.sd !== null && n > 1 ? tval(n - 1) * r.sd / Math.sqrt(n) : 0
  const ci: [number, number] = [(r?.mean ?? 0) - half, (r?.mean ?? 0) + half]
  const contrib = (it: Results['per_item'][number]) => (it.mean === null ? 0 : it.positive ? it.mean - 1 : 5 - it.mean)

  return (
    <Page>
      <PageHeader
        docTitle="Usability"
        eyebrow={<span className="flex items-center gap-1.5"><span className="relative flex size-1.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-ink/40" /><span className="relative inline-flex size-1.5 rounded-full bg-ink" /></span>Live · updated {Math.max(0, Math.round((Date.now() - updated) / 1000))}s ago</span>}
        title="Usability"
        actions={<>
          <IconButton label="Download responses (CSV)" onClick={() => window.open(`${API_URL}/reports/survey.csv?token=${token.get()}`, '_blank')}><DownloadSimple size={16} /></IconButton>
          <Button onClick={() => { navigator.clipboard?.writeText(link); toast('Survey link copied') }}><Copy size={15} /> Copy survey link</Button>
        </>}
      />

      {!r ? (
        <div className="grid grid-cols-12 gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="col-span-6 h-32 lg:col-span-3" />)}</div>
      ) : r.n === 0 ? (
        <Panel title="No responses yet" bodyClassName="p-6">
          <p className="max-w-md text-sm leading-relaxed text-smoke">Share <span className="text-ink">{link}</span> with participants. Results appear here as responses arrive.</p>
        </Panel>
      ) : (
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-12 grid grid-cols-2 gap-2 rounded-[1.4rem] bg-[#e2e1e1] p-2 lg:grid-cols-4">
            <Metric label="Responses" value={r.n} icon={<Users size={15} />} hint={n < 12 ? 'aim for 15–20' : 'participants'} />
            <Metric label="Mean SUS score" value={r.mean ?? 0} format={(x) => x.toFixed(1)} icon={<GaugeIcon size={15} />} hint={`95% CI ${fmt(ci[0], 0)}–${fmt(ci[1], 0)}`} delay={0.05} />
            <Metric label="Median" value={r.median ?? 0} format={(x) => x.toFixed(1)} icon={<ChartBar size={15} />} hint={`Range ${fmt(r.min, 0)}–${fmt(r.max, 0)}`} delay={0.1} />
            <Metric label="Std. deviation" value={r.sd ?? 0} format={(x) => x.toFixed(1)} icon={<Pulse size={15} />} hint="sample SD" delay={0.15} />
          </div>

          {/* Gauge · radar · distribution */}
          <Reveal className="col-span-12 md:col-span-6 lg:col-span-4">
            <Panel title="SUS score" action={<span className="text-xs text-ash">benchmark {r.benchmark}</span>} className="h-full" bodyClassName="flex flex-col items-center justify-center gap-1 p-4">
              <Gauge value={r.mean ?? 0} centerValue={Number(fmt(r.mean))} formatOptions={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }} defaultLabel={gradeOf(r.mean ?? 0)} activeFill="#201515" inactiveFill="#e2e1e1" totalNotches={36} className="w-full max-w-[280px]" />
              <p className="text-[11px] text-ash">95% CI {fmt(ci[0])}–{fmt(ci[1])} · {r.grade_counts.filter((g) => g.band === '68–80.2' || g.band === '>80.3').reduce((a, g) => a + g.count, 0)} of {n} above {r.benchmark}</p>
            </Panel>
          </Reveal>
          <Reveal delay={0.04} className="col-span-12 md:col-span-6 lg:col-span-4">
            <Panel title="Score by statement" action={<span className="text-xs text-ash">0–4 each</span>} className="h-full" bodyClassName="grid place-items-center p-2">
              <div className="aspect-square w-full max-w-[300px]">
                <RadarChart
                  margin={44}
                  levels={4}
                  metrics={r.per_item.map((it) => ({ key: `q${it.item}`, label: SHORT[it.item] ?? `Q${it.item}` }))}
                  data={[{ label: 'Mean contribution', color: '#201515', values: Object.fromEntries(r.per_item.map((it) => [`q${it.item}`, (contrib(it) / 4) * 100])) }]}
                >
                  <RadarGrid showLabels={false} stroke="#c7c4c4" />
                  <RadarAxis stroke="#c7c4c4" />
                  <RadarLabels />
                  <RadarArea index={0} color="#201515" />
                </RadarChart>
              </div>
            </Panel>
          </Reveal>
          <Reveal delay={0.08} className="col-span-12 lg:col-span-4">
            <Panel title="Score distribution" action={<span className="text-xs text-ash">respondents per band</span>} className="h-full" bodyClassName="flex flex-col px-1 pt-3">
              <BarChart data={r.histogram.filter((h) => h.start >= 30).map((h) => ({ name: `${h.start}s`, count: h.count }))} xDataKey="name" aspectRatio="auto" className="min-h-56 flex-1" margin={{ top: 16, right: 12, bottom: 30, left: 12 }} barGap={0.3}>
                <Grid horizontal numTicksRows={3} />
                <Bar dataKey="count" fill="#201515" lineCap="round" />
                <BarXAxis showAllLabels />
                <ChartTooltip />
              </BarChart>
            </Panel>
          </Reveal>

          {/* Sankey · radial task completion */}
          <Reveal className="col-span-12 lg:col-span-8">
            <Panel title="Who said what" action={<span className="text-xs text-ash">department → current method → verdict</span>} className="h-full" bodyClassName="px-1 py-2">
              {sankey ? (
                <SankeyChart data={sankey} aspectRatio="auto" className="h-80" margin={{ top: 16, right: 150, bottom: 16, left: 150 }} nodeWidth={10} nodePadding={14}>
                  <SankeyLink strokeOpacity={0.28} getNodeColor={(_, i) => RAMP[i % 4]} />
                  <SankeyNode getNodeColor={(_, i) => RAMP[i % 4]} lineCap={3} showValueLabels={false} />
                  <SankeyTooltip />
                </SankeyChart>
              ) : <Skeleton className="h-80 bg-white" />}
            </Panel>
          </Reveal>
          <Reveal delay={0.04} className="col-span-12 lg:col-span-4">
            <Panel title="Tasks done without help" action={<span className="text-xs text-ash">hover a ring</span>} className="h-full" bodyClassName="grid place-items-center p-3">
              <TaskRings tasks={r.tasks} n={n} />
            </Panel>
          </Reveal>

          {/* Ratings */}
          <Reveal className="col-span-12 md:col-span-6">
            <Panel title="Overall rating" className="h-full" bodyClassName="px-1 pt-3">
              <BarChart data={r.adjectives.map((a) => ({ name: a.label.replace(' imaginable', ''), count: a.count }))} xDataKey="name" aspectRatio="auto" className="h-56" margin={{ top: 16, right: 12, bottom: 30, left: 12 }} barGap={0.3}>
                <Grid horizontal numTicksRows={3} />
                <Bar dataKey="count" fill="#201515" lineCap="round" />
                <BarXAxis showAllLabels />
                <ChartTooltip />
              </BarChart>
            </Panel>
          </Reveal>
          <Reveal delay={0.04} className="col-span-12 md:col-span-6">
            <Panel title="Compared with today's method" className="h-full" bodyClassName="px-1 pt-3">
              <BarChart data={r.comparisons.map((c) => ({ name: c.label, count: c.count }))} xDataKey="name" aspectRatio="auto" className="h-56" margin={{ top: 16, right: 12, bottom: 30, left: 12 }} barGap={0.3}>
                <Grid horizontal numTicksRows={3} />
                <Bar dataKey="count" fill="#847e7e" lineCap="round" />
                <BarXAxis showAllLabels />
                <ChartTooltip />
              </BarChart>
            </Panel>
          </Reveal>

          {/* Comments */}
          <Reveal className="col-span-12">
            <Panel title="What people said" action={<span className="text-xs text-ash tabular">{r.comments.filter((c) => c.liked || c.improvements).length} comments</span>} inset={false} bodyClassName="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {r.comments.filter((c) => c.liked || c.improvements).map((c) => (
                <figure key={c.id} className="flex flex-col rounded-[1.1rem] bg-mist p-4">
                  <Quotes size={18} weight="fill" className="mb-2 text-ink/25" />
                  {c.liked && <p className="text-sm"><span className="mr-1.5 text-[11px] text-ash">Liked</span>{c.liked}</p>}
                  {c.improvements && <p className="mt-1.5 text-sm"><span className="mr-1.5 text-[11px] text-ash">Improve</span>{c.improvements}</p>}
                  <figcaption className="mt-auto pt-3 text-[11px] text-ash tabular">SUS {fmt(c.sus_score)}</figcaption>
                </figure>
              ))}
            </Panel>
          </Reveal>
        </div>
      )}
    </Page>
  )
}
