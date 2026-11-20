import { AddressBookTabs, ArrowRight, MapPin, UsersThree } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, Photo, Skeleton, StatusMark, ease } from '@/components/ui'
import { api } from '@/lib/api'
import type { Status } from '@/lib/types'

type PublicAsset = {
  id: number; tag: string; name: string; category_name: string; category_icon: string; image_url: string | null
  status: Status; condition: string; location_name: string | null; department_name: string | null
}

/** What a QR label shows to someone who isn't signed in: what the item is and where it belongs. */
export default function PublicScan() {
  const { tag = '' } = useParams()
  const [a, setA] = useState<PublicAsset | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    document.title = `${tag} · Ledger`
    let tries = 0
    const load = () => api.get<PublicAsset>(`/public/assets/${encodeURIComponent(tag)}/`).then(setA).catch((e) => {
      // free hosting may still be waking up
      if (e instanceof TypeError && tries++ < 15) { setErr('Waking the server…'); setTimeout(load, 4000) } else setErr(e.status === 404 ? `No asset with tag ${tag}.` : 'Could not load this asset.')
    })
    load()
  }, [tag])

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col p-3">
        <header className="flex items-center justify-between py-2">
          <span className="flex h-10 items-center gap-2 rounded-full bg-ink pl-3 pr-4 text-white">
            <AddressBookTabs size={18} weight="fill" />
            <span className="text-sm font-medium tracking-[-0.03em]">Ledger</span>
          </span>
          <span className="text-xs text-ash tabular">{tag.toUpperCase()}</span>
        </header>

        {!a ? (
          <div className="mt-3 space-y-2">
            <Skeleton className="aspect-[4/5] bg-white" />
            {err && <p className="px-1 text-sm text-smoke">{err}</p>}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="mt-3 rounded-[1.75rem] bg-white p-2">
            <Photo src={a.image_url} icon={a.category_icon} alt={a.name} color className="aspect-[4/3] rounded-[1.35rem]" iconSize={96} />
            <div className="px-3 pb-3 pt-4">
              <div className="flex items-center gap-2">
                <StatusMark status={a.status} onPaper />
                <span className="text-xs text-ash">{a.category_name}</span>
              </div>
              <h1 className="mt-2 text-2xl font-medium leading-tight tracking-[-0.03em]">{a.name}</h1>
              <div className="stack mt-4">
                <div className="flex items-center gap-3 bg-mist px-4 py-3 text-sm"><MapPin size={16} className="text-ash" /><span className="flex-1 text-ash">Location</span><span>{a.location_name ?? '—'}</span></div>
                <div className="flex items-center gap-3 bg-mist px-4 py-3 text-sm"><UsersThree size={16} className="text-ash" /><span className="flex-1 text-ash">Department</span><span>{a.department_name ?? '—'}</span></div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="mt-auto pt-4">
          <Link to={`/login?next=${encodeURIComponent(`/scan/${tag}`)}`}>
            <Button size="lg" className="w-full">Sign in to manage this asset <ArrowRight size={16} /></Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
