import { AddressBookTabs, ArrowLeft, ArrowRight, Check } from '@phosphor-icons/react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button, Field, SelectField, ease } from '@/components/ui'
import { ApiError, api } from '@/lib/api'
import { cn } from '@/lib/utils'

type Opt = { value: string; label: string }
type Demographic = { id: string; code: string; label: string; options: Opt[]; other_field: string | null; allow_other: boolean; required: boolean }
type Form = {
  title: string
  intro: string
  demographics: Demographic[]
  tasks: { id: string; text: string }[]
  task_outcomes: Opt[]
  sus: { instructions: string; source: string; scale: { value: number; label: string }[]; items: { item: number; field: string; text: string }[] }
  adjective: { id: string; code: string; label: string; options: Opt[]; required: boolean }
  comparison: { id: string; code: string; label: string; options: Opt[]; required: boolean }
  open_questions: { id: string; code: string; label: string; required: boolean; max_length: number }[]
}
type Answers = Record<string, string | number | undefined>

/* ---------------- controls: each question gets the control that suits it ---------------- */

/** Vertical radio list — for options with long labels. */
function RadioList({ options, value, onChange }: { options: Opt[]; value?: string | number; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" className="stack [border-radius:0.9rem]">
      {options.map((o) => {
        const on = String(value) === o.value
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={cn('flex items-center gap-3 px-3.5 py-3 text-left text-sm transition-colors', on ? 'bg-white' : 'bg-white/60 hover:bg-white')}>
            <span className={cn('grid size-[18px] shrink-0 place-items-center rounded-full transition-colors', on ? 'bg-ink' : 'bg-fog')}>
              {on && <span className="size-1.5 rounded-full bg-white" />}
            </span>
            <span className={on ? 'text-ink' : 'text-smoke'}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Compact segmented choice — for a few short options. */
function Seg({ options, value, onChange }: { options: Opt[]; value?: string | number; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" className="inline-flex max-w-full flex-wrap gap-0.5 rounded-[1rem] bg-white p-1">
      {options.map((o) => {
        const on = String(value) === o.value
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className={cn('rounded-[0.75rem] px-3 py-1.5 text-xs font-medium transition-colors', on ? 'bg-ink text-white' : 'text-smoke hover:bg-mist hover:text-ink')}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** 1–5 agreement scale as radio dots. */
function Scale({ value, onChange, labels }: { value?: string | number; onChange: (v: number) => void; labels: { value: number; label: string }[] }) {
  return (
    <div role="radiogroup" className="flex shrink-0 gap-1">
      {labels.map((s) => {
        const on = Number(value) === s.value
        return (
          <button key={s.value} type="button" role="radio" aria-checked={on} aria-label={s.label} title={s.label} onClick={() => onChange(s.value)}
            className={cn('grid size-9 place-items-center rounded-full text-xs font-medium tabular transition-colors', on ? 'bg-ink text-white' : 'bg-white text-smoke hover:bg-fog hover:text-ink')}>
            {s.value}
          </button>
        )
      })}
    </div>
  )
}

/** A grouped card of related questions. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[1.5rem] bg-white p-2">
      <h2 className="px-2.5 pb-2 pt-1.5 text-[13px] font-medium text-smoke">{title}</h2>
      <div className="stack [border-radius:1.1rem]">{children}</div>
    </section>
  )
}

/** One question row inside a group. `inline` puts the control beside the label on wide screens. */
function Q({ code, label, children, inline }: { code?: string; label: string; children: ReactNode; inline?: boolean }) {
  return (
    <div className={cn('bg-mist p-3', inline && 'sm:flex sm:items-center sm:justify-between sm:gap-4')}>
      <p className={cn('text-sm leading-snug', inline ? 'mb-2 sm:mb-0' : 'mb-2.5')}>
        {code && <span className="mr-2 text-[11px] text-ash tabular">{code}</span>}{label}
      </p>
      {children}
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

  useEffect(() => { document.title = 'Usability survey · Ledger' }, [])
  useEffect(() => { api.get<Form>('/survey/form/').then(setForm).catch(() => setErr('Could not load the survey. Is the server running?')) }, [])
  const set = (k: string) => (v: string | number) => setA((s) => ({ ...s, [k]: v }))
  const dm = (id: string) => form?.demographics.find((d) => d.id === id)

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

  /** Renders a demographic question with the control that fits it. */
  const demo = (id: string, kind: 'select' | 'radio' | 'seg', inline = false) => {
    const d = dm(id)
    if (!d) return null
    const other = d.other_field && a[d.id] === 'other'
    return (
      <Q key={d.id} code={d.code} label={d.label} inline={inline && !other}>
        {kind === 'select' && (
          <SelectField label="Choose one" value={String(a[d.id] ?? '')} onChange={(e) => set(d.id)(e.target.value)} className="bg-white [&_[data-slot=select-trigger]]:bg-white">
            <option value="">Select…</option>
            {d.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </SelectField>
        )}
        {kind === 'radio' && <RadioList options={d.options} value={a[d.id]} onChange={set(d.id)} />}
        {kind === 'seg' && <Seg options={d.options} value={a[d.id]} onChange={set(d.id)} />}
        {other && <Field label="Please specify" className="mt-2 [&_input]:bg-white" value={String(a[d.other_field!] ?? '')} onChange={(e) => set(d.other_field!)(e.target.value)} />}
      </Q>
    )
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto flex min-h-dvh max-w-2xl flex-col p-3 md:p-6">
        <header className="mb-6 flex items-center justify-between px-1 pt-1">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-ink text-white"><AddressBookTabs size={17} weight="fill" /></span>
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
            <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.4, ease }} className="flex-1 space-y-2">
              <h1 className="px-1 pb-2 text-2xl font-medium tracking-[-0.03em]">{steps[step]}</h1>

              {step === 0 && (
                <>
                  <Group title="Your work">
                    {demo('department', 'select')}
                    {demo('role', 'radio')}
                  </Group>
                  <Group title="Background">
                    {demo('age_group', 'select')}
                    {demo('computer_use', 'seg')}
                    {demo('prior_software', 'seg', true)}
                    {demo('current_method', 'radio')}
                  </Group>
                  <Group title="This session">
                    {demo('device', 'seg', true)}
                  </Group>
                </>
              )}

              {step === 1 && (
                <Group title="How did each task go?">
                  {form.tasks.map((t) => (
                    <Q key={t.id} code={t.id} label={t.text}>
                      <Seg options={form.task_outcomes} value={tasks[t.id]} onChange={(v) => setTasks((s) => ({ ...s, [t.id]: v }))} />
                    </Q>
                  ))}
                </Group>
              )}

              {step === 2 && (
                <Group title="How much do you agree?">
                  <div className="flex items-center justify-between bg-mist px-3 py-2 text-[11px] text-ash">
                    <span>{form.sus.scale[0]?.value} = {form.sus.scale[0]?.label}</span>
                    <span>{form.sus.scale[form.sus.scale.length - 1]?.value} = {form.sus.scale[form.sus.scale.length - 1]?.label}</span>
                  </div>
                  {form.sus.items.map((i) => (
                    <div key={i.field} className="flex flex-col gap-2.5 bg-mist p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <p className="text-sm leading-snug"><span className="mr-2 text-[11px] text-ash tabular">{i.item}</span>{i.text}</p>
                      <Scale value={a[i.field]} onChange={set(i.field)} labels={form.sus.scale} />
                    </div>
                  ))}
                </Group>
              )}

              {step === 3 && (
                <>
                  <Group title="Overall">
                    <Q code={form.adjective.code} label={form.adjective.label}>
                      <SelectField label="Rating" value={String(a.adjective ?? '')} onChange={(e) => set('adjective')(e.target.value)} className="[&_[data-slot=select-trigger]]:bg-white">
                        <option value="">Select…</option>
                        {form.adjective.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </SelectField>
                    </Q>
                    <Q code={form.comparison.code} label={form.comparison.label}>
                      <Seg options={form.comparison.options} value={a.comparison} onChange={set('comparison')} />
                    </Q>
                  </Group>
                  <Group title="Comments (optional)">
                    {form.open_questions.map((q) => (
                      <Q key={q.id} code={q.code} label={q.label}>
                        <textarea
                          value={String(a[q.id] ?? '')}
                          maxLength={q.max_length}
                          onChange={(e) => set(q.id)(e.target.value)}
                          rows={3}
                          className="w-full resize-none rounded-[0.9rem] bg-white px-4 py-3 text-sm placeholder:text-ash"
                        />
                      </Q>
                    ))}
                  </Group>
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
