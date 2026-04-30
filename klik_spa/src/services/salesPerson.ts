import { extractErrorMessage } from "../utils/errorExtraction";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function verifyPin(pin: string, device_id: string) {
  const csrfToken = window.csrf_token;

  const response = await fetch(
    "/api/method/klik_pos.api.sales_person.verify_pin",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Frappe-CSRF-Token": csrfToken,
      },
      body: JSON.stringify({ pin, device_id }),
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getRememberedSalesperson(device_id: string) {
  const csrfToken = window.csrf_token;

  const response = await fetch(
    "/api/method/klik_pos.api.sales_person.get_remembered_salesperson",
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
      "Failed to get remembered salesperson"
    );
    throw new Error(errorMessage);
  }

  return result.message;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
