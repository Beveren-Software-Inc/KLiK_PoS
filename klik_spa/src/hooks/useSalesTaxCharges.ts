// hooks/useTaxCategories.ts
import { useEffect, useState } from "react"

export interface TaxCategory {
  id: string
  name: string
  rate: number
}

export function useSalesTaxCharges() {
  const [salesTaxCharges, setTaxCategories] = useState<TaxCategory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTaxes = async () => {
      setIsLoading(true)
      try {
        const res = await fetch("/api/method/klik_pos.api.tax.get_sales_tax_categories")
        const data = await res.json()

        if (!data.message?.success) {
          throw new Error(data.message?.error || "Failed to fetch tax categories")
        }

        setTaxCategories(data.message.data || [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTaxes()
  }, [])

  return { salesTaxCharges, isLoading, error }
}
