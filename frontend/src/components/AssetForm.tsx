import { ImageSquare, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { api, uploadImage } from '@/lib/api'
import { today } from '@/lib/format'
import type { Asset, Category, Department, Location } from '@/lib/types'
import { invalidate, useData } from '@/lib/useData'
import { Sheet } from './Sheet'
import { useToast } from './Toast'
import { Button, Field, FieldGroup, MoneyField, SelectField } from './ui'

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
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  useEffect(() => {
    if (!open) return
    setErr(''); setFile(null); setPreview(asset?.image_url ?? null)
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
      if (k === 'category' && !s.useful_life_years) {
        const c = cats?.find((x) => String(x.id) === v)
        if (c) next.useful_life_years = String(c.useful_life_years)
      }
      return next
    })
  }

  const pick = (fl: File | undefined) => {
    if (!fl) return
    setFile(fl)
    setPreview(URL.createObjectURL(fl))
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
      let a = asset ? await api.patch<Asset>(`/assets/${asset.id}/`, body) : await api.post<Asset>('/assets/', body)
      if (file) a = await uploadImage(a.id, file)
      invalidate()
      toast(asset ? 'Saved' : `${a.tag} added`)
      onSaved?.(a)
      onClose()
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} onClose={onClose} title={asset ? 'Edit asset' : 'New asset'}>
      {/* Photo */}
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]) }}
        className="group relative mb-3 grid h-40 cursor-pointer place-items-center overflow-hidden rounded-[1.25rem] bg-mist transition-colors hover:bg-fog"
      >
        {preview ? (
          <>
            <img src={preview} alt="" className="size-full object-cover" />
            <button onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null) }} aria-label="Remove photo" className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white/90"><X size={14} /></button>
          </>
        ) : (
          <span className="flex flex-col items-center gap-1.5 text-xs text-ash"><ImageSquare size={22} />Add a photo</span>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>

      <FieldGroup>
        <Field label="Name" value={f.name} onChange={set('name')} />
        <SelectField label="Category" value={f.category} onChange={set('category')}>
          <option value="">Choose…</option>
          {cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
      </FieldGroup>
      <FieldGroup className="mt-3">
        <div className="grid grid-cols-2 gap-0.5">
          <Field label="Serial number" value={f.serial_number} onChange={set('serial_number')} />
          <Field label="Vendor" value={f.vendor} onChange={set('vendor')} />
        </div>
        <div className="grid grid-cols-2 gap-0.5">
          <Field label="Purchase date" type="date" value={f.purchase_date} onChange={set('purchase_date')} />
          <MoneyField label="Cost (₦)" value={f.purchase_cost} onChange={set('purchase_cost')} />
        </div>
        <div className="grid grid-cols-3 gap-0.5">
          <MoneyField label="Salvage (₦)" value={f.salvage_value} onChange={set('salvage_value')} />
          <Field label="Life (years)" inputMode="numeric" value={f.useful_life_years} onChange={set('useful_life_years')} />
          <SelectField label="Method" value={f.depreciation_method} onChange={set('depreciation_method')}>
            <option value="straight_line">Straight line</option>
            <option value="declining_balance">Declining</option>
          </SelectField>
        </div>
      </FieldGroup>
      <FieldGroup className="mt-3">
        <div className="grid grid-cols-2 gap-0.5">
          <SelectField label="Location" value={f.location} onChange={set('location')}>
            <option value="">—</option>
            {locs?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
          <SelectField label="Department" value={f.department} onChange={set('department')}>
            <option value="">—</option>
            {deps?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
        </div>
        <SelectField label="Condition" value={f.condition} onChange={set('condition')}>
          {['new', 'good', 'fair', 'poor'].map((c) => <option key={c} value={c}>{c}</option>)}
        </SelectField>
        <Field label="Notes" value={f.notes} onChange={set('notes')} />
      </FieldGroup>

      {err && <p className="mt-3 pl-1 text-xs text-smoke">{err}</p>}
      <Button size="lg" className="mt-5 w-full" disabled={busy || !f.name || !f.category} onClick={save}>{busy ? 'Saving…' : 'Save'}</Button>
    </Sheet>
  )
}
