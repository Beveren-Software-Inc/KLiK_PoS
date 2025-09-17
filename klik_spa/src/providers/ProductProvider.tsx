import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { MenuItem } from '../../types';
import { useAuth } from '../hooks/useAuth';

interface ProductContextType {
  products: MenuItem[];
  isLoading: boolean;
  isRefreshingStock: boolean;
  error: string | null;
  refetchProducts: () => Promise<void>;
  refreshStockOnly: () => Promise<void>;
  updateStockOnly: (itemCode: string, newStock: number) => void;
  updateStockForItems: (itemCodes: string[]) => Promise<void>;
  count: number;
  lastUpdated: Date | null;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

interface ProductProviderProps {
  children: ReactNode;
}

// Cache configuration
const CACHE_KEY = 'klik_pos_products_cache';
const CACHE_EXPIRY_KEY = 'klik_pos_products_cache_expiry';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function ProductProvider({ children }: ProductProviderProps) {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [products, setProducts] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshingStock, setIsRefreshingStock] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load products from cache
  const loadFromCache = useCallback((): MenuItem[] | null => {
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      const cacheExpiry = localStorage.getItem(CACHE_EXPIRY_KEY);

      if (cachedData && cacheExpiry) {
        const expiryTime = new Date(cacheExpiry).getTime();
        const now = Date.now();

        if (now < expiryTime) {
          const products = JSON.parse(cachedData);
          console.log(`Loaded ${products.length} products from cache`);
          return products;
        } else {
          console.log('Product cache expired, clearing...');
          localStorage.removeItem(CACHE_KEY);
          localStorage.removeItem(CACHE_EXPIRY_KEY);
        }
      }
    } catch (error) {
      console.error('Error loading products from cache:', error);
    }
    return null;
  }, []);

  // Save products to cache
  const saveToCache = useCallback((products: MenuItem[]) => {
    try {
      const expiryTime = new Date(Date.now() + CACHE_DURATION);
      localStorage.setItem(CACHE_KEY, JSON.stringify(products));
      localStorage.setItem(CACHE_EXPIRY_KEY, expiryTime.toISOString());
      console.log(`Cached ${products.length} products until ${expiryTime.toLocaleTimeString()}`);
    } catch (error) {
      console.error('Error saving products to cache:', error);
    }
  }, []);

  // Fetch products from API
  const fetchProductsFromAPI = async (): Promise<MenuItem[]> => {
    const priceList = "Standard Selling";
    const response = await fetch(
      `/api/method/klik_pos.api.item.get_items_with_balance_and_price`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const resData = await response.json();
    // console.log('API Response:', resData);

    if (resData?.message && Array.isArray(resData.message)) {
      return resData.message;
    } else {
      console.error('Invalid response format:', resData);
      throw new Error("Invalid response format");
    }
  };

  // Fetch only stock updates - with fallback to batch API
  const fetchStockUpdates = async (): Promise<Record<string, number>> => {
    try {
      console.log("Fetching stock updates from API...");
      const response = await fetch('/api/method/klik_pos.api.item.get_stock_updates');

      if (!response.ok) {
        console.error(`Stock update API failed: ${response.status} ${response.statusText}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const resData = await response.json();
      // console.log("Stock update API response:", resData);

      if (resData?.message && typeof resData.message === 'object') {
        // console.log(`Stock updates received for ${Object.keys(resData.message).length} items`);
        return resData.message;
      }

      console.warn("No stock updates in response:", resData);
      return {};
    } catch (error) {
      console.error('Error fetching stock updates:', error);

      // Fallback: Use batch API for all current products
      console.log("Falling back to batch stock API...");
      try {
        const itemCodes = products.map(p => p.id).join(',');
        if (itemCodes) {
          const batchResponse = await fetch(`/api/method/klik_pos.api.item.get_items_stock_batch?item_codes=${encodeURIComponent(itemCodes)}`);
          if (batchResponse.ok) {
            const batchData = await batchResponse.json();
            if (batchData?.message && typeof batchData.message === 'object') {
              // console.log(`Batch stock updates received for ${Object.keys(batchData.message).length} items`);
              return batchData.message;
            }
          }
        }
      } catch (fallbackError) {
        console.error('Batch API fallback also failed:', fallbackError);
      }

      throw error; // Re-throw original error
    }
  };

  const fetchProducts = async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
      let products: MenuItem[];

      // Try to load from cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedProducts = loadFromCache();
        if (cachedProducts) {
          products = cachedProducts;
          setIsLoading(false);

          // Update stock in background
          updateStockInBackground();
        } else {
          products = await fetchProductsFromAPI();
          saveToCache(products);
        }
      } else {
        products = await fetchProductsFromAPI();
        saveToCache(products);
      }

      setProducts(products);
      setLastUpdated(new Date());

      // console.log(`Products loaded: ${products.length} items`);
    } catch (error: any) {
      console.error("Error fetching products:", error);
      setError(error.message || "Unknown error occurred");

      // Fallback to cache on error
      const cachedProducts = loadFromCache();
      if (cachedProducts) {
        setProducts(cachedProducts);
        console.log('Using cached products as fallback');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Background stock update
  const updateStockInBackground = async () => {
    try {
      const stockUpdates = await fetchStockUpdates();
      if (Object.keys(stockUpdates).length > 0) {
        setProducts(prevProducts =>
          prevProducts.map(product => ({
            ...product,
            available: stockUpdates[product.id] ?? product.available
          }))
        );
        // console.log('Stock updated in background for', Object.keys(stockUpdates).length, 'items');
      }
    } catch (error) {
      console.error('Background stock update failed:', error);
    }
  };

  // Update stock for a specific item
  const updateStockOnly = useCallback((itemCode: string, newStock: number) => {
    setProducts(prevProducts =>
      prevProducts.map(product =>
        product.id === itemCode
          ? { ...product, available: newStock }
          : product
      )
    );
    console.log(`Updated stock for ${itemCode} to ${newStock}`);
  }, []);

  // Update stock for multiple specific items (efficient for post-payment updates)
  const updateStockForItems = useCallback(async (itemCodes: string[]) => {
    if (itemCodes.length === 0) return;

    try {
      console.log(`Updating stock for ${itemCodes.length} items:`, itemCodes);

      // Create comma-separated string for the API
      const itemCodesString = itemCodes.join(',');

      const response = await fetch(
        `/api/method/klik_pos.api.item.get_items_stock_batch?item_codes=${encodeURIComponent(itemCodesString)}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const resData = await response.json();
      console.log('Batch stock update response:', resData);

      if (resData?.message && typeof resData.message === 'object') {
        const stockUpdates = resData.message;

        setProducts(prevProducts =>
          prevProducts.map(product => ({
            ...product,
            available: stockUpdates[product.id] ?? product.available
          }))
        );

        console.log(`Updated stock for ${Object.keys(stockUpdates).length} items`);
      }
    } catch (error) {
      console.error('Failed to update stock for items:', error);
      // Don't throw error to avoid breaking the payment flow
    }
  }, []);

  const refetchProducts = async () => {
    console.log("Force refreshing products...");
    await fetchProducts(true);
  };

  // Lightweight stock-only refresh - much faster than full reload
  const refreshStockOnly = async () => {
    console.log("Refreshing stock only (lightweight)...");
    setIsRefreshingStock(true);
    try {
      const stockUpdates = await fetchStockUpdates();
      if (Object.keys(stockUpdates).length > 0) {
        setProducts(prevProducts =>
          prevProducts.map(product => ({
            ...product,
            available: stockUpdates[product.id] ?? product.available
          }))
        );
        console.log(`✅ Stock refreshed for ${Object.keys(stockUpdates).length} items - cashier can see updated availability`);
        setLastUpdated(new Date());
        return true; // Success
      }
      console.log("No stock updates needed - all items are current");
      return false; // No updates
    } catch (error) {
      console.error('❌ Stock-only refresh failed:', error);
      // Don't fallback to full refresh automatically - let the user decide
      console.log("Stock refresh failed - user can manually refresh if needed");
      return false; // Failed
    } finally {
      setIsRefreshingStock(false);
    }
  };

  useEffect(() => {
    // Don't fetch products until authentication is complete
    if (authLoading) {
      return;
    }

    // If not authenticated, don't fetch products
    if (!isAuthenticated) {
      setIsLoading(false);
      setError("Authentication required to load products");
      return;
    }

    // Authentication is complete, fetch products
    fetchProducts();

    // Set up periodic stock updates as fallback
    const stockUpdateInterval = setInterval(updateStockInBackground, 30000); // Every 30 seconds

    return () => {
      clearInterval(stockUpdateInterval);
    };
  }, [isAuthenticated, authLoading]);

  const value: ProductContextType = {
    products,
    isLoading,
    isRefreshingStock,
    error,
    refetchProducts,
    refreshStockOnly,
    updateStockOnly,
    updateStockForItems,
    count: products.length,
    lastUpdated,
  };

  return (
    <ProductContext.Provider value={value}>
      {children}
    </ProductContext.Provider>
  );
}

export function useProducts() {
  const context = useContext(ProductContext);
  if (context === undefined) {
    throw new Error('useProducts must be used within a ProductProvider');
  }
  return context;
}
