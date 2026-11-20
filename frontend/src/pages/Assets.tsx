import { DownloadSimple, List, MagnifyingGlass, Plus, SquaresFour } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AssetForm } from '@/components/AssetForm'
import { Button, Empty, IconButton, Page, PageHeader, Photo, Segmented, Skeleton, StatusMark, cx, ease } from '@/components/ui'
import { csvUrl } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { compact, naira } from '@/lib/format'
import { AssetIcon } from '@/lib/icons'
import type { Asset, Category } from '@/lib/types'
import { useData } from '@/lib/useData'

const statuses = ['all', 'available', 'assigned', 'maintenance', 'retired'] as const
type StatusFilter = (typeof statuses)[number]
const ratios = ['aspect-[4/5]', 'aspect-square', 'aspect-[5/6]', 'aspect-[3/4]', 'aspect-[6/5]']

/** Wrap card: text on top, photo inset with a thin rim left/right/bottom. */
function Card({ a, i }: { a: Asset; i: number }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.7, ease, delay: Math.min(i, 12) * 0.03 }}>
      <Link to={`/assets/${a.id}`} className={cx('group block rounded-[1.5rem] p-2 transition-colors duration-300', a.status === 'assigned' ? 'bg-ink text-white' : 'bg-white', a.status === 'retired' && 'opacity-50')}>
        <div className="min-w-0 px-2.5 pb-2.5 pt-2">
          <p className="truncate text-[13px] font-medium leading-tight">{a.name}</p>
          <p className={cx('mt-0.5 truncate text-[11px]', a.status === 'assigned' ? 'text-white/45' : 'text-ash')}>{a.tag} · {a.assigned_to_name ?? a.location_name ?? '—'}</p>
        </div>
        <div className="relative">
          <Photo src={a.image_url} icon={a.category_icon} alt={a.name} className={cx('rounded-[1.1rem]', ratios[a.id % ratios.length])} />
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-between">
            <StatusMark status={a.status} className={a.status === 'available' || a.status === 'maintenance' ? 'bg-white/90' : ''} />
            <span className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-medium text-ink tabular">₦{compact(a.current_value)}</span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function Row({ a }: { a: Asset }) {
  return (
    <Link to={`/assets/${a.id}`} className="group flex items-center gap-4 bg-white py-2 pl-2 pr-5 transition-colors hover:bg-mist">
      <Photo src={a.image_url} icon={a.category_icon} alt={a.name} className="size-11 shrink-0 rounded-full" iconSize={18} />
      <span className="w-20 shrink-0 text-xs text-ash tabular">{a.tag}</span>
      <span className="min-w-0 flex-1 truncate text-sm">{a.name}</span>
      <span className="hidden w-40 truncate text-sm text-smoke lg:block">{a.assigned_to_name ?? '—'}</span>
      <span className="hidden w-36 truncate text-sm text-smoke md:block">{a.department_name ?? '—'}</span>
      <span className="hidden w-28 text-right text-sm tabular sm:block">{naira(a.current_value)}</span>
      <span className="flex w-24 justify-end"><StatusMark status={a.status} onPaper /></span>
    </Link>
  )
}

export default function Assets() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? 'all') as StatusFilter
  const category = params.get('category') ?? ''
  const [q, setQ] = useState('')
  const [view, setView] = useState<'grid' | 'list'>(() => { try { return (localStorage.getItem('ledger.view') as 'grid' | 'list') || 'grid' } catch { return 'grid' } })
  const [adding, setAdding] = useState(params.get('new') === '1')
  const { canWrite } = useAuth()
  const nav = useNavigate()

  useEffect(() => { if (params.get('new') === '1') setAdding(true) }, [params])

  const { data: all, loading } = useData<Asset[]>('/assets/', { status: status === 'all' ? '' : status, category })
  const { data: cats } = useData<Category[]>('/categories/')

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!all || !s) return all
    return all.filter((a) => [a.name, a.tag, a.serial_number, a.vendor, a.assigned_to_name].some((x) => x?.toLowerCase().includes(s)))
  }, [all, q])

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    if (v && v !== 'all') p.set(k, v); else p.delete(k)
    if (k !== 'new') p.delete('new')
    setParams(p, { replace: true })
  }
  const toggleView = (v: 'grid' | 'list') => { setView(v); try { localStorage.setItem('ledger.view', v) } catch { /* noop */ } }
  const closeForm = () => { setAdding(false); if (params.get('new')) setParam('new', '') }

  return (
    <Page>
      <PageHeader
        eyebrow={list ? `${list.length} items` : '…'}
        title="Assets"
        actions={<>
          <IconButton label="Export CSV" onClick={() => window.open(csvUrl({ status: status === 'all' ? '' : status, category, search: q }), '_blank')}><DownloadSimple size={16} /></IconButton>
          {canWrite && <Button onClick={() => setAdding(true)}><Plus size={16} /> New asset</Button>}
        </>}
      />

      <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex h-11 flex-1 items-center gap-2.5 rounded-full bg-white px-4 md:max-w-xs">
          <MagnifyingGlass size={16} className="text-ash" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, tag, serial" className="h-full flex-1 bg-transparent text-sm placeholder:text-ash" />
        </div>
        <Segmented id="status" value={status} onChange={(v) => setParam('status', v)} options={statuses.map((s) => ({ value: s, label: s }))} />
        <div className="md:ml-auto">
          <Segmented id="view" value={view} onChange={toggleView} options={[{ value: 'grid', label: <SquaresFour size={15} /> }, { value: 'list', label: <List size={15} /> }]} />
        </div>
      </div>

      <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {cats?.map((c) => {
          const on = category === String(c.id)
          return (
            <button key={c.id} onClick={() => setParam('category', on ? '' : String(c.id))} className={cx('flex h-9 shrink-0 items-center gap-2 rounded-full pl-3 pr-3.5 text-xs font-medium transition-colors duration-300', on ? 'bg-ink text-white' : 'bg-white text-smoke hover:text-ink')}>
              <AssetIcon name={c.icon} size={15} weight={on ? 'fill' : 'regular'} />
              {c.name}
              <span className={cx('tabular', on ? 'text-white/50' : 'text-ash')}>{c.asset_count}</span>
            </button>
          )
        })}
      </div>

      {!list && loading ? (
        <div className="masonry">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className={cx('w-full', ratios[i % ratios.length])} />)}</div>
      ) : list && list.length === 0 ? (
        <Empty>Nothing matches</Empty>
      ) : view === 'grid' ? (
        <div className="masonry">
          <AnimatePresence mode="popLayout">{list?.map((a, i) => <Card key={a.id} a={a} i={i} />)}</AnimatePresence>
        </div>
      ) : (
        <div className="rounded-[1.5rem] bg-white p-2"><div className="stack">{list?.map((a) => <Row key={a.id} a={a} />)}</div></div>
      )}

      <AssetForm open={adding} onClose={closeForm} onSaved={(a) => nav(`/assets/${a.id}`)} />
    </Page>
  )
}
