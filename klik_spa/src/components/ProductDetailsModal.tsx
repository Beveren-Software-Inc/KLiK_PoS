"use client"

import { useEffect, useMemo, useState } from "react"
import type { MenuItem } from "../../types"
import { usePOSProfileStore } from "../stores/posProfileStore"

interface Batch {
  batch_id: string
  qty: number
  val_rate: number
  expiry_date?: string
  manufacturing_date?: string
  warehouse: string
  serials?: SerialEntry[]
}

interface SerialEntry {
  serial_no: string
  warehouse: string
  val_rate: number
  batch_no?: string
}

interface WarehouseStock {
  warehouse: string
  bal_qty: number
  val_rate: number
}

interface PriceListEntry {
  price_list: string
  rate: number
  currency: string
  uom?: string
  customer?: string
  note?: string
  cost: number
  margin: number
  margin_pct: number
}

interface ItemFullData {
  item_name: string
  item_code: string
  standard_rate: number
  valuation_rate: number
  price_lists: PriceListEntry[]
  batches: Batch[]
  serials: SerialEntry[]
  warehouse_stock: WarehouseStock[]
  uom: string
  brand?: string
  has_batch_no: number
  has_serial_no: number
  total_bal_qty: number
  global_stock_total?: {
    total_qty: number
    total_value: number
    avg_valuation_rate: number
  }
}

interface ProductDetailsModalProps {
  item: MenuItem
  warehouse?: string
  onClose: () => void
}

