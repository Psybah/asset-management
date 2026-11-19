import { ArrowUpRight, MagnifyingGlass } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import type { Asset } from '@/lib/types'
import { cn } from '@/lib/utils'
import { lenis } from './SmoothScroll'
import { Photo, StatusMark, ease } from './ui'

/** ⌘K asset search. A light dim, no blur — the page stays readable behind it. */
export function CommandK({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Asset[]>([])
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const nav = useNavigate()

  useEffect(() => {
    if (!open) return
    setQ(''); setResults([]); setIdx(0)
    lenis.current?.stop()
    setTimeout(() => inputRef.current?.focus(), 50)
    return () => lenis.current?.start()
  }, [open])

  useEffect(() => {
    if (!q.trim()) { setResults([]); return }
    const t = setTimeout(() => {
      api.get<Asset[]>('/assets/', { search: q }).then((r) => { setResults(r.slice(0, 6)); setIdx(0) }).catch(() => {})
    }, 150)
    return () => clearTimeout(t)
  }, [q])

  const go = (a: Asset) => { onClose(); nav(`/assets/${a.id}`) }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-center px-4 pt-[12vh]">
          <motion.div className="absolute inset-0 bg-ink/15" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.4, ease }}
            className="relative h-fit w-full max-w-xl rounded-[1.75rem] bg-white p-1.5"
          >
            <div className="flex h-13 items-center gap-3 rounded-[1.35rem] bg-mist px-4">
              <MagnifyingGlass size={17} className="text-ash" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') onClose()
                  if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)) }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)) }
                  if (e.key === 'Enter' && results[idx]) go(results[idx])
                }}
                placeholder="Search by tag, name or serial"
                className="h-full flex-1 bg-transparent text-[15px] placeholder:text-ash"
              />
              <kbd className="rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-ash">esc</kbd>
            </div>
            {results.length > 0 && (
              <div className="stack mt-1.5">
                {results.map((a, i) => (
                  <button
                    key={a.id}
                    onMouseEnter={() => setIdx(i)}
                    onClick={() => go(a)}
                    className={cn('group flex items-center gap-3 py-1.5 pl-1.5 pr-4 text-left transition-colors', i === idx ? 'bg-fog' : 'bg-mist')}
                  >
                    <Photo src={a.image_url} icon={a.category_icon} alt="" className="size-10 shrink-0 rounded-full" iconSize={16} />
                    <span className="min-w-0 flex-1 truncate text-sm">{a.name}</span>
                    <span className="hidden text-xs text-ash tabular sm:block">{a.tag}</span>
                    <StatusMark status={a.status} />
                    <ArrowUpRight size={14} className={i === idx ? 'opacity-100' : 'opacity-0'} />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
