import { useState, useEffect } from "react";

export interface DeliveryPersonnel {
  name: string;
  delivery_personnel: string;
  delivery_via?: string;
}

export function useDeliveryPersonnel(deliveryVia?: string | null) {
  const [personnel, setPersonnel] = useState<DeliveryPersonnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDeliveryPersonnel = async () => {
      try {
        setLoading(true);
        setError(null);
        const viaParam = deliveryVia ? `?delivery_via=${encodeURIComponent(deliveryVia)}` : "";
        const response = await fetch(
          `/api/method/klik_pos.api.delivery_personnel.get_delivery_personnel_list${viaParam}`,
          {
            method: "GET",
            headers: {
              "Accept": "application/json",
            },
            credentials: "include",
          }
        );

        const data = await response.json();
        if (response.ok && data.message && data.message.success) {
          setPersonnel(data.message.data || []);
        } else {
          throw new Error(data.message?.error || "Failed to fetch delivery personnel");
        }
      } catch (err: unknown) {
        console.error("Error loading delivery personnel:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchDeliveryPersonnel();
  }, [deliveryVia]);

  return { personnel, loading, error };
}
