import { X, Loader2, Pencil, Check } from "lucide-react";
import { formatCurrencyWithSymbol } from "../../utils/currency";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

interface SharingInterfaceProps {
  sharingMode: string | null;
  sharingData: { email: string; phone: string; name: string };
  setSharingData: (data: any) => void;
  invoiceData: any;
  calculations: any;
  displayCurrencySymbol: string;
  whatsappTemplates: any[];
  selectedTemplate: any;
  customMessage: string;
  isLoadingTemplates: boolean;
  isEditingWhatsapp: boolean;
  setIsEditingWhatsapp: (value: boolean) => void;
  setSelectedTemplate: (template: any) => void;
  setCustomMessage: (message: string) => void;
  emailTemplates: any[];
  selectedEmailTemplate: any;
  emailMessage: string;
  isLoadingEmailTemplates: boolean;
  isEditingEmail: boolean;
  setIsEditingEmail: (value: boolean) => void;
  setSelectedEmailTemplate: (template: any) => void;
  setEmailMessage: (message: string) => void;
  isSendingEmail: boolean;
  setIsSendingEmail: (value: boolean) => void;
  isSendingWhatsapp: boolean;
  setIsSendingWhatsapp: (value: boolean) => void;
  setSharingMode: (mode: string | null) => void;
  posDetails: any;
  getProcessedMessage: () => string;
  getProcessedEmailMessage: () => string;
  handleTemplateChange: (templateName: string) => void;
  handleEmailTemplateChange: (templateName: string) => void;
}

