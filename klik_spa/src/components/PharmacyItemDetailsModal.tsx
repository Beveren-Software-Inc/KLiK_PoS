"use client";

import { useEffect } from "react";

interface PharmacyItemDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemName: string;
  // Pharmacy fields - check if they exist
  custom_strength?: string | null;
  custom_pharmaceutical_form?: string | null;
  custom_number_of_pack?: number | null;
  custom_pack_size?: string | null;
  custom_route_of_administration?: string | null;
  position?: 'right' | 'center'; // For list view (right) vs grid view (center)
}

export default function PharmacyItemDetailsModal({
  isOpen,
  onClose,
  itemName,
  custom_strength,
  custom_pharmaceutical_form,
  custom_number_of_pack,
  custom_pack_size,
  custom_route_of_administration,
  position = 'center',
}: PharmacyItemDetailsModalProps) {
  // Track mouse position for better hover handling
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).lastMouseX = e.clientX
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).lastMouseY = e.clientY
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  if (!isOpen) return null;

  // Check if any pharmacy fields exist
  const hasPharmacyData =
    custom_strength ||
    custom_pharmaceutical_form ||
    custom_number_of_pack !== null ||
    custom_number_of_pack !== undefined ||
    custom_pack_size ||
    custom_route_of_administration;

  if (!hasPharmacyData) {
    return null;
  }

  // Position on left of cart (left side going to right)
  // Cart is w-[35%] starting from right, so position tooltip at left edge of cart
  const positionClasses = 'fixed left-[calc(65%-8px)] top-24 z-40';

  return (
    <div
      className={`${positionClasses} pharmacy-tooltip bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 w-72 max-h-[60vh] overflow-y-auto pointer-events-auto`}
      onMouseEnter={(e) => {
        e.stopPropagation(); // Keep tooltip open when hovering
      }}
      onMouseLeave={() => {
        // Delay closing to allow moving back to product
        setTimeout(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mouseX = (window as any).lastMouseX || 0
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mouseY = (window as any).lastMouseY || 0
          const hoveredElement = document.elementFromPoint(mouseX, mouseY)
          const isOverProduct = hoveredElement?.closest('[data-pharmacy-item]')
          
          // Only close if not moving back to a product
          if (!isOverProduct) {
            onClose()
          }
        }, 200)
      }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Pharmacy Details
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
            {itemName}
          </p>
        </div>

        {/* Pharmacy Details */}
        <div className="space-y-2">
          {custom_strength && (
            <div className="flex justify-between items-start py-1">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Strength:
              </span>
              <span className="text-xs text-gray-900 dark:text-white text-right flex-1 ml-2">
                {custom_strength}
              </span>
            </div>
          )}

          {custom_pharmaceutical_form && (
            <div className="flex justify-between items-start py-1">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Form:
              </span>
              <span className="text-xs text-gray-900 dark:text-white text-right flex-1 ml-2">
                {custom_pharmaceutical_form}
              </span>
            </div>
          )}

          {(custom_number_of_pack !== null && custom_number_of_pack !== undefined) && (
            <div className="flex justify-between items-start py-1">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Packs:
              </span>
              <span className="text-xs text-gray-900 dark:text-white text-right flex-1 ml-2">
                {custom_number_of_pack}
              </span>
            </div>
          )}

          {custom_pack_size && (
            <div className="flex justify-between items-start py-1">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Pack Size:
              </span>
              <span className="text-xs text-gray-900 dark:text-white text-right flex-1 ml-2">
                {custom_pack_size}
              </span>
            </div>
          )}

          {custom_route_of_administration && (
            <div className="flex justify-between items-start py-1">
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Route:
              </span>
              <span className="text-xs text-gray-900 dark:text-white text-right flex-1 ml-2">
                {custom_route_of_administration}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
