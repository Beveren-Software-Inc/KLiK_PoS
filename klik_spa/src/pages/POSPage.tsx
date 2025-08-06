// import { useI18n } from "../hooks/useI18n"
// import RetailPOSLayout from "../components/RetailPOSLayout"

// export default function MainPOSScreen() {
//   const { isRTL } = useI18n()

//   return (
//     <div className={`min-h-screen bg-gray-50 ${isRTL ? "rtl" : "ltr"}`}>
//       <RetailPOSLayout />
//     </div>
//   )
// }


import { useState, useEffect } from 'react'
import { useI18n } from "../hooks/useI18n"
import { usePOSOpeningStatus } from '../hooks/usePOSOpeningEntry'
import RetailPOSLayout from "../components/RetailPOSLayout"
import POSOpeningModal from '../components/PosOpeningEntryDialog'

export default function MainPOSScreen() {
  const { isRTL } = useI18n()
  const [showOpeningModal, setShowOpeningModal] = useState(false)
  const [posReady, setPosReady] = useState(false)
  
  // Check POS opening status
  const { 
    hasOpenEntry, 
    isLoading: statusLoading, 
    error: statusError, 
    refetch 
  } = usePOSOpeningStatus()

const currentUser = "Administrator"
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
        currentUser={currentUser}
      />
    </div>
  )
}