export default function SharingInterface({
  sharingMode,
  sharingData,
  setSharingData,
  invoiceData,
  calculations,
  displayCurrencySymbol,
  whatsappTemplates,
  selectedTemplate,
  customMessage,
  isLoadingTemplates,
  isEditingWhatsapp,
  setIsEditingWhatsapp,
  setSelectedTemplate,
  setCustomMessage,
  emailTemplates,
  selectedEmailTemplate,
  emailMessage,
  isLoadingEmailTemplates,
  isEditingEmail,
  setIsEditingEmail,
  setSelectedEmailTemplate,
  setEmailMessage,
  isSendingEmail,
  setIsSendingEmail,
  isSendingWhatsapp,
  setIsSendingWhatsapp,
  setSharingMode,
  posDetails,
  getProcessedMessage,
  getProcessedEmailMessage,
  handleTemplateChange,
  handleEmailTemplateChange,
}: SharingInterfaceProps) {
  const [modeEnabled, setModeEnabled] = useState(false);
  const [outgoingAccounts, setOutgoingAccounts] = useState<any[]>([]);
  const [selectedSender, setSelectedSender] = useState<string>("");

  useEffect(() => {
    if (sharingMode === "email") {
      const getEmailOutgoingAccounts = async () => {
        const { getAvailableOutgoingAccounts } =
          await import("../../services/useSharing");
        try {
          await getAvailableOutgoingAccounts().then((result: any) => {
            const accounts = result?.accounts ?? [];
            if (!accounts || accounts.length === 0) {
              toast.error(
                "No available outgoing email accounts found. Please configure email accounts in ERPNext to use this feature."
              );
              setModeEnabled(false);
            } else {
              setOutgoingAccounts(accounts);
              const defaultAccount =
                accounts.find((a: any) => a.source === "default_outgoing") ??
                accounts[0];
              setSelectedSender(defaultAccount?.name ?? "");
              setModeEnabled(true);
            }
          });
        } catch (error) {
          toast.error("Failed to load email accounts. Please try again.");
          setSharingMode(null);
        }
      };
      
      getEmailOutgoingAccounts();
    } else if (sharingMode === "sms") {
      const getSmsSettings = async () => {
        const { getSMSGateway } = await import("../../services/useSharing");
        try {
          await getSMSGateway().then((settings: any) => {
            if (!settings || !settings.enabled) {
              toast.error(
                "SMS gateway is not configured. Please set up SMS gateway in ERPNext to use this feature."
              );
              setModeEnabled(false);
            } else {
              setModeEnabled(true);
            }
          });
        } catch (error) {
          toast.error("Failed to load SMS settings. Please try again.");
          setSharingMode(null);
        }
      };

      getSmsSettings();
    } else if (sharingMode === "whatsapp") {
      const checkWhatsAppSetup = async () => {
        const { getWhatsAppSetup } = await import("../../services/useSharing");
        try {
          const setup = await getWhatsAppSetup();
          if (!setup?.is_configured) {
            toast.error(
              "WhatsApp is not configured. Please set up WhatsApp Business API in ERPNext to use this feature."
            );
            setModeEnabled(false);
          } else {
            setModeEnabled(true);
          }
        } catch (error) {
          toast.error("Failed to load WhatsApp setup. Please try again.");
          setSharingMode(null);
        }
      };

      checkWhatsAppSetup();
    }
  }, [sharingMode]);

  const sendEmail = async () => {
    setIsSendingEmail(true);
    try {
      const { sendEmails } = await import("../../services/useSharing");
      await sendEmails({
        email: sharingData.email,
        customer_name: sharingData.name,
        invoice_data: invoiceData?.name || "",
        message: getProcessedEmailMessage(),
        sender: selectedSender || undefined,
      });
      toast.success("Email sent successfully!");
      setSharingMode(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const sendWhatsApp = async () => {
    setIsSendingWhatsapp(true);
    try {
      const { sendWhatsAppMessage } = await import("../../services/useSharing");
      await sendWhatsAppMessage({
        mobile_no: sharingData.phone,
        customer_name: sharingData.name,
        invoice_data: invoiceData?.name || "",
        message: getProcessedMessage(),
      });
      alert("WhatsApp message sent successfully!");
      setSharingMode(null);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSendingWhatsapp(false);
    }
  };

  const sendSMS = async () => {
    try {
      const { sendSMSMessage } = await import("../../services/useSharing");
      await sendSMSMessage({
        mobile_no: sharingData.phone,
        customer_name: sharingData.name,
        message: `Thank you for your purchase at KLiK PoS.\nInvoice Total: ${formatCurrencyWithSymbol(calculations.grandTotal, displayCurrencySymbol)}\nThank you!`,
      });
      alert("SMS sent successfully!");
      setSharingMode(null);
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (sharingMode === "email") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white capitalize">Share via Email</h3>
          <button onClick={() => setSharingMode(null)} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Customer Name</label>
            <input type="text" value={sharingData.name} onChange={(e) => setSharingData((prev: any) => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" placeholder="Customer name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email Address</label>
            <input type="email" value={sharingData.email} onChange={(e) => setSharingData((prev: any) => ({ ...prev, email: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" placeholder="customer@email.com" />
          </div>
          {outgoingAccounts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Send From
              </label>
              <select
                value={selectedSender}
                onChange={(e) => setSelectedSender(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                {outgoingAccounts.map((account) => (
                  <option key={account.name} value={account.name}>
                    {account.default_sender}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Message Preview</label>
              <button onClick={() => setIsEditingEmail(!isEditingEmail)} className="text-sm text-beveren-600">
                {isEditingEmail ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
              </button>
            </div>
            {isEditingEmail && (
              <div className="space-y-3 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email Template</label>
                  {isLoadingEmailTemplates ? (
                    <div className="flex justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    <select value={selectedEmailTemplate?.name || ""} onChange={(e) => handleEmailTemplateChange(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                      <option value="">Select a template (optional)</option>
                      {emailTemplates.map((template) => (
                        <option key={template.name} value={template.name}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Custom Message</label>
                  <textarea value={emailMessage} onChange={(e) => setEmailMessage(e.target.value)} className="w-full px-3 py-2 border rounded-lg" rows={6} placeholder="Enter your email message..." />
                </div>
              </div>
            )}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-600 mb-2">Subject: Your Invoice from KLiK PoS</p>
              <div className="text-sm text-gray-900 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: getProcessedEmailMessage() }} />
            </div>
          </div>
          <button onClick={sendEmail} disabled={!sharingData.email || isSendingEmail || !modeEnabled} className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300">
            {isSendingEmail ? "Sending..." : "Send Email"}
          </button>
          {!modeEnabled && (
            <div className="mt-2 text-sm text-red-600">
              Email server is not configured. Please set up email server in
              ERPNext to use this feature.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (sharingMode === "whatsapp") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white capitalize">Share via WhatsApp</h3>
          <button onClick={() => setSharingMode(null)} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Customer Name</label>
            <input type="text" value={sharingData.name} onChange={(e) => setSharingData((prev: any) => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" placeholder="Customer name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone Number</label>
            <input type="tel" value={sharingData.phone} onChange={(e) => setSharingData((prev: any) => ({ ...prev, phone: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" placeholder="+254700000000" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">WhatsApp Message Preview</label>
              <button onClick={() => setIsEditingWhatsapp(!isEditingWhatsapp)} className="text-sm text-beveren-600">
                {isEditingWhatsapp ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
              </button>
            </div>
            {isEditingWhatsapp && (
              <div className="space-y-3 mb-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">WhatsApp Template</label>
                  {isLoadingTemplates ? (
                    <div className="flex justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : (
                    <select value={selectedTemplate?.name || ""} onChange={(e) => handleTemplateChange(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                      <option value="">Select a template (optional)</option>
                      {whatsappTemplates.map((template) => (
                        <option key={template.name} value={template.name}>
                          {template.template_name} - {template.category}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Custom Message</label>
                  <textarea value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} className="w-full px-3 py-2 border rounded-lg" rows={4} placeholder="Enter your WhatsApp message..." />
                </div>
              </div>
            )}
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200">
              <div className="text-sm text-gray-900 whitespace-pre-wrap">{getProcessedMessage()}</div>
            </div>
          </div>
          <button onClick={sendWhatsApp} disabled={!sharingData.phone || isSendingWhatsapp || !modeEnabled} className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300">
            {isSendingWhatsapp ? "Sending..." : "Send WhatsApp Message"}
          </button>
          {!modeEnabled && (
            <div className="mt-2 text-sm text-red-600">
              WhatsApp integration is not configured. Please set up WhatsApp
              Business API in ERPNext to use this feature.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (sharingMode === "sms") {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white capitalize">Share via SMS</h3>
          <button onClick={() => setSharingMode(null)} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Customer Name</label>
            <input type="text" value={sharingData.name} onChange={(e) => setSharingData((prev: any) => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" placeholder="Customer name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Phone Number</label>
            <input type="tel" value={sharingData.phone} onChange={(e) => setSharingData((prev: any) => ({ ...prev, phone: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" placeholder="+254700000000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">SMS Message Preview</label>
            <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-4 border border-teal-200">
              <div className="text-sm text-gray-900">
                <p>Hi {sharingData.name || "Customer"}!</p>
                <p className="mt-1">Thank you for your purchase at KLiK PoS.</p>
                <p className="mt-1">Invoice Total: {formatCurrencyWithSymbol(calculations.grandTotal, displayCurrencySymbol)}</p>
                <p className="mt-1">Thank you!</p>
              </div>
            </div>
          </div>
          <button onClick={sendSMS} disabled={!sharingData.phone || !modeEnabled} className="w-full py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:bg-gray-300">
            Send SMS
          </button>
          {!modeEnabled && (
            <div className="mt-2 text-sm text-red-600">
              SMS gateway is not configured. Please set up SMS gateway in
              ERPNext to use this feature.
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}