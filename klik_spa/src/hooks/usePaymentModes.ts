import { useEffect, useState } from "react";

interface PaymentMode {
  mode_of_payment: string;
  default: number;
  amount?: number;
  type?: string;
  account?: string;
  custom_currency?: string;
}

export function usePaymentModes(posProfile: string) {
  const [modes, setModes] = useState<PaymentMode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!posProfile) return;

    const fetchPaymentModes = async () => {
      setIsLoading(true);
      posProfile = "Test POS Profile"
      try {
        const res = await fetch(`/api/method/klik_pos.api.payment.get_payment_modes?pos_profile=${posProfile}`);
        const data = await res.json();
            console.log("here",data)
        // if (!data.message.success) {
        //   throw new Error(data.message.error || "Failed to fetch payment modes");
        // }

        setModes(data.message.data || []);
        setError(null);
      } catch (err: any) {
        setError(err.message);
        setModes([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPaymentModes();
  }, [posProfile]);

  return { modes, isLoading, error };
}
