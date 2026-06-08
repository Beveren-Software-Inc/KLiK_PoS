import { useState } from 'react'
import { useProducts } from './useProducts'
import type { MenuItem } from '../../types'

interface UseBarcodeScannerReturn {
  scanBarcode: (barcode: string) => Promise<boolean>
  isScanning: boolean
  error: string | null
  clearError: () => void
}

export function useBarcodeScanner(onAddToCart: (item: MenuItem) => void): UseBarcodeScannerReturn {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { products } = useProducts()

  const clearError = () => setError(null)

  const scanBarcode = async (barcode: string): Promise<boolean> => {
    if (!barcode.trim()) {
      setError('Please enter a valid barcode')
      return false
    }

    setIsScanning(true)
    setError(null)

    try {
      // First try to find by barcode in the products list
      // Note: This assumes barcode is stored in the item data
      // You may need to modify the API to include barcode information
      const foundItem = products.find(item => {
        // For now, we'll search by item ID or name
        // In a real implementation, you'd have a barcode field
        return item.id === barcode ||
               item.name.toLowerCase().includes(barcode.toLowerCase())
      })

      if (foundItem) {
        onAddToCart(foundItem)
        return true
      }

      // If not found in local products, try API call
      try {
        // First try combined identifier endpoint (barcode/batch/serial)
        const response = await fetch(`/api/method/klik_pos.api.item.item_search.get_item_by_identifier?code=${encodeURIComponent(barcode)}`)
        const data = await response.json()

        if (data.message && data.message.item_code) {
          // Convert API response to MenuItem format
          const isStockItem = data.message.is_stock_item !== false;
          const item = {
            id: data.message.item_code,
            name: data.message.item_name || data.message.item_code,
            category: data.message.item_group || 'General',
            price: data.message.price || 0,
            available: data.message.available || 0,
            is_stock_item: isStockItem,
            is_product_bundle: data.message.is_product_bundle || false,
            bundle_items: data.message.bundle_items || [],
            is_variant_template: data.message.is_variant_template || false,
            has_variants: data.message.has_variants || false,
            variant_of: data.message.variant_of,
            variant_based_on: data.message.variant_based_on,
            image: data.message.image,
            sold: 0
          }
          onAddToCart(item)
          return true
        } else {
          setError('Product not found for this barcode')
          return false
        }
      } catch (apiError) {
        console.error('API error:', apiError)
        setError('Product not found for this barcode')
        return false
      }
    } catch (err) {
      console.error('Barcode scanning error:', err)
      setError('Error processing barcode')
      return false
    } finally {
      setIsScanning(false)
    }
  }

  return {
    scanBarcode,
    isScanning,
    error,
    clearError
  }
}
