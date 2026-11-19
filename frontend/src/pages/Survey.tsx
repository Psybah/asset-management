import { ArrowLeft, ArrowRight, Check } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button, Field, ease } from '@/components/ui'
import { ApiError, api } from '@/lib/api'
import { cn } from '@/lib/utils'

type Opt = { value: string; label: string }
type Form = {
  title: string
  intro: string
  demographics: { id: string; code: string; label: string; options: Opt[]; other_field: string | null; allow_other: boolean; required: boolean }[]
  tasks: { id: string; text: string }[]
  task_outcomes: Opt[]
  sus: { instructions: string; source: string; scale: { value: number; label: string }[]; items: { item: number; field: string; text: string }[] }
  adjective: { id: string; code: string; label: string; options: Opt[]; required: boolean }
  comparison: { id: string; code: string; label: string; options: Opt[]; required: boolean }
  open_questions: { id: string; code: string; label: string; required: boolean; max_length: number }[]
}
type Answers = Record<string, string | number | undefined>

function Choice({ options, value, onChange, cols }: { options: Opt[]; value?: string | number; onChange: (v: string) => void; cols?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', cols)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn('min-h-10 rounded-full px-4 py-2 text-left text-sm transition-colors duration-200', String(value) === o.value ? 'bg-ink text-white' : 'bg-white hover:bg-fog')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Block({ code, label, children }: { code?: string; label: string; children: ReactNode }) {
  return (
    <div className="rounded-[1.5rem] bg-white p-1.5">
      <p className="px-3 pb-3 pt-2.5 text-sm leading-snug">
        {code && <span className="mr-2 text-xs text-ash tabular">{code}</span>}{label}
      </p>
      <div className="rounded-[1.15rem] bg-canvas/60 p-2">{children}</div>
    </div>
  )
}

export default function Survey() {
  const [form, setForm] = useState<Form | null>(null)
  const [step, setStep] = useState(0)
  const [a, setA] = useState<Answers>({})
  const [tasks, setTasks] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => { api.get<Form>('/survey/form/').then(setForm).catch(() => setErr('Could not load the survey. Is the server running?')) }, [])
  const set = (k: string) => (v: string | number) => setA((s) => ({ ...s, [k]: v }))

  const steps = useMemo(() => (form ? ['About you', 'Tasks', 'Usability', 'Overall'] : []), [form])

  const valid = (() => {
    if (!form) return false
    if (step === 0) return form.demographics.every((d) => !d.required || (a[d.id] && (a[d.id] !== 'other' || !d.other_field || a[d.other_field])))
    if (step === 1) return form.tasks.every((t) => tasks[t.id])
    if (step === 2) return form.sus.items.every((i) => a[i.field])
    if (step === 3) return !!a.adjective && !!a.comparison
    return true
  })()

  const submit = async () => {
    if (!form) return
    setBusy(true); setErr('')
    const body = {
      ...a,
      tasks_completed: form.tasks.filter((t) => tasks[t.id] !== 'not_completed').map((t) => t.id),
      tasks_with_help: form.tasks.filter((t) => tasks[t.id] === 'with_help').map((t) => t.id),
      ...Object.fromEntries(form.sus.items.map((i) => [i.field, Number(a[i.field])])),
    }
    try { await api.post('/survey/', body); setDone(true) } catch (e) {
      setErr(e instanceof ApiError && e.status === 429 ? 'Too many submissions from this network. Try again later.' : (e as Error).message)
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-dvh p-2 md:p-3">
      <div className="mx-auto flex min-h-[calc(100dvh-1rem)] max-w-2xl flex-col rounded-[1.75rem] bg-canvas p-3 md:min-h-[calc(100dvh-1.5rem)] md:rounded-[2.25rem] md:p-6">
        <header className="mb-6 flex items-center justify-between px-1 pt-1">
          <div className="flex items-center gap-2.5">
            <span className="grid size-5 place-items-center rounded-full bg-ink"><span className="size-2 rounded-full bg-white" /></span>
            <span className="text-[15px] font-medium tracking-[-0.03em]">Ledger</span>
          </div>
          {form && !done && <span className="text-xs text-ash tabular">{step + 1} / {steps.length}</span>}
        </header>

        {form && !done && (
          <div className="mb-6 flex gap-1 px-1">
            {steps.map((s, i) => (
              <div key={s} className="h-1 flex-1 overflow-hidden rounded-full bg-fog">
                <motion.div className="h-full rounded-full bg-ink" initial={false} animate={{ width: i <= step ? '100%' : '0%' }} transition={{ duration: 0.5, ease }} />
              </div>
            ))}
          </div>
        )}

        {!form && !err && <div className="h-40 animate-pulse rounded-[1.5rem] bg-white" />}
        {!form && err && <p className="px-1 text-sm text-smoke">{err}</p>}

        <AnimatePresence mode="wait">
          {done ? (
            <motion.div key="done" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-1 flex-col items-center justify-center text-center">
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="mb-5 grid size-14 place-items-center rounded-full bg-ink text-white"><Check size={22} /></motion.span>
              <h1 className="text-2xl font-medium tracking-[-0.03em]">Thank you</h1>
              <p className="mt-2 max-w-xs text-sm text-ash">Your response has been recorded anonymously.</p>
            </motion.div>
          ) : form && (
            <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.4, ease }} className="flex-1 space-y-2.5">
              <h1 className="px-1 pb-2 text-2xl font-medium tracking-[-0.03em]">{steps[step]}</h1>
              {step === 0 && (
                <>
                  <p className="px-1 pb-2 text-sm leading-relaxed text-smoke">{form.intro}</p>
                  {form.demographics.map((d) => (
                    <Block key={d.id} code={d.code} label={d.label}>
                      <Choice options={d.options} value={a[d.id]} onChange={set(d.id)} />
                      {d.other_field && a[d.id] === 'other' && <Field label="Please specify" className="mt-2" value={String(a[d.other_field] ?? '')} onChange={(e) => set(d.other_field!)(e.target.value)} />}
                    </Block>
                  ))}
                </>
              )}
              {step === 1 && form.tasks.map((t) => (
                <Block key={t.id} code={t.id} label={t.text}>
                  <Choice options={form.task_outcomes} value={tasks[t.id]} onChange={(v) => setTasks((s) => ({ ...s, [t.id]: v }))} />
                </Block>
              ))}
              {step === 2 && (
                <>
                  <p className="px-1 pb-2 text-sm text-smoke">{form.sus.instructions}</p>
                  {form.sus.items.map((i) => (
                    <Block key={i.field} code={String(i.item)} label={i.text}>
                      <div className="grid grid-cols-5 gap-1">
                        {form.sus.scale.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => set(i.field)(s.value)}
                            className={cn('flex h-14 flex-col items-center justify-center rounded-[1rem] transition-colors', Number(a[i.field]) === s.value ? 'bg-ink text-white' : 'bg-white hover:bg-fog')}
                          >
                            <span className="text-sm font-medium">{s.value}</span>
                            <span className={cn('hidden text-[9px] sm:block', Number(a[i.field]) === s.value ? 'text-white/60' : 'text-ash')}>{s.label}</span>
                          </button>
                        ))}
                      </div>
                    </Block>
                  ))}
                  <p className="px-1 text-[11px] text-ash">1 = {form.sus.scale[0]?.label} · 5 = {form.sus.scale[form.sus.scale.length - 1]?.label}. {form.sus.source}</p>
                </>
              )}
              {step === 3 && (
                <>
                  <Block code={form.adjective.code} label={form.adjective.label}><Choice options={form.adjective.options} value={a.adjective} onChange={set('adjective')} /></Block>
                  <Block code={form.comparison.code} label={form.comparison.label}><Choice options={form.comparison.options} value={a.comparison} onChange={set('comparison')} /></Block>
                  {form.open_questions.map((q) => (
                    <Block key={q.id} code={q.code} label={q.label}>
                      <textarea
                        value={String(a[q.id] ?? '')}
                        maxLength={q.max_length}
                        onChange={(e) => set(q.id)(e.target.value)}
                        rows={3}
                        placeholder="Optional"
                        className="w-full resize-none rounded-[0.9rem] bg-white px-4 py-3 text-sm placeholder:text-ash"
                      />
                    </Block>
                  ))}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {form && !done && (
          <div className="sticky bottom-3 mt-6 flex items-center justify-between gap-2 rounded-full bg-canvas/90 p-1 backdrop-blur-sm">
            <Button tone="paper" beam={false} disabled={step === 0} onClick={() => setStep((s) => s - 1)}><ArrowLeft size={15} /> Back</Button>
            {err && <p className="flex-1 text-center text-xs text-smoke">{err}</p>}
            {step < steps.length - 1
              ? <Button disabled={!valid} onClick={() => { setStep((s) => s + 1); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Next <ArrowRight size={15} /></Button>
              : <Button disabled={!valid || busy} onClick={submit}>{busy ? 'Sending…' : 'Submit'} <Check size={15} /></Button>}
          </div>
        )}
      </div>
    </div>
  )
}
