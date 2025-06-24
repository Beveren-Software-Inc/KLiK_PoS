"use client"

import { useI18n } from "../hooks/useI18n"
import type { CartItem } from "../../types"

interface CartItemRowProps {
  item: CartItem
  onUpdateQty: (itemCode: string, newQty: number) => void
}

export default function CartItemRow({ item, onUpdateQty }: CartItemRowProps) {
  const { isRTL } = useI18n()

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center space-x-3">
        <img src={item.imageURL || "/placeholder.svg"} alt={item.nameEn} className="w-12 h-12 rounded object-cover" />
        <div>
          <div className="font-medium text-sm">{isRTL ? item.nameAr : item.nameEn}</div>
          <div className="text-xs text-gray-600">{isRTL ? item.nameEn : item.nameAr}</div>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button
          onClick={() => onUpdateQty(item.itemCode, item.qty - 1)}
          className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
        >
          −
        </button>
        <span className="w-8 text-center font-medium">{item.qty}</span>
        <button
          onClick={() => onUpdateQty(item.itemCode, item.qty + 1)}
          className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center hover:bg-green-700"
        >
          +
        </button>
      </div>

      <div className="text-gray-800 font-semibold">₨ {(item.price * item.qty).toFixed(2)}</div>
    </div>
  )
}
