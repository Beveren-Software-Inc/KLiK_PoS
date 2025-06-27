import { useFrappeGetDoc } from "frappe-react-sdk";

interface PaymentMode {
  mode_of_payment: string;
  default?: 0 | 1;
}

interface POSProfile {
  name: string;
  company: string;
  warehouse: string;
  currency: string;
  write_off_account?: string;
  write_off_cost_center?: string;
  payment_methods?: PaymentMode[];
  // Add other POS Profile fields as needed
}

interface UsePOSProfileReturn {
  profile: POSProfile | null;
  paymentModes: PaymentMode[];
  defaultPaymentMode?: string;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export function usePOSProfile(profileName: string): UsePOSProfileReturn {
  const { 
    data, 
    error, 
    isLoading, 
    mutate 
  } = useFrappeGetDoc<POSProfile>("POS Profile", profileName);

  const paymentModes = data?.payment_methods || [];
  const defaultPaymentMode = paymentModes.find(mode => mode.default === 1)?.mode_of_payment;

  return {
    profile: data || null,
    paymentModes,
    defaultPaymentMode,
    isLoading,
    error: error ? new Error(error.message) : null,
    refetch: mutate,
  };
}

