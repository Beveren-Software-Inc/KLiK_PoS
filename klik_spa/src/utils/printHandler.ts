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
}

export function handlePrintInvoice(invoiceData: Invoice | null, options: PrintOptions = {}) {
  console.log('Print function called with:', invoiceData);

  if (!invoiceData) {
    toast.error("No invoice data available for printing");
    return;
  }

  const isAlreadyPrinted = Boolean(invoiceData.custom_is_printed);
  if (isAlreadyPrinted && options.preventReprint) {
    toast.error("Reprinting is not allowed for this invoice");
    return;
  }

  const printElement = document.querySelector('.print-preview-container');
  if (!printElement) {
    toast.error("Print preview not found");
    return;
  }

  console.log('Print element found:', printElement);

  // Set custom filename for PDF
  const invoiceName = invoiceData.name || invoiceData.id || 'Invoice';
  const originalTitle = document.title;
  document.title = `${invoiceName}`;

  console.log('Setting title to:', invoiceName);

  // Store original styles
  const originalBodyStyle = document.body.style.cssText;
  const originalPrintElementStyle = (printElement as HTMLElement).style.cssText;

  // Create a temporary print overlay
  const printOverlay = document.createElement('div');
  printOverlay.innerHTML = printElement.innerHTML;
  printOverlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    overflow: auto;
    display: flex;
    justify-content: center;
  `;

  const printContent = document.createElement('div');
  printContent.innerHTML = printOverlay.innerHTML;
  printOverlay.innerHTML = '';
  printContent.style.cssText = `
    background: white;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    height: fit-content;
    min-height: 100%;
  `;
  printOverlay.appendChild(printContent);

  // Hide the original page content
  document.body.style.cssText = `
    overflow: hidden;
  `;

  // Hide all direct children of body except our overlay
  const bodyChildren = Array.from(document.body.children);
  bodyChildren.forEach((child) => {
    if (child !== printOverlay) {
      (child as HTMLElement).style.display = 'none';
    }
  });

  // Add the print overlay
  document.body.appendChild(printOverlay);

  // Add print-specific styles
  const printStyles = document.createElement('style');
  printStyles.textContent = `
    @media print {
      body * {
        visibility: hidden;
      }
      .print-overlay .print-content, .print-overlay .print-content * {
        visibility: visible;
      }
      .print-overlay .print-content {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        padding: 0 !important;
      }
    }
    @page {
      size: A4;
      margin: 1cm;
    }
  `;
  printOverlay.className = 'print-overlay';
  printContent.className = 'print-content';
  document.head.appendChild(printStyles);

  console.log('Print overlay created and added');

  const restorePage = () => {
    console.log('Restoring page...');

    // Remove print overlay
    if (printOverlay.parentNode) {
      printOverlay.parentNode.removeChild(printOverlay);
    }

    if (printStyles.parentNode) {
      printStyles.parentNode.removeChild(printStyles);
    }

    document.body.style.cssText = originalBodyStyle;
    (printElement as HTMLElement).style.cssText = originalPrintElementStyle;

    bodyChildren.forEach((child) => {
      (child as HTMLElement).style.display = '';
    });

    document.title = originalTitle;

    console.log('Page restored successfully');
  };

  let restored = false;
  const restoreOnce = () => {
    if (!restored) {
      restored = true;
      restorePage();
    }
  };

  const handleAfterPrint = () => {
    console.log('After print event fired');
    restoreOnce();
    window.removeEventListener('afterprint', handleAfterPrint);
  };

  window.addEventListener('afterprint', handleAfterPrint);

  // Mark invoice as printed before triggering the dialog
  if (invoiceData.name) {
    markInvoiceAsPrinted(invoiceData.name)
      .then(() => options.onAfterMark?.())
      .catch((err) => {
        console.error("Error marking invoice as printed:", err);
        toast.error("Failed to mark invoice as printed");
      });
  }

  console.log('Triggering print...');
  // Trigger print
  window.print();

  // Fallback: restore after a delay if afterprint event doesn't fire
  setTimeout(() => {
    console.log('Fallback timeout triggered');
    restoreOnce();
    window.removeEventListener('afterprint', handleAfterPrint);
  }, 2000);
}
