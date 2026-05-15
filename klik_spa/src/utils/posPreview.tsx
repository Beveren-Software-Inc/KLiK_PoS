import { useState, useEffect, useRef } from "react";
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
  const lastLoadedKeyRef = useRef<string>("");

  const { posDetails, isLoading: posLoading } = usePOSProfileStore();
  const invoiceName = typeof invoice?.name === "string" ? invoice.name : "";
  const posProfile = typeof invoice?.pos_profile === "string" ? invoice.pos_profile : "";
  const printFormat = typeof posDetails?.print_format === "string" ? posDetails.print_format : "";

  useEffect(() => {
    let isCancelled = false;

    const fetchPrintHTML = async () => {
      // Wait until posDetails is loaded
      if (posLoading || !posDetails) return;

      const requestKey = `${invoiceName}::${posProfile}::${printFormat}`;
      if (requestKey === lastLoadedKeyRef.current && html) {
        return;
      }

      setLoading(true);
      try {
        const invoiceForAPI: { doctype: string; name: string; [key: string]: unknown } = {
          ...invoice,
          doctype: "Sales Invoice",
          name: invoiceName,
        };

        const { html: previewHtml, style: previewStyle } = await getPrintFormatHTML(
          invoiceForAPI,
          printFormat
        );

        if (isCancelled) return;

        setHtml(previewHtml);
        setStyle(previewStyle);
        lastLoadedKeyRef.current = requestKey;
      } catch (err) {
        if (!isCancelled) {
          console.error("Error loading print format:", err);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchPrintHTML();

    return () => {
      isCancelled = true;
    };
  }, [invoice, invoiceName, posProfile, posLoading, posDetails, printFormat, html]);

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
