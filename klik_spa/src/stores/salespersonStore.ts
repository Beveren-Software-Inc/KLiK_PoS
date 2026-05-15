import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  clearRememberedSalesperson,
  getRememberedSalesperson,
  listSalespeople,
  verifyPin,
  type SalespersonIdentity,
  type SalespersonSummary,
} from "../services/salesPerson";
import { usePOSProfileStore } from "./posProfileStore";

const SALESPERSON_CACHE_MS = 5 * 60 * 1000;

const getActivePOSProfileName = () => usePOSProfileStore.getState().posDetails?.name;

export const getPOSDeviceId = () => {
  let deviceId = localStorage.getItem("pos_device_id");
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem("pos_device_id", deviceId);
  }
  return deviceId;
};

interface SalespersonState {
  activeSalesperson: SalespersonIdentity | null;
  salespeople: SalespersonSummary[];
  rememberLocked: boolean;
  isRestoring: boolean;
  isLoadingSalespeople: boolean;
  isVerifying: boolean;
  error: string | null;
  lastLoadedAt: number | null;
  hasAttemptedRestore: boolean;
  ensureInitialized: () => Promise<void>;
  loadSalespeople: (force?: boolean) => Promise<void>;
  verifySalespersonPin: (
    pin: string,
    salesperson?: string
  ) => Promise<SalespersonIdentity>;
  clearActiveSalesperson: (clearRemembered?: boolean) => Promise<void>;
  setRememberLocked: (locked: boolean) => Promise<void>;
}

export const useSalespersonStore = create<SalespersonState>()(
  persist(
    (set, get) => ({
      activeSalesperson: null,
      salespeople: [],
      rememberLocked: true,
      isRestoring: false,
      isLoadingSalespeople: false,
      isVerifying: false,
      error: null,
      lastLoadedAt: null,
      hasAttemptedRestore: false,

      ensureInitialized: async () => {
        const { hasAttemptedRestore, rememberLocked } = get();
        if (hasAttemptedRestore) return;

        set({ hasAttemptedRestore: true, isRestoring: true, error: null });

        try {
          if (!rememberLocked) return;

          const result = await getRememberedSalesperson(
            getPOSDeviceId(),
            getActivePOSProfileName()
          );
          if (result?.success && result.salesperson && result.salesperson_name) {
            set({
              activeSalesperson: {
                name: result.salesperson,
                salesperson_name: result.salesperson_name,
              },
            });
          }
        } catch (error) {
          set({
            error:
              error instanceof Error
                ? error.message
                : "Failed to restore remembered salesperson",
          });
        } finally {
          set({ isRestoring: false });
        }
      },

      loadSalespeople: async (force = false) => {
        const { isLoadingSalespeople, lastLoadedAt } = get();
        const isCacheValid =
          !force && lastLoadedAt && Date.now() - lastLoadedAt < SALESPERSON_CACHE_MS;
        if (isLoadingSalespeople || isCacheValid) return;

        set({ isLoadingSalespeople: true, error: null });

        try {
          const salespeople = await listSalespeople(getActivePOSProfileName());
          set({
            salespeople,
            isLoadingSalespeople: false,
            lastLoadedAt: Date.now(),
          });
        } catch (error) {
          set({
            isLoadingSalespeople: false,
            error:
              error instanceof Error ? error.message : "Failed to load salespeople",
          });
          throw error;
        }
      },

      verifySalespersonPin: async (pin, salesperson) => {
        set({ isVerifying: true, error: null });

        try {
          const result = await verifyPin(
            pin,
            getPOSDeviceId(),
            salesperson,
            getActivePOSProfileName()
          );
          if (!result?.success || !result.salesperson || !result.salesperson_name) {
            throw new Error(result?.message || "Invalid PIN. Please try again.");
          }

          const activeSalesperson = {
            name: result.salesperson,
            salesperson_name: result.salesperson_name,
          };

          set({ activeSalesperson, isVerifying: false });

          if (!get().rememberLocked) {
            await clearRememberedSalesperson(getPOSDeviceId());
          }

          return activeSalesperson;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to verify salesperson PIN";
          set({ error: message, isVerifying: false });
          throw error instanceof Error ? error : new Error(message);
        }
      },

      clearActiveSalesperson: async (clearRemembered = true) => {
        set({ activeSalesperson: null, error: null });
        if (!clearRemembered) return;
        await clearRememberedSalesperson(getPOSDeviceId());
      },

      setRememberLocked: async (locked) => {
        set({ rememberLocked: locked });
        if (!locked) {
          await clearRememberedSalesperson(getPOSDeviceId());
        }
      },
    }),
    {
      name: "klik-pos-salesperson",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ rememberLocked: state.rememberLocked }),
    }
  )
);