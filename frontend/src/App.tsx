import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { CommandK } from './components/CommandK'
import { Shell } from './components/Shell'
import { useAuth } from './lib/auth'
import Activity from './pages/Activity'
import AssetDetail from './pages/AssetDetail'
import Assets from './pages/Assets'
import Insights from './pages/Insights'
import Library from './pages/Library'
import Login from './pages/Login'
import Maintenance from './pages/Maintenance'
import Overview from './pages/Overview'
import People from './pages/People'
import Scan from './pages/Scan'
import Survey from './pages/Survey'

function Splash() {
  return (
    <div className="grid h-dvh place-items-center">
      <div className="flex flex-col items-center gap-5">
        <motion.span className="size-3 rounded-full bg-white" animate={{ scale: [1, 1.6, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4 }} className="text-xs text-white/50">Waking the server — up to a minute on the free plan</motion.p>
      </div>
    </div>
  )
}

export default function App() {
  const { user, ready } = useAuth()
  const location = useLocation()
  const [search, setSearch] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch((s) => !s) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // The usability survey is public: participants don't need an account.
  if (location.pathname.startsWith('/survey')) return <Survey />
  if (!ready) return <Splash />

  if (!user) {
    const next = location.pathname === '/login' ? '' : `?next=${encodeURIComponent(location.pathname)}`
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to={`/login${next}`} replace />} />
      </Routes>
    )
  }

  return (
    <Shell onSearch={() => setSearch(true)}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Overview />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/assets/:id" element={<AssetDetail />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/people" element={<People />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/library" element={<Library />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/scan/:tag" element={<Scan />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
      <CommandK open={search} onClose={() => setSearch(false)} />
    </Shell>
  )
}
