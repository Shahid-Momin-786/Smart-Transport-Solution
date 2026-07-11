import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api, { setAuthToken, clearAuthToken } from '@/services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const initialize = useCallback(async () => {
    const token = localStorage.getItem('access_token')
    const stored = localStorage.getItem('user')
    if (token && stored) {
      setAuthToken(token)
      setUser(JSON.parse(stored))
      try {
        const res = await api.get('/auth/me/')
        setUser(res.data)
        localStorage.setItem('user', JSON.stringify(res.data))
      } catch {
        clearAuth()
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    initialize()
  }, [initialize])

  const login = async (email, password) => {
    const res = await api.post('/auth/login/', { email, password })
    const { access, refresh, user: userData } = res.data
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
    localStorage.setItem('user', JSON.stringify(userData))
    setAuthToken(access)
    setUser(userData)
    return userData
  }

  const logout = async () => {
    try {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) await api.post('/auth/logout/', { refresh })
    } catch {}
    clearAuth()
  }

  const clearAuth = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    clearAuthToken()
    setUser(null)
  }

  const updateUser = (data) => {
    const updated = { ...user, ...data }
    setUser(updated)
    localStorage.setItem('user', JSON.stringify(updated))
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