const fmt = (n: number, sym = "") => `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"
const isExpired = (d?: string) => !!d && new Date(d) < new Date()
const isSoonExpiry = (d?: string) => {
  if (!d) return false
  const diff = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= 90
}

function MarginChip({ pct }: { pct: number }) {
  const cls = pct >= 30
    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
    : pct >= 10
    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
    </span>
  )
}

function BatchCard({ batch, currencySymbol, showSerials, showCost }: { batch: Batch; currencySymbol: string; showSerials: boolean; showCost: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const expired = isExpired(batch.expiry_date)
  const soonExp = isSoonExpiry(batch.expiry_date)
  const hasSerials = showSerials && batch.serials && batch.serials.length > 0

  return (
    <div className={`rounded-xl border ${
      expired 
        ? "border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-900/20" 
        : soonExp 
        ? "border-yellow-300 dark:border-yellow-700 bg-yellow-50/30 dark:bg-yellow-900/20"
        : "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/40"
    }`}>
      <div 
        className="p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600/30 transition-colors"
        onClick={() => hasSerials && setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-mono text-sm font-bold text-gray-900 dark:text-white">{batch.batch_id}</h4>
              {expired && (
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 font-semibold">
                  Expired
                </span>
              )}
              {!expired && soonExp && (
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 font-semibold">
                  Soon
                </span>
              )}
            </div>
            
            <div className="flex flex-wrap gap-3 mt-1.5 text-xs">
              <span className="text-gray-500 dark:text-gray-400">📍 {batch.warehouse}</span>
              {batch.expiry_date && (
                <span className={`${expired ? "text-red-600 dark:text-red-400" : soonExp ? "text-yellow-600 dark:text-yellow-400" : "text-gray-500 dark:text-gray-400"}`}>
                  Exp: {fmtDate(batch.expiry_date)}
                </span>
              )}
              {batch.manufacturing_date && (
                <span className="text-gray-500 dark:text-gray-400">Mfg: {fmtDate(batch.manufacturing_date)}</span>
              )}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {batch.qty.toLocaleString()} <span className="text-xs font-normal text-gray-500">units</span>
            </div>
            {showCost && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {fmt(batch.val_rate, currencySymbol)}/unit
              </div>
            )}
            {hasSerials && (
              <div className="text-xs text-beveren-600 dark:text-beveren-400 mt-1.5 flex items-center gap-1 justify-end">
                {expanded ? "▼" : "▶"} {batch.serials.length} serials
              </div>
            )}
          </div>
        </div>
      </div>
      
      {hasSerials && expanded && (
        <div className="border-t border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-800/50 p-4">
          <div className="flex flex-wrap gap-2">
            {batch.serials?.map((serial, idx) => (
              <div key={idx} className="bg-white dark:bg-gray-700 rounded-lg px-2.5 py-1 text-xs font-mono text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                {serial.serial_no}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SerialCard({ serial, currencySymbol, showCost }: { serial: SerialEntry; currencySymbol: string; showCost: boolean }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/40 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-mono text-sm font-semibold text-gray-900 dark:text-white">{serial.serial_no}</p>
          <div className="flex gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
            <span>📍 {serial.warehouse}</span>
            {serial.batch_no && <span>📦 {serial.batch_no}</span>}
          </div>
        </div>
        {showCost && (
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{fmt(serial.val_rate, currencySymbol)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProductDetailsModal({ item, onClose }: ProductDetailsModalProps) {
  const [data, setData] = useState<ItemFullData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"pricing" | "stock" | "details">("pricing")
  const { posDetails, loading } = usePOSProfileStore()

  const warehouse = useMemo(() => {
    if (loading) return null
    return posDetails?.warehouse
  }, [posDetails, loading])

  const restrictCostVisibility = useMemo(() => {
    if (loading) return true
    return posDetails?.restrict_cost_visibility_in_tooltip ?? true
  }, [posDetails, loading])

  useEffect(() => {
    const fetchFullData = async () => {
      setIsLoading(true)
      try {
        if (!warehouse) return
        const response = await fetch(
          `/api/method/klik_pos.api.item.item_details.get_full_pricing_and_batch_details?item_code=${encodeURIComponent(item.id)}&warehouse=${encodeURIComponent(warehouse)}`
        )
        const res = await response.json()
        if (res?.message) {
          console.log(res.message);
          
          setData(res.message)
        }
      } catch (error) {
        console.error("Failed to fetch product details:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchFullData()
  }, [item.id, warehouse])

  const sym = item.currency_symbol || "KES "
  const totalQty = data?.global_stock_total?.total_qty ?? data?.total_bal_qty ?? 0
  const totalValue = data?.global_stock_total?.total_value ?? 0

  const hasBatchOnly = data?.has_batch_no && !data?.has_serial_no
  const hasSerialOnly = data?.has_serial_no && !data?.has_batch_no
  const hasBoth = data?.has_batch_no && data?.has_serial_no

  const tabs = [
    { key: "pricing" as const, label: "Pricing & Warehouse" },
    { key: "stock" as const, label: hasBoth ? "Batches & Serials" : hasBatchOnly ? "Batches" : hasSerialOnly ? "Serials" : "Stock" },
    { key: "details" as const, label: "Details" },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300">

        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4 flex-1">
              {item.image ? (
                <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover border border-gray-200 dark:border-gray-600" crossOrigin="anonymous" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-beveren-100 dark:bg-beveren-900/30 flex items-center justify-center text-beveren-600 dark:text-beveren-400 font-bold text-lg">
                  {item.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{item.name}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{item.id}</p>
                  {item.category && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.category}</p>
                    </>
                  )}
                  {data?.brand && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{data.brand}</p>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase font-semibold">Total Stock (All Warehouses)</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {totalQty.toLocaleString()} <span className="text-sm font-normal text-gray-500">{data?.uom}</span>
              </p>
              {totalValue > 0 && !restrictCostVisibility && (
                <p className="text-xs text-gray-500 mt-0.5">Value: {fmt(totalValue, sym)}</p>
              )}
            </div>
            
            <button onClick={onClose} className="ml-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-beveren-500 border-t-transparent" />
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading product details...</p>
          </div>
        ) : (
          <>
            <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 shrink-0 overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-3 font-medium text-sm transition-colors relative whitespace-nowrap ${
                    activeTab === tab.key
                      ? "text-beveren-600 dark:text-beveren-400"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-beveren-500 rounded-full" />}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {activeTab === "pricing" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Price Lists</h3>
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
                      <table className="w-full text-sm min-w-[600px]">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                            <th className="text-left p-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase">Price List</th>
                            <th className="text-right p-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase">Rate</th>
                            {!restrictCostVisibility && (
                              <>
                                <th className="text-right p-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase">Cost</th>
                                <th className="text-right p-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase">Margin</th>
                                <th className="text-center p-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase">Margin %</th>
                              </>
                            )}
                            <th className="text-left p-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase">Customer</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data?.price_lists ?? []).map((pl, idx) => (
                            <tr key={idx} className="border-b border-gray-100 dark:border-gray-700/60 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                              <td className="p-3 font-medium text-gray-900 dark:text-white">{pl.price_list}</td>
                              <td className="p-3 text-right font-bold text-beveren-600 dark:text-beveren-400">{fmt(pl.rate, `${pl.currency} `)}</td>
                              {!restrictCostVisibility && (
                                <>
                                  <td className="p-3 text-right text-gray-600 dark:text-gray-400">{fmt(pl.cost, `${pl.currency} `)}</td>
                                  <td className={`p-3 text-right font-semibold ${pl.margin >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                    {pl.margin >= 0 ? "+" : ""}{fmt(pl.margin, `${pl.currency} `)}
                                   </td>
                                  <td className="p-3 text-center"><MarginChip pct={pl.margin_pct} /></td>
                                </>
                              )}
                              <td className="p-3">
                                {pl.customer ? (
                                  <span className="text-xs text-beveren-600 dark:text-beveren-400">{pl.customer}</span>
                                ) : (
                                  <span className="text-xs text-gray-400">All Customers</span>
                                )}
                               </td>
                             </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Warehouse Stock</h3>
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                          <tr>
                            <th className="text-left p-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase">Warehouse</th>
                            <th className="text-right p-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase">Quantity</th>
                            {!restrictCostVisibility && (
                              <th className="text-right p-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase">Rate</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                          {(data?.warehouse_stock ?? []).map((wh, idx) => (
                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                              <td className="p-3 font-medium text-gray-900 dark:text-white">{wh.warehouse}</td>
                              <td className="p-3 text-right font-semibold text-gray-900 dark:text-white">{wh.bal_qty.toLocaleString()}</td>
                              {!restrictCostVisibility && (
                                <td className="p-3 text-right text-gray-600 dark:text-gray-400">{fmt(wh.val_rate, sym)}</td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              
              {activeTab === "stock" && (
                <div className="space-y-4">
                  {hasBoth ? (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Batches with Serial Numbers</h3>
                        <div className="text-xs text-gray-500">
                          {data?.batches?.reduce((sum, b) => sum + (b.serials?.length || 0), 0)} total serials
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {(data?.batches ?? []).map((batch, idx) => (
                          <BatchCard key={idx} batch={batch} currencySymbol={sym} showSerials={true} showCost={!restrictCostVisibility} />
                        ))}
                      </div>
                    </>
                  ) : hasBatchOnly ? (
                    <>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Batches</h3>
                      <div className="grid grid-cols-1 gap-3">
                        {(data?.batches ?? []).map((batch, idx) => (
                          <BatchCard key={idx} batch={batch} currencySymbol={sym} showSerials={false} showCost={!restrictCostVisibility} />
                        ))}
                      </div>
                    </>
                  ) : hasSerialOnly ? (
                    <>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Serial Numbers ({data?.serials?.length ?? 0})</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(data?.serials ?? []).map((serial, idx) => (
                          <SerialCard key={idx} serial={serial} currencySymbol={sym} showCost={!restrictCostVisibility} />
                        ))}
                      </div>
                    </>
                  ) : (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Warehouse Stock</h3>
                      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                            <tr>
                              <th className="text-left p-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase">Warehouse</th>
                              <th className="text-right p-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase">Quantity</th>
                              {!restrictCostVisibility && (
                                <th className="text-right p-3 font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase">Rate</th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                            {(data?.warehouse_stock ?? []).map((wh, idx) => (
                              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                                <td className="p-3 font-medium text-gray-900 dark:text-white">{wh.warehouse}</td>
                                <td className="p-3 text-right font-semibold text-gray-900 dark:text-white">{wh.bal_qty.toLocaleString()}</td>
                                {!restrictCostVisibility && (
                                  <td className="p-3 text-right text-gray-600 dark:text-gray-400">{fmt(wh.val_rate, sym)}</td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "details" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-2">Basic Information</p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Item Code</span>
                        <span className="text-xs font-mono font-semibold text-gray-900 dark:text-white">{item.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Item Name</span>
                        <span className="text-xs font-semibold text-gray-900 dark:text-white">{item.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Category</span>
                        <span className="text-xs text-gray-700 dark:text-gray-300">{item.category || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">UOM</span>
                        <span className="text-xs font-semibold text-gray-900 dark:text-white">{data?.uom ?? "—"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Brand</span>
                        <span className="text-xs text-gray-700 dark:text-gray-300">{data?.brand || "—"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-2">Tracking</p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs text-gray-500">Type</span>
                        <span className="text-xs font-semibold text-beveren-600 dark:text-beveren-400">
                          {hasBoth ? "Batch + Serial" : hasBatchOnly ? "Batch Tracked" : hasSerialOnly ? "Serial Tracked" : "Basic Stock"}
                        </span>
                      </div>
                      {hasBoth && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-500">Total Batches</span>
                            <span className="text-xs font-semibold text-gray-900 dark:text-white">{data?.batches?.length ?? 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-500">Total Serials</span>
                            <span className="text-xs font-semibold text-gray-900 dark:text-white">{data?.serials?.length ?? 0}</span>
                          </div>
                        </>
                      )}
                      {hasBatchOnly && (
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-500">Total Batches</span>
                          <span className="text-xs font-semibold text-gray-900 dark:text-white">{data?.batches?.length ?? 0}</span>
                        </div>
                      )}
                      {hasSerialOnly && (
                        <div className="flex justify-between">
                          <span className="text-xs text-gray-500">Total Serials</span>
                          <span className="text-xs font-semibold text-gray-900 dark:text-white">{data?.serials?.length ?? 0}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {!restrictCostVisibility && (
                    <div className="md:col-span-2 bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-2">Valuation</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Standard Rate</p>
                          <p className="text-base font-bold text-gray-900 dark:text-white">{fmt(data?.standard_rate ?? 0, sym)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Avg Valuation Rate</p>
                          <p className="text-base font-bold text-gray-900 dark:text-white">{fmt(data?.valuation_rate ?? 0, sym)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Method</p>
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Moving Average</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {item.description && (
                    <div className="md:col-span-2 bg-gray-50 dark:bg-gray-700/40 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-2">Description</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{item.description}</p>
                    </div>
                  )}
                </div>
              )}

            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 shrink-0">
              <button onClick={onClose} className="w-full px-6 py-2.5 bg-beveren-600 hover:bg-beveren-700 text-white font-semibold rounded-lg transition-all active:scale-[0.98]">
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}