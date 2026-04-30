import { useState, useEffect } from "react";
import { getPrintFormatHTML } from "./getPrintHTML.js";
import { usePOSProfileStore } from "../stores/posProfileStore.js";

type PrintPreviewProps = {
  invoice: {
    pos_profile: string;
    name: string;
    [key: string]: unknown;
  };
};

export default function PrintPreview({ invoice }: PrintPreviewProps) {
  const [html, setHtml] = useState("");
  const [style, setStyle] = useState("");
  const [loading, setLoading] = useState(true);

  const { posDetails, loading: posLoading } = usePOSProfileStore();

  useEffect(() => {
    const fetchPrintHTML = async () => {
      // Wait until posDetails is loaded
      if (posLoading || !posDetails) return;

      setLoading(true);
      try {
        // console.log("Fetching print format for invoice:", printFormat);
        // Convert invoice to the format expected by getPrintFormatHTML
        const invoiceName = typeof invoice.name === 'string' ? invoice.name : '';
        const invoiceForAPI: { doctype: string; name: string; [key: string]: unknown } = {
          ...invoice,
          doctype: 'Sales Invoice',
          name: invoiceName
        };
        const { html, style } = await getPrintFormatHTML(invoiceForAPI, posDetails?.print_format as string);
        setHtml(html);
        setStyle(style);
      } catch (err) {
        console.error("Error loading print format:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPrintHTML();
  }, [invoice, posDetails, posLoading, posDetails?.print_format ]); // re-run when posDetails or invoice changes

  if (loading) return <p>Loading Print Preview...</p>;

  return (
    <div className="print-preview-container p-4 relative bg-white text-gray-900 dark:bg-gray-800 dark:text-white shadow overflow-auto max-h-[90vh]">
      <style dangerouslySetInnerHTML={{ __html: style }} />
      <div
        className="print-preview-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
