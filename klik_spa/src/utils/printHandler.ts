import { toast } from "react-toastify";
import { markInvoiceAsPrinted } from "../services/salesInvoice";

interface Invoice {
  name?: string;
  id?: string;
  pos_profile: string;
  custom_is_printed?: boolean | number;
  [key: string]: unknown;
}

interface PrintOptions {
  preventReprint?: boolean;
  onAfterMark?: () => void;
  posDetails?: {
    print_format?: string;
    letter_head?: string | null;
    [key: string]: unknown;
  } | null;
}

export function handlePrintInvoice(invoiceData: Invoice | null, options: PrintOptions = {}) {
  if (!invoiceData) {
    toast.error("No invoice data available for printing");
    return;
  }

  const isAlreadyPrinted = Boolean(invoiceData.custom_is_printed);
  if (isAlreadyPrinted && options.preventReprint) {
    toast.error("Reprinting is not allowed for this invoice");
    return;
  }

  const invoiceName = invoiceData.name || invoiceData.id;
  if (!invoiceName) {
    toast.error("Invoice name is missing");
    return;
  }

  const printFormat = options.posDetails?.print_format || "";
  const letterHead = options.posDetails?.letter_head || 0;

  const baseUrl = window.location.origin;
  const url =
    baseUrl +
    "/printview?doctype=Sales%20Invoice" +
    "&name=" + encodeURIComponent(invoiceName) +
    "&format=" + encodeURIComponent(printFormat) +
    "&no_letterhead=" + (letterHead ? 0 : 1);

  // Remove any previous print iframe
  const existingFrame = document.getElementById("klik-print-frame");
  if (existingFrame) existingFrame.remove();

  const iframe = document.createElement("iframe");
  iframe.id = "klik-print-frame";
  iframe.src = url;
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;";
  document.body.appendChild(iframe);

  iframe.addEventListener("load", () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      toast.error("Unable to print. Try allowing pop-ups or use the print button in the preview.");
    } finally {
      // Clean up after print dialog closes
      setTimeout(() => iframe.remove(), 60000);
    }
  });

  // Mark invoice as printed
  markInvoiceAsPrinted(invoiceName)
    .then(() => options.onAfterMark?.())
    .catch((err) => {
      console.error("Error marking invoice as printed:", err);
      toast.error("Failed to mark invoice as printed");
    });
}
