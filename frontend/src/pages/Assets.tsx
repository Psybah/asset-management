import { DownloadSimple, List, MagnifyingGlass, Plus, SquaresFour } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AssetForm } from '../components/AssetForm'
import { Chip, Empty, IconButton, Page, Skeleton, StatusMark, Title, cx, ease } from '../components/ui'
import { csvUrl } from '../lib/api'
import { useAuth } from '../lib/auth'
import { compact, naira } from '../lib/format'
import { AssetIcon } from '../lib/icons'
import type { Asset, Category } from '../lib/types'
import { useData } from '../lib/useData'

const statuses = ['all', 'available', 'assigned', 'maintenance', 'retired'] as const
// Pinterest rhythm: deterministic varied heights.
const heights = ['aspect-[4/5]', 'aspect-square', 'aspect-[5/6]', 'aspect-[3/4]', 'aspect-[6/5]']

function Card({ a, i }: { a: Asset; i: number }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.8, ease, delay: Math.min(i, 14) * 0.035 }}
    >
      <Link
        to={`/assets/${a.id}`}
        className={cx(
          'group relative flex flex-col justify-between overflow-hidden rounded-[2.25rem] p-5 transition-colors duration-500',
          heights[a.id % heights.length],
          a.status === 'assigned' ? 'bg-ink text-paper' : 'bg-mist hover:bg-fog',
          a.status === 'retired' && 'opacity-50',
        )}
      >
        <div className="flex items-start justify-between">
          <StatusMark status={a.status} className={a.status === 'assigned' ? '!bg-paper/10' : ''} />
          <span className={cx('text-[11px] tabular', a.status === 'assigned' ? 'text-paper/40' : 'text-ash')}>{a.tag}</span>
        </div>
        <div className="grid flex-1 place-items-center">
          <AssetIcon
            name={a.category_icon}
            size={52}
            weight="thin"
            className="transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)] group-hover:-rotate-6 group-hover:scale-125"
          />
        </div>
        <div>
          <p className="truncate text-[15px] leading-tight">{a.name}</p>
          <p className={cx('mt-1 truncate text-xs', a.status === 'assigned' ? 'text-paper/50' : 'text-ash')}>
            {a.assigned_to_name ?? a.location_name ?? '—'} · ₦{compact(a.current_value)}
          </p>
        </div>
      </Link>
    </motion.div>
  )
}

function Row({ a, i }: { a: Asset; i: number }) {
  return (
    <motion.div layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease, delay: Math.min(i, 20) * 0.02 }}>
      <Link to={`/assets/${a.id}`} className="group flex h-16 items-center gap-4 rounded-full pl-2 pr-6 transition-colors hover:bg-mist">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-mist transition-colors group-hover:bg-paper"><AssetIcon name={a.category_icon} size={22} /></span>
        <span className="w-20 shrink-0 text-xs text-ash tabular">{a.tag}</span>
        <span className="min-w-0 flex-1 truncate">{a.name}</span>
        <span className="hidden w-48 truncate text-sm text-smoke lg:block">{a.assigned_to_name ?? '—'}</span>
        <span className="hidden w-40 truncate text-sm text-smoke md:block">{a.department_name ?? '—'}</span>
        <span className="hidden w-32 text-right text-sm tabular sm:block">{naira(a.current_value)}</span>
        <StatusMark status={a.status} onPaper className="w-28 justify-center" />
      </Link>
    </motion.div>
  )
}

export default function Assets() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? 'all'
  const category = params.get('category') ?? ''
  const [q, setQ] = useState('')
  const [view, setView] = useState<'grid' | 'list'>(() => { try { return (localStorage.getItem('ledger.view') as 'grid' | 'list') || 'grid' } catch { return 'grid' } })
  const [adding, setAdding] = useState(false)
  const { canWrite } = useAuth()
  const nav = useNavigate()

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
    setParams(p, { replace: true })
  }
  const toggleView = (v: 'grid' | 'list') => { setView(v); try { localStorage.setItem('ledger.view', v) } catch { /* noop */ } }

  return (
    <Page>
      <div className="mb-8 flex items-end justify-between gap-4 md:mb-12">
        <Title>Assets</Title>
        <div className="flex shrink-0 gap-2 pb-3">
          <IconButton label="Export CSV" onClick={() => window.open(csvUrl({ status: status === 'all' ? '' : status, category, search: q }), '_blank')}>
            <DownloadSimple size={18} />
          </IconButton>
          {canWrite && <IconButton tone="ink" label="New asset" onClick={() => setAdding(true)}><Plus size={18} /></IconButton>}
        </div>
      </div>

      {/* Controls float as a sticky pill cluster */}
      <div className="sticky top-3 z-30 mb-8 flex flex-col gap-2 md:flex-row md:items-center">
        <div className="flex h-14 flex-1 items-center gap-3 rounded-full bg-paper/80 px-5 backdrop-blur-xl md:max-w-sm">
          <MagnifyingGlass size={18} className="text-ash" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className="h-full flex-1 bg-transparent" />
          {list && <span className="text-xs text-ash tabular">{list.length}</span>}
        </div>
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto rounded-full bg-paper/80 p-1 backdrop-blur-xl">
          {statuses.map((s) => <Chip key={s} active={status === s} onClick={() => setParam('status', s)}>{s}</Chip>)}
        </div>
        <div className="flex items-center gap-1 rounded-full bg-paper/80 p-1 backdrop-blur-xl md:ml-auto">
          {(['grid', 'list'] as const).map((v) => (
            <button key={v} onClick={() => toggleView(v)} aria-label={v} className={cx('relative grid h-10 w-10 place-items-center rounded-full', view === v ? 'text-paper' : 'text-ash')}>
              {view === v && <motion.span layoutId="view" className="absolute inset-0 rounded-full bg-ink" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span className="relative">{v === 'grid' ? <SquaresFour size={18} /> : <List size={18} />}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Category icons as a horizontal rail */}
      <div className="no-scrollbar -mx-4 mb-10 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {cats?.map((c, i) => {
          const on = category === String(c.id)
          return (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.2 + i * 0.03 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setParam('category', on ? '' : String(c.id))}
              title={c.name}
              className={cx('group flex h-14 shrink-0 items-center gap-2 rounded-full pl-4 pr-5 transition-colors duration-300', on ? 'bg-ink text-paper' : 'bg-mist hover:bg-fog')}
            >
              <AssetIcon name={c.icon} size={20} weight={on ? 'fill' : 'light'} />
              <span className="text-[13px]">{c.name}</span>
            </motion.button>
          )
        })}
      </div>

      {!list && loading ? (
        <div className="masonry">{Array.from({ length: 10 }).map((_, i) => <div key={i} className={heights[i % heights.length]}><Skeleton className="h-full" /></div>)}</div>
      ) : list && list.length === 0 ? (
        <Empty>Nothing here</Empty>
      ) : view === 'grid' ? (
        <div className="masonry">
          <AnimatePresence mode="popLayout">
            {list?.map((a, i) => <Card key={a.id} a={a} i={i} />)}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex flex-col">
          <AnimatePresence mode="popLayout">
            {list?.map((a, i) => <Row key={a.id} a={a} i={i} />)}
          </AnimatePresence>
        </div>
      )}

      <AssetForm open={adding} onClose={() => setAdding(false)} onSaved={(a) => nav(`/assets/${a.id}`)} />
    </Page>
  )
}
