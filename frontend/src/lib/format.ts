const ngn = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 })

export const naira = (n: number | null | undefined) => `₦${ngn.format(Math.round(Number(n ?? 0)))}`

export function compact(n: number | null | undefined) {
  const v = Number(n ?? 0)
  const abs = Math.abs(v)
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1).replace(/\.0$/, '')}b`
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1).replace(/\.0$/, '')}m`
  if (abs >= 1e3) return `${(v / 1e3).toFixed(0)}k`
  return String(Math.round(v))
}

export const date = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export const shortDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'

export function ago(s: string) {
  const diff = (Date.now() - new Date(s).getTime()) / 1000
  const units: [number, string][] = [[31536000, 'y'], [2592000, 'mo'], [604800, 'w'], [86400, 'd'], [3600, 'h'], [60, 'm']]
  for (const [sec, u] of units) if (Math.abs(diff) >= sec) return `${Math.floor(diff / sec)}${u}`
  return 'now'
}

export const today = () => new Date().toISOString().slice(0, 10)

export const label = (s: string) => s.replace(/_/g, ' ')
