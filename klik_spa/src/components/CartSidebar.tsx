"use client"

import { useI18n } from "../hooks/useI18n"
import type { CartItem } from "../../types"
import CartItemRow from "./CartItemRow"

interface CartSidebarProps {
  cartItems: CartItem[]
  onUpdateQty: (itemCode: string, newQty: number) => void
  subtotal: number
  vat: number
  total: number
  onCheckout: () => void
}

export default function CartSidebar({ cartItems, onUpdateQty, subtotal, vat, total, onCheckout }: CartSidebarProps) {
  const { t } = useI18n()

  return (
    <div className="bg-green-50 rounded-lg p-4 h-full flex flex-col">
      <h2 className="text-lg font-bold mb-4">{t("CART")}</h2>

      <div className="flex-1 overflow-y-auto">
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
        <div className="border-t pt-4 mt-4">
          <div className="space-y-2">
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

          <input
            type="text"
            placeholder={t("PROMO_CODE_PLACEHOLDER")}
            className="border border-gray-300 rounded px-2 py-1 w-full mt-4"
          />

          <button
            onClick={onCheckout}
            className="mt-4 w-full bg-green-700 text-white py-3 rounded hover:bg-green-800 transition-colors"
          >
            {t("PROCEED_TO_CHECKOUT")}
          </button>
        </div>
      )}
    </div>
  )
}
