import { ArrowLeft, HandArrowDown, HandArrowUp, PencilSimple, Printer, QrCode, Trash, Wrench } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AssetForm } from '../components/AssetForm'
import { Area } from '../components/Charts'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { Button, Counter, Field, IconButton, Input, Page, Reveal, Select, Skeleton, StatusMark, cx, ease } from '../components/ui'
import { api, qrUrl } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ago, compact, date, label, naira, today } from '../lib/format'
import { AssetIcon } from '../lib/icons'
import type { Asset, DepRow, TimelineItem, User } from '../lib/types'
import { invalidate, useData } from '../lib/useData'

type Action = 'edit' | 'checkout' | 'checkin' | 'care' | 'dispose' | null

function Stat({ k, v, delay = 0 }: { k: string; v: ReactNode; delay?: number }) {
  return (
    <Reveal delay={delay} y={16}>
      <p className="text-xs text-ash">{k}</p>
      <p className="mt-1 truncate text-lg tracking-[-0.02em]">{v ?? '—'}</p>
    </Reveal>
  )
}

const dot: Record<TimelineItem['type'], string> = {
  created: 'bg-ink', checkout: 'bg-ink', checkin: 'bg-paper ring-2 ring-ink ring-inset', maintenance: 'grain bg-fog',
  disposal: 'bg-ash', update: 'bg-fog',
}

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

  const open = (x: Action, init: Record<string, string> = {}) => { setForm(init); setAct(x) }
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const run = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true)
    try { await fn(); invalidate(); reload(); setAct(null); toast(msg) } catch (e) { toast((e as Error).message) } finally { setBusy(false) }
  }

  if (!a) {
    return (
      <Page>
        <div className="grid gap-10 md:grid-cols-2">
          <Skeleton className="aspect-square !rounded-full" />
          <div className="space-y-4 pt-10"><Skeleton className="h-6 w-24" /><Skeleton className="h-24 w-3/4" /><Skeleton className="h-40" /></div>
        </div>
      </Page>
    )
  }

  const pct = a.purchase_cost ? a.current_value / a.purchase_cost : 0
  const printLabel = () => {
    const w = window.open('', '_blank', 'width=420,height=520')
    if (!w) return
    w.document.write(`<html><head><title>${a.tag}</title><style>body{font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0}div{text-align:center}img{width:220px;height:220px}p{margin:4px 0;letter-spacing:-.01em}</style></head><body><div><img src="${qrUrl(a.id)}" onload="setTimeout(()=>print(),200)"/><p style="font-size:22px">${a.tag}</p><p style="color:#888;font-size:13px">${a.name}</p></div></body></html>`)
    w.document.close()
  }

  return (
    <Page>
      <motion.button
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => (history.length > 2 ? nav(-1) : nav('/assets'))}
        className="mb-8 flex h-11 items-center gap-2 rounded-full bg-mist pl-3 pr-5 text-sm transition-colors hover:bg-fog"
      >
        <ArrowLeft size={16} /> Back
      </motion.button>

      <section className="grid items-start gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-16">
        {/* Flip disc: icon ↔ QR */}
        <div className="md:sticky md:top-10" style={{ perspective: 1400 }}>
          <motion.button
            onClick={() => setFlip((f) => !f)}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, rotateY: flip ? 180 : 0 }}
            transition={{ duration: 1, ease }}
            style={{ transformStyle: 'preserve-3d' }}
            aria-label="Flip to QR"
            className="relative mx-auto block aspect-square w-full max-w-[560px]"
          >
            <span className={cx('absolute inset-0 grid place-items-center rounded-full [backface-visibility:hidden]', a.status === 'assigned' ? 'bg-ink text-paper' : 'bg-mist')}>
              <AssetIcon name={a.category_icon} size={180} weight="thin" />
              <span className="absolute bottom-[12%] flex items-center gap-1.5 text-xs opacity-40"><QrCode size={14} /> tap</span>
            </span>
            <span className="absolute inset-0 grid place-items-center rounded-full bg-mist [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <img src={qrUrl(a.id)} alt={`QR ${a.tag}`} className="w-[48%] mix-blend-multiply" />
              <span className="absolute bottom-[14%] text-sm tabular">{a.tag}</span>
            </span>
          </motion.button>
        </div>

        <div className="min-w-0">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mb-5 flex items-center gap-3">
            <StatusMark status={a.status} onPaper />
            <span className="text-sm text-ash tabular">{a.tag}</span>
          </motion.div>
          <h1 className="overflow-hidden text-[clamp(2.75rem,6vw,6rem)] leading-[0.92] tracking-[-0.055em]">
            <motion.span className="block" initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ duration: 1, ease, delay: 0.1 }}>{a.name}</motion.span>
          </h1>

          {/* Value */}
          <Reveal delay={0.2} className="mt-10 flex items-end gap-6">
            <p className="text-6xl tracking-[-0.05em] md:text-7xl">₦<Counter value={a.current_value} format={(n) => compact(n)} /></p>
            <div className="mb-3 flex-1">
              <div className="h-1.5 overflow-hidden rounded-full bg-mist">
                <motion.div className="h-full rounded-full bg-ink" initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }} transition={{ duration: 1.5, ease, delay: 0.4 }} />
              </div>
              <p className="mt-2 text-xs text-ash">{Math.round(pct * 100)}% of {naira(a.purchase_cost)}</p>
            </div>
          </Reveal>

          {/* Actions */}
          {canWrite && a.status !== 'retired' && (
            <Reveal delay={0.3} className="mt-10 flex flex-wrap gap-2">
              {a.status === 'available' && <Button onClick={() => open('checkout')}><HandArrowUp size={18} /> Assign</Button>}
              {a.status === 'assigned' && <Button onClick={() => open('checkin', { condition: a.condition })}><HandArrowDown size={18} /> Return</Button>}
              <Button tone="mist" onClick={() => open('care', { kind: 'preventive', scheduled_date: today() })}><Wrench size={18} /> Care</Button>
              <IconButton label="Edit" onClick={() => open('edit')}><PencilSimple size={18} /></IconButton>
              <IconButton label="Print label" onClick={printLabel}><Printer size={18} /></IconButton>
              <IconButton label="Dispose" onClick={() => open('dispose', { method: 'scrapped' })}><Trash size={18} /></IconButton>
            </Reveal>
          )}

          {/* Facts */}
          <div className="mt-14 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3">
            <Stat k="Holder" v={a.assigned_to_name} />
            <Stat k="Since" v={a.assigned_since ? date(a.assigned_since) : null} delay={0.03} />
            <Stat k="Department" v={a.department_name} delay={0.06} />
            <Stat k="Location" v={a.location_name} delay={0.09} />
            <Stat k="Kind" v={a.category_name} delay={0.12} />
            <Stat k="Condition" v={<span className="capitalize">{a.condition}</span>} delay={0.15} />
            <Stat k="Serial" v={a.serial_number || null} delay={0.18} />
            <Stat k="Vendor" v={a.vendor || null} delay={0.21} />
            <Stat k="Bought" v={date(a.purchase_date)} delay={0.24} />
          </div>

          {/* Depreciation */}
          {dep && dep.length > 1 && (
            <Reveal className="mt-16 rounded-[2.5rem] bg-mist p-7 pb-0">
              <div className="flex items-baseline justify-between">
                <p className="text-xs text-smoke">{a.depreciation_method === 'straight_line' ? 'Straight line' : 'Declining balance'} · {a.useful_life_years} yrs</p>
                <p className="text-xs text-ash">−{naira(a.accumulated_depreciation)}</p>
              </div>
              <div className="-mx-7 mt-8">
                <Area height={150} data={[{ x: dep[0].year - 1, y: dep[0].opening }, ...dep.map((r) => ({ x: r.year, y: r.closing }))]} format={(n) => `₦${compact(n)}`} />
              </div>
            </Reveal>
          )}

          {/* Timeline */}
          {tl && tl.length > 0 && (
            <div className="mt-16">
              <ol className="relative ml-2">
                <span className="absolute bottom-3 left-[5px] top-3 w-px bg-fog" />
                {tl.map((t, i) => (
                  <Reveal key={t.id} delay={Math.min(i, 8) * 0.04} y={14}>
                    <li className="relative flex gap-6 pb-8">
                      <span className={cx('relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full', dot[t.type])} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px]">{t.title}</p>
                        {t.detail && <p className="mt-0.5 text-sm text-smoke">{t.detail}</p>}
                      </div>
                      <span className="shrink-0 text-xs text-ash tabular" title={new Date(t.timestamp).toLocaleString()}>{ago(t.timestamp)}</span>
                    </li>
                  </Reveal>
                ))}
              </ol>
            </div>
          )}
        </div>
      </section>

      {/* Sheets */}
      <AssetForm open={act === 'edit'} onClose={() => setAct(null)} asset={a} onSaved={() => reload()} />

      <Sheet open={act === 'checkout'} onClose={() => setAct(null)} title="Assign">
        <div className="space-y-4">
          <Field label="To">
            <Select value={form.user ?? ''} onChange={set('user')}>
              <option value="">—</option>
              {people?.map((p) => <option key={p.id} value={p.id}>{p.name}{p.department_name ? ` · ${p.department_name}` : ''}</option>)}
            </Select>
          </Field>
          <Field label="Due back (optional)"><Input type="date" value={form.due_date ?? ''} onChange={set('due_date')} /></Field>
          <Field label="Note"><Input value={form.note ?? ''} onChange={set('note')} /></Field>
        </div>
        <Button size="lg" className="mt-8 w-full" disabled={busy || !form.user}
          onClick={() => run(() => api.post(`/assets/${a.id}/checkout/`, { user: Number(form.user), due_date: form.due_date || null, note: form.note ?? '' }), 'Assigned')}>
          Assign
        </Button>
      </Sheet>

      <Sheet open={act === 'checkin'} onClose={() => setAct(null)} title="Return">
        <div className="space-y-4">
          <Field label="Condition">
            <Select value={form.condition ?? 'good'} onChange={set('condition')}>
              {['new', 'good', 'fair', 'poor'].map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Note"><Input value={form.note ?? ''} onChange={set('note')} /></Field>
        </div>
        <Button size="lg" className="mt-8 w-full" disabled={busy}
          onClick={() => run(() => api.post(`/assets/${a.id}/checkin/`, { condition: form.condition, note: form.note ?? '' }), 'Returned')}>
          Return
        </Button>
      </Sheet>

      <Sheet open={act === 'care'} onClose={() => setAct(null)} title="Care">
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          <Field label="What" className="col-span-2"><Input value={form.title ?? ''} onChange={set('title')} placeholder="Quarterly service" /></Field>
          <Field label="Type">
            <Select value={form.kind} onChange={set('kind')}>
              <option value="preventive">Preventive</option>
              <option value="corrective">Corrective</option>
            </Select>
          </Field>
          <Field label="When"><Input type="date" value={form.scheduled_date ?? ''} onChange={set('scheduled_date')} /></Field>
          <Field label="Vendor"><Input value={form.vendor ?? ''} onChange={set('vendor')} /></Field>
          <Field label="Cost ₦"><Input inputMode="numeric" value={form.cost ?? ''} onChange={set('cost')} /></Field>
        </div>
        <Button size="lg" className="mt-8 w-full" disabled={busy || !form.title}
          onClick={() => run(() => api.post('/maintenance/', { asset: a.id, title: form.title, kind: form.kind, scheduled_date: form.scheduled_date, vendor: form.vendor ?? '', cost: form.cost ? Number(form.cost) : null, status: 'scheduled', notes: '' }), 'Scheduled')}>
          Schedule
        </Button>
      </Sheet>

      <Sheet open={act === 'dispose'} onClose={() => setAct(null)} title="Dispose">
        <div className="space-y-4">
          <Field label="How">
            <Select value={form.method} onChange={set('method')}>
              {['sold', 'donated', 'scrapped', 'lost'].map((m) => <option key={m} value={m}>{label(m)}</option>)}
            </Select>
          </Field>
          <Field label="Why"><Input value={form.reason ?? ''} onChange={set('reason')} /></Field>
          <Field label="Recovered ₦"><Input inputMode="numeric" value={form.value ?? ''} onChange={set('value')} /></Field>
        </div>
        <Button size="lg" className="mt-8 w-full" disabled={busy || !form.reason}
          onClick={() => run(() => api.post(`/assets/${a.id}/dispose/`, { method: form.method, reason: form.reason, value: form.value ? Number(form.value) : null }), 'Retired')}>
          Retire asset
        </Button>
      </Sheet>

    </Page>
  )
}
