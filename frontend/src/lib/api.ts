// Relative by default: the Vite server proxies /api to Django, so this works on any host.
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api'

const KEY = 'ledger.token'

export const token = {
  get: () => {
    try { return localStorage.getItem(KEY) } catch { return null }
  },
  set: (t: string | null) => {
    try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY) } catch { /* storage unavailable */ }
  },
}

export class ApiError extends Error {
  status: number
  data: unknown
  constructor(status: number, data: unknown) {
    super(firstMessage(data) ?? `Request failed (${status})`)
    this.status = status
    this.data = data
  }
}

function firstMessage(data: unknown): string | undefined {
  if (!data) return
  if (typeof data === 'string') return data
  if (Array.isArray(data)) return firstMessage(data[0])
  if (typeof data === 'object') {
    const d = data as Record<string, unknown>
    if (typeof d.detail === 'string') return d.detail
    const [k, v] = Object.entries(d)[0] ?? []
    const m = firstMessage(v)
    return m && k && k !== 'non_field_errors' ? `${k.replace(/_/g, ' ')}: ${m}` : m
  }
}

type Query = Record<string, string | number | boolean | undefined | null>

export function qs(q?: Query) {
  if (!q) return ''
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const t = token.get()
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Token ${t}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (res.status === 401) {
    token.set(null)
    if (!location.pathname.startsWith('/login')) location.assign('/login')
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  const data = text ? (() => { try { return JSON.parse(text) } catch { return text } })() : undefined
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}

export const api = {
  get: <T>(path: string, q?: Query) => request<T>('GET', path + qs(q)),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: (path: string) => request<void>('DELETE', path),
}

/** Multipart upload of an asset photo. */
export async function uploadImage<T = import('./types').Asset>(id: number, file: File): Promise<T> {
  const fd = new FormData()
  fd.append('image', file)
  const t = token.get()
  const res = await fetch(`${API_URL}/assets/${id}/image/`, { method: 'POST', headers: t ? { Authorization: `Token ${t}` } : {}, body: fd })
  const data = await res.json().catch(() => undefined)
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}

/** QR codes are drawn in the browser so they always point at the address the app is open on. */
declare const __LAN_ORIGIN__: string
const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
export const publicOrigin = isLocal && __LAN_ORIGIN__ ? __LAN_ORIGIN__ : location.origin
export const scanUrl = (tag: string) => `${publicOrigin}/scan/${encodeURIComponent(tag)}`
export const csvUrl = (q?: Query) => `${API_URL}/reports/assets.csv${qs({ ...q, token: token.get() })}`
