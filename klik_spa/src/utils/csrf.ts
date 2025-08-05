export function getCSRFToken(): string | null {
  return typeof window !== "undefined" ? window.csrf_token ?? null : null;
}
