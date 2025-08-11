import { useState, useEffect } from "react"
import { getPrintFormatHTML } from "./getPrintHTML.js"
import { usePOSDetails } from "../hooks/usePOSProfile.js"

type PrintPreviewProps = {
  invoice: {
    pos_profile: string
    name: string
    [key: string]: any
  }
}
export default function PrintPreview({ invoice }: PrintPreviewProps) {
  const [html, setHtml] = useState("")
  const [style, setStyle] = useState("")
  const [loading, setLoading] = useState(true)
   const { posDetails, loading: posLoading } = usePOSDetails();

  const printFormat = posDetails?.print_format ?? "Sales Invoice"


  useEffect(() => {
    const fetchPrintHTML = async () => {
      try {
        // const printFormat = "Sales Invoice"
        const { html, style } = await getPrintFormatHTML(invoice, printFormat)
        setHtml(html)
        setStyle(style)
      } catch (err) {
        console.error("Error loading print format", err)
      } finally {
        setLoading(false)
      }
    }

    fetchPrintHTML()
  }, [invoice])

  if (loading) return <p>Loading Print Preview...</p>

  return (
    <div className="print-preview-container p-4 bg-white shadow overflow-auto max-h-[90vh]">
      <style dangerouslySetInnerHTML={{ __html: style }} />
      <div
        className="print-preview-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
