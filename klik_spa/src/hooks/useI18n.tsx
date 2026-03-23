"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useAuth } from "./useAuth"
import erpnextAPI from "../services/erpnext-api"
import { hasTranslation, translations, type Language, type TranslationKey } from "../i18n/translations"
import {
  applyLanguageToDocument,
  getLocaleForLanguage,
  normalizeLanguage,
  persistLanguagePreference,
  resolveInitialLanguage,
} from "../i18n/utils"

type TranslationParams = Record<string, string | number | null | undefined>

interface I18nContextType {
  language: Language
  locale: string
  setLanguage: (lang: string) => void
  t: (key: TranslationKey, params?: TranslationParams) => string
  tl: (key: string, params?: TranslationParams) => string
  isRTL: boolean
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
  formatCurrency: (value: number, currency?: string, options?: Intl.NumberFormatOptions) => string
  formatDate: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string
  formatTime: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string
  formatDateTime: (value: string | number | Date, options?: Intl.DateTimeFormatOptions) => string
  translateValue: (value: string) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

function interpolate(template: string, params?: TranslationParams) {
  if (!params) {
    return template
  }

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => String(params[key] ?? ""))
}

function toDate(value: string | number | Date) {
  return value instanceof Date ? value : new Date(value)
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [language, setLanguageState] = useState<Language>(() => resolveInitialLanguage())

  const locale = useMemo(() => getLocaleForLanguage(language), [language])
  const isRTL = language === "ar"

  const translate = (key: string, params?: TranslationParams): string => {
    const bucket = translations[language] ?? translations.ar
    const fallback = translations.en
    const template =
      (hasTranslation(key) ? bucket[key] : undefined) ??
      (hasTranslation(key) ? fallback[key] : undefined) ??
      key

    return interpolate(template, params)
  }

  const formatNumber = (value: number, options: Intl.NumberFormatOptions = {}) =>
    new Intl.NumberFormat(locale, options).format(value)

  const formatCurrency = (
    value: number,
    currency: string = "SAR",
    options: Intl.NumberFormatOptions = {},
  ) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    }).format(value)

  const formatDate = (value: string | number | Date, options: Intl.DateTimeFormatOptions = {}) =>
    new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...options,
    }).format(toDate(value))

  const formatTime = (value: string | number | Date, options: Intl.DateTimeFormatOptions = {}) =>
    new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      ...options,
    }).format(toDate(value))

  const formatDateTime = (
    value: string | number | Date,
    options: Intl.DateTimeFormatOptions = {},
  ) =>
    new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      ...options,
    }).format(toDate(value))

  useEffect(() => {
    const initialLanguage = resolveInitialLanguage()
    setLanguageState(initialLanguage)
    persistLanguagePreference(initialLanguage)
  }, [])

  useEffect(() => {
    persistLanguagePreference(language)
  }, [language])

  useEffect(() => {
    applyLanguageToDocument(language)
  }, [language])

  const handleSetLanguage = (lang: string) => {
    const nextLanguage = normalizeLanguage(lang)

    if (nextLanguage === language) {
      return
    }

    setLanguageState(nextLanguage)

    if (user?.name) {
      void erpnextAPI.setLanguage(nextLanguage).catch((error) => {
        console.warn("Failed to persist language preference:", error)
      })
    }
  }

  const value: I18nContextType = {
    language,
    locale,
    setLanguage: handleSetLanguage,
    t: (key, params) => translate(key, params),
    tl: translate,
    isRTL,
    formatNumber,
    formatCurrency,
    formatDate,
    formatTime,
    formatDateTime,
    translateValue: (value) => translate(value),
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18nContextType {
  const context = useContext(I18nContext)
  if (context === undefined) {
    throw new Error("useI18n must be used within an I18nProvider")
  }
  return context
}
