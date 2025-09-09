import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { MenuItem } from '../../types';

interface ProductContextType {
  products: MenuItem[];
  isLoading: boolean;
  error: string | null;
  refetchProducts: () => Promise<void>;
  count: number;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

interface ProductProviderProps {
  children: ReactNode;
}

export function ProductProvider({ children }: ProductProviderProps) {
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const priceList = "Standard Selling";
      const response = await fetch(
        `/api/method/klik_pos.api.item.get_items_with_balance_and_price?price_list=${encodeURIComponent(priceList)}`
      );

      const resData = await response.json();

      if (resData?.message && Array.isArray(resData.message)) {
        setProducts(resData.message);
        // console.log("Products fetched successfully:", resData.message.length, "items");
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error: any) {
      console.error("Error fetching products:", error);
      setError(error.message || "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const refetchProducts = async () => {
    console.log("Refreshing products...");
    await fetchProducts();
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const value: ProductContextType = {
    products,
    isLoading,
    error,
    refetchProducts,
    count: products.length,
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
