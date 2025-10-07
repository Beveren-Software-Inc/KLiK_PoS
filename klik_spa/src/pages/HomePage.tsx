import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function HomePage() {
  const navigate = useNavigate()
  const { isAuthenticated, loading } = useAuth()

  useEffect(() => {

    if (!loading) {
      if (isAuthenticated) {
        navigate('/pos', { replace: true })
      } else {
        navigate('/login', { replace: true })
      }
    }
  }, [isAuthenticated, loading, navigate])

  // Show loading spinner while checking authentication
  return (
    <div className="min-h-screen bg-gradient-to-br from-beveren-50 to-beveren-100 flex items-center justify-center">
      <div className="text-center">
        <div className="text-2xl font-bold text-beveren-700 mb-4">KLiK PoS</div>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-beveren-700 mx-auto"></div>
        <p className="text-beveren-600 mt-4">Loading...</p>
      </div>
    </div>
  )
}
