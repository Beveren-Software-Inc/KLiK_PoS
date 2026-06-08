import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MenuItem, Customer, ItemGroup } from '../../types';
import { usePOSProfileStore } from './posProfileStore';
import { useCartStore } from './cartStore';

interface ProductStoreState {
  products: MenuItem[];
  itemGroups: ItemGroup[];
  customers: Customer[];
  selectedCustomer: Customer | null;
  searchQuery: string;
  selectedCategory: string;
  totalCount: number;
  hasMore: boolean;
  currentOffset: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  isSearching: boolean;
  isLoadingCustomers: boolean;
  isRefreshingStock: boolean;
  error: string | null;
  lastFullRefresh: number | null;
  lastUpdated: Date | null;
  isInitialized: boolean;
  posName: string | null;
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
  stopBackgroundRefresh: () => void;
  startBackgroundRefresh: () => void;
  executeSearch: (query: string) => Promise<void>;
  fetchProductsFromAPI: (limit: number, offset: number, search: string, category: string, customerId: string, priceList?: string) => Promise<{
    items: MenuItem[];
    item_groups: ItemGroup[];
    total_count: number;
    has_more: boolean;
  }>;
  fetchStockUpdates: () => Promise<Record<string, number>>;
  getFilteredItems: () => MenuItem[];
  getUseScannerOnly: () => boolean;
  getHideUnavailableItems: () => boolean;
  getScalePrefix: () => string;
  getDefaultView: () => 'grid' | 'list';
  checkAndInitialize: () => void;
  syncCustomerFromCart: () => void;
  getEffectiveCustomer: () => Customer | null;
  getEffectivePriceList: () => string;
}

const PAGE_SIZE = 1000;
const LOAD_MORE_SIZE = 500;
const CACHE_DURATION = 5 * 60 * 1000;
let currentPosName = '';
let refreshTimers: Array<ReturnType<typeof setInterval>> = [];
let searchTimer: ReturnType<typeof setTimeout> | null = null;

