import { Plus, X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/components/Toast'
import { Page, PageHeader, Panel, Segmented } from '@/components/ui'
import { IconFolder } from '@/components/ui-kit/icon-folder'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { AssetIcon } from '@/lib/icons'
import type { Category, Department, Location } from '@/lib/types'
import { invalidate, useData } from '@/lib/useData'

type Tab = 'categories' | 'locations' | 'departments'

function AddInline({ onAdd, placeholder }: { onAdd: (name: string) => Promise<void>; placeholder: string }) {
  const [name, setName] = useState('')
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (name.trim()) { await onAdd(name.trim()); setName('') } }} className="flex h-11 items-center gap-1 rounded-full bg-white pl-4 pr-1">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} className="w-40 bg-transparent text-sm placeholder:text-ash" />
      <button type="submit" aria-label="Add" className="grid size-9 place-items-center rounded-full bg-ink text-white"><Plus size={14} /></button>
    </form>
  )
}

export default function Library() {
  const [tab, setTab] = useState<Tab>('categories')
  const { data: cats, reload: rc } = useData<Category[]>('/categories/')
  const { data: locs, reload: rl } = useData<Location[]>('/locations/')
  const { data: deps, reload: rd } = useData<Department[]>('/departments/')
  const { canWrite } = useAuth()
  const toast = useToast()
  const nav = useNavigate()

  const add = async (name: string) => {
    const body: Record<string, unknown> = { name }
    if (tab === 'categories') Object.assign(body, { icon: 'cube', useful_life_years: 5 })
    if (tab === 'locations') Object.assign(body, { floor: '' })
    try { await api.post(`/${tab}/`, body); invalidate(); rc(); rl(); rd(); toast('Added') } catch (e) { toast((e as Error).message) }
  }
  const remove = async (id: number) => {
    try { await api.del(`/${tab}/${id}/`); invalidate(); rc(); rl(); rd() } catch (e) { toast((e as Error).message) }
  }

  const rows = tab === 'locations' ? locs : deps

  return (
    <Page>
      <PageHeader
        eyebrow="Reference data"
        title="Library"
        actions={canWrite && <AddInline onAdd={add} placeholder={tab === 'categories' ? 'New category' : tab === 'locations' ? 'New location' : 'New department'} />}
      />
      <div className="mb-5">
        <Segmented id="lib" value={tab} onChange={setTab} options={[{ value: 'categories', label: 'Categories' }, { value: 'locations', label: 'Locations' }, { value: 'departments', label: 'Departments' }]} />
      </div>

      <AnimatePresence mode="wait">
        {tab === 'categories' ? (
          <motion.div key="cats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
            {cats?.map((c) => (
              <div key={c.id} className="flex flex-col items-center">
                <IconFolder
                  title={c.name}
                  theme="light"
                  spread={58}
                  showPill={false}
                  icons={(c.cover_urls?.length ? c.cover_urls : [null]).slice(0, 4).map((src) => (src ? { src } : { node: <AssetIcon name={c.icon} size={40} weight="thin" />, background: '#f4f4f4' }))}
                />
                <div className="mt-2 flex w-full max-w-[420px] items-center justify-between px-2 text-xs text-ash">
                  <button onClick={() => nav(`/assets?category=${c.id}`)} className="hover:text-ink">{c.asset_count} {c.asset_count === 1 ? "asset" : "assets"} · {c.useful_life_years}-year life</button>
                  {canWrite && c.asset_count === 0 && <button onClick={() => remove(c.id)} aria-label="Remove" className="hover:text-ink"><X size={12} /></button>}
                </div>
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Panel inset={false} bodyClassName="stack">
              {rows?.map((r) => (
                <div key={r.id} className="group flex items-center gap-4 bg-mist px-4 py-3">
                  <span className="grid size-8 place-items-center rounded-full bg-white text-xs font-medium">{r.name[0]}</span>
                  <span className="flex-1 text-sm">{r.name}</span>
                  {'floor' in r && r.floor ? <span className="text-xs text-ash">Floor {String(r.floor)}</span> : null}
                  <span className="w-16 text-right text-xs text-ash tabular">{r.asset_count} assets</span>
                  {canWrite && r.asset_count === 0 && <button onClick={() => remove(r.id)} aria-label="Remove" className="text-ash opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"><X size={13} /></button>}
                </div>
              ))}
            </Panel>
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  )
}
