import { extractErrorMessage } from "../utils/errorExtraction";

export interface SalespersonIdentity {
  name: string;
  salesperson_name: string;
}

export interface SalespersonSummary {
  salesperson: string;
  salesperson_name: string;
  has_pin: boolean;
}

interface SalespersonApiResponse {
  success: boolean;
  salesperson?: string;
  salesperson_name?: string;
  salespeople?: SalespersonSummary[];
  message?: string;
}

export async function verifyPin(
  pin: string,
  device_id: string,
  salesperson?: string,
  pos_profile?: string
): Promise<SalespersonApiResponse> {
  const csrfToken = window.csrf_token;

  const response = await fetch(
    "/api/method/klik_pos.api.sales_person.verify_pin",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Frappe-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({ pin, device_id, salesperson, pos_profile }),
      credentials: "include",
    }
  );

  const result = await response.json();

  if (!response.ok) {
    const errorMessage = extractErrorMessage(result, "Failed to verify PIN");
    throw new Error(errorMessage);
  }

  return result.message;
}

export async function getRememberedSalesperson(
  device_id: string,
  pos_profile?: string
): Promise<SalespersonApiResponse> {
  const csrfToken = window.csrf_token;

  const response = await fetch(
    "/api/method/klik_pos.api.sales_person.get_remembered_salesperson",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Frappe-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({ device_id, pos_profile }),
      credentials: "include",
    }
  );

  const result = await response.json();

  if (!response.ok) {
    const errorMessage = extractErrorMessage(
      result,
      "Failed to get remembered salesperson"
    );
    throw new Error(errorMessage);
  }

  return result.message;
}

export async function clearRememberedSalesperson(device_id: string) {
  const csrfToken = window.csrf_token;

  const response = await fetch(
    "/api/method/klik_pos.api.sales_person.clear_remembered_salesperson",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Frappe-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({ device_id }),
      credentials: "include",
    }
  );

  const result = await response.json();

  if (!response.ok) {
    const errorMessage = extractErrorMessage(
      result,
      "Failed to clear remembered salesperson"
    );
    throw new Error(errorMessage);
  }

  return result.message;
}

export async function listSalespeople(
  pos_profile?: string
): Promise<SalespersonSummary[]> {
  const params = new URLSearchParams();
  if (pos_profile) {
    params.set("pos_profile", pos_profile);
  }

  const endpoint = params.toString()
    ? `/api/method/klik_pos.api.sales_person.list_salespeople?${params.toString()}`
    : "/api/method/klik_pos.api.sales_person.list_salespeople";

  const response = await fetch(
    endpoint,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "include",
    }
  );

  const result = await response.json();

  if (!response.ok) {
    const errorMessage = extractErrorMessage(result, "Failed to load salespeople");
    throw new Error(errorMessage);
  }

  return result.message?.salespeople || [];
}
