import { MagnifyingGlass } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sheet } from '@/components/Sheet'
import { Empty, Page, PageHeader, Photo, Skeleton, StatusMark, cx, ease } from '@/components/ui'
import type { Asset, User } from '@/lib/types'
import { useData } from '@/lib/useData'

export default function People() {
  const { data } = useData<User[]>('/people/')
  const { data: assets } = useData<Asset[]>('/assets/', { status: 'assigned' })
  const [sel, setSel] = useState<User | null>(null)
  const [q, setQ] = useState('')
  const held = useMemo(() => {
    const m = new Map<number, Asset[]>()
    assets?.forEach((a) => a.assigned_to && m.set(a.assigned_to, [...(m.get(a.assigned_to) ?? []), a]))
    return m
  }, [assets])
  const list = [...(data ?? [])]
    .filter((p) => !q || `${p.name} ${p.department_name}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.asset_count ?? 0) - (a.asset_count ?? 0))

  return (
    <Page>
      <PageHeader
        eyebrow={data ? `${data.length} people` : '…'}
        title="People"
        actions={
          <div className="flex h-11 items-center gap-2.5 rounded-full bg-white px-4">
            <MagnifyingGlass size={15} className="text-ash" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find someone" className="w-36 bg-transparent text-sm placeholder:text-ash" />
          </div>
        }
      />
      {!data ? (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p, i) => {
            const items = held.get(p.id) ?? []
            return (
              <motion.button
                key={p.id}
                onClick={() => setSel(p)}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease, delay: Math.min(i, 12) * 0.03 }}
                className="group rounded-[1.5rem] bg-white p-1.5 text-left transition-transform duration-500 hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-3 px-2 pb-2 pt-1.5">
                  <span className={cx('grid size-9 shrink-0 place-items-center rounded-full text-xs font-medium', items.length ? 'bg-ink text-white' : 'bg-mist')}>{p.initials}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs capitalize text-ash">{[p.department_name, p.role].filter(Boolean).join(' · ')}</p>
                  </div>
                  <span className="text-xs text-ash tabular">{p.asset_count ?? 0}</span>
                </div>
                <div className="flex h-16 gap-1 rounded-[1.1rem] bg-mist p-1">
                  {items.slice(0, 4).map((a) => <Photo key={a.id} src={a.image_url} icon={a.category_icon} alt={a.name} className="h-full w-16 rounded-[0.85rem]" iconSize={20} />)}
                  {items.length === 0 && <span className="grid flex-1 place-items-center text-[11px] text-ash">Holds nothing</span>}
                </div>
              </motion.button>
            )
          })}
        </div>
      )}

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.name}>
        <p className="-mt-3 mb-5 text-xs capitalize text-ash">{[sel?.department_name, sel?.role].filter(Boolean).join(' · ')}</p>
        {sel && (held.get(sel.id) ?? []).length === 0 ? <Empty>Holds nothing</Empty> : (
          <div className="stack">
            {(sel ? held.get(sel.id) ?? [] : []).map((a) => (
              <Link key={a.id} to={`/assets/${a.id}`} onClick={() => setSel(null)} className="group flex items-center gap-3 bg-mist py-1.5 pl-1.5 pr-4 transition-colors hover:bg-fog">
                <Photo src={a.image_url} icon={a.category_icon} alt="" className="size-11 shrink-0 rounded-full" iconSize={16} />
                <span className="min-w-0 flex-1 truncate text-sm">{a.name}</span>
                <StatusMark status={a.status} />
              </Link>
            ))}
          </div>
        )}
      </Sheet>
    </Page>
  )
}
