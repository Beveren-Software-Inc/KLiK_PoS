import { useFrappeGetDocList } from "frappe-react-sdk";
import { usePOSProfile } from "./usePOSProfile";

interface ModeOfPayment {
  name: string;
  mode_of_payment: string;
  type: string;
  enabled: 1 | 0;
  default: 1 | 0;
  accounts: Array<{
    company: string;
    default_account: string;
  }>;
}

interface UseModeOfPaymentReturn {
  modes: ModeOfPayment[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  defaultMode?: string;
}

export function useModeOfPayment(posProfileName: string): UseModeOfPaymentReturn {
  // Get payment methods linked to POS Profile
  const { 
    paymentModes: posPaymentMethods, 
    isLoading: profileLoading,
    error: profileError,
    refetch: refetchProfile
  } = usePOSProfile(posProfileName);

  // Get full details of all payment modes
  const {
    data: allPaymentModes,
    error: modesError,
    isLoading: modesLoading,
    mutate
  } = useFrappeGetDocList<ModeOfPayment>("Mode of Payment", {
    fields: ["name", "mode_of_payment", "type", "enabled", "default", "accounts"],
    limit: 100
  });

  // Filter to only include modes enabled in POS Profile
  const enabledModes = allPaymentModes?.filter(mode => 
    posPaymentMethods.some(pm => pm.mode_of_payment === mode.name)
  ) || [];

  // Find default mode
  const defaultMode = enabledModes.find(mode => mode.default === 1)?.name || 
                     posPaymentMethods.find(pm => pm.default === 1)?.mode_of_payment;

  return {
    modes: enabledModes,
    isLoading: profileLoading || modesLoading,
    error: profileError || modesError,
    refetch: () => {
      refetchProfile();
      mutate();
    },
    defaultMode
  };
}