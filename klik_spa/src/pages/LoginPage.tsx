import type React from "react"
import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import erpnextAPI from "../services/erpnext-api"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("")
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const testConnection = async () => {
    setConnectionStatus("Testing connection...")
    const result = await erpnextAPI.testConnection()
    setConnectionStatus(result.success ? "✅ " + result.message : "❌ " + result.message)
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const result = await login(username, password)

      if (result.success) {
        // Redirect to the intended route or default to /pos
        const from = (location.state as any)?.from?.pathname || "/pos"
        navigate(from, { replace: true })
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError("Login failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-beveren-50 to-beveren-100 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 backdrop-blur-sm bg-white/95">
          {/* Logo Section */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <img src="https://beverensoftware.com/wp-content/uploads/2023/06/cropped-15-1-180x180.png" alt="KLiK PoS" className="w-16 h-16 rounded-full shadow-lg" />
            </div>
            <h1 className="text-3xl font-bold text-beveren-800">KLiK PoS</h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-3">
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-beveren-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-beveren-500 focus:border-transparent transition-all duration-200 bg-beveren-50/50"
                  placeholder="Username or Email"
                  required
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="w-5 h-5 text-beveren-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
              </div>

              <div className="relative">
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-beveren-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-beveren-500 focus:border-transparent transition-all duration-200 bg-beveren-50/50"
                  placeholder="Password"
                  required
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="w-5 h-5 text-beveren-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm text-red-600 font-medium text-center">{error}</p>
              </div>
            )}

            {connectionStatus && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-sm text-blue-600 font-medium text-center">{connectionStatus}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-beveren-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-beveren-700 focus:outline-none focus:ring-4 focus:ring-beveren-300 transition-all duration-300 shadow-lg hover:shadow-xl disabled:bg-beveren-400 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span className="ml-2">Signing In...</span>
                </div>
              ) : (
                "Sign In"
              )}
            </button>

            <button
              type="button"
              onClick={testConnection}
              className="w-full mt-2 bg-gray-500 text-white font-bold py-2 px-4 rounded-xl hover:bg-gray-600 focus:outline-none focus:ring-4 focus:ring-gray-300 transition-all duration-300"
            >
              Test Connection
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-beveren-600">
            Powered by{" "}
            <a href="https://beverensoftware.com" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">
              Beveren Software
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
