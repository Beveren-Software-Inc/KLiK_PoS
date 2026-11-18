import { useCallback, useEffect, useState } from "react";

export interface ClosingEntryPreviewPayment {
  mode_of_payment: string;
  opening_amount: number;
  expected_amount: number;
  closing_amount: number;
  difference: number;
  transactions: number;
}

// Fetches the payment reconciliation that create_closing_entry will save,
// so the closing shift screen shows exactly what gets stored.
export function useClosingEntryPreview() {
  const [payments, setPayments] = useState<ClosingEntryPreviewPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/method/klik_pos.api.pos_entry.get_closing_entry_preview", {
        headers: { Accept: "application/json" },
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.exception || `HTTP ${res.status}`);
      }

      setPayments(data.message || []);
      setError(null);
    } catch (err) {
      setPayments([]);
      setError(err instanceof Error ? err.message : "Failed to load closing preview");
    } finally {
      // Only the initial load blocks the page; refetches update in place
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { payments, isLoading, error, refetch };
}
