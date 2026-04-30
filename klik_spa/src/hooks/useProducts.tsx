import type { MenuItem } from "../../types";
import { useEffect, useState } from "react";
import { useProduct } from "../providers/ProductProvider";

interface UseProductsReturn {
  products: MenuItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  isRefreshingStock: boolean;
  isSearching: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  refreshStockOnly: () => Promise<boolean>;
  updateStockOnly: (itemCode: string, newStock: number) => void;
  updateStockForItems: (itemCodes: string[]) => Promise<void>;
  updateBatchQuantitiesForItems: (itemCodes: string[]) => Promise<void>;
  loadMoreProducts: () => Promise<void>;
  searchProducts: (query: string) => Promise<void>;
  clearSearch: () => void;
  count: number;
  totalCount: number;
  hasMore: boolean;
  lastUpdated: Date | null;
  searchQuery: string;
}

interface Batch {
  batch_id: string;
  qty: number;
}

interface UseBatchReturn {
  batches: Batch[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  count: number;
  updateBatchQuantities: (itemCode: string) => Promise<void>;
}

export function useProducts(): UseProductsReturn {
  const context = useProduct();
  
  return {
    products: context.products,
    isLoading: context.isLoading,
    isLoadingMore: context.isLoadingMore,
    isRefreshingStock: context.isRefreshingStock,
    isSearching: context.isSearching,
    error: context.error,
    refetch: context.refetchProducts,
    refreshStockOnly: context.refreshStockOnly,
    updateStockOnly: context.updateStockOnly,
    updateStockForItems: context.updateStockForItems,
    updateBatchQuantitiesForItems: context.updateBatchQuantitiesForItems,
    loadMoreProducts: context.loadMoreProducts,
    searchProducts: context.searchProducts,
    clearSearch: context.clearSearch,
    count: context.products.length,
    totalCount: context.totalCount,
    hasMore: context.hasMore,
    lastUpdated: context.lastUpdated,
    searchQuery: context.searchQuery,
  };
}

export function useBatchData(itemCode: string, warehouse: string): UseBatchReturn {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchBatches = async () => {
    if (!itemCode || !warehouse) return;
    
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      const response = await fetch(
        `/api/method/klik_pos.api.batch.get_batch_nos_with_qty?item_code=${encodeURIComponent(itemCode)}&warehouse=${encodeURIComponent(warehouse)}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const resData = await response.json();

      if (resData?.message && Array.isArray(resData.message)) {
        setBatches(resData.message);
      } else {
        setBatches([]);
      }
    } catch (error) {
      console.error("Error fetching batch data:", error);
      setErrorMessage(error instanceof Error ? error.message : "Unknown error occurred");
      setBatches([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (itemCode && warehouse) {
      fetchBatches();
    }
  }, [itemCode, warehouse]);

  const updateBatchQuantities = async (targetItemCode: string): Promise<void> => {
    if (targetItemCode !== itemCode) return;
    
    try {
      const response = await fetch(
        `/api/method/klik_pos.api.item.item_details.get_batch_nos_with_qty?item_code=${encodeURIComponent(targetItemCode)}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const resData = await response.json();

      if (resData?.message && Array.isArray(resData.message)) {
        setBatches(resData.message);
      }
    } catch (error) {
      console.error("Error updating batch quantities:", error);
    }
  };

  return {
    batches,
    isLoading,
    error: errorMessage,
    refetch: fetchBatches,
    count: batches.length,
    updateBatchQuantities,
  };
}