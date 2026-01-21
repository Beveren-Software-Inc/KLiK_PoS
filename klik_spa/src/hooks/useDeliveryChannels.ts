import { useEffect, useState } from "react";

export interface DeliveryChannel {
  name: string;
  delivery_via?: string;
}

export function useDeliveryChannels() {
  const [channels, setChannels] = useState<DeliveryChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChannels = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          "/api/method/klik_pos.api.delivery_channel.get_delivery_channel_list",
          {
            method: "GET",
            headers: { Accept: "application/json" },
            credentials: "include",
          }
        );

        const data = await response.json();
        if (response.ok && data.message && data.message.success) {
          setChannels(data.message.data || []);
        } else {
          throw new Error(data.message?.error || "Failed to fetch delivery channels");
        }
      } catch (err: unknown) {
        console.error("Error loading delivery channels:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchChannels();
  }, []);

  return { channels, loading, error };
}

