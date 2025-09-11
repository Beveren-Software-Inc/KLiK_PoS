import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { MenuItem } from '../../types';

interface ProductContextType {
  products: MenuItem[];
  isLoading: boolean;
  error: string | null;
  refetchProducts: () => Promise<void>;
  updateStockOnly: (itemCode: string, newStock: number) => void;
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
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
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
      `/api/method/klik_pos.api.item.get_items_with_balance_and_price?price_list=${encodeURIComponent(priceList)}`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const resData = await response.json();
    console.log('API Response:', resData);

    if (resData?.message && Array.isArray(resData.message)) {
      return resData.message;
    } else {
      console.error('Invalid response format:', resData);
      throw new Error("Invalid response format");
    }
  };

  // Fetch only stock updates
  const fetchStockUpdates = async (): Promise<Record<string, number>> => {
    try {
      const response = await fetch('/api/method/klik_pos.api.item.get_stock_updates');
      const resData = await response.json();

      if (resData?.message && typeof resData.message === 'object') {
        return resData.message;
      }
      return {};
    } catch (error) {
      console.error('Error fetching stock updates:', error);
      return {};
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

      console.log(`Products loaded: ${products.length} items`);
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
        console.log('Stock updated in background for', Object.keys(stockUpdates).length, 'items');
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

  const refetchProducts = async () => {
    console.log("Force refreshing products...");
    await fetchProducts(true);
  };

  useEffect(() => {
    fetchProducts();

    // Set up periodic stock updates as fallback
    const stockUpdateInterval = setInterval(updateStockInBackground, 30000); // Every 30 seconds

    return () => {
      clearInterval(stockUpdateInterval);
    };
  }, []);

  const value: ProductContextType = {
    products,
    isLoading,
    error,
    refetchProducts,
    updateStockOnly,
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
