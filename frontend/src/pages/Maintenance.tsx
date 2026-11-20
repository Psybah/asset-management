import { CalendarBlank, CheckCircle, CircleDashed, DotsSixVertical, Plus, Spinner, Warning } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type DragEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Sheet } from '@/components/Sheet'
import { useToast } from '@/components/Toast'
import { Button, Field, FieldGroup, IconButton, Page, PageHeader, Photo, SelectField, Skeleton, cx, ease } from '@/components/ui'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { compact, shortDate, today } from '@/lib/format'
import type { Asset, Maintenance as M } from '@/lib/types'
import { invalidate, useData } from '@/lib/useData'

type Status = M['status']
const columns: { key: Status; label: string; icon: ReactNode }[] = [
  { key: 'scheduled', label: 'Scheduled', icon: <CircleDashed size={15} /> },
  { key: 'in_progress', label: 'In progress', icon: <Spinner size={15} /> },
  { key: 'done', label: 'Done', icon: <CheckCircle size={15} /> },
]

function Card({ m, photo, canDrag, onDragStart }: { m: M; photo?: Asset; canDrag: boolean; onDragStart: (e: DragEvent, m: M) => void }) {
  return (
    <motion.article
      layout
      layoutId={`job-${m.id}`}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      draggable={canDrag}
      // motion's onDragStart is for its own drag gestures; use the native event for HTML5 DnD.
      {...({ onDragStartCapture: (e: DragEvent) => onDragStart(e, m) } as object)}
      className={cx('group rounded-[1.15rem] bg-white p-1', canDrag && 'cursor-grab active:cursor-grabbing')}
    >
      <div className="flex items-start gap-2 px-2.5 pb-2 pt-2">
        <div className="min-w-0 flex-1">
          <p className={cx('text-sm leading-snug', m.status === 'done' && 'text-smoke')}>{m.title}</p>
        </div>
        {m.overdue && <span className="mt-0.5 flex shrink-0 items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium text-white"><Warning size={10} weight="fill" />Overdue</span>}
        {canDrag && !m.overdue && <DotsSixVertical size={16} className="mt-0.5 shrink-0 text-ash opacity-0 transition-opacity group-hover:opacity-100" />}
      </div>
      <Link to={`/assets/${m.asset}`} draggable={false} className="flex items-center gap-2 rounded-[0.9rem] bg-mist p-1 pr-3 transition-colors hover:bg-fog">
        <Photo src={photo?.image_url} icon={photo?.category_icon} alt="" className="size-8 shrink-0 rounded-[0.65rem]" iconSize={14} />
        <span className="min-w-0 flex-1 truncate text-xs">{m.asset_name}</span>
        <span className="shrink-0 text-[10px] text-ash tabular">{m.asset_tag}</span>
      </Link>
      <div className={cx('flex items-center gap-1.5 px-2 pb-1.5 pt-2 text-[11px]', m.overdue ? 'font-medium text-ink' : 'text-ash')}>
        <span className="flex items-center gap-1">{m.overdue ? <Warning size={12} weight="fill" /> : <CalendarBlank size={12} />}{shortDate(m.completed_date ?? m.scheduled_date)}</span>
        <span>·</span>
        <span className="capitalize">{m.kind}</span>
        {m.cost ? <span className="ml-auto tabular">₦{compact(m.cost)}</span> : null}
      </div>
    </motion.article>
  )
}

