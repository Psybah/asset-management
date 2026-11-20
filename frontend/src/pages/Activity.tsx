import { ArrowsLeftRight, HandArrowDown, HandArrowUp, ImageSquare, PencilSimple, Plus, Trash, Wrench, type Icon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/Avatar'
import { Page, PageHeader, Reveal, Segmented, Skeleton, cx } from '@/components/ui'
import type { Audit } from '@/lib/types'
import { useData } from '@/lib/useData'

const icons: Record<string, Icon> = {
  create: Plus, update: PencilSimple, delete: Trash, checkout: HandArrowUp, checkin: HandArrowDown, dispose: Trash, maintenance: Wrench, image: ImageSquare,
}
const filters = ['all', 'checkout', 'checkin', 'maintenance', 'create', 'update', 'dispose'] as const
type Filter = (typeof filters)[number]
const filterLabel: Record<Filter, string> = { all: 'All', checkout: 'Assigned', checkin: 'Returned', maintenance: 'Maintenance', create: 'Added', update: 'Edited', dispose: 'Disposed' }

function dayKey(s: string) {
  const d = new Date(s)
  const t = new Date()
  const diff = Math.floor((new Date(t.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === t.getFullYear() ? undefined : 'numeric' })
}

/** Audit trail as a timeline: one rail per day, a node per event. */
export default function Activity() {
  const { data } = useData<Audit[]>('/audit/', { limit: 200 })
  const [filter, setFilter] = useState<Filter>('all')

  const groups = useMemo(() => {
    const g = new Map<string, Audit[]>()
    data?.filter((a) => filter === 'all' || a.action === filter).forEach((a) => { const k = dayKey(a.timestamp); g.set(k, [...(g.get(k) ?? []), a]) })
    return [...g.entries()]
  }, [data, filter])

  return (
    <Page>
      <PageHeader eyebrow="Audit trail" title="Activity" />
      <div className="mb-5">
        <Segmented id="audit" value={filter} onChange={setFilter} options={filters.map((f) => ({ value: f, label: filterLabel[f] }))} />
      </div>

      {!data && <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>}

      <div className="space-y-4">
        {groups.map(([day, items]) => (
          <Reveal key={day}>
            <section className="grid gap-x-6 rounded-[1.6rem] bg-white p-1.5 md:grid-cols-[150px_1fr]">
              <header className="px-3 pb-1 pt-2.5 md:pb-3">
                <h2 className="text-[13px] font-medium">{day}</h2>
                <p className="text-[11px] text-ash tabular">{items.length} {items.length === 1 ? 'event' : 'events'}</p>
              </header>
              <ol className="relative py-1 pr-2">
                <span aria-hidden className="absolute bottom-6 left-[19px] top-6 w-px bg-fog" />
                {items.map((a) => {
                  const I = icons[a.action] ?? ArrowsLeftRight
                  const strong = a.action === 'dispose' || a.action === 'delete'
                  const body = (
                    <div className="group flex gap-3 rounded-[1rem] py-2 pl-1 pr-2 transition-colors hover:bg-mist">
                      <span className={cx('relative z-10 grid size-[30px] shrink-0 place-items-center rounded-full', strong ? 'bg-ink text-white' : 'bg-white text-ink ring-1 ring-fog')}><I size={14} /></span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-sm leading-snug">{a.summary}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-ash">
                          {a.actor_name && <Avatar name={a.actor_name} className="size-4" />}
                          {a.actor_name ?? 'System'} · <span className="tabular">{new Date(a.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                        </p>
                      </div>
                    </div>
                  )
                  return (
                    <li key={a.id}>
                      {a.entity === 'asset' && a.entity_id && a.action !== 'delete' ? <Link to={`/assets/${a.entity_id}`}>{body}</Link> : body}
                    </li>
                  )
                })}
              </ol>
            </section>
          </Reveal>
        ))}
        {data && groups.length === 0 && <p className="px-1 text-sm text-ash">No events of this kind.</p>}
      </div>
    </Page>
  )
}
