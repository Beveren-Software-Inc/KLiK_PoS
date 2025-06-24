"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

interface I18nContextType {
  language: string
  setLanguage: (lang: string) => void
  t: (key: string) => string
  isRTL: boolean
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

const translations = {
  en: {
    // Login
    LOGIN_TITLE: "Login",
    USERNAME: "Username",
    PASSWORD: "Password",
    LOGIN_BUTTON: "Login",
    LOGGING_IN: "Logging in...",
    INVALID_CREDENTIALS: "Invalid credentials",
    LOGIN_ERROR: "Login error",

    // Navigation
    PROFILE: "Profile",
    LOGOUT: "Logout",
    PAYMENT_TITLE: "Payment",

    // POS
    SEARCH_PLACEHOLDER: "Search products",
    CART: "Cart",
    CART_EMPTY: "Your cart is empty",
    SUBTOTAL: "Subtotal",
    VAT: "VAT",
    TOTAL: "Total",
    PROMO_CODE_PLACEHOLDER: "Enter promo code",
    PROCEED_TO_CHECKOUT: "Proceed to Checkout",
    BACK_TO_CART: "Back to Cart",

    // Payment
    INVOICE_SUMMARY: "Invoice Summary",
    INVOICE_ID: "Invoice ID",
    DATE_TIME: "Date & Time",
    SCAN_TO_VERIFY: "Scan to Verify",
    PAYMENT_METHODS: "Payment Methods",
    CASH: "Cash",
    CARD: "Card",
    DIGITAL_WALLET: "Digital Wallet",
    AMOUNT_RECEIVED: "Amount Received",
    CHANGE: "Change",
    INSERT_OR_TAP_CARD: "Insert or Tap Card",
    SCAN_WITH_STC_PAY: "Scan with STC Pay",
    CONFIRM_PAYMENT: "Confirm Payment",

    // Offline
    OFFLINE_MESSAGE: "You are offline. New orders will sync when you're back online.",

    // Errors
    INVOICE_NOT_FOUND: "Invoice not found",
  },
  ar: {
    // Login
    LOGIN_TITLE: "تسجيل الدخول",
    USERNAME: "اسم المستخدم",
    PASSWORD: "كلمة المرور",
    LOGIN_BUTTON: "دخول",
    LOGGING_IN: "جاري تسجيل الدخول...",
    INVALID_CREDENTIALS: "بيانات الاعتماد غير صحيحة",
    LOGIN_ERROR: "خطأ في تسجيل الدخول",

    // Navigation
    PROFILE: "الملف الشخصي",
    LOGOUT: "تسجيل الخروج",
    PAYMENT_TITLE: "الدفع",

    // POS
    SEARCH_PLACEHOLDER: "ابحث عن منتج",
    CART: "السلة",
    CART_EMPTY: "سلتك فارغة",
    SUBTOTAL: "المجموع الفرعي",
    VAT: "ضريبة القيمة المضافة",
    TOTAL: "الإجمالي",
    PROMO_CODE_PLACEHOLDER: "أدخل رمز العرض",
    PROCEED_TO_CHECKOUT: "إتمام الدفع",
    BACK_TO_CART: "العودة للسلة",

    // Payment
    INVOICE_SUMMARY: "ملخص الفاتورة",
    INVOICE_ID: "رقم الفاتورة",
    DATE_TIME: "التاريخ والوقت",
    SCAN_TO_VERIFY: "امسح للتدقيق",
    PAYMENT_METHODS: "طرق الدفع",
    CASH: "نقد",
    CARD: "بطاقة",
    DIGITAL_WALLET: "المحفظة الرقمية",
    AMOUNT_RECEIVED: "المبلغ المستلم",
    CHANGE: "الباقي",
    INSERT_OR_TAP_CARD: "أدخل أو اضغط البطاقة",
    SCAN_WITH_STC_PAY: "امسح عبر STC Pay",
    CONFIRM_PAYMENT: "تأكيد الدفع",

    // Offline
    OFFLINE_MESSAGE: "أنت غير متصل. سيتم مزامنة الطلبات عند عودتك للإنترنت.",

    // Errors
    INVOICE_NOT_FOUND: "الفاتورة غير موجودة",
  },
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState("en")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    
    const savedLang = localStorage.getItem("language") || "en"
    setLanguage(savedLang)

    // Set document direction
    document.documentElement.dir = savedLang === "ar" ? "rtl" : "ltr"
    document.documentElement.lang = savedLang
  }, [mounted])

  const handleSetLanguage = (lang: string) => {
    if (!mounted) return
    
    setLanguage(lang)
    localStorage.setItem("language", lang)
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr"
    document.documentElement.lang = lang
  }

  const t = (key: string): string => {
    return translations[language as keyof typeof translations]?.[key as keyof typeof translations.en] || key
  }

  const isRTL = language === "ar"

  return (
    <I18nContext.Provider value={{ language, setLanguage: handleSetLanguage, t, isRTL }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (context === undefined) {
    throw new Error("useI18n must be used within an I18nProvider")
  }
  return context
}
