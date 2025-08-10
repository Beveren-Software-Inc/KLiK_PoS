import type React from "react"
import { useState, useEffect, createContext, useContext } from "react"
import erpnextAPI from "../services/erpnext-api"

interface User {
  name: string // This is the user ID/email in ERPNext
  email: string
  full_name: string
  role?: string
  first_name?: string
  last_name?: string
  user_image?: string
}

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<{ success: boolean; message: string }>
  logout: () => Promise<void>
  loading: boolean
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    
    // Initialize ERPNext API session
    erpnextAPI.initializeSession()
    
    // Check if user is already logged in
    const token = localStorage.getItem("erpnext_token")
    const userData = localStorage.getItem("user_data")

    console.log("Auth check:", { 
      hasToken: !!token, 
      hasUserData: !!userData,
      token,
      userData: userData ? JSON.parse(userData) : "missing"
    })

    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)
      } catch (error) {
        console.error("Error parsing user data:", error)
        localStorage.removeItem("erpnext_token")
        localStorage.removeItem("user_data")
        localStorage.removeItem("erpnext_sid")
      }
    }
    setLoading(false)
  }, [mounted])

  const login = async (username: string, password: string) => {
    try {
      setLoading(true)
      
      // Use the real ERPNext API
      const result = await erpnextAPI.login(username, password)

      if (result.success && result.user) {
        console.log("Login successful:", result.user)
        const userData = {
          name: result.user.name || username,
          email: result.user.email || username,
          full_name: result.user.full_name || result.user.name || username,
          role: result.user.role || "User",
        }

        setUser(userData)
        localStorage.setItem("erpnext_token", "authenticated")
        localStorage.setItem("user_data", JSON.stringify(userData))

        return { success: true, message: result.message }
      } else {
        return { success: false, message: result.message }
      }
    } catch (error) {
      console.error("Login error:", error)
      return { success: false, message: "Login failed. Please try again." }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    await erpnextAPI.logout()
    setUser(null)
    localStorage.removeItem("erpnext_token")
    localStorage.removeItem("user_data")
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        loading,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
