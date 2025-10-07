

import { useEffect, useState, useCallback } from "react";

// HOOK 1: Check if POS Opening Entry Exists
export function usePOSOpeningStatus() {
  const [hasOpenEntry, setHasOpenEntry] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/method/klik_pos.api.pos_entry.open_pos");
      const data = await res.json();
      if (typeof data.message === "boolean") {
        setHasOpenEntry(data.message);
      } else {
        throw new Error("Unexpected response");
      }
    } catch (err: any) {
      console.error("Error checking POS Opening Entry:", err);
      setError(err.message || "Failed to check opening entry status");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    hasOpenEntry,
    isLoading,
    error,
    refetch: fetchStatus,
  };
}
