import { Plus, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { Chip, Page, Title, cx } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { AssetIcon } from '../lib/icons'
import type { Category, Department, Location } from '../lib/types'
import { invalidate, useData } from '../lib/useData'

type Tab = 'categories' | 'locations' | 'departments'
const tabs: { key: Tab; label: string }[] = [
  { key: 'categories', label: 'Kinds' },
  { key: 'locations', label: 'Places' },
  { key: 'departments', label: 'Teams' },
]

type Item = (Category | Location | Department) & { icon?: string }

export default function Library() {
  const [tab, setTab] = useState<Tab>('categories')
  const { data, reload } = useData<Item[]>(`/${tab}/`)
  const { canWrite } = useAuth()
  const [name, setName] = useState('')
  const toast = useToast()

  const add = async () => {
    if (!name.trim()) return
    const body: Record<string, unknown> = { name: name.trim() }
    if (tab === 'categories') Object.assign(body, { icon: 'cube', useful_life_years: 5 })
    if (tab === 'locations') Object.assign(body, { floor: '' })
    try { await api.post(`/${tab}/`, body); setName(''); invalidate(); reload(); toast('Added') } catch (e) { toast((e as Error).message) }
  }
  const remove = async (id: number) => {
    try { await api.del(`/${tab}/${id}/`); invalidate(); reload() } catch (e) { toast((e as Error).message) }
  }

  const filterKey = tab === 'categories' ? 'category' : tab === 'locations' ? 'location' : 'department'

  return (
    <Page>
      <div className="mb-10"><Title>Library</Title></div>
      <div className="mb-10 inline-flex gap-1 rounded-full bg-mist p-1">
        {tabs.map((t) => <Chip key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>{t.label}</Chip>)}
      </div>

      <div className="flex flex-wrap gap-2">
        <AnimatePresence mode="popLayout">
          {data?.map((it, i) => (
            <motion.div
              key={`${tab}-${it.id}`}
              layout
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24, delay: i * 0.025 }}
              className="group relative"
            >
              <Link
                to={tab === 'categories' ? `/assets?category=${it.id}` : '/assets'}
                className={cx('flex h-20 items-center gap-4 rounded-full bg-mist pl-3 pr-8 transition-colors hover:bg-fog', canWrite && 'pr-14')}
                title={filterKey}
              >
                <span className="grid h-14 w-14 place-items-center rounded-full bg-paper">
                  {tab === 'categories' ? <AssetIcon name={it.icon} size={24} /> : <span className="text-lg">{it.name[0]}</span>}
                </span>
                <span>
                  <span className="block text-lg tracking-[-0.02em]">{it.name}</span>
                  <span className="block text-xs text-ash tabular">{it.asset_count}</span>
                </span>
              </Link>
              {canWrite && (
                <button
                  onClick={() => remove(it.id)}
                  aria-label="Remove"
                  className="absolute right-4 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-ash opacity-0 transition-opacity hover:bg-paper hover:text-ink group-hover:opacity-100"
                >
                  <X size={14} />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {canWrite && (
          <motion.form layout onSubmit={(e) => { e.preventDefault(); add() }} className="flex h-20 items-center gap-2 rounded-full bg-ink pl-7 pr-3 text-paper">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add" className="w-32 bg-transparent text-lg placeholder:text-paper/40 md:w-44" />
            <button type="submit" aria-label="Add" className="grid h-14 w-14 place-items-center rounded-full bg-paper/10 transition-colors hover:bg-paper/20"><Plus size={20} /></button>
          </motion.form>
        )}
      </div>
    </Page>
  )
}
