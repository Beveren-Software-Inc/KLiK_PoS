import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface POSCompanyDetails {
  name?: string;
  company_name?: string;
  abbr?: string;
  tax_id?: string;
  phone_no?: string;
  email?: string;
  country?: string;
  default_currency?: string;
}

export interface POSProfile {
  name: string;
  company?: string | POSCompanyDetails;
  currency?: string;
  currency_symbol?: string;
  is_zatca_enabled?: boolean;
  business_type?: "B2B" | "B2C" | "B2B & B2C";
  hide_unavailable_items?: boolean;
  custom_use_scanner_fully?: boolean;
  custom_hide_expected_amount?: boolean;
  write_off_limit?: number;
  write_off_account?: string;
  write_off_cost_center?: string;
  custom_delivery_required?: number;
  custom_prevent_invoice_reprinting?: boolean | number;
  custom_allow_return?: boolean | number | string;
  custom_allow_to_create_and_edit_customers?: number;
  custom_default_view?: "Grid View" | "List View";
  custom_cart_item_insertion_position?: "Top" | "Bottom";
  custom_show_item_code_in_product_list?: boolean | number;
  custom_enhanced_search?: boolean | number;
  custom_scale_barcodes_start_with?: string;
  is_tax_included_in_basic_rate?: boolean | number | string;
  warehouse?: string;
  restrict_cost_visibility_in_tooltip?: boolean;
  is_default?: boolean;
  [key: string]: unknown;
}

export interface POSDetails extends POSProfile {
  company?: POSCompanyDetails;
}

export interface UserInfo {
  user: string;
  full_name: string;
  email: string;
  roles: string[];
  is_admin_user: boolean;
  admin_roles: string[];
  pos_profile: string | null;
  pos_profile_name: string | null;
}

interface POSDetailsState {
  posDetails: POSDetails | null;
  posProfiles: POSProfile[];
  useScannerOnly: boolean;
  hideUnavailableItems: boolean;
  scalePrefix: string;
  defaultView: 'grid' | 'list';
  currencySymbol: string;
  currency: string;
  businessType: string;
  isZatcaEnabled: boolean;
  warehouse: string | null;
  hasOpenEntry: boolean | null;
  isCheckingOpening: boolean;
  openingError: string | null;
  userInfo: UserInfo | null;
  isLoadingUser: boolean;
  userError: string | null;
  isLoading: boolean;
  isLoadingProfiles: boolean;
  profilesError: string | null;
  error: string | null;
  lastFetched: number | null;
  lastUserFetch: number | null;
  lastOpeningFetch: number | null;
  lastProfilesFetch: number | null;
  isInitialized: boolean;
  isAuthenticated: boolean;
  fetchPOSDetails: (force?: boolean) => Promise<void>;
  fetchPOSProfiles: (force?: boolean) => Promise<void>;
  fetchPOSOpeningStatus: (force?: boolean) => Promise<void>;
  fetchUserInfo: (force?: boolean) => Promise<void>;
  clearCache: () => void;
  updatePOSDetails: (details: Partial<POSDetails>) => void;
  resetOpeningStatus: () => void;
  refreshAll: () => Promise<void>;
  setAuthenticated: (status: boolean) => void;
}

const CACHE_DURATION = 10 * 60 * 1000;
const OPENING_STATUS_CACHE_DURATION = 30 * 1000;
const USER_INFO_CACHE_DURATION = 5 * 60 * 1000;
const PROFILES_CACHE_DURATION = 10 * 60 * 1000;

