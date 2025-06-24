import { useState, useEffect } from "react"
import { useParams } from "react-router-dom"
import { useI18n } from "../hooks/useI18n"
import NavBar from "../components/NavBar"
import PaymentMethodCard from "../components/PaymentMethodCard"
import QRCodeDisplay from "../components/QRCodeDisplay"

interface InvoiceData {
  invoiceId: string
  dateTime: string
  items: Array<{
    itemCode: string
    nameEn: string
    nameAr: string
    qty: number
    unitPrice: number
    lineTotal: number
  }>
  subtotal: number
  vat: number
  total: number
  qrCodeURL: string
}

export default function PaymentScreen() {
  const params = useParams()
  const invoiceId = params.invoiceId as string
  const { t, isRTL } = useI18n()
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInvoiceData()
  }, [invoiceId])

  const loadInvoiceData = async () => {
    try {
      // Simulate ERPNext API call
      const mockData: InvoiceData = {
        invoiceId: invoiceId,
        dateTime: new Date().toISOString(),
        items: [
          {
            itemCode: "ITEM001",
            nameEn: "Wireless Headphones",
            nameAr: "سماعات لاسلكية",
            qty: 1,
            unitPrice: 299.0,
            lineTotal: 299.0,
          },
        ],
        subtotal: 299.0,
        vat: 14.95,
        total: 313.95,
        qrCodeURL: "/placeholder.svg?height=128&width=128",
      }
      setInvoiceData(mockData)
    } catch (error) {
      console.error("Failed to load invoice data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentMethodSelect = (method: string) => {
    setSelectedPaymentMethod(method)
  }

  const handleConfirmPayment = async () => {
    if (!selectedPaymentMethod || !invoiceData) return

    try {
      // Process payment based on selected method
      console.log("Processing payment:", selectedPaymentMethod, invoiceData.invoiceId)
      // Navigate to receipt screen
    } catch (error) {
      console.error("Payment failed:", error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
      </div>
    )
  }

  if (!invoiceData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">{t("INVOICE_NOT_FOUND")}</h2>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${isRTL ? "rtl" : "ltr"}`}>
      <NavBar />

      <div className="max-w-4xl mx-auto p-4">
        {/* Invoice Summary */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">{t("INVOICE_SUMMARY")}</h2>

          <div className="mb-4">
            <div className="text-sm text-gray-600 mb-2">
              {t("INVOICE_ID")}: {invoiceData.invoiceId}
            </div>
            <div className="text-sm text-gray-600">
              {t("DATE_TIME")}: {new Date(invoiceData.dateTime).toLocaleString()}
            </div>
          </div>

          <div className="border-t pt-4">
            {invoiceData.items.map((item, index) => (
              <div key={index} className="flex justify-between items-center py-2">
                <div>
                  <div className="font-medium">{isRTL ? item.nameAr : item.nameEn}</div>
                  <div className="text-sm text-gray-600">
                    {item.qty} × ₨ {item.unitPrice.toFixed(2)}
                  </div>
                </div>
                <div className="font-semibold">₨ {item.lineTotal.toFixed(2)}</div>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 mt-4">
            <div className="flex justify-between py-1">
              <span>{t("SUBTOTAL")}</span>
              <span>₨ {invoiceData.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>{t("VAT")} (5%)</span>
              <span>₨ {invoiceData.vat.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-2 font-bold text-lg border-t">
              <span>{t("TOTAL")}</span>
              <span>₨ {invoiceData.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <QRCodeDisplay qrCodeURL={invoiceData.qrCodeURL} caption={t("SCAN_TO_VERIFY")} />
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">{t("PAYMENT_METHODS")}</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <PaymentMethodCard
              method="cash"
              title={t("CASH")}
              icon="cash"
              selected={selectedPaymentMethod === "cash"}
              onSelect={() => handlePaymentMethodSelect("cash")}
              total={invoiceData.total}
            />

            <PaymentMethodCard
              method="card"
              title={t("CARD")}
              icon="card"
              selected={selectedPaymentMethod === "card"}
              onSelect={() => handlePaymentMethodSelect("card")}
              total={invoiceData.total}
            />

            <PaymentMethodCard
              method="wallet"
              title={t("DIGITAL_WALLET")}
              icon="wallet"
              selected={selectedPaymentMethod === "wallet"}
              onSelect={() => handlePaymentMethodSelect("wallet")}
              total={invoiceData.total}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row gap-4">
          <button className="text-green-700 hover:text-green-800 font-medium">{t("BACK_TO_CART")}</button>

          <button
            onClick={handleConfirmPayment}
            disabled={!selectedPaymentMethod}
            className="flex-1 bg-green-700 text-white py-3 px-6 rounded-md hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {t("CONFIRM_PAYMENT")}
          </button>
        </div>
      </div>
    </div>
  )
}
