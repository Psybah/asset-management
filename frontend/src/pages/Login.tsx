import { ArrowRight } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Input, ease } from '../components/ui'
import { useAuth } from '../lib/auth'

const demo = [
  { u: 'admin', p: 'admin123' },
  { u: 'manager', p: 'manager123' },
  { u: 'staff', p: 'staff123' },
]

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [username, setU] = useState('')
  const [password, setP] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (u = username, p = password) => {
    setBusy(true); setErr('')
    try {
      await login(u, p)
      nav(params.get('next') || '/', { replace: true })
    } catch (e) {
      setErr((e as Error).message || 'Try again')
    } finally { setBusy(false) }
  }

  return (
    <div className="relative grid min-h-dvh overflow-hidden md:grid-cols-[1.3fr_1fr]">
      {/* Left: giant wordmark on ink */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-ink p-10 text-paper md:flex">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex items-center gap-3 text-sm text-paper/50">
          <span className="h-2.5 w-2.5 rounded-full bg-paper" /> Asset management
        </motion.div>

        {/* Orbiting circles */}
        <div className="pointer-events-none absolute right-[-12%] top-[8%] aspect-square w-[70%]">
          {[1, 0.72, 0.44].map((s, i) => (
            <motion.div
              key={i}
              className="absolute inset-0 m-auto rounded-full bg-paper/[0.06]"
              style={{ width: `${s * 100}%`, height: `${s * 100}%` }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 1.6, ease, delay: 0.2 + i * 0.12 }}
            />
          ))}
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          >
            <span className="absolute left-1/2 top-0 h-5 w-5 -translate-x-1/2 rounded-full bg-paper" />
          </motion.div>
        </div>

        <h1 className="relative -mb-[0.18em] -ml-[0.06em] text-[clamp(6rem,17vw,19rem)] leading-[0.8] tracking-[-0.07em]">
          {'Ledger'.split('').map((c, i) => (
            <motion.span key={i} className="inline-block" initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 1.1, ease, delay: 0.1 + i * 0.05 }}>
              {c}
            </motion.span>
          ))}
        </h1>
      </div>

      {/* Right: form */}
      <motion.form
        onSubmit={(e) => { e.preventDefault(); submit() }}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease, delay: 0.3 }}
        className="flex flex-col justify-center gap-3 px-6 py-16 md:px-16"
      >
        <h1 className="mb-10 text-7xl tracking-[-0.06em] md:hidden">Ledger</h1>
        <Input autoFocus placeholder="Username" value={username} onChange={(e) => setU(e.target.value)} autoComplete="username" />
        <Input placeholder="Password" type="password" value={password} onChange={(e) => setP(e.target.value)} autoComplete="current-password" />
        <Button type="submit" size="lg" disabled={busy || !username || !password} className="mt-2 w-full justify-between">
          <span>{busy ? '…' : 'Enter'}</span>
          <ArrowRight size={20} />
        </Button>
        <motion.p animate={{ opacity: err ? 1 : 0, height: err ? 'auto' : 0 }} className="pl-6 text-sm text-smoke">{err}</motion.p>

        <div className="mt-10 flex flex-wrap items-center gap-2">
          <span className="mr-2 pl-6 text-xs text-ash">Demo</span>
          {demo.map((d) => (
            <Button key={d.u} type="button" tone="mist" size="sm" onClick={() => { setU(d.u); setP(d.p); submit(d.u, d.p) }}>
              {d.u}
            </Button>
          ))}
        </div>
      </motion.form>
    </div>
  )
}