export const usePOSProfileStore = create<POSDetailsState>()(
  persist(
    (set, get) => ({
      posDetails: null,
      posProfiles: [],
      useScannerOnly: false,
      hideUnavailableItems: false,
      scalePrefix: "",
      defaultView: "grid",
      currencySymbol: "$",
      currency: "USD",
      businessType: "B2C",
      isZatcaEnabled: false,
      warehouse: null,
      hasOpenEntry: null,
      isCheckingOpening: false,
      openingError: null,
      userInfo: null,
      isLoadingUser: false,
      userError: null,
      isLoading: false,
      isLoadingProfiles: false,
      profilesError: null,
      error: null,
      lastFetched: null,
      lastUserFetch: null,
      lastOpeningFetch: null,
      lastProfilesFetch: null,
      isInitialized: false,
      isAuthenticated: false,

      setAuthenticated: (status: boolean) => {
        set({ isAuthenticated: status });
      },

      fetchPOSProfiles: async (force = false) => {
        const { lastProfilesFetch, isLoadingProfiles, isAuthenticated } = get();
        const isCacheValid = lastProfilesFetch && (Date.now() - lastProfilesFetch) < PROFILES_CACHE_DURATION;
        
        if (!isAuthenticated) {
          set({ isLoadingProfiles: false });
          return;
        }
        if (!force && isCacheValid) return;
        if (isLoadingProfiles) return;
        
        set({ isLoadingProfiles: true, profilesError: null });
        
        try {
          const response = await fetch("/api/method/klik_pos.api.pos_profile.get_pos_profiles_for_user", {
            method: "GET",
            headers: { "Accept": "application/json" },
            credentials: "include",
          });
          
          if (response.status === 401 || response.status === 403) {
            set({ isAuthenticated: false, isLoadingProfiles: false });
            return;
          }
          
          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data._server_messages || "Failed to fetch POS profiles");
          }
          
          const profiles = data.message as POSProfile[];
          
          set({
            posProfiles: profiles,
            isLoadingProfiles: false,
            profilesError: null,
            lastProfilesFetch: Date.now(),
          });
          
        } catch (err) {
          set({
            profilesError: err instanceof Error ? err.message : "Unknown error",
            isLoadingProfiles: false,
          });
        }
      },

      fetchPOSDetails: async (force = false) => {
        const { lastFetched, isLoading, isInitialized, isAuthenticated } = get();
        const isCacheValid = lastFetched && (Date.now() - lastFetched) < CACHE_DURATION;
        
        if (!isAuthenticated) {
          set({ isLoading: false });
          return;
        }
        if (!force && isCacheValid && isInitialized) return;
        if (isLoading) return;
        
        set({ isLoading: true, error: null });
        
        try {
          const response = await fetch("/api/method/klik_pos.api.pos_profile.get_pos_details", {
            method: "GET",
            headers: { "Accept": "application/json" },
            credentials: "include",
          });
          
          if (response.status === 401 || response.status === 403) {
            set({ isAuthenticated: false, isLoading: false });
            return;
          }
          
          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data._server_messages || "Failed to fetch POS details");
          }
          
          const posDetails = data.message as POSDetails;
          
          set({
            posDetails,
            useScannerOnly: posDetails?.custom_use_scanner_fully || false,
            hideUnavailableItems: posDetails?.hide_unavailable_items || false,
            scalePrefix: posDetails?.custom_scale_barcodes_start_with || "",
            defaultView: posDetails?.custom_default_view === "List View" ? "list" : "grid",
            currencySymbol: posDetails?.currency_symbol || "$",
            currency: posDetails?.currency || "USD",
            businessType: posDetails?.business_type || "B2C",
            isZatcaEnabled: posDetails?.is_zatca_enabled || false,
            warehouse: posDetails?.warehouse || null,
            isLoading: false,
            error: null,
            lastFetched: Date.now(),
            isInitialized: true,
          });
          
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : "Unknown error",
            isLoading: false,
          });
        }
      },
      
      fetchPOSOpeningStatus: async (force = false) => {
        const { hasOpenEntry, isCheckingOpening, lastOpeningFetch, isAuthenticated } = get();
        const isOpeningStatusCached = lastOpeningFetch && 
          (Date.now() - lastOpeningFetch) < OPENING_STATUS_CACHE_DURATION && 
          hasOpenEntry !== null;
        
        if (!isAuthenticated) {
          set({ isCheckingOpening: false });
          return;
        }
        if (!force && isOpeningStatusCached) return;
        if (isCheckingOpening) return;
        
        set({ isCheckingOpening: true, openingError: null });
        
        try {
          const response = await fetch("/api/method/klik_pos.api.pos_entry.open_pos", {
            method: "GET",
            headers: { "Accept": "application/json" },
            credentials: "include",
          });
          
          if (response.status === 401 || response.status === 403) {
            set({ isAuthenticated: false, isCheckingOpening: false });
            return;
          }
          
          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data._server_messages || "Failed to check opening entry status");
          }
          
          if (typeof data.message === "boolean") {
            set({ 
              hasOpenEntry: data.message,
              isCheckingOpening: false,
              lastOpeningFetch: Date.now(),
            });
          } else {
            throw new Error("Unexpected response format");
          }
          
        } catch (err) {
          set({
            openingError: err instanceof Error ? err.message : "Failed to check opening entry status",
            isCheckingOpening: false,
          });
        }
      },

      fetchUserInfo: async (force = false) => {
        const { userInfo, isLoadingUser, lastUserFetch, isAuthenticated } = get();
        const isUserInfoCached = lastUserFetch && 
          (Date.now() - lastUserFetch) < USER_INFO_CACHE_DURATION && 
          userInfo !== null;
        
        if (!isAuthenticated) {
          set({ isLoadingUser: false });
          return;
        }
        if (!force && isUserInfoCached) return;
        if (isLoadingUser) return;
        
        set({ isLoadingUser: true, userError: null });
        
        try {
          const response = await fetch("/api/method/klik_pos.api.user.get_current_user_info", {
            method: "GET",
            headers: { "Accept": "application/json" },
            credentials: "include",
          });

          if (response.status === 401 || response.status === 403) {
            set({ isAuthenticated: false, isLoadingUser: false });
            return;
          }

          const data = await response.json();

          if (response.ok && data.message?.success) {
            set({
              userInfo: data.message.data,
              isLoadingUser: false,
              userError: null,
              lastUserFetch: Date.now(),
            });
          } else {
            throw new Error(data.message?.error || "Failed to fetch user info");
          }
        } catch (err) {
          set({
            userError: err instanceof Error ? err.message : "Unknown error",
            isLoadingUser: false,
          });
        }
      },
      
      refreshAll: async () => {
        const { isAuthenticated } = get();
        if (!isAuthenticated) return;
        
        await Promise.all([
          get().fetchPOSDetails(true),
          get().fetchPOSProfiles(true),
          get().fetchPOSOpeningStatus(true),
          get().fetchUserInfo(true),
        ]);
      },
      
      clearCache: () => {
        set({
          posDetails: null,
          posProfiles: [],
          isLoading: false,
          error: null,
          lastFetched: null,
          lastProfilesFetch: null,
          isInitialized: false,
          useScannerOnly: false,
          hideUnavailableItems: false,
          scalePrefix: "",
          defaultView: "grid",
          warehouse: null,
          hasOpenEntry: null,
          isCheckingOpening: false,
          openingError: null,
          lastOpeningFetch: null,
          userInfo: null,
          isLoadingUser: false,
          userError: null,
          lastUserFetch: null,
          isAuthenticated: false,
          isLoadingProfiles: false,
          profilesError: null,
        });
        localStorage.removeItem('pos-profile-storage');
      },
      
      updatePOSDetails: (details: Partial<POSDetails>) => {
        set(state => {
          const updatedDetails = ({ ...(state.posDetails || {}), ...details } as POSDetails);
          return {
            posDetails: updatedDetails,
            useScannerOnly: updatedDetails?.custom_use_scanner_fully || false,
            hideUnavailableItems: updatedDetails?.hide_unavailable_items || false,
            scalePrefix: updatedDetails?.custom_scale_barcodes_start_with || "",
            defaultView: updatedDetails?.custom_default_view === "List View" ? "list" : "grid",
            currencySymbol: updatedDetails?.currency_symbol || "$",
            currency: updatedDetails?.currency || "USD",
            businessType: updatedDetails?.business_type || "B2C",
            isZatcaEnabled: updatedDetails?.is_zatca_enabled || false,
            warehouse: updatedDetails?.warehouse || null,
          };
        });
      },
      
      resetOpeningStatus: () => {
        set({
          hasOpenEntry: null,
          isCheckingOpening: false,
          openingError: null,
          lastOpeningFetch: null,
        });
      },
    }),
    {
      name: 'pos-profile-storage',
      partialize: (state) => ({
        posDetails: state.posDetails,
        posProfiles: state.posProfiles,
        useScannerOnly: state.useScannerOnly,
        hideUnavailableItems: state.hideUnavailableItems,
        scalePrefix: state.scalePrefix,
        defaultView: state.defaultView,
        currencySymbol: state.currencySymbol,
        currency: state.currency,
        businessType: state.businessType,
        isZatcaEnabled: state.isZatcaEnabled,
        warehouse: state.warehouse,
        userInfo: state.userInfo,
        lastFetched: state.lastFetched,
        lastUserFetch: state.lastUserFetch,
        lastProfilesFetch: state.lastProfilesFetch,
        isInitialized: state.isInitialized,
      }),
    }
  )
);