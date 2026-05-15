// hooks/useTaxCategories.ts
import { useEffect, useState } from "react"

export interface TaxCategory {
  id: string
  name: string
  rate: number
  is_inclusive: boolean
  type: "inclusive" | "exclusive"
  tax_lines?: Array<{
    account_head: string
    charge_type: string
    rate: number
    included_in_print_rate: boolean
  }>
}

export function useSalesTaxCharges() {
  const [salesTaxCharges, setTaxCategories] = useState<TaxCategory[]>([])
  const [defaultTax, setDefaultTax] = useState<string | null>(null)
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
        setDefaultTax(data.message.default || null)

        //eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchTaxes()
  }, [])

  return { salesTaxCharges, defaultTax, isLoading, error }
}