export const useProductStore = create<ProductStoreState>()(
  persist(
    (set, get) => ({
      products: [],
      itemGroups: [],
      customers: [],
      selectedCustomer: null,
      searchQuery: '',
      selectedCategory: 'all',
      totalCount: 0,
      hasMore: false,
      currentOffset: 0,
      isLoading: false,
      isLoadingMore: false,
      isSearching: false,
      isLoadingCustomers: false,
      isRefreshingStock: false,
      error: null,
      lastFullRefresh: null,
      lastUpdated: null,
      isInitialized: false,
      posName: null,

      getFilteredItems: () => {
        const { products } = get();
        const hideUnavailable = usePOSProfileStore.getState().hideUnavailableItems;
        if (hideUnavailable) {
          return products.filter((p) => {
            const isStockItem = p.is_stock_item !== false;
            if (!isStockItem) {
              return true;
            }
            return (p.available || 0) > 0;
          });
        }
        return products;
      },
      
      getUseScannerOnly: () => usePOSProfileStore.getState().useScannerOnly,
      getHideUnavailableItems: () => usePOSProfileStore.getState().hideUnavailableItems,
      getScalePrefix: () => usePOSProfileStore.getState().scalePrefix,
      getDefaultView: () => usePOSProfileStore.getState().defaultView,

      getEffectiveCustomer: () => {
        const cartCustomer = useCartStore.getState().selectedCustomer;
        const { selectedCustomer } = get();
        
        if (cartCustomer) {
          return cartCustomer;
        }
        return selectedCustomer;
      },

      getEffectivePriceList: () => {
        const allowPriceListSwitching = !!usePOSProfileStore.getState().posDetails?.allow_price_list_switching;
        const cartState = useCartStore.getState();
        return (allowPriceListSwitching ? cartState.selectedPriceList : null)
          || cartState.selectedCustomer?.sellingPriceList
          || get().selectedCustomer?.sellingPriceList
          || "";
      },

      syncCustomerFromCart: () => {
        const cartCustomer = useCartStore.getState().selectedCustomer;
        const { selectedCustomer } = get();
        
        if (cartCustomer && (!selectedCustomer || selectedCustomer.id !== cartCustomer.id)) {
          set({ selectedCustomer: cartCustomer });
          if (currentPosName) {
            get().initializePOS(currentPosName, cartCustomer.id);
          }
        }
      },

      checkAndInitialize: () => {
        const { posName, isInitialized, isLoading } = get();
        const profileStore = usePOSProfileStore.getState();
        
        get().syncCustomerFromCart();
        
        if (!posName && profileStore.isInitialized && profileStore.posDetails?.name) {
          const profileName = profileStore.posDetails.name;
          set({ posName: profileName });
          get().initializePOS(profileName);
        } else if (posName && !isInitialized && !isLoading) {
          get().initializePOS(posName);
        }
      },

      fetchProductsFromAPI: async (limit, offset, search, category, customerId, priceList) => {
        try {
          const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
            pos_profile: currentPosName,
          });
          
          if (customerId) {
            params.append('customer', customerId);
          }
          
          if (priceList) {
            params.append('price_list', priceList);
          }
          
          if (search) params.append('search', search);
          if (category && category !== 'all') params.append('category', category);
          
          const response = await fetch(`/api/method/klik_pos.api.item.item_listing.get_items?${params.toString()}`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          
          const data = await response.json();
          const message = data?.message || data;
          
          return {
            items: message.items || [],
            item_groups: message.item_groups || [],
            total_count: message.total_count || 0,
            has_more: message.has_more || false,
          };
        } catch (err) {
          console.error('fetchProductsFromAPI error:', err);
          return { items: [], item_groups: [], total_count: 0, has_more: false };
        }
      },

      fetchStockUpdates: async () => {
        const { products } = get();
        if (products.length === 0) return {};
        
        try {
          const itemCodes = products.slice(0, 100).map(p => p.id).join(',');
          const response = await fetch(
            `/api/method/klik_pos.api.item.item_stock.get_items_stock_batch?item_codes=${encodeURIComponent(itemCodes)}&pos_profile=${encodeURIComponent(currentPosName)}`
          );
          
          if (response.ok) {
            const data = await response.json();
            return data?.message || {};
          }
          return {};
        } catch (error) {
          console.error('Stock update failed:', error);
          return {};
        }
      },

      initializePOS: async (posName: string, customerId = '') => {
        const { lastFullRefresh, products, isLoading, isInitialized, searchQuery, selectedCategory } = get();
        
        const effectiveCustomer = get().getEffectiveCustomer();
        const effectiveCustomerId = customerId || effectiveCustomer?.id || '';
        const effectivePriceList = get().getEffectivePriceList();
        
        const isCacheValid = lastFullRefresh && 
          (Date.now() - lastFullRefresh) < CACHE_DURATION && 
          products.length > 0;
        
        if (isCacheValid && !effectiveCustomerId && isInitialized && !isLoading) {
          return;
        }
        
        if (isLoading) {
          return;
        }
        
        set({ isLoading: true, error: null });
        currentPosName = posName;
        
        try {
          const result = await get().fetchProductsFromAPI(
            PAGE_SIZE,
            0,
            '',
            'all',
            effectiveCustomerId,
            effectivePriceList
          );
          
          set({
            products: result.items,
            itemGroups: result.item_groups,
            totalCount: result.total_count,
            hasMore: result.has_more,
            currentOffset: result.items.length,
            isLoading: false,
            lastFullRefresh: Date.now(),
            lastUpdated: new Date(),
            error: null,
            searchQuery,
            selectedCategory,
            isInitialized: true,
          });
          
          get().startBackgroundRefresh();
          
        } catch (err) {
          set({ 
            error: err instanceof Error ? err.message : 'Failed to initialize POS',
            isLoading: false 
          });
        }
      },

      fetchProducts: async (reset = true) => {
        const { searchQuery, selectedCategory, fetchProductsFromAPI, posName } = get();
        
        if (!posName && !currentPosName) {
          return;
        }
        
        const effectiveCustomer = get().getEffectiveCustomer();
        const customerId = effectiveCustomer?.id || '';
        const priceList = get().getEffectivePriceList();
        const requestSearchQuery = searchQuery;
        const requestCategory = selectedCategory;
        const requestCustomerId = customerId;
        const requestPriceList = priceList;
        
        set({ isLoading: reset, error: null });
        
        try {
          const result = await fetchProductsFromAPI(
            reset ? PAGE_SIZE : LOAD_MORE_SIZE,
            reset ? 0 : get().currentOffset,
            requestSearchQuery,
            requestCategory,
            customerId,
            priceList
          );

          // Ignore stale responses that no longer match the active query/filter/customer context.
          const latest = get();
          const latestCustomer = latest.getEffectiveCustomer();
          const latestCustomerId = latestCustomer?.id || '';
          const latestPriceList = latest.getEffectivePriceList();
          if (
            latest.searchQuery !== requestSearchQuery ||
            latest.selectedCategory !== requestCategory ||
            latestCustomerId !== requestCustomerId ||
            latestPriceList !== requestPriceList
          ) {
            set({ isLoading: false });
            return;
          }
          
          set({
            products: reset ? result.items : [...get().products, ...result.items],
            itemGroups: reset ? result.item_groups : get().itemGroups,
            totalCount: result.total_count,
            hasMore: result.has_more,
            currentOffset: reset ? result.items.length : get().currentOffset + result.items.length,
            isLoading: false,
            lastFullRefresh: Date.now(),
            lastUpdated: new Date(),
            isInitialized: true,
          });
        } catch (err) {
          set({ error: 'Failed to fetch products', isLoading: false });
        }
      },

      loadMoreProducts: async () => {
        const { isLoadingMore, hasMore, searchQuery, fetchProducts } = get();
        if (isLoadingMore || !hasMore || searchQuery) return;
        
        set({ isLoadingMore: true });
        await fetchProducts(false);
        set({ isLoadingMore: false });
      },

      searchProducts: async (query: string, immediate = false) => {
        const trimmedQuery = query.trim();

        if (searchTimer) {
          clearTimeout(searchTimer);
          searchTimer = null;
        }

        set({ searchQuery: query, isSearching: true });

        if (!trimmedQuery) {
          set({ isSearching: false });
          get().fetchProducts(true);
          return;
        }
        
        if (!immediate) {
          searchTimer = setTimeout(async () => {
            await get().executeSearch(trimmedQuery);
          }, 400);
          return;
        }
        
        await get().executeSearch(trimmedQuery);
      },

      executeSearch: async (query: string) => {
        const { fetchProductsFromAPI, selectedCategory } = get();
        
        const effectiveCustomer = get().getEffectiveCustomer();
        const customerId = effectiveCustomer?.id || '';
        const priceList = get().getEffectivePriceList();
        
        try {
          const result = await fetchProductsFromAPI(500, 0, query, selectedCategory, customerId, priceList);
          
          if (get().searchQuery.trim() === query) {
            set({
              products: result.items,
              itemGroups: result.item_groups,
              totalCount: result.total_count,
              hasMore: false,
              currentOffset: result.items.length,
              isSearching: false,
            });
          }
        } catch (err) {
          set({ error: 'Search failed', isSearching: false });
        }
      },

      clearSearch: () => {
        if (searchTimer) {
          clearTimeout(searchTimer);
          searchTimer = null;
        }
        set({ searchQuery: '' });
        get().fetchProducts(true);
      },

      setCategory: (category: string) => {
        const { selectedCategory, searchQuery } = get();
        if (selectedCategory === category) return;
        
        set({ selectedCategory: category });
        
        if (!searchQuery) {
          get().fetchProducts(true);
        }
      },

      refreshStockOnly: async () => {
        set({ isRefreshingStock: true });
        
        try {
          const stockUpdates = await get().fetchStockUpdates();
          
          if (Object.keys(stockUpdates).length > 0) {
            set(state => ({
              products: state.products.map(product => ({
                ...product,
                available: stockUpdates[product.id] ?? product.available
              })),
              lastUpdated: new Date(),
              isRefreshingStock: false,
            }));
            return true;
          }
          
          set({ isRefreshingStock: false });
          return false;
        } catch (error) {
          console.error('Stock refresh failed:', error);
          set({ isRefreshingStock: false });
          return false;
        }
      },

      updateStockOnly: (itemCode: string, newStock: number) => {
        set(state => ({
          products: state.products.map(product =>
            product.id === itemCode ? { ...product, available: newStock } : product
          )
        }));
      },

      updateStockForItems: async (itemCodes: string[]) => {
        if (itemCodes.length === 0) return;
        
        try {
          const itemCodesString = itemCodes.join(',');
          const response = await fetch(
            `/api/method/klik_pos.api.item.item_stock.get_items_stock_batch?item_codes=${encodeURIComponent(itemCodesString)}&pos_profile=${encodeURIComponent(currentPosName)}`
          );
          
          if (response.ok) {
            const data = await response.json();
            const stockUpdates = data?.message || {};
            
            set(state => ({
              products: state.products.map(product => ({
                ...product,
                available: stockUpdates[product.id] ?? product.available
              }))
            }));
          }
        } catch (error) {
          console.error('Failed to update stock for items:', error);
        }
      },

      searchCustomers: async (query: string) => {
        if (!query.trim()) {
          set({ customers: [], isLoadingCustomers: false });
          return [];
        }
        
        set({ isLoadingCustomers: true });
        
        try {
          const response = await fetch(
            `/api/method/klik_pos.api.customer.customer_search.search_customers?query=${encodeURIComponent(query)}&pos_profile=${encodeURIComponent(currentPosName)}`
          );
          
          if (!response.ok) throw new Error('Failed to fetch customers');
          
          const data = await response.json();
          const customers = data?.message?.customers || [];
          
          set({ customers, isLoadingCustomers: false });
          return customers;
        } catch (error) {
          console.error('Customer search failed:', error);
          set({ isLoadingCustomers: false });
          return [];
        }
      },

      setSelectedCustomer: (customer: Customer | null) => {
        set({ selectedCustomer: customer });
        
        useCartStore.getState().setSelectedCustomer(customer);
        
        if (currentPosName && customer) {
          get().initializePOS(currentPosName, customer?.id || '');
        }
      },

      clearCache: () => {
        get().stopBackgroundRefresh();
        
        set({
          products: [],
          itemGroups: [],
          customers: [],
          selectedCustomer: null,
          searchQuery: '',
          selectedCategory: 'all',
          totalCount: 0,
          hasMore: false,
          currentOffset: 0,
          isLoading: false,
          isLoadingMore: false,
          isSearching: false,
          isLoadingCustomers: false,
          isRefreshingStock: false,
          error: null,
          lastFullRefresh: null,
          lastUpdated: null,
          isInitialized: false,
          posName: null,
        });
        
        localStorage.removeItem('product-storage');
      },

      startBackgroundRefresh: () => {
        get().stopBackgroundRefresh();
        
        const stockInterval = setInterval(() => {
          const { isSearching, isLoading } = get();
          if (document.visibilityState === 'visible' && !isSearching && !isLoading) {
            get().refreshStockOnly();
          }
        }, 30000);
        
        const fullRefreshInterval = setInterval(() => {
          const { searchQuery, isLoading } = get();
          if (document.visibilityState === 'visible' && !searchQuery && !isLoading) {
            get().fetchProducts(true);
          }
        }, CACHE_DURATION);
        
        refreshTimers = [stockInterval, fullRefreshInterval];
        
        const handleFocus = () => {
          const { lastFullRefresh, searchQuery } = get();
          if (lastFullRefresh && (Date.now() - lastFullRefresh) > 120000 && !searchQuery) {
            get().refreshStockOnly();
          }
        };
        
        window.addEventListener('focus', handleFocus);
        (window as any).__posFocusHandler = handleFocus;
      },

      stopBackgroundRefresh: () => {
        refreshTimers.forEach(timer => clearInterval(timer));
        refreshTimers = [];
        
        const handler = (window as any).__posFocusHandler;
        if (handler) {
          window.removeEventListener('focus', handler);
          delete (window as any).__posFocusHandler;
        }
      },
    }),
    {
      name: 'product-storage',
      partialize: (state) => ({
        itemGroups: state.itemGroups,
        lastFullRefresh: state.lastFullRefresh,
        selectedCustomer: state.selectedCustomer,
        isInitialized: state.isInitialized,
        posName: state.posName,
      }),
    }
  )
);

