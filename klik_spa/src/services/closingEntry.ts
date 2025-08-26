import { useState } from "react";

// HOOK: Create POS Closing Entry
interface ClosingBalance {
  mode_of_payment: string;
  closing_amount: number;
}

interface UseCreateClosingReturn {
  createClosingEntry: (closingBalance: ClosingBalance[]) => Promise<void>;
  isCreating: boolean;
  error: string | null;
  success: boolean;
}

export function useCreatePOSClosingEntry(): UseCreateClosingReturn {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const createClosingEntry = async (closingBalance: ClosingBalance[]) => {
    setIsCreating(true);
    setError(null);
    setSuccess(false);
    const csrfToken = window.csrf_token;

    console.log("Closing", closingBalance);
    try {
      const res = await fetch("/api/method/klik_pos.api.pos_entry.create_closing_entry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Frappe-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ closing_balance: closingBalance }),
        credentials: "include",
      });

      const data = await res.json();

      if (res.ok && data.message) {
        setSuccess(true);
      } else {
        throw new Error(data._server_messages || "Failed to create closing entry");
      }
    } catch (err: any) {
      console.error("Error creating POS Closing Entry:", err);
      setError(err.message || "Unexpected error occurred");
    } finally {
      setIsCreating(false);
    }
  };

  return {
    createClosingEntry,
    isCreating,
    error,
    success,
  };
}