export default function Maintenance() {
  const { data, reload } = useData<M[]>('/maintenance/')
  const { data: assets } = useData<Asset[]>('/assets/')
  const { canWrite } = useAuth()
  const toast = useToast()
  const [jobs, setJobs] = useState<M[] | undefined>()
  const [over, setOver] = useState<Status | null>(null)
  const [dragging, setDragging] = useState<M | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  useEffect(() => { setJobs(data) }, [data])
  const byId = new Map((assets ?? []).map((a) => [a.id, a]))
  const overdue = jobs?.filter((m) => m.overdue).length ?? 0

  const move = async (m: M, status: Status) => {
    if (m.status === status) return
    setJobs((js) => js?.map((j) => (j.id === m.id ? { ...j, status, overdue: status === 'done' ? false : j.overdue } : j)))
    try { await api.patch(`/maintenance/${m.id}/`, { status }); invalidate(); reload(); toast(status === 'done' ? 'Marked done' : status === 'in_progress' ? 'Started' : 'Moved back') } catch (e) { setJobs(data); toast((e as Error).message) }
  }

  const create = async () => {
    setBusy(true)
    try {
      await api.post('/maintenance/', { asset: Number(form.asset), title: form.title, kind: form.kind ?? 'preventive', scheduled_date: form.date || today(), vendor: form.vendor ?? '', cost: form.cost ? Number(form.cost) : null, status: 'scheduled', notes: '' })
      invalidate(); reload(); setAdding(false); setForm({}); toast('Scheduled')
    } catch (e) { toast((e as Error).message) } finally { setBusy(false) }
  }
  const set = (k: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <Page>
      <PageHeader
        eyebrow={overdue ? `${overdue} overdue` : 'All on schedule'}
        title="Maintenance"
        actions={canWrite && <Button onClick={() => setAdding(true)}><Plus size={15} /> New job</Button>}
      />

      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        {columns.map((col, ci) => {
          const items = (jobs ?? [])
            .filter((m) => m.status === col.key)
            .sort((a, b) => (col.key === 'done' ? b.scheduled_date.localeCompare(a.scheduled_date) : Number(b.overdue) - Number(a.overdue) || a.scheduled_date.localeCompare(b.scheduled_date)))
          const isOver = over === col.key && dragging?.status !== col.key
          return (
            <motion.section
              key={col.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease, delay: ci * 0.06 }}
              onDragOver={(e) => { if (canWrite) { e.preventDefault(); setOver(col.key) } }}
              onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
              onDrop={(e) => { e.preventDefault(); setOver(null); if (dragging) move(dragging, col.key); setDragging(null) }}
              className={cx('flex min-h-[60vh] w-[82vw] shrink-0 snap-center flex-col rounded-[1.6rem] p-1.5 transition-colors duration-200 md:w-auto', isOver ? 'bg-fog' : 'bg-white/60')}
            >
              <header className="flex items-center gap-2 px-2.5 pb-2.5 pt-2">
                <span className="text-smoke">{col.icon}</span>
                <h2 className="text-[13px] font-medium">{col.label}</h2>
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1.5 text-[11px] font-medium tabular">{items.length}</span>
                {canWrite && col.key === 'scheduled' && <IconButton label="New job" size="icon-sm" className="ml-auto" onClick={() => setAdding(true)}><Plus size={13} /></IconButton>}
              </header>
              <div className="flex flex-1 flex-col gap-1.5">
                {!jobs && [0, 1, 2].map((i) => <Skeleton key={i} className="h-28 bg-white" />)}
                <AnimatePresence mode="popLayout">
                  {items.slice(0, col.key === 'done' ? 12 : 60).map((m) => (
                    <Card key={m.id} m={m} photo={byId.get(m.asset)} canDrag={canWrite} onDragStart={(e, job) => { e.dataTransfer.effectAllowed = 'move'; setDragging(job) }} />
                  ))}
                </AnimatePresence>
                {jobs && items.length === 0 && (
                  <div className={cx('grid flex-1 place-items-center rounded-[1.15rem] text-xs text-ash outline-2 -outline-offset-2 outline-dashed', isOver ? 'outline-ash' : 'outline-transparent')}>
                    {canWrite ? 'Drop a job here' : 'Nothing here'}
                  </div>
                )}
              </div>
            </motion.section>
          )
        })}
      </div>
      {canWrite && <p className="mt-3 px-1 text-[11px] text-ash">Drag cards between columns to update their status.</p>}

      <Sheet open={adding} onClose={() => setAdding(false)} title="New maintenance job">
        <FieldGroup>
          <SelectField label="Asset" value={form.asset ?? ''} onChange={set('asset')}>
            <option value="">Choose an asset…</option>
            {(assets ?? []).filter((a) => a.status !== 'retired').map((a) => <option key={a.id} value={a.id}>{a.tag} · {a.name}</option>)}
          </SelectField>
          <Field label="What needs doing" value={form.title ?? ''} onChange={set('title')} />
          <div className="grid grid-cols-2 gap-0.5">
            <SelectField label="Type" value={form.kind ?? 'preventive'} onChange={set('kind')}>
              <option value="preventive">Preventive</option>
              <option value="corrective">Corrective</option>
            </SelectField>
            <Field label="Date" type="date" value={form.date ?? today()} onChange={set('date')} />
          </div>
          <div className="grid grid-cols-2 gap-0.5">
            <Field label="Vendor" value={form.vendor ?? ''} onChange={set('vendor')} />
            <Field label="Cost (₦)" inputMode="numeric" value={form.cost ?? ''} onChange={set('cost')} />
          </div>
        </FieldGroup>
        <Button size="lg" className="mt-5 w-full" disabled={busy || !form.asset || !form.title} onClick={create}>{busy ? 'Saving…' : 'Schedule'}</Button>
      </Sheet>
    </Page>
  )
}