if (typeof window !== 'undefined') {
  setTimeout(() => {
    const profileState = usePOSProfileStore.getState();
    if (profileState.isInitialized && profileState.posDetails?.name) {
      useProductStore.getState().checkAndInitialize();
    }
  }, 100);
  
  let previousProfileState = usePOSProfileStore.getState();
  
  const unsubscribeProfile = usePOSProfileStore.subscribe((state) => {
    const productStore = useProductStore.getState();
    
    if (state.isInitialized && state.posDetails?.name && !productStore.isInitialized && !productStore.isLoading) {
      productStore.checkAndInitialize();
    }
    
    if (previousProfileState.hideUnavailableItems !== state.hideUnavailableItems ||
        previousProfileState.useScannerOnly !== state.useScannerOnly) {
      if (productStore.isInitialized && !productStore.searchQuery.trim()) {
        productStore.fetchProducts(true);
      }
    }
    
    previousProfileState = state;
  });

  let previousSelectedPriceList = useCartStore.getState().selectedPriceList;
  const unsubscribePriceList = useCartStore.subscribe((state) => {
    if (state.selectedPriceList === previousSelectedPriceList) {
      return;
    }

    previousSelectedPriceList = state.selectedPriceList;
    const productStore = useProductStore.getState();
    if (productStore.isInitialized) {
      productStore.fetchProducts(true);
    }
  });
  
  if ((window as any).__productStoreUnsubscribe) {
    (window as any).__productStoreUnsubscribe();
  }
  (window as any).__productStoreUnsubscribe = () => {
    unsubscribeProfile();
    unsubscribePriceList();
  };
}
