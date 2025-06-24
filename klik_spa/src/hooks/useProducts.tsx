import { useState, useEffect, useCallback } from "react"
import type { MenuItem } from "../../types"
import { mockMenuItems } from "../data/mockData"
import erpnextAPI from "../services/erpnext-api"

interface UseProductsReturn {
  products: MenuItem[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  liveDataCount: number
  mockDataCount: number
}

export function useProducts(): UseProductsReturn {
  const [products, setProducts] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [liveDataCount, setLiveDataCount] = useState(0)
  const [mockDataCount, setMockDataCount] = useState(0)

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      console.log("🔄 Starting product fetch...")

      // First test the API connection
      const connectionTest = await erpnextAPI.testConnection()
      console.log("🧪 API connection test result:", connectionTest)

      if (!connectionTest.success) {
        console.warn("⚠️ API connection failed, using mock data only")
        setProducts(mockMenuItems)
        setLiveDataCount(0)
        setMockDataCount(mockMenuItems.length)
        setLoading(false)
        return
      }

      // Try to fetch items from ERPNext
      console.log("📦 Fetching live products from ERPNext...")
      
      try {
        // Use ERPNext API to get Item doctype
        const items = await erpnextAPI.getDocList('Item', 
          ['name', 'item_name', 'description', 'standard_rate', 'item_group', 'image'], 
          { disabled: 0 }
        )
        
        console.log("📊 ERPNext items response:", items)

        if (items && Array.isArray(items)) {
          // Transform ERPNext items to our MenuItem format
          const liveProducts: MenuItem[] = items.slice(0, 50).map((item: any) => ({
            id: item.name,
            name: item.item_name || item.name,
            description: item.description || '',
            price: parseFloat(item.standard_rate) || 0,
            category: item.item_group || 'General',
            image: item.image || '/placeholder-item.png',
            available: parseInt(item.actual_qty) || 0, // Use actual quantity from ERPNext
            sold: 0, // Default sold count
            preparationTime: 10 // Default preparation time
          }))

          // Combine live data with mock data
          const combinedProducts = [...liveProducts, ...mockMenuItems]

          setProducts(combinedProducts)
          setLiveDataCount(liveProducts.length)
          setMockDataCount(mockMenuItems.length)

          console.log(`✅ Loaded ${liveProducts.length} live products and ${mockMenuItems.length} mock products`)
        } else {
          throw new Error("Invalid items response format")
        }
      } catch (itemError) {
        console.warn("⚠️ ERPNext items fetch failed, trying alternative approach:", itemError)
        
        // Fallback: use mock data only
        setProducts(mockMenuItems)
        setLiveDataCount(0)
        setMockDataCount(mockMenuItems.length)
        console.log("📦 Using mock data only")
      }
      
    } catch (err) {
      console.error("💥 Error in product fetch:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch products"
      setError(errorMessage)

      // Fallback to mock data only
      setProducts(mockMenuItems)
      setLiveDataCount(0)
      setMockDataCount(mockMenuItems.length)

      console.log("⚠️ Using mock data only due to error:", errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  return {
    products,
    loading,
    error,
    refetch: fetchProducts,
    liveDataCount,
    mockDataCount,
  }
}
