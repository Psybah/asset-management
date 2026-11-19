import { ArrowsLeftRight, HandArrowDown, HandArrowUp, PencilSimple, Plus, Trash, Wrench, ImageSquare, type Icon } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Page, PageHeader, Panel, Reveal, Skeleton, cx } from '@/components/ui'
import type { Audit } from '@/lib/types'
import { useData } from '@/lib/useData'

const icons: Record<string, Icon> = {
  create: Plus, update: PencilSimple, delete: Trash, checkout: HandArrowUp, checkin: HandArrowDown, dispose: Trash, maintenance: Wrench, image: ImageSquare,
}

function dayKey(s: string) {
  const d = new Date(s)
  const t = new Date()
  const diff = Math.floor((new Date(t.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: d.getFullYear() === t.getFullYear() ? undefined : 'numeric' })
}

export default function Activity() {
  const { data } = useData<Audit[]>('/audit/', { limit: 150 })
  const groups = new Map<string, Audit[]>()
  data?.forEach((a) => { const k = dayKey(a.timestamp); groups.set(k, [...(groups.get(k) ?? []), a]) })

  return (
    <Page>
      <PageHeader eyebrow="Audit trail" title="Activity" />
      {!data && <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>}
      <div className="space-y-4">
        {[...groups.entries()].map(([day, items]) => (
          <Reveal key={day}>
            <Panel title={day} action={<span className="text-xs text-ash tabular">{items.length}</span>} inset={false} bodyClassName="stack">
              {items.map((a) => {
                const I = icons[a.action] ?? ArrowsLeftRight
                const strong = a.action === 'dispose' || a.action === 'delete'
                const body = (
                  <div className={cx('flex items-center gap-3 py-2 pl-2 pr-4 transition-colors', strong ? 'bg-ink text-white' : 'bg-mist hover:bg-fog')}>
                    <span className={cx('grid size-9 shrink-0 place-items-center rounded-full', strong ? 'bg-white/10' : 'bg-white')}><I size={15} /></span>
                    <span className="min-w-0 flex-1 text-sm leading-snug">{a.summary}</span>
                    <span className="hidden shrink-0 text-xs opacity-50 sm:block">{a.actor_name}</span>
                    <span className="w-11 shrink-0 text-right text-xs opacity-50 tabular">{new Date(a.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )
                return a.entity === 'asset' && a.entity_id && a.action !== 'delete'
                  ? <Link key={a.id} to={`/assets/${a.entity_id}`}>{body}</Link>
                  : <div key={a.id}>{body}</div>
              })}
            </Panel>
          </Reveal>
        ))}
      </div>
    </Page>
  )
}
