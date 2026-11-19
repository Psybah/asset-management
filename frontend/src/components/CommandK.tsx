import { ArrowUpRight, MagnifyingGlass } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { AssetIcon } from '../lib/icons'
import type { Asset } from '../lib/types'
import { lenis } from './SmoothScroll'
import { StatusMark, ease } from './ui'

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
      api.get<Asset[]>('/assets/', { search: q }).then((r) => { setResults(r.slice(0, 7)); setIdx(0) }).catch(() => {})
    }, 160)
    return () => clearTimeout(t)
  }, [q])

  const go = (a: Asset) => { onClose(); nav(`/assets/${a.id}`) }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-center px-4 pt-[14vh]">
          <motion.div className="absolute inset-0 bg-paper/70 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.5, ease }}
            className="relative w-full max-w-2xl"
          >
            <div className="flex h-20 items-center gap-4 rounded-full bg-ink px-8 text-paper">
              <MagnifyingGlass size={22} className="opacity-50" />
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
                placeholder="Tag, name, serial"
                className="h-full flex-1 bg-transparent text-xl tracking-[-0.02em] placeholder:text-paper/30"
              />
              <kbd className="rounded-full bg-paper/10 px-3 py-1 text-[11px] text-paper/50">esc</kbd>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              <AnimatePresence initial={false}>
                {results.map((a, i) => (
                  <motion.button
                    key={a.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}
                    exit={{ opacity: 0 }}
                    onMouseEnter={() => setIdx(i)}
                    onClick={() => go(a)}
                    className={`flex h-16 items-center gap-4 rounded-full pl-3 pr-6 text-left transition-colors duration-200 ${i === idx ? 'bg-mist' : 'bg-paper'}`}
                  >
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-paper"><AssetIcon name={a.category_icon} size={20} /></span>
                    <span className="flex-1 truncate text-[15px]">{a.name}</span>
                    <span className="hidden text-xs text-ash sm:block">{a.tag}</span>
                    <StatusMark status={a.status} onPaper />
                    <ArrowUpRight size={16} className={i === idx ? 'opacity-100' : 'opacity-0'} />
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
