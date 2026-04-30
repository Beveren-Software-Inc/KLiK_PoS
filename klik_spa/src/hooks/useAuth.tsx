import type React from "react"
import { useState, useEffect, createContext, useContext } from "react"
import erpnextAPI from "../services/erpnext-api"
import { usePOSProfileStore } from "../stores/posProfileStore"

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
  login: (
    username: string,
    password: string,
    otp?: string,
    tmpId?: string
  ) => Promise<{
    success: boolean
    message: string
    requires_otp?: boolean
    tmp_id?: string
    verification?: {
      method?: string
      prompt?: string
      setup?: boolean
      token_delivery?: boolean
    }
  }>
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
  const { setAuthenticated, refreshAll, clearCache } = usePOSProfileStore.getState()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return;

    const syncAuthSession = async () => {
      erpnextAPI.initializeSession();

      try {
        const freshUserData = await erpnextAPI.getCurrentUserProfile();

        if (freshUserData && freshUserData.name && freshUserData.name !== "Guest") {
          const updatedUser = {
            name: freshUserData.name,
            email: freshUserData.email || freshUserData.name,
            full_name: freshUserData.full_name || `${freshUserData.first_name || ""} ${freshUserData.last_name || ""}`.trim(),
            role: freshUserData.role_profile_name || freshUserData.role || "User",
            first_name: freshUserData.first_name,
            last_name: freshUserData.last_name,
            user_image: freshUserData.user_image
          };

          setUser(updatedUser);
          localStorage.setItem("erpnext_token", "authenticated");
          localStorage.setItem("user_data", JSON.stringify(updatedUser));
          
          setAuthenticated(true);
          await refreshAll();
        } else {
          setUser(null);
          localStorage.removeItem("erpnext_token");
          localStorage.removeItem("user_data");
          localStorage.removeItem("erpnext_sid");
          
          setAuthenticated(false);
          clearCache();
        }
      } catch (error) {
        console.error("Session sync failed:", error);
        setAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    syncAuthSession();
  }, [mounted, setAuthenticated, refreshAll, clearCache]);

  const login = async (username: string, password: string, otp?: string, tmpId?: string) => {
    try {
      setLoading(true)

      const result = await erpnextAPI.login(username, password, otp, tmpId)

      if (result.requires_otp) {
        return {
          success: false,
          message: result.message,
          requires_otp: true,
          tmp_id: result.tmp_id,
          verification: result.verification,
        }
      }

      if (result.success && result.user) {
        const userData = {
          name: result.user.name || username,
          email: result.user.email || username,
          full_name: result.user.full_name || result.user.name || username,
          role: result.user.role || "User",
        }

        setUser(userData)
        localStorage.setItem("erpnext_token", "authenticated")
        localStorage.setItem("user_data", JSON.stringify(userData))
        
        setAuthenticated(true)
        await refreshAll()

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
    
    setAuthenticated(false)
    clearCache()
  }

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

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}