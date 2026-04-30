import { useEffect, useCallback } from 'react';
import { usePOSProfileStore, type UserInfo } from '../stores/posProfileStore';

interface UseUserInfoReturn {
  userInfo: UserInfo | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useUserInfo(): UseUserInfoReturn {
  const {
    userInfo,
    isLoadingUser: isLoading,
    userError: error,
    fetchUserInfo,
  } = usePOSProfileStore();

  useEffect(() => {
    if (!userInfo && !isLoading) {
      fetchUserInfo();
    }
  }, [userInfo, isLoading, fetchUserInfo]);

  const refetch = useCallback(async () => {
    await fetchUserInfo(true);
  }, [fetchUserInfo]);

  return {
    userInfo,
    isLoading,
    error,
    refetch,
  };
}