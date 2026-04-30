import { useEffect, useCallback } from 'react';
import { usePOSProfileStore } from '../stores/posProfileStore';

interface UsePOSOpeningStatusReturn {
  hasOpenEntry: boolean | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  reset: () => void;
}

export function usePOSOpeningStatus(): UsePOSOpeningStatusReturn {
  const {
    hasOpenEntry,
    isCheckingOpening: isLoading,
    openingError: error,
    fetchPOSOpeningStatus,
    resetOpeningStatus,
  } = usePOSProfileStore();

  useEffect(() => {
    if (hasOpenEntry === null && !isLoading) {
      fetchPOSOpeningStatus();
    }
  }, [hasOpenEntry, isLoading, fetchPOSOpeningStatus]);

  const refetch = useCallback(async () => {
    await fetchPOSOpeningStatus(true);
  }, [fetchPOSOpeningStatus]);

  const reset = useCallback(() => {
    resetOpeningStatus();
  }, [resetOpeningStatus]);

  return {
    hasOpenEntry,
    isLoading,
    error,
    refetch,
    reset,
  };
}