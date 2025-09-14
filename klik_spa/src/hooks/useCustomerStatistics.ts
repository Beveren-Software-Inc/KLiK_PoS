import { useState, useEffect } from 'react';

interface CustomerStatistics {
  total_orders: number;
  total_spent: number;
  last_visit: string | null;
}

interface UseCustomerStatisticsReturn {
  statistics: CustomerStatistics | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCustomerStatistics(customerId: string | null): UseCustomerStatisticsReturn {
  const [statistics, setStatistics] = useState<CustomerStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatistics = async () => {
    if (!customerId) {
      setStatistics(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/method/klik_pos.api.customer.get_customer_statistics?customer_id=${encodeURIComponent(customerId)}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result?.message?.success) {
        setStatistics(result.message.data);
      } else {
        throw new Error(result?.message?.error || 'Failed to fetch customer statistics');
      }
    } catch (err: any) {
      console.error('Error fetching customer statistics:', err);
      setError(err.message || 'Failed to fetch customer statistics');
      setStatistics(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, [customerId]);

  return {
    statistics,
    isLoading,
    error,
    refetch: fetchStatistics,
  };
}
