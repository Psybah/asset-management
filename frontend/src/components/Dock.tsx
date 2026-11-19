import { Cube, MagnifyingGlass, Pulse, SignOut, SquaresFour, Stack, Users, Wrench, type Icon } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { spring } from './ui'

const items: { to: string; icon: Icon; label: string }[] = [
  { to: '/', icon: SquaresFour, label: 'Overview' },
  { to: '/assets', icon: Cube, label: 'Assets' },
  { to: '/maintenance', icon: Wrench, label: 'Care' },
  { to: '/people', icon: Users, label: 'People' },
  { to: '/activity', icon: Pulse, label: 'Activity' },
  { to: '/library', icon: Stack, label: 'Library' },
]

function Tip({ show, children }: { show: boolean; children: string }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={{ opacity: 0, y: 6, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.95 }}
          transition={spring}
          className="pointer-events-none absolute -top-11 left-1/2 -translate-x-1/2 rounded-full bg-ink px-3 py-1.5 text-[11px] whitespace-nowrap text-paper"
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

export function Dock({ onSearch }: { onSearch: () => void }) {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [hover, setHover] = useState<string | null>(null)
  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to))

  return (
    <motion.nav
      initial={{ y: 120, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ ...spring, delay: 0.3 }}
      className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-ink p-1.5 sm:gap-1"
      onMouseLeave={() => setHover(null)}
    >
      {items.map(({ to, icon: I, label }) => {
        const active = isActive(to)
        return (
          <NavLink
            key={to}
            to={to}
            aria-label={label}
            onMouseEnter={() => setHover(to)}
            className="relative grid h-10 w-10 place-items-center rounded-full sm:h-11 sm:w-11 md:h-12 md:w-12"
          >
            {active && <motion.span layoutId="dock" transition={spring} className="absolute inset-0 rounded-full bg-paper" />}
            <I size={20} weight={active ? 'fill' : 'regular'} className={`relative transition-colors duration-300 ${active ? 'text-ink' : 'text-paper/60 hover:text-paper'}`} />
            <Tip show={hover === to && !active}>{label}</Tip>
          </NavLink>
        )
      })}
      <span className="mx-1 hidden h-5 w-px bg-paper/15 sm:block" />
      <button
        onClick={onSearch}
        onMouseEnter={() => setHover('search')}
        aria-label="Search"
        className="relative grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-full text-paper/60 transition-colors hover:text-paper md:h-12 md:w-12"
      >
        <MagnifyingGlass size={20} />
        <Tip show={hover === 'search'}>⌘K</Tip>
      </button>
      <button
        onClick={async () => { await logout(); nav('/login') }}
        onMouseEnter={() => setHover('me')}
        aria-label="Sign out"
        className="group relative grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-full bg-paper/10 text-[12px] text-paper md:h-12 md:w-12"
      >
        <span className="transition-opacity group-hover:opacity-0">{user?.initials}</span>
        <SignOut size={18} className="absolute opacity-0 transition-opacity group-hover:opacity-100" />
        <Tip show={hover === 'me'}>{`${user?.name ?? ''} · sign out`}</Tip>
      </button>
    </motion.nav>
  )
}
