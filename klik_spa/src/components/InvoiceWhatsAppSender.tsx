import React, { useState } from 'react';
import { sendInvoiceWhatsApp } from '../services/useSharing';

interface InvoiceWhatsAppSenderProps {
  customerName?: string;
  customerPhone?: string;
  invoiceNumber?: string;
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
}

export const InvoiceWhatsAppSender: React.FC<InvoiceWhatsAppSenderProps> = ({
  customerName = '',
  customerPhone = '',
  invoiceNumber = '',
  onSuccess,
  onError
}) => {
  const [phoneNumber, setPhoneNumber] = useState(customerPhone);
  const [name, setName] = useState(customerName);
  const [invoiceNo, setInvoiceNo] = useState(invoiceNumber);
  const [message, setMessage] = useState('Your invoice is ready! Please find the PDF attached.');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const handleSendInvoice = async () => {
    if (!phoneNumber || !name || !invoiceNo) {
      const errorMsg = 'Please fill in all required fields (Phone, Name, Invoice Number)';
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await sendInvoiceWhatsApp({
        mobile_no: phoneNumber,
        customer_name: name,
        invoice_data: invoiceNo,
        message: message
      });

      setResult(response);
      onSuccess?.(response);
      console.log('Invoice WhatsApp sent successfully:', response);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to send invoice WhatsApp message';
      setError(errorMsg);
      onError?.(errorMsg);
      console.error('Invoice WhatsApp error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="invoice-whatsapp-sender p-4 border rounded-lg bg-white shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Send Invoice via WhatsApp</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Customer Phone Number *
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+254740743521"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Customer Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Invoice Number *
          </label>
          <input
            type="text"
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            placeholder="ACC-SINV-2025-001"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Your invoice is ready! Please find the PDF attached."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={handleSendInvoice}
          disabled={loading}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending Invoice...' : 'Send Invoice via WhatsApp'}
        </button>

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-md">
            <h4 className="font-semibold">Success!</h4>
            <p><strong>Recipient:</strong> {result.recipient}</p>
            <p><strong>Invoice:</strong> {result.invoice}</p>
            <p><strong>Amount:</strong> {result.amount}</p>
            <p><strong>Message ID:</strong> {result.message_id}</p>
          </div>
        )}
      </div>
    </div>
  );
};
