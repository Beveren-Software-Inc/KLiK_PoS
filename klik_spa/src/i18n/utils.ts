import type { Language } from "./translations";

const LANGUAGE_STORAGE_KEY = "language";
const LANGUAGE_COOKIE_DAYS = 365;

function isLanguage(value: string | null | undefined): value is Language {
  return value === "ar" || value === "en";
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

function setCookie(name: string, value: string, days: number = LANGUAGE_COOKIE_DAYS) {
  if (typeof document === "undefined") {
    return;
  }

  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function getLocaleForLanguage(language: Language) {
  return language === "ar" ? "ar-SA" : "en-US";
}

export function applyLanguageToDocument(language: Language) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.setAttribute("dir", language === "ar" ? "rtl" : "ltr");
  document.documentElement.setAttribute("lang", language);
}

export function persistLanguagePreference(language: Language) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }

  setCookie("preferred_language", language);
  setCookie("user_lang", language);
  applyLanguageToDocument(language);
}

export function resolveInitialLanguage(): Language {
  if (typeof window === "undefined") {
    return "ar";
  }

  const userLang = getCookie("user_lang");
  const preferredLanguage = getCookie("preferred_language");
  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  const isGuest = getCookie("user_id") === "Guest" || getCookie("system_user") === "no";

  if (isLanguage(userLang) && !(isGuest && userLang === "en" && !preferredLanguage && !storedLanguage)) {
    return userLang;
  }

  if (isLanguage(preferredLanguage)) {
    return preferredLanguage;
  }

  if (isLanguage(storedLanguage)) {
    return storedLanguage;
  }

  return "ar";
}

export function normalizeLanguage(language: string | null | undefined): Language {
  return language === "en" ? "en" : "ar";
}
