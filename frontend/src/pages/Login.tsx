import { ArrowRight } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Silk from '@/components/bits/Silk'
import { Button, Field, FieldGroup, ease } from '@/components/ui'
import { useAuth } from '@/lib/auth'

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
    <div className="h-dvh p-2 md:p-3">
      <div className="mx-auto grid h-full max-w-[1440px] gap-2 overflow-hidden rounded-[1.75rem] bg-white p-2 md:grid-cols-[1.15fr_1fr] md:rounded-[2.25rem]">
        {/* Visual: React Bits Silk, monochrome */}
        <div className="relative hidden overflow-hidden rounded-[1.4rem] bg-ink md:block md:rounded-[1.75rem]">
          <Silk color="#3a3a3a" speed={3} scale={1.1} noiseIntensity={1.2} rotation={0.3} className="absolute inset-0" />
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-9 text-white">
            <div className="flex items-center gap-2.5">
              <span className="grid size-5 place-items-center rounded-full bg-white"><span className="size-2 rounded-full bg-ink" /></span>
              <span className="text-[15px] font-medium tracking-[-0.03em]">Ledger</span>
            </div>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease, delay: 0.3 }}
              className="max-w-[18ch] text-[2rem] font-medium leading-[1.1] tracking-[-0.04em]"
            >
              Every asset, accounted for.
            </motion.p>
          </div>
        </div>

        {/* Form */}
        <div className="flex flex-col justify-center px-4 py-10 md:px-14">
          <motion.form
            onSubmit={(e) => { e.preventDefault(); submit() }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.1 }}
            className="mx-auto w-full max-w-sm"
          >
            <div className="mb-8 flex items-center gap-2.5 md:hidden">
              <span className="grid size-5 place-items-center rounded-full bg-ink"><span className="size-2 rounded-full bg-white" /></span>
              <span className="text-[15px] font-medium tracking-[-0.03em]">Ledger</span>
            </div>
            <h1 className="text-2xl font-medium tracking-[-0.03em]">Sign in</h1>
            <p className="mt-1.5 text-sm text-ash">Use your office account.</p>

            <FieldGroup className="mt-8">
              <Field label="Username" autoFocus value={username} onChange={(e) => setU(e.target.value)} autoComplete="username" />
              <Field label="Password" type="password" value={password} onChange={(e) => setP(e.target.value)} autoComplete="current-password" />
            </FieldGroup>

            <motion.p initial={false} animate={{ opacity: err ? 1 : 0, height: err ? 'auto' : 0 }} className="overflow-hidden pl-1 pt-2 text-xs text-smoke">{err}</motion.p>

            <Button type="submit" size="lg" disabled={busy || !username || !password} className="mt-4 w-full">
              {busy ? 'Signing in…' : 'Continue'} <ArrowRight size={16} />
            </Button>

            <div className="mt-10">
              <p className="mb-2 text-xs text-ash">Demo accounts</p>
              <div className="flex flex-wrap gap-1.5">
                {demo.map((d) => (
                  <Button key={d.u} tone="paper" size="sm" beam={false} faceClassName="bg-mist from-mist to-mist" onClick={() => { setU(d.u); setP(d.p); submit(d.u, d.p) }}>
                    {d.u}
                  </Button>
                ))}
              </div>
            </div>
          </motion.form>
        </div>
      </div>
    </div>
  )
}
