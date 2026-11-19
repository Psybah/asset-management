import Lenis from 'lenis'
import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

export const lenis: { current: Lenis | null } = { current: null }

/** Smooth-scrolls the app's inner container (the page scrolls inside the frame, not the window). */
export function ScrollArea({ children, className }: { children: ReactNode; className?: string }) {
  const wrapper = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    if (!wrapper.current || !content.current) return
    const l = new Lenis({ wrapper: wrapper.current, content: content.current, lerp: 0.1, smoothWheel: true })
    lenis.current = l
    let raf = 0
    const loop = (t: number) => { l.raf(t); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); l.destroy(); lenis.current = null }
  }, [])

  useEffect(() => { lenis.current?.scrollTo(0, { immediate: true }) }, [pathname])

  return (
    <div ref={wrapper} className={className} style={{ overflowY: 'auto' }}>
      <div ref={content}>{children}</div>
    </div>
  )
}
