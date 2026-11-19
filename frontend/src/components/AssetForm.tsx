import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { today } from '../lib/format'
import type { Asset, Category, Department, Location } from '../lib/types'
import { invalidate, useData } from '../lib/useData'
import { Sheet } from './Sheet'
import { useToast } from './Toast'
import { Button, Field, Input, Select } from './ui'

const blank = {
  name: '', category: '', serial_number: '', vendor: '', purchase_date: today(), purchase_cost: '',
  salvage_value: '0', depreciation_method: 'straight_line', useful_life_years: '', location: '', department: '',
  condition: 'new', notes: '',
}

type FormState = typeof blank

export function AssetForm({ open, onClose, asset, onSaved }: { open: boolean; onClose: () => void; asset?: Asset; onSaved?: (a: Asset) => void }) {
  const { data: cats } = useData<Category[]>(open ? '/categories/' : null)
  const { data: locs } = useData<Location[]>(open ? '/locations/' : null)
  const { data: deps } = useData<Department[]>(open ? '/departments/' : null)
  const [f, setF] = useState<FormState>(blank)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const toast = useToast()

  useEffect(() => {
    if (!open) return
    setErr('')
    setF(asset ? {
      name: asset.name, category: String(asset.category), serial_number: asset.serial_number, vendor: asset.vendor,
      purchase_date: asset.purchase_date, purchase_cost: String(asset.purchase_cost), salvage_value: String(asset.salvage_value),
      depreciation_method: asset.depreciation_method, useful_life_years: String(asset.useful_life_years),
      location: asset.location ? String(asset.location) : '', department: asset.department ? String(asset.department) : '',
      condition: asset.condition, notes: asset.notes,
    } : blank)
  }, [open, asset])

  const set = (k: keyof FormState) => (e: { target: { value: string } }) => {
    const v = e.target.value
    setF((s) => {
      const next = { ...s, [k]: v }
      // Default useful life from category
      if (k === 'category' && !s.useful_life_years) {
        const c = cats?.find((x) => String(x.id) === v)
        if (c) next.useful_life_years = String(c.useful_life_years)
      }
      return next
    })
  }

  const save = async () => {
    setBusy(true); setErr('')
    const body = {
      ...f,
      category: Number(f.category),
      purchase_cost: Number(f.purchase_cost || 0),
      salvage_value: Number(f.salvage_value || 0),
      useful_life_years: Number(f.useful_life_years || 1),
      location: f.location ? Number(f.location) : null,
      department: f.department ? Number(f.department) : null,
    }
    try {
      const a = asset ? await api.patch<Asset>(`/assets/${asset.id}/`, body) : await api.post<Asset>('/assets/', body)
      invalidate()
      toast(asset ? 'Saved' : `${a.tag} added`)
      onSaved?.(a)
      onClose()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} onClose={onClose} title={asset ? 'Edit' : 'New asset'}>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4">
        <Field label="Name" className="col-span-2"><Input value={f.name} onChange={set('name')} placeholder="MacBook Air 13" /></Field>
        <Field label="Kind" className="col-span-2">
          <Select value={f.category} onChange={set('category')}>
            <option value="">—</option>
            {cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Serial"><Input value={f.serial_number} onChange={set('serial_number')} /></Field>
        <Field label="Vendor"><Input value={f.vendor} onChange={set('vendor')} /></Field>
        <Field label="Bought"><Input type="date" value={f.purchase_date} onChange={set('purchase_date')} /></Field>
        <Field label="Cost ₦"><Input inputMode="numeric" value={f.purchase_cost} onChange={set('purchase_cost')} /></Field>
        <Field label="Salvage ₦"><Input inputMode="numeric" value={f.salvage_value} onChange={set('salvage_value')} /></Field>
        <Field label="Life (yrs)"><Input inputMode="numeric" value={f.useful_life_years} onChange={set('useful_life_years')} /></Field>
        <Field label="Method" className="col-span-2">
          <Select value={f.depreciation_method} onChange={set('depreciation_method')}>
            <option value="straight_line">Straight line</option>
            <option value="declining_balance">Declining balance</option>
          </Select>
        </Field>
        <Field label="Location">
          <Select value={f.location} onChange={set('location')}>
            <option value="">—</option>
            {locs?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Department">
          <Select value={f.department} onChange={set('department')}>
            <option value="">—</option>
            {deps?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Condition" className="col-span-2">
          <Select value={f.condition} onChange={set('condition')}>
            {['new', 'good', 'fair', 'poor'].map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Notes" className="col-span-2"><Input value={f.notes} onChange={set('notes')} /></Field>
      </div>
      {err && <p className="mt-5 pl-6 text-sm text-smoke">{err}</p>}
      <Button size="lg" className="mt-8 w-full" disabled={busy || !f.name || !f.category} onClick={save}>{busy ? '…' : 'Save'}</Button>
    </Sheet>
  )
}
