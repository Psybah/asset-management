import {
  AddressBookTabs, ChatCircleDots, Cube, DownloadSimple, MagnifyingGlass, Plus, Pulse, SignOut, SquaresFour, Stack, Users, Wrench, ChartPieSlice, type Icon,
} from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { csvUrl, publicOrigin } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { Avatar } from './Avatar'
import { Notch } from './Notch'
import { UpcomingButton } from './Upcoming'
import { ScrollArea } from './SmoothScroll'
import { spring } from './ui'

const nav: { to: string; icon: Icon; label: string; manager?: boolean }[] = [
  { to: '/', icon: SquaresFour, label: 'Overview' },
  { to: '/assets', icon: Cube, label: 'Assets' },
  { to: '/maintenance', icon: Wrench, label: 'Maintenance' },
  { to: '/people', icon: Users, label: 'People' },
  { to: '/library', icon: Stack, label: 'Library' },
  { to: '/activity', icon: Pulse, label: 'Activity' },
  { to: '/insights', icon: ChartPieSlice, label: 'Usability', manager: true },
]

function Tip({ show, children, side = 'top' }: { show: boolean; children: ReactNode; side?: 'top' | 'right' }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={{ opacity: 0, scale: 0.9, ...(side === 'top' ? { y: 6 } : { x: -6 }) }}
          animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={spring}
          className={cn(
            'pointer-events-none absolute z-50 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-white',
            side === 'top' ? '-top-9 left-1/2 -translate-x-1/2' : 'left-[calc(100%+10px)] top-1/2 -translate-y-1/2',
          )}
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  )
}

/** Main navigation: a notch of the dark frame rising from the bottom edge, like a dock. */
function Dock() {
  const { pathname } = useLocation()
  const { canWrite } = useAuth()
  const [hover, setHover] = useState<string | null>(null)
  const items = nav.filter((n) => !n.manager || canWrite)
  const active = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to))
  return (
    <Notch edge="bottom" className="left-1/2 -translate-x-1/2" bodyClassName="pb-2.5 pt-2.5 md:pt-3">
      <nav className="flex items-center gap-1 md:gap-1.5" onMouseLeave={() => setHover(null)}>
        {items.map(({ to, icon: I, label }) => {
          const on = active(to)
          return (
            <NavLink key={to} to={to} aria-label={label} onMouseEnter={() => setHover(to)} className="relative grid size-10 place-items-center rounded-full md:size-11">
              <span className={cn('absolute inset-0 rounded-full transition-colors duration-300', on ? 'bg-white' : 'bg-white/[0.07] hover:bg-white/15')} />
              <I size={18} weight={on ? 'fill' : 'regular'} className={cn('relative', on ? 'text-ink' : 'text-white/70')} />
              <Tip show={hover === to && !on}>{label}</Tip>
            </NavLink>
          )
        })}
      </nav>
    </Notch>
  )
}

/** Quick tools: a floating white rail on the left (after the reference layout). */
function Sidebar({ onSearch }: { onSearch: () => void }) {
  const { canWrite } = useAuth()
  const nav = useNavigate()
  const [hover, setHover] = useState<string | null>(null)

  const Item = ({ id, icon: I, label, onClick, dark }: { id: string; icon: Icon; label: string; onClick: () => void; dark?: boolean }) => (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(id)}
      onMouseLeave={() => setHover(null)}
      aria-label={label}
      className={cn('relative grid size-11 place-items-center rounded-full transition-colors duration-300', dark ? 'bg-ink text-white hover:bg-[#2a2a2a]' : 'text-ink hover:bg-mist')}
    >
      <I size={19} />
      <Tip show={hover === id} side="right">{label}</Tip>
    </button>
  )

  return (
    <aside className="absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
      <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ ...spring, delay: 0.2 }} className="flex flex-col gap-1 rounded-full bg-white p-1.5">
        {canWrite && <Item id="new" icon={Plus} label="New asset" dark onClick={() => nav('/assets?new=1')} />}
        <Item id="search" icon={MagnifyingGlass} label="Search  ⌘K" onClick={onSearch} />
        <Item id="csv" icon={DownloadSimple} label="Export register" onClick={() => window.open(csvUrl(), '_blank')} />
      </motion.div>
      <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ ...spring, delay: 0.3 }} className="flex flex-col gap-1 rounded-full bg-white p-1.5">
        <Item id="survey" icon={ChatCircleDots} label="Usability survey" onClick={() => window.open(`${publicOrigin}/survey`, '_blank')} />
      </motion.div>
    </aside>
  )
}

function Profile() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [])
  return (
    <div ref={ref} className="relative">
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen((o) => !o)}
        aria-label="Account"
        className="size-11 overflow-hidden rounded-full bg-ink"
      >
        <Avatar name={user?.name} className="size-full" />
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={spring}
            className="absolute right-0 top-13 w-60 origin-top-right rounded-[1.4rem] bg-white p-1.5"
          >
            <div className="flex items-center gap-3 rounded-[1.1rem] bg-mist px-3 py-3">
              <Avatar name={user?.name} className="bg-white" />
              <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="truncate text-xs capitalize text-ash">{[user?.role, user?.department_name].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            <button
              onClick={async () => { await logout(); nav('/login') }}
              className="mt-1 flex h-11 w-full items-center gap-2.5 rounded-full px-4 text-sm transition-colors hover:bg-mist"
            >
              <SignOut size={16} /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Shell({ children, onSearch }: { children: ReactNode; onSearch: () => void }) {
  return (
    <div className="h-dvh p-2 md:p-3">
      <div className="relative h-full overflow-hidden rounded-[1.75rem] bg-canvas md:rounded-[2.25rem]">
        {/* Floating logo */}
        <Link to="/" className="absolute left-3 top-3 z-40 flex h-11 items-center gap-2.5 rounded-full bg-ink pl-3 pr-4 text-white md:left-4 md:top-4">
          <AddressBookTabs size={20} weight="bold" />
          <span className="text-[15px] font-medium tracking-[-0.03em]">Ledger</span>
        </Link>
        <div className="absolute right-3 top-3 z-40 flex items-center gap-2 md:right-4 md:top-4">
          <UpcomingButton />
          <Profile />
        </div>
        <Sidebar onSearch={onSearch} />
        <ScrollArea className="h-full">
          <div className="mx-auto max-w-[1180px] px-4 pb-36 pt-20 md:px-8 md:pt-24 lg:pl-24">{children}</div>
        </ScrollArea>
        <Dock />
      </div>
    </div>
  )
}
