"use client"

import { useState, useRef, useEffect } from "react"
import { Tag, X, Check, Gift } from "lucide-react"
import type { GiftCoupon } from "../../types"
import { availableCoupons } from "../data/mockData"
import { usePOSDetails } from "../hooks/usePOSProfile"


interface GiftCouponPopoverProps {
  onApplyCoupon: (coupon: GiftCoupon) => void
  appliedCoupons: GiftCoupon[]
  isOpen: boolean
  onClose: () => void
  buttonRef: React.RefObject<HTMLButtonElement | null>
}

export default function GiftCouponPopover({
  onApplyCoupon,
  appliedCoupons,
  isOpen,
  onClose,
  buttonRef
}: GiftCouponPopoverProps) {
  const [couponCode, setCouponCode] = useState("")
  const [giftCardCode, setGiftCardCode] = useState("")
  const [error, setError] = useState("")
  const popoverRef = useRef<HTMLDivElement>(null)
    const { posDetails, loading: posLoading } = usePOSDetails();
const currency = posDetails?.currency
const currency_symbol = posDetails?.currency_symbol

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, buttonRef])

  const handleApplyCoupon = (code: string, type: 'coupon' | 'giftcard') => {
    if (!code.trim()) {
      setError(`Please enter a ${type} code`)
      return
    }

    // Find coupon in available coupons
    let coupon = availableCoupons.find((c) => c.code.toLowerCase() === code.toLowerCase())

    // If not found and it's a gift card, create a custom coupon
    if (!coupon && type === 'giftcard') {
      // Simulate gift card validation - in real app, this would call API
      const giftCardValue = parseFloat(code.replace(/[^0-9.]/g, '')) || 0
      if (giftCardValue > 0) {
        coupon = {
          code: code.toUpperCase(),
          value: giftCardValue,
          description: `Gift Card ${code}`
        }
      }
    }

    if (!coupon) {
      setError(`Invalid ${type} code`)
      return
    }

    if (appliedCoupons.some((c) => c.code === coupon!.code)) {
      setError(`${type === 'coupon' ? 'Coupon' : 'Gift card'} already applied`)
      return
    }

    onApplyCoupon(coupon)
    setCouponCode("")
    setGiftCardCode("")
    setError("")
    onClose()
  }

  const validateAndShowAmount = (code: string, type: 'coupon' | 'giftcard') => {
    if (!code.trim()) return null

    let coupon = availableCoupons.find((c) => c.code.toLowerCase() === code.toLowerCase())

    if (!coupon && type === 'giftcard') {
      const giftCardValue = parseFloat(code.replace(/[^0-9.]/g, '')) || 0
      if (giftCardValue > 0) {
        return giftCardValue
      }
    }

    return coupon ? coupon.value : null
  }

  const couponAmount = validateAndShowAmount(couponCode, 'coupon')
  const giftCardAmount = validateAndShowAmount(giftCardCode, 'giftcard')

  if (!isOpen) return null

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl z-50 p-4 animate-in slide-in-from-bottom-2"
    >
      {/* Arrow */}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
        <div className="w-3 h-3 bg-white dark:bg-gray-800 border-r border-b border-gray-200 dark:border-gray-600 transform rotate-45"></div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
            <Tag size={16} className="mr-2 text-beveren-600" />
            Add Discount
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
            {error}
          </div>
        )}

        {/* Coupon Code Input */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Coupon Code
          </label>
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase())
                  setError("")
                }}
                placeholder="Enter coupon code"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-beveren-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              {couponAmount && (
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-green-600 dark:text-green-400 font-medium">
                  -{currency_symbol}{couponAmount.toFixed(2)}
                </div>
              )}
            </div>
            <button
              onClick={() => handleApplyCoupon(couponCode, 'coupon')}
              disabled={!couponCode.trim()}
              className="px-3 py-2 bg-beveren-600 text-white rounded-md hover:bg-beveren-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              <Check size={14} />
            </button>
          </div>
        </div>

        {/* Gift Card Input */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Gift Card
          </label>
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={giftCardCode}
                onChange={(e) => {
                  setGiftCardCode(e.target.value.toUpperCase())
                  setError("")
                }}
                placeholder="Enter gift card code or amount"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-beveren-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              {giftCardAmount && (
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-green-600 dark:text-green-400 font-medium">
                  -{currency_symbol}{giftCardAmount.toFixed(2)}
                </div>
              )}
            </div>
            <button
              onClick={() => handleApplyCoupon(giftCardCode, 'giftcard')}
              disabled={!giftCardCode.trim()}
              className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              <Gift size={14} />
            </button>
          </div>
        </div>

        {/* Quick Coupon Options */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Quick Apply
          </label>
          <div className="grid grid-cols-2 gap-2">
            {availableCoupons.slice(0, 4).map((coupon) => {
              const isApplied = appliedCoupons.some((c) => c.code === coupon.code)
              return (
                <button
                  key={coupon.code}
                  onClick={() => handleApplyCoupon(coupon.code, 'coupon')}
                  disabled={isApplied}
                  className={`p-2 text-xs rounded-md border transition-colors ${
                    isApplied
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 border-gray-200 dark:border-gray-600 cursor-not-allowed'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-beveren-50 dark:hover:bg-beveren-900/20 hover:border-beveren-300'
                  }`}
                >
                  <div className="font-medium">{coupon.code}</div>
                  <div className="text-green-600 dark:text-green-400">-{currency_symbol}{coupon.value.toFixed(2)}</div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
