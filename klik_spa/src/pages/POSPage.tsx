

import { useState, useEffect } from 'react'
import { useI18n } from "../hooks/useI18n"
import { usePOSOpeningStatus } from '../hooks/usePOSOpeningEntry'
import RetailPOSLayout from "../components/RetailPOSLayout"
import POSOpeningModal from '../components/PosOpeningEntryDialog'
import erpnextAPI from '../services/erpnext-api'

export default function MainPOSScreen() {
  const { isRTL } = useI18n()
  const [showOpeningModal, setShowOpeningModal] = useState(false)
  const [posReady, setPosReady] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [userLoading, setUserLoading] = useState(true)
  const [userError, setUserError] = useState(null)



  
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
            role: userProfile.role_profile_name || 'User',
            user_image: userProfile.user_image
          })
        } else {
          // Fallback to basic user info
          const basicUser = await erpnextAPI.getCurrentUser()
          if (basicUser) {
            setCurrentUser({
              name: basicUser,
              email: basicUser,
              full_name: basicUser,
              role: 'User'
            })
          } else {
            // No user found, might need to login
            setUserError('No user session found')
          }
        }
      } catch (error) {
        console.error('Error fetching current user:', error)
        setUserError(error.message || 'Failed to fetch user')
      } finally {
        setUserLoading(false)
      }
    }

    fetchCurrentUser()
  }, [])



  // Check opening entry status when component mounts
  useEffect(() => {
    if (!statusLoading && !statusError) {
      if (hasOpenEntry === true) {
        // User has an open entry, POS is ready
        setPosReady(true)
        setShowOpeningModal(false)
      } else if (hasOpenEntry === false) {
        // No open entry, need to create one
        setPosReady(false)
        setShowOpeningModal(true)
      }
    } else if (statusError) {
      // Handle error - you might want to show an error message
      console.error('Error checking POS opening status:', statusError)
      // For now, show the opening modal to let user try
      setPosReady(false)
      setShowOpeningModal(true)
    }
  }, [hasOpenEntry, statusLoading, statusError])

  // Handle successful opening entry creation
  const handleOpeningSuccess = () => {
    setShowOpeningModal(false)
    setPosReady(true)
    refetch()
  }

  // Handle closing the modal (user cancelled)
  const handleOpeningClose = () => {
    setShowOpeningModal(false)
   
  }

  // Show loading screen while checking status
  if (statusLoading) {
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

  return (
    <div className={`min-h-screen bg-gray-50 ${isRTL ? "rtl" : "ltr"}`}>
      {/* Show POS Layout only when ready */}
      {posReady && <RetailPOSLayout />}
      
      {/* Show a placeholder or message when POS is not ready */}
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

      {/* POS Opening Modal */}
      <POSOpeningModal
        isOpen={showOpeningModal}
        onClose={handleOpeningClose}
        onSuccess={handleOpeningSuccess}
        currentUser={currentUser?.name}
      />
    </div>
  )
}