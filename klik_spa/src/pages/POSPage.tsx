import { useI18n } from "../hooks/useI18n"
import RetailPOSLayout from "../components/RetailPOSLayout"

export default function MainPOSScreen() {
  const { isRTL } = useI18n()

  return (
    <div className={`min-h-screen bg-gray-50 ${isRTL ? "rtl" : "ltr"}`}>
      <RetailPOSLayout />
    </div>
  )
}
