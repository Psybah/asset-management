import { motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sheet } from '../components/Sheet'
import { Empty, Page, Skeleton, StatusMark, Title, cx } from '../components/ui'
import { AssetIcon } from '../lib/icons'
import type { Asset, User } from '../lib/types'
import { useData } from '../lib/useData'

/** People as a bubble field — bubble size ∝ assets held. */
export default function People() {
  const { data } = useData<User[]>('/people/')
  const [sel, setSel] = useState<User | null>(null)
  const { data: held } = useData<Asset[]>(sel ? '/assets/' : null, { assigned_to: sel?.id })
  const max = Math.max(1, ...(data ?? []).map((p) => p.asset_count ?? 0))
  const sorted = [...(data ?? [])].sort((a, b) => (b.asset_count ?? 0) - (a.asset_count ?? 0))

  return (
    <Page>
      <div className="mb-12"><Title>People</Title></div>
      {!data ? (
        <div className="flex flex-wrap gap-3">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-32 w-32 !rounded-full" />)}</div>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
          {sorted.map((p, i) => {
            const n = p.asset_count ?? 0
            const size = 96 + (n / max) * 120
            return (
              <motion.button
                key={p.id}
                onClick={() => setSel(p)}
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 + i * 0.03 }}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.95 }}
                className={cx('group relative flex flex-col items-center justify-center rounded-full', i === 0 ? 'bg-ink text-paper' : 'bg-mist hover:bg-fog')}
                style={{ width: size, height: size }}
              >
                <span className="text-[clamp(1.1rem,2vw,1.75rem)] tracking-[-0.03em]">{p.initials}</span>
                <span className={cx('mt-1 max-w-[80%] truncate text-[11px] opacity-0 transition-opacity group-hover:opacity-100', i === 0 ? 'text-paper/60' : 'text-smoke')}>
                  {p.name.split(' ')[0]}
                </span>
                {n > 0 && (
                  <span className={cx('absolute right-[8%] top-[8%] grid h-7 min-w-7 place-items-center rounded-full px-2 text-[11px] tabular', i === 0 ? 'bg-paper text-ink' : 'bg-ink text-paper')}>
                    {n}
                  </span>
                )}
              </motion.button>
            )
          })}
        </div>
      )}

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel?.name}>
        <p className="-mt-6 mb-8 text-sm text-ash capitalize">{[sel?.department_name, sel?.role].filter(Boolean).join(' · ')}</p>
        {held && held.length === 0 && <Empty>Holds nothing</Empty>}
        <div className="flex flex-col gap-1.5">
          {held?.map((a) => (
            <Link key={a.id} to={`/assets/${a.id}`} onClick={() => setSel(null)} className="flex h-16 items-center gap-4 rounded-full bg-mist pl-2 pr-5 transition-colors hover:bg-fog">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-paper"><AssetIcon name={a.category_icon} size={20} /></span>
              <span className="flex-1 truncate">{a.name}</span>
              <StatusMark status={a.status} />
            </Link>
          ))}
        </div>
      </Sheet>
    </Page>
  )
}
