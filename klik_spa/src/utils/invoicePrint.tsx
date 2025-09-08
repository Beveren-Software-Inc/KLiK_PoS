import { toast } from "react-toastify";
import PrintPreview  from "../utils/posPreview"

export const DisplayPrintPreview = ({ invoice }: { invoice: any }) => {
  return (
      <PrintPreview invoice={invoice} />

  );
};

export const handlePrintInvoice = (invoiceData: any) => {
  console.log('Print function called with:', invoiceData);

  if (!invoiceData) {
    toast.error("No invoice data available for printing");
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
    background: white;
    z-index: 9999;
    padding: 20px;
    overflow: auto;
  `;

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
      .print-overlay, .print-overlay * {
        visibility: visible;
      }
      .print-overlay {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        height: 100% !important;
      }
    }
    @page {
      size: A4;
      margin: 1cm;
    }
  `;
  printOverlay.className = 'print-overlay';
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

  const handleAfterPrint = () => {
    console.log('After print event fired');
    restorePage();
    window.removeEventListener('afterprint', handleAfterPrint);
  };

  window.addEventListener('afterprint', handleAfterPrint);

  console.log('Triggering print...');
  // Trigger print
  window.print();

  // Fallback: restore after a delay if afterprint event doesn't fire
  setTimeout(() => {
    console.log('Fallback timeout triggered');
    restorePage();
    window.removeEventListener('afterprint', handleAfterPrint);
  }, 2000);
};
