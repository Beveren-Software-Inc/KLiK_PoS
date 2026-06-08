interface CurrentUser {
  name?: string;
  email?: string;
  full_name: string;
  role: string;
  user_image?: string;
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { useI18n } from "../hooks/useI18n"
import { usePOSOpeningStatus } from '../hooks/usePOSOpeningEntry'
import RetailPOSLayout from "../components/RetailPOSLayout"
import POSOpeningModal from '../components/PosOpeningEntryDialog'
import erpnextAPI from '../services/erpnext-api'
import { loadCachedItemsToCart, hasCachedDraftInvoiceItems } from '../utils/draftInvoiceCache'
import { usePOSProfileStore } from '../stores/posProfileStore'

export default function MainPOSScreen() {
  const { isRTL } = useI18n()
  const [showOpeningModal, setShowOpeningModal] = useState(false)
  const [posReady, setPosReady] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [userError, setUserError] = useState<string | null>(null)
  const [cacheLoaded, setCacheLoaded] = useState(false)
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)

  const { refreshAll, isAuthenticated, setAuthenticated } = usePOSProfileStore()

  const {
    hasOpenEntry,
    isLoading: statusLoading,
    error: statusError,
    refetch
  } = usePOSOpeningStatus()

  const silentRefresh = useCallback(async () => {
    if (!isMountedRef.current) return
    try {
      await refreshAll()
      await refetch()
    } catch (error) {
      console.error('MainPOSScreen silent refresh failed:', error)
    }
  }, [refreshAll, refetch])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && posReady && isAuthenticated && isMountedRef.current) {
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current)
        }
        refreshTimeoutRef.current = setTimeout(() => {
          silentRefresh()
        }, 500)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [posReady, silentRefresh, isAuthenticated])

  useEffect(() => {
    const handleFocus = () => {
      if (posReady && isAuthenticated && isMountedRef.current) {
        if (refreshTimeoutRef.current) {
          clearTimeout(refreshTimeoutRef.current)
        }
        refreshTimeoutRef.current = setTimeout(() => {
          silentRefresh()
        }, 500)
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [posReady, silentRefresh, isAuthenticated])

  useEffect(() => {
    const handleOnline = () => {
      if (isAuthenticated && posReady && isMountedRef.current) {
        silentRefresh()
      }
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [silentRefresh, isAuthenticated, posReady])

  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!isMountedRef.current) return
      try {
        setUserLoading(true)
        setUserError(null)

        erpnextAPI.initializeSession()

        const userProfile = await erpnextAPI.getCurrentUserProfile()

        if (!isMountedRef.current) return

        if (userProfile) {
          setCurrentUser({
            name: userProfile.name,
            email: userProfile.email || userProfile.name,
            full_name: userProfile.full_name || userProfile.first_name + ' ' + (userProfile.last_name || ''),
            role: userProfile.role_profile_name || 'User',
            user_image: userProfile.user_image
          })
          setAuthenticated(true)
        } else {
          const basicUser = await erpnextAPI.getCurrentUser()
          if (!isMountedRef.current) return
          if (basicUser) {
            setCurrentUser({
              name: basicUser as string,
              email: basicUser as string,
              full_name: basicUser as string,
              role: 'User'
            })
            setAuthenticated(true)
          } else {
            setUserError('No user session found')
            setAuthenticated(false)
          }
        }
      } catch (error) {
        if (!isMountedRef.current) return
        console.error('Error fetching current user:', error)
        setUserError((error as Error).message || 'Failed to fetch user')
        setAuthenticated(false)
      } finally {
        if (isMountedRef.current) {
          setUserLoading(false)
        }
      }
    }

    fetchCurrentUser()
  }, [setAuthenticated])

  useEffect(() => {
    if (posReady && !cacheLoaded && isMountedRef.current) {
      setTimeout(async () => {
        if (!isMountedRef.current) return
        const hasCached = hasCachedDraftInvoiceItems()
        if (hasCached) {
          await loadCachedItemsToCart()
        }
        if (isMountedRef.current) {
          setCacheLoaded(true)
        }
      }, 1000)
    }
  }, [posReady, cacheLoaded])

  useEffect(() => {
    if (!statusLoading && !statusError && isMountedRef.current) {
      if (hasOpenEntry === true) {
        setPosReady(true)
        setShowOpeningModal(false)
      } else if (hasOpenEntry === false) {
        setPosReady(false)
        setShowOpeningModal(false)
      }
    } else if (statusError && isMountedRef.current) {
      console.error('Error checking POS opening status:', statusError)
      setPosReady(false)
      setShowOpeningModal(false)
    }
  }, [hasOpenEntry, statusLoading, statusError])

  const handleOpeningSuccess = () => {
    setShowOpeningModal(false)
    setPosReady(true)
    setCacheLoaded(false)
    refetch()
    silentRefresh()
  }

  const handleOpeningClose = () => {
    setShowOpeningModal(false)
  }

  if ((statusLoading || userLoading) && !posReady) {
    return (
      <div className={`min-h-screen bg-gray-50 ${isRTL ? "rtl" : "ltr"} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Initializing POS</h2>
          <p className="text-gray-600">Checking your POS session status...</p>
        </div>
      </div>
    )
  }

  if (userError) {
    return (
      <div className={`min-h-screen bg-gray-50 ${isRTL ? "rtl" : "ltr"} flex items-center justify-center`}>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600">{userError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${isRTL ? "rtl" : "ltr"} pb-12`}>
      {posReady && <RetailPOSLayout />}

      {!posReady && !showOpeningModal && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">POS Not Ready</h2>
            <p className="text-gray-600 mb-4">Please start a POS session to continue.</p>
            <button
              onClick={() => setShowOpeningModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Start POS Session
            </button>
          </div>
        </div>
      )}

      <POSOpeningModal
        isOpen={showOpeningModal}
        onClose={handleOpeningClose}
        onSuccess={handleOpeningSuccess}
        currentUser={currentUser?.name || 'Unknown User'}
      />
    </div>
  )
}