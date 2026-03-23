
interface CurrentUser {
  name?: string;
  email?: string;
  full_name: string;
  role: string;
  user_image?: string;
}

import { useState, useEffect } from 'react'
import { useI18n } from "../hooks/useI18n"
import { usePOSOpeningStatus } from '../hooks/usePOSOpeningEntry'
import RetailPOSLayout from "../components/RetailPOSLayout"
import POSOpeningModal from '../components/PosOpeningEntryDialog'
import erpnextAPI from '../services/erpnext-api'
import { loadCachedItemsToCart, hasCachedDraftInvoiceItems } from '../utils/draftInvoiceCache'

export default function MainPOSScreen() {
  const { isRTL, tl } = useI18n()
  const [showOpeningModal, setShowOpeningModal] = useState(false)
  const [posReady, setPosReady] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [userError, setUserError] = useState<string | null>(null)
  const [cacheLoaded, setCacheLoaded] = useState(false)


  // Check POS opening status
  const {
    hasOpenEntry,
    isLoading: statusLoading,
    error: statusError,
    refetch
  } = usePOSOpeningStatus()

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        setUserLoading(true)
        setUserError(null)

        erpnextAPI.initializeSession()

        const userProfile = await erpnextAPI.getCurrentUserProfile()

        if (userProfile) {
          setCurrentUser({
            name: userProfile.name,
            email: userProfile.email || userProfile.name,
            full_name: userProfile.full_name || userProfile.first_name + ' ' + (userProfile.last_name || ''),
            role: userProfile.role_profile_name || tl('Guest User'),
            user_image: userProfile.user_image
          })
        } else {
          // Fallback to basic user info
          const basicUser = await erpnextAPI.getCurrentUser()
          if (basicUser) {
            setCurrentUser({
              name: basicUser as string,
              email: basicUser as string,
              full_name: basicUser as string,
              role: tl('Guest User')
            })
          } else {
            // No user found, might need to login
            setUserError(tl('No user session found'))
          }
        }
      } catch (error) {
        console.error('Error fetching current user:', error)
        setUserError((error as Error).message || tl('Failed to fetch user'))
      } finally {
        setUserLoading(false)
      }
    }

    fetchCurrentUser()
  }, [tl])

  // Load cached draft invoice items when POS becomes ready
  useEffect(() => {
    if (posReady && !cacheLoaded) {
      // Add a small delay to ensure everything is loaded
      setTimeout(async () => {
        const hasCached = hasCachedDraftInvoiceItems();

        if (hasCached) {
          console.log('Loading cached draft invoice items to cart');
          await loadCachedItemsToCart();

        }

        // Mark cache as loaded to prevent multiple executions
        setCacheLoaded(true);
      }, 1000); // 1 second delay
    }
  }, [posReady, cacheLoaded]);

  // Check opening entry status when component mounts
  // Note: The POSOpeningEntryGuard handles showing the modal and blocking access
  // This just sets posReady state for this component
  useEffect(() => {
    if (!statusLoading && !statusError) {
      if (hasOpenEntry === true) {
        setPosReady(true)
        setShowOpeningModal(false)
      } else if (hasOpenEntry === false) {
        // Guard will handle showing modal and blocking access
        setPosReady(false)
        setShowOpeningModal(false)
      }
    } else if (statusError) {
      console.error('Error checking POS opening status:', statusError)
      // Guard will handle showing modal and blocking access
      setPosReady(false)
      setShowOpeningModal(false)
    }
  }, [hasOpenEntry, statusLoading, statusError])

  // Handle successful opening entry creation
  const handleOpeningSuccess = () => {
    setShowOpeningModal(false)
    setPosReady(true)
    // Reset cache loaded flag when opening new POS session
    setCacheLoaded(false)
    refetch()
  }

  const handleOpeningClose = () => {
    setShowOpeningModal(false)
  }

  // Show loading screen while checking status
  if (statusLoading || userLoading) {
    return (
      <div className={`min-h-screen bg-gray-50 ${isRTL ? "rtl" : "ltr"} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{tl("Initializing POS")}</h2>
          <p className="text-gray-600">{tl("Checking your POS session status...")}</p>
        </div>
      </div>
    )
  }

  if (userError) {
    return (
      <div className={`min-h-screen bg-gray-50 ${isRTL ? "rtl" : "ltr"} flex items-center justify-center`}>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">{tl("Error")}</h2>
          <p className="text-gray-600">{tl(userError)}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${isRTL ? "rtl" : "ltr"} pb-12`}>

      {/* Show POS Layout only when ready */}
      {posReady && <RetailPOSLayout />}

      {/* Show a placeholder or message when POS is not ready */}
      {!posReady && !showOpeningModal && (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{tl("POS Not Ready")}</h2>
            <p className="text-gray-600 mb-4">{tl("Please start a POS session to continue.")}</p>
            <button
              onClick={() => setShowOpeningModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {tl("Start POS Session")}
            </button>
          </div>
        </div>
      )}

      {/* POS Opening Modal */}
      <POSOpeningModal
        isOpen={showOpeningModal}
        onClose={handleOpeningClose}
        onSuccess={handleOpeningSuccess}
        currentUser={currentUser?.name || tl("Guest User")}
      />
    </div>
  )
}
