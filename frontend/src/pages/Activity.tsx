import { ArrowsLeftRight, HandArrowDown, HandArrowUp, PencilSimple, Plus, Trash, Wrench, type Icon } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Page, Reveal, Skeleton, Title, cx } from '../components/ui'
import type { Audit } from '../lib/types'
import { useData } from '../lib/useData'

const icons: Record<string, Icon> = {
  create: Plus, update: PencilSimple, delete: Trash, checkout: HandArrowUp, checkin: HandArrowDown,
  dispose: Trash, maintenance: Wrench,
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
      <div className="mb-14"><Title>Activity</Title></div>
      {!data && <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 !rounded-full" />)}</div>}
      <div className="space-y-16">
        {[...groups.entries()].map(([day, items]) => (
          <section key={day} className="grid gap-4 md:grid-cols-[14rem_1fr] md:gap-10">
            <Reveal><h2 className="text-2xl tracking-[-0.04em] text-ash md:sticky md:top-10">{day}</h2></Reveal>
            <div className="flex flex-col gap-1.5">
              {items.map((a, i) => {
                const I = icons[a.action] ?? ArrowsLeftRight
                const body = (
                  <div className={cx('flex min-h-16 items-center gap-4 rounded-full py-2 pl-2 pr-6 transition-colors', a.action === 'dispose' || a.action === 'delete' ? 'bg-ink text-paper' : 'bg-mist hover:bg-fog')}>
                    <span className={cx('grid h-12 w-12 shrink-0 place-items-center rounded-full', a.action === 'dispose' || a.action === 'delete' ? 'bg-paper/10' : 'bg-paper')}><I size={18} /></span>
                    <span className="min-w-0 flex-1 text-[15px] leading-snug">{a.summary}</span>
                    <span className="hidden shrink-0 text-xs opacity-50 sm:block">{a.actor_name}</span>
                    <span className="w-12 shrink-0 text-right text-xs opacity-50 tabular">{new Date(a.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                )
                return (
                  <Reveal key={a.id} delay={Math.min(i, 10) * 0.03} y={14}>
                    {a.entity === 'asset' && a.entity_id && a.action !== 'delete' ? <Link to={`/assets/${a.entity_id}`}>{body}</Link> : body}
                  </Reveal>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </Page>
  )
}
