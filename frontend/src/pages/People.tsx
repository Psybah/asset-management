import { MagnifyingGlass } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { Sheet } from '@/components/Sheet'
import { Empty, Page, PageHeader, Photo, Reveal, Skeleton, StatusMark } from '@/components/ui'
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
  const list = (data ?? [])
    .filter((p) => !q || `${p.name} ${p.department_name ?? ''} ${p.email}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

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

      <Reveal>
        <div className="overflow-hidden rounded-[1.6rem] bg-white p-2">
          <div className="no-scrollbar overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-y-0.5 text-left text-sm">
              <thead>
                <tr className="text-xs text-ash">
                  <th className="px-4 pb-2 pt-2 font-medium">Name</th>
                  <th className="px-4 pb-2 pt-2 font-medium">Department</th>
                  <th className="px-4 pb-2 pt-2 font-medium">Role</th>
                  <th className="px-4 pb-2 pt-2 font-medium">Holding</th>
                  <th className="px-4 pb-2 pt-2 text-right font-medium">Assets</th>
                </tr>
              </thead>
              <tbody>
                {!data && Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={5}><Skeleton className="h-14 rounded-md bg-mist" /></td></tr>)}
                {list.map((p) => {
                  const items = held.get(p.id) ?? []
                  return (
                    <tr key={p.id} onClick={() => setSel(p)} className="group cursor-pointer [&>td]:bg-mist [&>td]:transition-colors hover:[&>td]:bg-fog">
                      <td className="rounded-l-md py-2 pl-2 pr-4 group-first:rounded-tl-[1.15rem] group-last:rounded-bl-[1.15rem]">
                        <div className="flex items-center gap-3">
                          <Avatar name={p.name} className="bg-white" />
                          <div className="min-w-0">
                            <p className="truncate">{p.name}</p>
                            <p className="truncate text-xs text-ash">{p.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 text-smoke">{p.department_name ?? '—'}</td>
                      <td className="px-4 capitalize text-smoke">{p.role}</td>
                      <td className="px-4">
                        <div className="flex -space-x-2">
                          {items.slice(0, 4).map((a) => <Photo key={a.id} src={a.image_url} icon={a.category_icon} alt={a.name} className="size-8 rounded-full ring-2 ring-mist" iconSize={14} />)}
                          {items.length === 0 && <span className="text-xs text-ash">—</span>}
                        </div>
                      </td>
                      <td className="rounded-r-md px-4 text-right tabular group-first:rounded-tr-[1.15rem] group-last:rounded-br-[1.15rem]">{p.asset_count ?? 0}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.name}>
        <div className="-mt-2 mb-5 flex items-center gap-3">
          <Avatar name={sel?.name} className="size-12" />
          <p className="text-xs capitalize text-ash">{[sel?.department_name, sel?.role].filter(Boolean).join(' · ')}</p>
        </div>
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
