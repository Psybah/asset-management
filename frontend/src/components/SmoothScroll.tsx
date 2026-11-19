import Lenis from 'lenis'
import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

export const lenis: { current: Lenis | null } = { current: null }

export function SmoothScroll({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()

  useEffect(() => {
    const l = new Lenis({ lerp: 0.09, smoothWheel: true })
    lenis.current = l
    let raf = 0
    const loop = (t: number) => { l.raf(t); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); l.destroy(); lenis.current = null }
  }, [])

  useEffect(() => { lenis.current?.scrollTo(0, { immediate: true }) }, [pathname])

  return <>{children}</>
}
