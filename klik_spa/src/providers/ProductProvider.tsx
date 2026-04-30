import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useProductStore } from '../stores/productStore';
import type { MenuItem, POSProfile, Customer, ItemGroup } from '../../types';

interface ProductContextType {
  products: MenuItem[];
  filteredItems: MenuItem[];
  posDetails: POSProfile | null;
  itemGroups: ItemGroup[];
  customers: Customer[];
  selectedCustomer: Customer | null;
  
  searchQuery: string;
  selectedCategory: string;
  
  totalCount: number;
  hasMore: boolean;
  
  isLoading: boolean;
  isLoadingMore: boolean;
  isSearching: boolean;
  isLoadingCustomers: boolean;
  isRefreshingStock: boolean;
  error: string | null;
  
  useScannerOnly: boolean;
  hideUnavailableItems: boolean;
  scalePrefix: string;
  defaultView: 'grid' | 'list';
  
  initializePOS: (posName: string, customerId?: string) => Promise<void>;
  fetchProducts: (reset?: boolean) => Promise<void>;
  loadMoreProducts: () => Promise<void>;
  searchProducts: (query: string, immediate?: boolean) => Promise<void>;
  clearSearch: () => void;
  setCategory: (category: string) => void;
  refreshStockOnly: () => Promise<boolean>;
  updateStockOnly: (itemCode: string, newStock: number) => void;
  updateStockForItems: (itemCodes: string[]) => Promise<void>;
  searchCustomers: (query: string) => Promise<Customer[]>;
  setSelectedCustomer: (customer: Customer | null) => void;
  clearCache: () => void;
  
  lastUpdated: Date | null;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

interface ProductProviderProps {
  children: ReactNode;
  posName: string;
  initialCustomerId?: string;
}

export function ProductProvider({ children, posName, initialCustomerId }: ProductProviderProps) {
  const store = useProductStore();
  
  useEffect(() => {
    if (posName) {
      store.initializePOS(posName, initialCustomerId);
    }
    return () => {
      store.stopBackgroundRefresh();
    };
  }, [posName, initialCustomerId]);
  
  const filteredItems = store.getFilteredItems();
  const useScannerOnly = store.getUseScannerOnly();
  const hideUnavailableItems = store.getHideUnavailableItems();
  const scalePrefix = store.getScalePrefix();
  const defaultView = store.getDefaultView();
  
  const contextValue: ProductContextType = {
    products: store.products,
    filteredItems,
    itemGroups: store.itemGroups,
    customers: store.customers,
    selectedCustomer: store.selectedCustomer,
    
    searchQuery: store.searchQuery,
    selectedCategory: store.selectedCategory,
    
    totalCount: store.totalCount,
    hasMore: store.hasMore,
    
    isLoading: store.isLoading,
    isLoadingMore: store.isLoadingMore,
    isSearching: store.isSearching,
    isLoadingCustomers: store.isLoadingCustomers,
    isRefreshingStock: store.isRefreshingStock,
    error: store.error,
    
    useScannerOnly,
    hideUnavailableItems,
    scalePrefix,
    defaultView,
    
    initializePOS: store.initializePOS,
    fetchProducts: store.fetchProducts,
    loadMoreProducts: store.loadMoreProducts,
    searchProducts: store.searchProducts,
    clearSearch: store.clearSearch,
    setCategory: store.setCategory,
    refreshStockOnly: store.refreshStockOnly,
    updateStockOnly: store.updateStockOnly,
    updateStockForItems: store.updateStockForItems,
    searchCustomers: store.searchCustomers,
    setSelectedCustomer: store.setSelectedCustomer,
    clearCache: store.clearCache,
    
    lastUpdated: store.lastUpdated,
  };
  
  return (
    <ProductContext.Provider value={contextValue}>
      {children}
    </ProductContext.Provider>
  );
}

export function useProduct() {
  const context = useContext(ProductContext);
  if (context === undefined) {
    throw new Error('useProduct must be used within a ProductProvider');
  }
  return context;
}

export { useProductStore };