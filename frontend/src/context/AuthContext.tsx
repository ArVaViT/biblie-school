import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react"
import type { User } from "@/types"
import { authService } from "@/services/auth"

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (email: string, password: string, fullName: string, role: "teacher" | "student") => Promise<User>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    if (!authService.isAuthenticated()) {
      setUser(null)
      return
    }
    try {
      const currentUser = await authService.getCurrentUser()
      setUser(currentUser)
    } catch {
      authService.logout()
      setUser(null)
    }
  }, [])

  useEffect(() => {
    refreshUser().finally(() => setLoading(false))
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const response = await authService.login(email, password)
    setUser(response.user)
    return response.user
  }, [])

  const register = useCallback(
    async (email: string, password: string, fullName: string, role: "teacher" | "student"): Promise<User> => {
      const response = await authService.register(email, password, fullName, role)
      setUser(response.user)
      return response.user
    },
    [],
  )

  const logout = useCallback(() => {
    authService.logout()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
