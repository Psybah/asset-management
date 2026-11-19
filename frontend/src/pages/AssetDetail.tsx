import { ArrowLeft, HandArrowDown, HandArrowUp, PencilSimple, Printer, QrCode, Trash, Wrench } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AssetForm } from '@/components/AssetForm'
import { Avatar } from '@/components/Avatar'
import { Area } from '@/components/charts/area'
import { AreaChart } from '@/components/charts/area-chart'
import { Grid } from '@/components/charts/grid'
import { ChartTooltip } from '@/components/charts/tooltip'
import { XAxis } from '@/components/charts/x-axis'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import { Button, Counter, Field, FieldGroup, IconButton, Page, Panel, Photo, Reveal, SelectField, Skeleton, StatusMark, cx, ease } from '@/components/ui'
import QRCode from 'qrcode'
import { api, scanUrl } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { ago, compact, date, label, naira, today } from '@/lib/format'
import type { Asset, DepRow, TimelineItem, User } from '@/lib/types'
import { invalidate, useData } from '@/lib/useData'

type Action = 'edit' | 'checkout' | 'checkin' | 'care' | 'dispose' | null

export default function AssetDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { canWrite } = useAuth()
  const { data: a, reload } = useData<Asset>(`/assets/${id}/`)
  const { data: dep } = useData<DepRow[]>(`/assets/${id}/depreciation/`)
  const { data: tl } = useData<TimelineItem[]>(`/assets/${id}/timeline/`)
  const { data: people } = useData<User[]>('/people/')
  const [flip, setFlip] = useState(false)
  const [act, setAct] = useState<Action>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [qr, setQr] = useState('')
  useEffect(() => {
    if (a) QRCode.toDataURL(scanUrl(a.tag), { margin: 1, width: 480, color: { dark: '#0a0a0a', light: '#00000000' } }).then(setQr)
  }, [a])

  const open = (x: Action, init: Record<string, string> = {}) => { setForm(init); setAct(x) }
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true)
    try { await fn(); invalidate(); reload(); setAct(null); toast(msg) } catch (e) { toast((e as Error).message) } finally { setBusy(false) }
  }

  if (!a) {
    return (
      <Page>
        <div className="grid gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          <Skeleton className="aspect-square" />
          <div className="space-y-3"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40" /><Skeleton className="h-60" /></div>
        </div>
      </Page>
    )
  }

  const pct = a.purchase_cost ? a.current_value / a.purchase_cost : 0
  const series = dep && dep.length ? [{ date: new Date(dep[0].year, 0, 1), value: dep[0].opening }, ...dep.map((r) => ({ date: new Date(r.year + 1, 0, 1), value: r.closing }))] : []
  const printLabel = () => {
    const w = window.open('', '_blank', 'width=420,height=520')
    if (!w) return
    w.document.write(`<html><head><title>${a.tag}</title><style>body{font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0}div{text-align:center}img{width:220px;height:220px}p{margin:4px 0}</style></head><body><div><img src="${qr}" onload="setTimeout(()=>print(),200)"/><p style="font-size:22px">${a.tag}</p><p style="color:#888;font-size:13px">${a.name}</p></div></body></html>`)
    w.document.close()
  }

  return (
    <Page>
      <button onClick={() => (history.length > 2 ? nav(-1) : nav('/assets'))} className="mb-5 flex h-9 items-center gap-1.5 rounded-full bg-white pl-3 pr-4 text-xs font-medium transition-colors hover:bg-white/70">
        <ArrowLeft size={14} /> Assets
      </button>

      <section className="grid items-start gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* Photo ↔ QR flip card */}
        <div className="md:sticky md:top-4" style={{ perspective: 1400 }}>
          <motion.div
            animate={{ rotateY: flip ? 180 : 0 }}
            transition={{ duration: 0.9, ease }}
            style={{ transformStyle: 'preserve-3d' }}
            className="relative aspect-[4/5] w-full"
          >
            <div className="absolute inset-0 flex flex-col rounded-[1.75rem] bg-white p-1.5 [backface-visibility:hidden]">
              <div className="flex items-center justify-between px-3 pb-2 pt-1.5">
                <span className="text-xs text-ash tabular">{a.tag}</span>
                <button onClick={() => setFlip(true)} aria-label="Show QR code" className="flex h-7 items-center gap-1.5 rounded-full bg-mist px-3 text-[11px] font-medium hover:bg-fog"><QrCode size={13} /> QR</button>
              </div>
              <Photo src={a.image_url} icon={a.category_icon} alt={a.name} color className="flex-1 rounded-[1.35rem]" iconSize={120} />
            </div>
            <div className="absolute inset-0 flex flex-col rounded-[1.75rem] bg-white p-1.5 [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <div className="flex items-center justify-between px-3 pb-2 pt-1.5">
                <span className="text-xs text-ash">Scan to open</span>
                <button onClick={() => setFlip(false)} className="flex h-7 items-center rounded-full bg-mist px-3 text-[11px] font-medium hover:bg-fog">Photo</button>
              </div>
              <div className="grid flex-1 place-items-center rounded-[1.35rem] bg-mist">
                <div className="flex flex-col items-center gap-3">
                  {qr && <img src={qr} alt={`QR ${a.tag}`} className="w-48" />}
                  <span className="max-w-56 truncate text-[10px] text-ash">{scanUrl(a.tag)}</span>
                  <span className="text-sm font-medium tabular">{a.tag}</span>
                  <Button tone="paper" size="sm" beam={false} onClick={printLabel}><Printer size={14} /> Print label</Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="rounded-[1.75rem] bg-white p-5 md:p-6">
            <div className="mb-3 flex items-center gap-2">
              <StatusMark status={a.status} onPaper />
              <span className="text-xs text-ash">{a.category_name}</span>
            </div>
            <h1 className="overflow-hidden text-2xl font-medium leading-tight tracking-[-0.03em] md:text-[1.75rem]">
              <motion.span className="block" initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ duration: 0.8, ease }}>{a.name}</motion.span>
            </h1>
            <div className="mt-6 flex items-end gap-5">
              <p className="text-[2rem] font-medium leading-none tracking-[-0.04em]">₦<Counter value={a.current_value} format={(n) => compact(n)} /></p>
              <div className="mb-1 flex-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-mist">
                  <motion.div className="h-full rounded-full bg-ink" initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }} transition={{ duration: 1.2, ease, delay: 0.3 }} />
                </div>
                <p className="mt-1.5 text-[11px] text-ash">{Math.round(pct * 100)}% of {naira(a.purchase_cost)}</p>
              </div>
            </div>
            {canWrite && a.status !== 'retired' && (
              <div className="mt-6 flex flex-wrap gap-1.5">
                {a.status === 'available' && <Button onClick={() => open('checkout')}><HandArrowUp size={16} /> Assign</Button>}
                {a.status === 'assigned' && <Button onClick={() => open('checkin', { condition: a.condition })}><HandArrowDown size={16} /> Return</Button>}
                <Button tone="paper" beam={false} faceClassName="from-mist to-mist" onClick={() => open('care', { kind: 'preventive', scheduled_date: today() })}><Wrench size={16} /> Maintenance</Button>
                <IconButton label="Edit" onClick={() => open('edit')} faceClassName="from-mist to-mist"><PencilSimple size={16} /></IconButton>
                <IconButton label="Dispose" onClick={() => open('dispose', { method: 'scrapped' })} faceClassName="from-mist to-mist"><Trash size={16} /></IconButton>
              </div>
            )}
          </div>

          <Reveal>
            <Panel title="Details" inset={false} bodyClassName="stack">
              {[
                ['Holder', a.assigned_to_name], ['Since', a.assigned_since ? date(a.assigned_since) : null], ['Department', a.department_name],
                ['Location', a.location_name], ['Condition', a.condition], ['Serial', a.serial_number || null], ['Vendor', a.vendor || null], ['Purchased', date(a.purchase_date)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 bg-mist px-4 py-3 text-sm">
                  <span className="text-ash">{k}</span>
                  <span className="flex min-w-0 items-center gap-2 truncate capitalize">{k === 'Holder' && v && <Avatar name={String(v)} className="size-6 bg-white" />}{v ?? '—'}</span>
                </div>
              ))}
            </Panel>
          </Reveal>

          {series.length > 1 && (
            <Reveal>
              <Panel
                title={`Depreciation · ${a.depreciation_method === 'straight_line' ? 'straight line' : 'declining balance'} · ${a.useful_life_years} yrs`}
                action={<span className="text-xs text-ash">−{naira(a.accumulated_depreciation)}</span>}
                bodyClassName="px-1 pt-3"
              >
                <AreaChart data={series} xDataKey="date" aspectRatio="auto" className="h-52" margin={{ top: 16, right: 16, bottom: 28, left: 16 }}>
                  <Grid horizontal numTicksRows={3} />
                  <Area dataKey="value" fill="var(--chart-1)" stroke="var(--chart-1)" fillOpacity={0.12} strokeWidth={2} />
                  <XAxis numTicks={series.length} />
                  <ChartTooltip />
                </AreaChart>
              </Panel>
            </Reveal>
          )}

          {tl && tl.length > 0 && (
            <Reveal>
              <Panel title="History" inset={false} bodyClassName="stack">
                {tl.map((t) => (
                  <div key={t.id} className="flex gap-4 bg-mist px-4 py-3">
                    <span className={cx('mt-1.5 size-2 shrink-0 rounded-full', t.type === 'checkout' || t.type === 'created' ? 'bg-ink' : t.type === 'disposal' ? 'bg-ash' : 'bg-fog ring-1 ring-ash')} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{t.title}</p>
                      {t.detail && <p className="mt-0.5 text-xs text-ash">{t.detail}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-ash tabular" title={new Date(t.timestamp).toLocaleString()}>{ago(t.timestamp)}</span>
                  </div>
                ))}
              </Panel>
            </Reveal>
          )}
        </div>
      </section>

      <AssetForm open={act === 'edit'} onClose={() => setAct(null)} asset={a} onSaved={() => reload()} />

      <Sheet open={act === 'checkout'} onClose={() => setAct(null)} title="Assign">
        <FieldGroup>
          <SelectField label="Assign to" value={form.user ?? ''} onChange={set('user')}>
            <option value="">Choose a person…</option>
            {people?.map((p) => <option key={p.id} value={p.id}>{p.name}{p.department_name ? ` · ${p.department_name}` : ''}</option>)}
          </SelectField>
          <Field label="Due back (optional)" type="date" value={form.due_date ?? ''} onChange={set('due_date')} />
          <Field label="Note" value={form.note ?? ''} onChange={set('note')} />
        </FieldGroup>
        <Button size="lg" className="mt-5 w-full" disabled={busy || !form.user}
          onClick={() => run(() => api.post(`/assets/${a.id}/checkout/`, { user: Number(form.user), due_date: form.due_date || null, note: form.note ?? '' }), 'Assigned')}>
          Assign
        </Button>
      </Sheet>

      <Sheet open={act === 'checkin'} onClose={() => setAct(null)} title="Return">
        <FieldGroup>
          <SelectField label="Condition on return" value={form.condition ?? 'good'} onChange={set('condition')}>
            {['new', 'good', 'fair', 'poor'].map((c) => <option key={c} value={c}>{c}</option>)}
          </SelectField>
          <Field label="Note" value={form.note ?? ''} onChange={set('note')} />
        </FieldGroup>
        <Button size="lg" className="mt-5 w-full" disabled={busy}
          onClick={() => run(() => api.post(`/assets/${a.id}/checkin/`, { condition: form.condition, note: form.note ?? '' }), 'Returned')}>
          Return
        </Button>
      </Sheet>

      <Sheet open={act === 'care'} onClose={() => setAct(null)} title="Schedule maintenance">
        <FieldGroup>
          <Field label="What needs doing" value={form.title ?? ''} onChange={set('title')} />
          <div className="grid grid-cols-2 gap-0.5">
            <SelectField label="Type" value={form.kind} onChange={set('kind')}>
              <option value="preventive">Preventive</option>
              <option value="corrective">Corrective</option>
            </SelectField>
            <Field label="Date" type="date" value={form.scheduled_date ?? ''} onChange={set('scheduled_date')} />
          </div>
          <div className="grid grid-cols-2 gap-0.5">
            <Field label="Vendor" value={form.vendor ?? ''} onChange={set('vendor')} />
            <Field label="Cost (₦)" inputMode="numeric" value={form.cost ?? ''} onChange={set('cost')} />
          </div>
        </FieldGroup>
        <Button size="lg" className="mt-5 w-full" disabled={busy || !form.title}
          onClick={() => run(() => api.post('/maintenance/', { asset: a.id, title: form.title, kind: form.kind, scheduled_date: form.scheduled_date, vendor: form.vendor ?? '', cost: form.cost ? Number(form.cost) : null, status: 'scheduled', notes: '' }), 'Scheduled')}>
          Schedule
        </Button>
      </Sheet>

      <Sheet open={act === 'dispose'} onClose={() => setAct(null)} title="Dispose">
        <FieldGroup>
          <SelectField label="Method" value={form.method} onChange={set('method')}>
            {['sold', 'donated', 'scrapped', 'lost'].map((m) => <option key={m} value={m}>{label(m)}</option>)}
          </SelectField>
          <Field label="Reason" value={form.reason ?? ''} onChange={set('reason')} />
          <Field label="Amount recovered (₦)" inputMode="numeric" value={form.value ?? ''} onChange={set('value')} />
        </FieldGroup>
        <Button size="lg" className="mt-5 w-full" disabled={busy || !form.reason}
          onClick={() => run(() => api.post(`/assets/${a.id}/dispose/`, { method: form.method, reason: form.reason, value: form.value ? Number(form.value) : null }), 'Retired')}>
          Retire asset
        </Button>
      </Sheet>
    </Page>
  )
}
