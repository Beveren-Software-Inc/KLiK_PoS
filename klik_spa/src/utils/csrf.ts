
// utils/csrf.ts

export function getCSRFToken(): string {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
}
