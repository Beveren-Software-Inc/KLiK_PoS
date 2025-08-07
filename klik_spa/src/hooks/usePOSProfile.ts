import { useFrappeGetDoc } from "frappe-react-sdk";
import { useEffect, useState } from "react"

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


export function usePOSProfiles() {
  const [profiles, setProfiles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPOSProfiles = async () => {
      try {
        setLoading(true)

        const response = await fetch("/api/method/klik_pos.api.pos_profile.get_pos_profiles_for_user", {
          method: "GET",
          headers: {
            "Accept": "application/json",
            // "X-Frappe-CSRF-Token": (window as any).csrf_token || "",
          },
          credentials: "include",
        })

        const data = await response.json()
        if (response.ok && data.message) {
          setProfiles(data.message)
        } else {
          throw new Error(data._server_messages || "Failed to fetch POS Profiles")
        }
      } catch (err: any) {
        console.error("Error loading POS Profiles:", err)
        setError(err.message || "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchPOSProfiles()
  }, [])

  return { profiles, loading, error }
}


export function usePOSDetails() {
  const [posDetails, setPOSDetails] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPOSDetails = async () => {
      try {
        setLoading(true)

        const response = await fetch("/api/method/klik_pos.api.pos_profile.get_pos_details", {
          method: "GET",
          headers: {
            "Accept": "application/json",
          },
          credentials: "include",
        })

        const data = await response.json()

        if (response.ok && data.message) {
          setPOSDetails(data.message)
        } else {
          throw new Error(data._server_messages || "Failed to fetch POS details")
        }
      } catch (err: any) {
        console.error("Error loading POS details:", err)
        setError(err.message || "Unknown error")
      } finally {
        setLoading(false)
      }
    }

    fetchPOSDetails()
  }, [])

  return { posDetails, loading, error }
}

