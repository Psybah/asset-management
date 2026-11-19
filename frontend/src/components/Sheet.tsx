import { X } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { lenis } from './SmoothScroll'
import { ease } from './ui'

/** Bottom sheet on mobile, floating rounded panel on desktop. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    lenis.current?.stop()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => { lenis.current?.start(); window.removeEventListener('keydown', onKey) }
  }, [open, onClose])

  // Portal to <body>: page transitions apply transform/filter, which would otherwise trap `position: fixed`.
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          <motion.div
            className="absolute inset-0 bg-ink/35"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            aria-label={title}
            initial={{ y: '100%', opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 0.65, ease }}
            data-lenis-prevent
            className="relative max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-[2rem] bg-paper p-5 pb-8 md:max-w-lg md:rounded-[2rem] md:p-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-medium tracking-[-0.03em]">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-mist transition-colors hover:bg-fog">
                <X size={15} />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
