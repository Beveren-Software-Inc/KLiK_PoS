"use client"

import { useState } from "react"
import { X, Tag, Check } from "lucide-react"
import type { GiftCoupon } from "../../types"
import { availableCoupons } from "../data/mockData"

interface GiftCouponSelectorProps {
  onClose: () => void
  onApplyCoupon: (coupon: GiftCoupon) => void
  appliedCoupons: GiftCoupon[]
}

export default function GiftCouponSelector({ onClose, onApplyCoupon, appliedCoupons }: GiftCouponSelectorProps) {
  const [customCode, setCustomCode] = useState("")
  const [error, setError] = useState("")

  const handleApplyCoupon = (coupon: GiftCoupon) => {
    onApplyCoupon(coupon)
    onClose()
  }

  const handleApplyCustomCode = () => {
    if (!customCode.trim()) {
      setError("Please enter a coupon code")
      return
    }

    const coupon = availableCoupons.find((c) => c.code.toLowerCase() === customCode.toLowerCase())

    if (!coupon) {
      setError("Invalid coupon code")
      return
    }

    if (appliedCoupons.some((c) => c.code === coupon.code)) {
      setError("Coupon already applied")
      return
    }

    onApplyCoupon(coupon)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Gift Coupons</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Custom code input */}
        <div className="mb-6">
          <div className="flex space-x-2">
            <input
              type="text"
              value={customCode}
              onChange={(e) => {
                setCustomCode(e.target.value)
                setError("")
              }}
              placeholder="Enter coupon code"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleApplyCustomCode}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>

        {/* Available coupons */}
        <div className="space-y-3 max-h-60 overflow-y-auto">
          <h4 className="font-medium text-sm text-gray-500">Available Coupons</h4>
          {availableCoupons.map((coupon) => {
            const isApplied = appliedCoupons.some((c) => c.code === coupon.code)

            return (
              <div
                key={coupon.code}
                className={`p-3 border rounded-xl ${
                  isApplied
                    ? "border-green-200 bg-green-50"
                    : "border-gray-200 hover:border-blue-200 hover:bg-blue-50 cursor-pointer"
                }`}
                onClick={() => !isApplied && handleApplyCoupon(coupon)}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Tag size={16} className={isApplied ? "text-green-500" : "text-blue-500"} />
                    <div>
                      <h5 className="font-semibold text-sm">{coupon.code}</h5>
                      <p className="text-xs text-gray-500">{coupon.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="font-bold text-sm mr-2">${coupon.value.toFixed(2)}</span>
                    {isApplied && <Check size={16} className="text-green-500" />}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
