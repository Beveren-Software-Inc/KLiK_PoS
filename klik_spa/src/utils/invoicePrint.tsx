import { toast } from "react-toastify";
import PrintPreview  from "../utils/posPreview"

export const DisplayPrintPreview = ({ invoice }: { invoice: any }) => {
  return (
    <div className="border p-2 m-2 print-preview-container">
      <PrintPreview invoice={invoice} />
    </div>
  );
};

export const handlePrintInvoice = (invoiceData: any) => {


  if (!invoiceData) {
    toast.error("No invoice data available for printing");
    return;
  }

  const printElement = document.querySelector('.print-preview-container');
  if (!printElement) {
    toast.error("Print preview not found");
    return;
  }

  const printContents = printElement.innerHTML;
  const originalContents = document.body.innerHTML;

  const printStyles = `
    <style>
      @media print {
        body {
          margin: 0;
          padding: 20px;
          font-family: Arial, sans-serif;
          background: white;
        }
        body * {
          visibility: hidden;
        }
        .print-content, .print-content * {
          visibility: visible;
        }
        .print-content {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        .border {
          border: none !important;
        }
        .p-2, .m-2 {
          padding: 0 !important;
          margin: 0 !important;
        }
      }
      @page {
        size: A4;
        margin: 1cm;
      }
    </style>
  `;

  document.body.innerHTML = `
    ${printStyles}
    <div class="print-content">
      ${printContents}
    </div>
  `;

  window.print();
  document.body.innerHTML = originalContents;
  // window.location.reload();
  window.location.href = '/klik_pos/pos';

};
