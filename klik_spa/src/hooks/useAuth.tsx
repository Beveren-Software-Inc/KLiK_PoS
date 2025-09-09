import type React from "react"
import { useState, useEffect, createContext, useContext } from "react"
import erpnextAPI from "../services/erpnext-api"

interface User {
  name: string
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
  checkSession: () => Promise<boolean>
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

    // console.log("Auth check:", {
    //   hasToken: !!token,
    //   hasUserData: !!userData,
    //   token,
    //   userData: userData ? JSON.parse(userData) : "missing"
    // })

    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData)

        // First, set the user from cached data to avoid login redirect
        setUser(parsedUser)

        // Then try to refresh user data from server in the background
        const refreshUserData = async () => {
          try {
            // First validate the session
            const isSessionValid = await erpnextAPI.validateSession()
            if (!isSessionValid) {
              console.warn("Session is invalid, clearing auth data")
              localStorage.removeItem("erpnext_token")
              localStorage.removeItem("user_data")
              localStorage.removeItem("erpnext_sid")
              setUser(null)
              return
            }

            const freshUserData = await erpnextAPI.getCurrentUserProfile()
            if (freshUserData) {
              const updatedUser = {
                name: freshUserData.name || parsedUser.name,
                email: freshUserData.email || freshUserData.name || parsedUser.email,
                full_name: freshUserData.full_name || freshUserData.first_name + ' ' + (freshUserData.last_name || '') || parsedUser.full_name,
                role: freshUserData.role_profile_name || freshUserData.role || parsedUser.role || "User",
                first_name: freshUserData.first_name,
                last_name: freshUserData.last_name,
                user_image: freshUserData.user_image
              }

              setUser(updatedUser)
              localStorage.setItem("user_data", JSON.stringify(updatedUser))
            }
          } catch (error) {
            console.warn("Failed to refresh user data, using cached data:", error)
            // Don't clear the user data if refresh fails - keep using cached data
          }
        }

        // Run refresh in background without blocking authentication
        refreshUserData()
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
    localStorage.removeItem("erpnext_sid")
  }

  // Method to check if session is still valid
  const checkSession = async () => {
    if (!user) return false

    try {
      const isValid = await erpnextAPI.validateSession()
      if (!isValid) {
        console.log("Session expired, logging out")
        await logout()
        return false
      }
      return true
    } catch (error) {
      console.error("Session check failed:", error)
      return false
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        checkSession,
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
