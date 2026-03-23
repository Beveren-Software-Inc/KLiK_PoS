import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { usePOSOpeningStatus } from '../hooks/usePOSOpeningEntry';
import POSOpeningModal from './PosOpeningEntryDialog';
import erpnextAPI from '../services/erpnext-api';
import { useI18n } from '../hooks/useI18n';

interface CurrentUser {
  name?: string;
  email?: string;
  full_name: string;
  role: string;
  user_image?: string;
}

interface POSOpeningEntryGuardProps {
  children: React.ReactNode;

  excludePaths?: string[];
}

/**
 * Guard component that ensures a POS opening entry exists before allowing access to protected pages.
 * Shows the opening entry modal when no entry is found and blocks access to page content.
 */
export default function POSOpeningEntryGuard({
  children,
  excludePaths = ['/settings', '/login']
}: POSOpeningEntryGuardProps) {
  const { isRTL, tl } = useI18n();
  const location = useLocation();
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [userError, setUserError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check POS opening status
  const {
    hasOpenEntry,
    isLoading: statusLoading,
    error: statusError,
    refetch
  } = usePOSOpeningStatus();

  // Check if current path should be excluded
  const shouldExclude = useCallback(() => {
    const currentPath = location.pathname;
    return excludePaths.some(path => currentPath.includes(path));
  }, [excludePaths, location.pathname]);

  // Fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        setUserLoading(true);
        setUserError(null);

        erpnextAPI.initializeSession();

        const userProfile = await erpnextAPI.getCurrentUserProfile();

        if (userProfile) {
          setCurrentUser({
            name: userProfile.name,
            email: userProfile.email || userProfile.name,
            full_name: userProfile.full_name || userProfile.first_name + ' ' + (userProfile.last_name || ''),
            role: userProfile.role_profile_name || tl('Guest User'),
            user_image: userProfile.user_image
          });
        } else {
          // Fallback to basic user info
          const basicUser = await erpnextAPI.getCurrentUser();
          if (basicUser) {
            setCurrentUser({
              name: basicUser as string,
              email: basicUser as string,
              full_name: basicUser as string,
              role: tl('Guest User')
            });
          } else {
            setUserError(tl('No user session found'));
          }
        }
      } catch (error) {
        console.error('Error fetching current user:', error);
        setUserError((error as Error).message || tl('Failed to fetch user'));
      } finally {
        setUserLoading(false);
      }
    };

    fetchCurrentUser();
  }, [tl]);

  // Refetch opening entry status when route changes (silently in background)
  // This ensures we check for opening entry on every navigation without blocking UI
  useEffect(() => {
    if (shouldExclude()) {
      return;
    }

    // Only refetch if we already have a status (don't block on first load)
    // This allows background refresh without showing loading screen
    if (hasOpenEntry !== null && isInitialized) {
      refetch();
    }
  }, [location.pathname, refetch, hasOpenEntry, isInitialized, shouldExclude]);

  // This helps detect if opening entry was closed from ERPNext while user was away
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const currentPath = location.pathname;
        const isExcluded = excludePaths.some(path => currentPath.includes(path));
        if (!isExcluded) {
          refetch();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refetch, location.pathname, excludePaths]);

  // Re-check when route changes or opening entry status changes
  useEffect(() => {
    if (shouldExclude()) {
      setIsInitialized(true);
      setShowOpeningModal(false);
      return;
    }

    // On initial load, wait for both status and user to be loaded
    // On subsequent navigations, use cached data and update when refetch completes
    const isInitialCheck = hasOpenEntry === null;

    if (isInitialCheck && (statusLoading || userLoading)) {
      return; // Wait for initial load
    }

    if (userError) {
      setIsInitialized(true);
      setShowOpeningModal(false);
      return;
    }

    // Check opening entry status
    // If we have cached data, update immediately even if refetch is in progress
    if (hasOpenEntry !== null) {
      if (hasOpenEntry === true) {
        // Opening entry exists, allow access
        setShowOpeningModal(false);
        setIsInitialized(true);
      } else {
        setShowOpeningModal(true);
        setIsInitialized(true);
      }
    } else if (!statusLoading && statusError) {
      // Only show error modal if we don't have cached data
      setShowOpeningModal(true);
      setIsInitialized(true);
    }
  }, [hasOpenEntry, statusLoading, statusError, userLoading, userError, location.pathname, shouldExclude]);

  // Handle successful opening entry creation
  const handleOpeningSuccess = () => {
    setShowOpeningModal(false);
    setIsInitialized(true);
    setTimeout(() => {
      refetch();
    }, 500);
  };

  const handleOpeningClose = () => {

  };

  // If path is excluded, render children directly
  if (shouldExclude()) {
    return <>{children}</>;
  }


  const shouldShowLoading = hasOpenEntry === null && (statusLoading || userLoading);

  if (shouldShowLoading) {
    return (
      <div className={`min-h-screen bg-gray-50 ${isRTL ? "rtl" : "ltr"} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-beveren-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{tl("Initializing POS")}</h2>
          <p className="text-gray-600">{tl("Checking your POS session status...")}</p>
        </div>
      </div>
    );
  }

  // If no opening entry (false or null), show modal and block access to children
  if (hasOpenEntry !== true) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center pointer-events-none opacity-50">
          {children}
        </div>

        {/* Show opening entry modal */}
        <POSOpeningModal
          isOpen={showOpeningModal}
          onClose={handleOpeningClose}
          onSuccess={handleOpeningSuccess}
          currentUser={currentUser?.name || tl("Guest User")}
        />
      </>
    );
  }

  return <>{children}</>;
}
