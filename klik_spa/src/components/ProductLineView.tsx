"use client"

import { useI18n } from "../hooks/useI18n"
import type { MenuItem } from "../../types"

interface ProductLineViewProps {
  items: MenuItem[]
  onAddToCart: (item: MenuItem) => void
  isMobile?: boolean
  scannerOnly?: boolean
  cartQuantities?: Map<string, number>
}

export default function ProductLineView({
  items,
  onAddToCart,
  isMobile = false,
  scannerOnly = false,
  cartQuantities,
}: ProductLineViewProps) {
  const { tl } = useI18n()

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="mb-2 text-lg font-semibold text-foreground">{tl("No items found")}</h3>
          <p className="text-app-muted">{tl("Try adjusting your search or filters")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`${isMobile ? "p-4" : "p-2"} bg-transparent`}>
      {/* Header Row */}
      <div className="mb-4 overflow-hidden rounded-[28px] border border-app-border bg-app-surface">
        <div className={`${isMobile ? "grid grid-cols-8 gap-2 px-3 py-3" : "grid grid-cols-12 gap-4 px-4 py-3"} border-b border-app-border bg-app-elevated`}>
          <div className={`${isMobile ? "col-span-3" : "col-span-4"}`}>
            <span className="text-xs font-semibold text-app-muted">{tl("Product")}</span>
          </div>
          <div className={`${isMobile ? "col-span-2" : "col-span-2"} text-center`}>
            <span className="text-xs font-semibold text-app-muted">{tl("Rate")}</span>
          </div>
          <div className={`${isMobile ? "col-span-2" : "col-span-2"} text-center`}>
            <span className="text-xs font-semibold text-app-muted">{tl("Qty")}</span>
          </div>
          {!isMobile && (
            <div className="col-span-2 text-center">
              <span className="text-sm font-semibold text-app-muted">{tl("UOM")}</span>
            </div>
          )}
          <div className={`${isMobile ? "col-span-1" : "col-span-2"} text-center`}>
            <span className="text-xs font-semibold text-app-muted">{tl("Action")}</span>
          </div>
        </div>

        {/* Product Rows */}
        <div className="divide-y divide-app-border">
          {items.map((item) => {
            const isOutOfStock = item.available <= 0
            const isDisabled = isOutOfStock || scannerOnly
            const cartQuantity = cartQuantities?.get(item.id) ?? 0
            const isInCart = cartQuantity > 0
            const formattedPrice = `${item.currency_symbol}${item.price.toFixed(2)}`

            return (
              <div
                key={item.id}
                className={`${isMobile ? "grid grid-cols-8 gap-2 px-3 py-3" : "grid grid-cols-12 gap-4 px-4 py-3"} transition-colors hover:bg-app-elevated ${
                  isInCart ? "bg-app-primary/[0.06] ring-1 ring-inset ring-app-primary/20" : ""
                } ${
                  isDisabled ? "opacity-60" : "cursor-pointer"
                }`}
                onClick={() => !isDisabled && onAddToCart(item)}
              >
                {/* Product Name */}
                <div className={`${isMobile ? "col-span-3" : "col-span-4"} flex items-start`}>
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-medium text-foreground ${isMobile ? "text-xs leading-tight" : "text-sm"} ${
                      isMobile ? "break-words" : "truncate"
                    }`}>
                      {item.name}
                    </h3>
                    <p className={`text-app-muted ${isMobile ? "text-xs leading-tight" : "text-sm"} ${
                      isMobile ? "break-words" : "truncate"
                    }`}>
                      {item.category}
                    </p>
                    {isInCart && (
                        <span className="mt-1 inline-flex rounded-full bg-app-primary/12 px-2 py-0.5 text-[11px] font-semibold text-app-primary">
                        {tl("In cart x{{count}}", { count: cartQuantity })}
                        </span>
                    )}
                  </div>
                </div>

                {/* Rate */}
                <div className={`${isMobile ? "col-span-2" : "col-span-2"} flex items-center justify-center`}>
                  <span className={`font-semibold text-app-primary ${isMobile ? "text-xs" : "text-sm"}`}>
                    {formattedPrice}
                  </span>
                </div>

                {/* Available Qty */}
                <div className={`${isMobile ? "col-span-2" : "col-span-2"} flex items-center justify-center`}>
                  <span className={`font-medium ${isMobile ? "text-xs" : "text-sm"} ${
                    isOutOfStock
                      ? "text-rose-500 dark:text-rose-300"
                      : "text-foreground"
                  }`}>
                    {isOutOfStock ? "0" : item.available}
                  </span>
                </div>

                {/* UOM - Desktop only */}
                {!isMobile && (
                  <div className="col-span-2 flex items-center justify-center">
                    <span className="text-sm text-app-muted">
                      {item.uom || "Nos"}
                    </span>
                  </div>
                )}

                {/* Action */}
                <div className={`${isMobile ? "col-span-1" : "col-span-2"} flex items-center justify-center`}>
                  {isDisabled ? (
                    <span className={`text-app-muted ${isMobile ? "text-xs" : "text-xs"}`}>
                      {isOutOfStock ? "0" : "S"}
                    </span>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddToCart(item)
                      }}
                      className={`app-touch-target rounded-xl border border-app-primary/20 bg-app-primary/10 font-medium text-app-primary transition-colors hover:bg-app-primary hover:text-white active:scale-[0.98] ${
                        isMobile ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
                      }`}
                    >
                      {isMobile ? "+" : tl("Add")}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
