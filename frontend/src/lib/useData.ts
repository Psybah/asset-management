import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'

type Query = Record<string, string | number | boolean | undefined | null>

// Tiny SWR-style cache so navigating back feels instant.
const cache = new Map<string, unknown>()
const listeners = new Set<() => void>()

export function invalidate() {
  cache.clear()
  listeners.forEach((l) => l())
}

export function useData<T>(path: string | null, q?: Query) {
  const key = path ? path + JSON.stringify(q ?? {}) : null
  const [data, setData] = useState<T | undefined>(() => (key ? (cache.get(key) as T) : undefined))
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(!data)
  const keyRef = useRef(key)
  keyRef.current = key

  const load = useCallback(() => {
    if (!path || !key) return
    setLoading(true)
    api.get<T>(path, q)
      .then((d) => {
        cache.set(key, d)
        if (keyRef.current === key) { setData(d); setError(null) }
      })
      .catch((e) => keyRef.current === key && setError(e))
      .finally(() => keyRef.current === key && setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    if (key && cache.has(key)) setData(cache.get(key) as T)
    load()
  }, [key, load])

  useEffect(() => {
    listeners.add(load)
    return () => { listeners.delete(load) }
  }, [load])

  return { data, error, loading, reload: load }
}
