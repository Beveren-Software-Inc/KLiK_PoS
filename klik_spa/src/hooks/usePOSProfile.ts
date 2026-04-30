import { useEffect } from 'react';
import { usePOSProfileStore, type POSDetails, type POSCompanyDetails, type POSProfile } from '../stores/posProfileStore';

interface UsePOSProfilesReturn {
  posDetails: POSDetails | null;
  posProfiles: POSProfile[];
  loading: boolean;
  profilesLoading: boolean;
  error: string | null;
  profilesError: string | null;
  useScannerOnly: boolean;
  hideUnavailableItems: boolean;
  scalePrefix: string;
  defaultView: 'grid' | 'list';
  currencySymbol: string;
  currency: string;
  businessType: string;
  isZatcaEnabled: boolean;
  refresh: () => Promise<void>;
  refreshProfiles: () => Promise<void>;
  clearCache: () => void;
}

export function usePOSProfiles(): UsePOSProfilesReturn {
  const {
    posDetails,
    posProfiles,
    useScannerOnly,
    hideUnavailableItems,
    scalePrefix,
    defaultView,
    currencySymbol,
    currency,
    businessType,
    isZatcaEnabled,
    isLoading: loading,
    isLoadingProfiles: profilesLoading,
    error,
    profilesError,
    isInitialized,
    isAuthenticated,
    fetchPOSDetails,
    fetchPOSProfiles,
    clearCache,
  } = usePOSProfileStore();

  useEffect(() => {
    if (isAuthenticated && !isInitialized && !posDetails) {
      fetchPOSDetails();
    }
  }, [isAuthenticated, isInitialized, posDetails, fetchPOSDetails]);

  useEffect(() => {
    if (isAuthenticated && posProfiles.length === 0) {
      fetchPOSProfiles();
    }
  }, [isAuthenticated, posProfiles.length, fetchPOSProfiles]);

  return {
    posDetails,
    posProfiles,
    loading,
    profilesLoading,
    error,
    profilesError,
    useScannerOnly,
    hideUnavailableItems,
    scalePrefix,
    defaultView,
    currencySymbol,
    currency,
    businessType,
    isZatcaEnabled,
    refresh: () => fetchPOSDetails(true),
    refreshProfiles: () => fetchPOSProfiles(true),
    clearCache,
  };
}

export type { POSDetails, POSCompanyDetails, POSProfile };