import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, token } from './api'
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
    api.get<User>('/auth/me/').then(setUser).catch(() => token.set(null)).finally(() => setReady(true))
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
