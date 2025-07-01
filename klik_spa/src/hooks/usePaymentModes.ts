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
      try {
        const res = await fetch(`/api/method/klik_pos.api.payment.get_payment_modes`);
        const data = await res.json();
        if (!data.message.success) {
          throw new Error(data.message.error || "Failed to fetch payment modes");
        }

        setModes(data.message.data || []);
        setError(null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export function useAllPaymentModes() {
  const [modes, setModes] = useState<PaymentMode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {

    const fetchPaymentModes = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/method/klik_pos.api.payment.get_all_mode_of_payment`);
        const data = await res.json();
        
        if (!data.message) {
          throw new Error(data.message.error || "Failed to fetch payment modes");
        }

        setModes(data.message || []);
        setError(null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        setError(err.message);
        setModes([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPaymentModes();
  }, []);

  return { modes, isLoading, error };
}
