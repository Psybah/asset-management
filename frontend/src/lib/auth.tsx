import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { ApiError, api, token } from './api'
import type { User } from './types'

interface AuthState {
  user: User | null
  ready: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  canWrite: boolean
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!token.get()) { setReady(true); return }
    // Only a 401 means the session is gone; a network error means the free server is
    // still waking up, so keep the session and retry for up to ~75 s.
    let cancelled = false
    const started = Date.now()
    const check = (): Promise<void> => api.get<User>('/auth/me/').then((u) => { if (!cancelled) setUser(u) }).catch((e) => {
      if (e instanceof TypeError && Date.now() - started < 75_000 && !cancelled) return new Promise<void>((r) => setTimeout(r, 4000)).then(check)
      if (e instanceof ApiError && e.status === 401) token.set(null)
    })
    check().finally(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/auth/login/', { username, password })
    token.set(res.token)
    setUser(res.user)
  }, [])

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout/') } catch { /* already gone */ }
    token.set(null)
    setUser(null)
  }, [])

  return (
    <Ctx.Provider value={{ user, ready, login, logout, canWrite: !!user && user.role !== 'staff' }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside provider')
  return v
}
