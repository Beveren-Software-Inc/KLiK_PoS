"use client"

import { useI18n } from "../hooks/useI18n"
import type { MenuItem } from "../../types"

interface ProductCardProps {
  item: MenuItem
  onAddToCart: (item: MenuItem) => void
  isMobile?: boolean
  scannerOnly?: boolean
  cartQuantity?: number
}

export default function ProductCard({
  item,
  onAddToCart,
  isMobile = false,
  scannerOnly = false,
  cartQuantity = 0,
}: ProductCardProps) {
  const { tl } = useI18n()
  const isOutOfStock = item.available <= 0
  const isDisabled = isOutOfStock || scannerOnly
  const isInCart = cartQuantity > 0

  // Format price based on currency
  const formattedPrice = `${item.currency_symbol}${item.price.toFixed(2)}`

return (
    <div
      className={`overflow-hidden rounded-[26px] border transition-all duration-200 ${
        isInCart
          ? "border-app-primary/45 bg-app-primary/[0.06] shadow-[0_24px_60px_rgba(19,127,236,0.18)] ring-2 ring-app-primary/15"
          : "border-app-border bg-app-surface"
      } ${
        isDisabled
          ? "opacity-70 cursor-not-allowed"
          : "cursor-pointer hover:-translate-y-1 hover:border-app-primary/40 hover:shadow-[0_24px_60px_rgba(0,0,0,0.3)] active:scale-95"
      } ${isMobile ? "touch-manipulation" : ""}`}
      onClick={() => !isDisabled && onAddToCart(item)}
    >
      {/* Image - Maintain same size for consistency */}
      <div className="relative">
        <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
          {item.discount && (
            <div className="rounded-md bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white">
              -{item.discount}%
            </div>
          )}
          {isInCart && (
            <div className="rounded-full bg-app-primary px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg">
              {tl("In cart x{{count}}", { count: cartQuantity })}
            </div>
          )}
        </div>

        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className={`w-full object-cover ${isMobile ? "h-24" : "h-32"}`}
            crossOrigin="anonymous"
          />
        ) : (
          <div className={`flex w-full items-center justify-center ${isMobile ? "h-24" : "h-32"} bg-app-elevated`}>
            <div className="text-sm font-medium text-app-muted">
              {tl("No Image")}
            </div>
          </div>
        )}
        {!isOutOfStock && (
          <div className="absolute top-2 right-2 rounded-full border border-app-border bg-app-elevated px-2 py-1 text-xs font-medium text-foreground shadow-lg">
            {item.available}
          </div>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 backdrop-blur-[1px]">
            <span className="text-white font-bold text-xs">{tl("Out of Stock")}</span>
          </div>
        )}
        {scannerOnly && !isOutOfStock && (
          <div className="absolute inset-0  flex items-center justify-center">
            <span className="rounded-full border border-app-primary/30 bg-app-surface/90 px-3 py-1 text-xs font-semibold text-app-primary shadow-sm backdrop-blur-sm">
              {tl("Scan Only")}
            </span>
          </div>
        )}
      </div>
      <div className={`${isMobile ? "h-14 p-3" : "h-20 p-4"} flex flex-col justify-between`}>
        <div>
          <h3 className={`truncate font-semibold text-foreground ${isMobile ? "text-xs" : "text-sm"}`}>
            {item.name}
          </h3>
          {isInCart && !isMobile && (
            <p className="mt-1 text-[11px] font-medium text-app-primary">
              {tl("Selected in cart")}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className={`capitalize text-app-muted ${isMobile ? "text-xs" : "text-xs"}`}>
            {item.category}
          </p>
          <span className={`font-bold text-app-primary ${isMobile ? "text-xs" : "text-sm"}`}>
            {formattedPrice}
          </span>
        </div>
      </div>
    </div>
  )
}
