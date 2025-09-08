
// import { useFrappeGetDocList } from "frappe-react-sdk";
import type { MenuItem } from "../../types";
import { useEffect, useState } from "react";
import { useProducts as useProductsContext } from "../providers/ProductProvider";

interface UseProductsReturn {
  products: MenuItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  count: number;
}

type Batch = {
  batch_no: string;
  qty: number;
};

type UseBatchReturn = {
  batches: Batch[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  count: number;
};

// Re-export the context hook for backward compatibility
export function useProducts(): UseProductsReturn {
  const context = useProductsContext();
  return {
    products: context.products,
    isLoading: context.isLoading,
    error: context.error,
    refetch: context.refetchProducts,
    count: context.products.length,
  };
}


export function useBatchData(itemCode: string, warehouse: string): UseBatchReturn {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchBatches = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/method/klik_pos.api.batch.get_batch_nos_with_qty?item_code=${encodeURIComponent(itemCode)}&warehouse=${encodeURIComponent(warehouse)}`
      );
      const resData = await response.json();

      if (resData?.message && Array.isArray(resData.message)) {
        setBatches(resData.message);
      } else {
        throw new Error("Invalid response format");
      }

    } catch (error: any) {
      console.error("Error fetching batch data:", error);
      setErrorMessage(error.message || "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (itemCode && warehouse) {
      fetchBatches();
    }
  }, [itemCode, warehouse]);

  return {
    batches,
    isLoading,
    error: errorMessage,
    refetch: fetchBatches,
    count: batches.length,
  };
}
