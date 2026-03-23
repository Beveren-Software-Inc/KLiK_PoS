import { hasTranslation, translations, type Language } from "./translations"
import { getCookie, getLocaleForLanguage, normalizeLanguage } from "./utils"

type TranslationParams = Record<string, string | number | null | undefined>

function interpolate(template: string, params?: TranslationParams) {
  if (!params) {
    return template
  }

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => String(params[key] ?? ""))
}

function toDate(value: string | number | Date) {
  return value instanceof Date ? value : new Date(value)
}

export function getCurrentLanguage(): Language {
  if (typeof document !== "undefined") {
    const documentLanguage = document.documentElement.getAttribute("lang")
    if (documentLanguage) {
      return normalizeLanguage(documentLanguage)
    }
  }

  if (typeof window !== "undefined") {
    const userLanguage = getCookie("user_lang")
    const preferredLanguage = getCookie("preferred_language")
    const storedLanguage = window.localStorage.getItem("language")

    if (userLanguage || preferredLanguage || storedLanguage) {
      return normalizeLanguage(userLanguage || preferredLanguage || storedLanguage)
    }
  }

  return "ar"
}

export function translateText(key: string, params?: TranslationParams, language: Language = getCurrentLanguage()) {
  const bucket = translations[language] ?? translations.ar
  const fallback = translations.en
  const template =
    (hasTranslation(key) ? bucket[key] : undefined) ??
    (hasTranslation(key) ? fallback[key] : undefined) ??
    key

  return interpolate(template, params)
}

export function translateValue(value: string, language: Language = getCurrentLanguage()) {
  return translateText(value, undefined, language)
}

export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
  language: Language = getCurrentLanguage(),
) {
  return new Intl.NumberFormat(getLocaleForLanguage(language), options).format(value)
}

export function formatCurrency(
  value: number,
  currency: string = "SAR",
  options: Intl.NumberFormatOptions = {},
  language: Language = getCurrentLanguage(),
) {
  try {
    return new Intl.NumberFormat(getLocaleForLanguage(language), {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

export function formatDate(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {},
  language: Language = getCurrentLanguage(),
) {
  return new Intl.DateTimeFormat(getLocaleForLanguage(language), {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  }).format(toDate(value))
}

export function formatTime(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {},
  language: Language = getCurrentLanguage(),
) {
  return new Intl.DateTimeFormat(getLocaleForLanguage(language), {
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(toDate(value))
}

export function formatDateTime(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions = {},
  language: Language = getCurrentLanguage(),
) {
  return new Intl.DateTimeFormat(getLocaleForLanguage(language), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(toDate(value))
}

export function formatRelativeTime(date: Date, language: Language = getCurrentLanguage()) {
  const locale = getLocaleForLanguage(language)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  const diffMs = date.getTime() - Date.now()
  const diffMinutes = Math.round(diffMs / 60000)

  if (Math.abs(diffMinutes) < 1) {
    return formatter.format(0, "minute")
  }

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute")
  }

  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour")
  }

  const diffDays = Math.round(diffHours / 24)
  if (Math.abs(diffDays) < 7) {
    return formatter.format(diffDays, "day")
  }

  return formatDateTime(date, undefined, language)
}
