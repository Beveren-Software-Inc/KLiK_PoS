"use client"

import { useI18n } from "../hooks/useI18n"
import type { CartItem } from "../../types"
import CartItemRow from "./CartItemRow"

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
  cartItems: CartItem[]
  onUpdateQty: (itemCode: string, newQty: number) => void
  subtotal: number
  vat: number
  total: number
  onCheckout: () => void
}

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQty,
  subtotal,
  vat,
  total,
  onCheckout,
}: CartDrawerProps) {
  const { t } = useI18n()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />

      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-lg max-h-[60vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">{t("CART")}</h2>
          <button onClick={onClose} className="p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {cartItems.length === 0 ? (
            <div className="text-center text-gray-500 py-8">{t("CART_EMPTY")}</div>
          ) : (
            <div className="space-y-2">
              {cartItems.map((item) => (
                <CartItemRow key={item.itemCode} item={item} onUpdateQty={onUpdateQty} />
              ))}
            </div>
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="p-4 border-t bg-gray-50">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span>{t("SUBTOTAL")}</span>
                <span>₨ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t("VAT")} (5%)</span>
                <span>₨ {vat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>{t("TOTAL")}</span>
                <span>₨ {total.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={onCheckout}
              className="w-full bg-green-700 text-white py-3 rounded hover:bg-green-800 transition-colors"
            >
              {t("PROCEED_TO_CHECKOUT")}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
