import React, { useState } from 'react';
import { sendInvoiceSMS } from '../services/useSharing';
import { getUserFriendlyError } from '../utils/errorMessages';

interface InvoiceSMSSenderProps {
  customerName?: string;
  customerPhone?: string;
  invoiceNumber?: string;
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
}

export const InvoiceSMSSender: React.FC<InvoiceSMSSenderProps> = ({
  customerName = '',
  customerPhone = '',
  invoiceNumber = '',
  onSuccess,
  onError
}) => {
  const [phoneNumber, setPhoneNumber] = useState(customerPhone);
  const [name, setName] = useState(customerName);
  const [invoiceNo, setInvoiceNo] = useState(invoiceNumber);
  const [message, setMessage] = useState('Your invoice is ready!');
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
      const response = await sendInvoiceSMS({
        mobile_no: phoneNumber,
        customer_name: name,
        invoice_data: invoiceNo,
        message: message
      });

      setResult(response);
      onSuccess?.(response);
      console.log('Invoice SMS sent successfully:', response);
    } catch (err: any) {
      const userFriendlyError = getUserFriendlyError(err.message || 'Failed to send invoice SMS message', 'sms');
      setError(userFriendlyError);
      onError?.(userFriendlyError);
      console.error('Invoice SMS error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="invoice-sms-sender p-4 border rounded-lg bg-white shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Send Invoice via SMS</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Customer Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter customer name"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number *
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="+1234567890"
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter invoice number"
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
            placeholder="Your invoice is ready!"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={handleSendInvoice}
          disabled={loading}
          className="w-full px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending SMS...' : 'Send Invoice via SMS'}
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
            <p><strong>Message:</strong> {result.message}</p>
          </div>
        )}
      </div>
    </div>
  );
};
