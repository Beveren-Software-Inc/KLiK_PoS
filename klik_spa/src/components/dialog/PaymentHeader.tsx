import { X, Printer, MailPlus, MessageCirclePlus, MessageSquarePlus, Eye, Loader2 } from "lucide-react";
import { handlePrintInvoice } from "../../utils/printHandler";

interface PaymentHeaderProps {
  invoiceSubmitted: boolean;
  isAutoPrinting: boolean;
  invoiceData: any;
  sharingMode: string | null;
  setSharingMode: (mode: string | null) => void;
  isProcessingPayment: boolean;
  isHoldingOrder: boolean;
  onClose: (completed?: boolean) => void;
  handleViewInvoice: (invoice: any) => void;
  clearOrderState: () => void;
  navigate: (path: string) => void;
  posDetails: any;
}

export default function PaymentHeader({
  invoiceSubmitted,
  isAutoPrinting,
  invoiceData,
  sharingMode,
  setSharingMode,
  isProcessingPayment,
  isHoldingOrder,
  onClose,
  handleViewInvoice,
  clearOrderState,
  navigate,
  posDetails,
}: PaymentHeaderProps) {
  if (invoiceSubmitted) {
    return (
      <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Order Complete</h2>
        <div className="flex items-center space-x-3">
          {isAutoPrinting && (
            <div className="flex items-center space-x-2 text-blue-600">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Printing...</span>
            </div>
          )}
          <button
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
            title="Print"
            onClick={() => {
              handlePrintInvoice(invoiceData, { preventReprint: Boolean(posDetails?.custom_prevent_invoice_reprinting) });
              clearOrderState();
              navigate("/");
            }}
          >
            <Printer size={20} />
          </button>
          <button
            className={`p-2 rounded-lg ${sharingMode === "email" ? "bg-blue-100 text-blue-700" : "text-blue-600 hover:bg-blue-100"} dark:text-blue-400 dark:hover:bg-blue-900`}
            title="Email"
            onClick={() => setSharingMode(sharingMode === "email" ? null : "email")}
          >
            <MailPlus size={20} />
          </button>
          <button
            className={`p-2 rounded-lg ${sharingMode === "whatsapp" ? "bg-blue-100 text-green-700" : "text-green-600 hover:bg-green-100"} dark:text-green-400 dark:hover:bg-green-900`}
            title="WhatsApp"
            onClick={() => setSharingMode(sharingMode === "whatsapp" ? null : "whatsapp")}
            style={{ display: posDetails?.custom_enable_whatsapp ? "block" : "none" }}
          >
            <MessageCirclePlus size={20} />
          </button>
          <button
            className={`p-2 rounded-lg ${sharingMode === "sms" ? "bg-blue-100 text-blue-700" : "text-blue-600 hover:bg-blue-100"} dark:text-blue-400 dark:hover:bg-blue-900`}
            title="SMS"
            onClick={() => setSharingMode(sharingMode === "sms" ? null : "sms")}
            style={{ display: posDetails?.custom_enable_sms ? "block" : "none" }}
          >
            <MessageSquarePlus size={20} />
          </button>
          <button
            className="p-2 text-purple-600 hover:bg-purple-100 dark:text-purple-400 dark:hover:bg-purple-900 rounded-lg"
            title="View Full"
            onClick={() => handleViewInvoice(invoiceData)}
          >
            <Eye size={20} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Order Summary</h2>
      <button
        onClick={() => onClose(invoiceSubmitted)}
        disabled={isProcessingPayment || isHoldingOrder}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <X size={24} />
      </button>
    </div>
  );
}