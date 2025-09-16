import React, { useState } from 'react';
import { sendSimpleWhatsApp, sendWhatsApp, sendTemplateWhatsApp } from '../services/useSharing';

interface WhatsAppTestProps {
  mobile?: string;
  message?: string;
}

export const WhatsAppTest: React.FC<WhatsAppTestProps> = ({
  mobile = '',
  message = 'Hello from KLiK PoS!'
}) => {
  const [phoneNumber, setPhoneNumber] = useState(mobile);
  const [messageText, setMessageText] = useState(message);
  const [templateName, setTemplateName] = useState('hello_world');
  const [templateParameters, setTemplateParameters] = useState('John Doe, INV-001, $100.00');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const handleSendSimpleMessage = async () => {
    if (!phoneNumber || !messageText) {
      setError('Please enter both phone number and message');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await sendSimpleWhatsApp(phoneNumber, messageText);
      setResult(response);
      console.log('WhatsApp sent successfully:', response);
    } catch (err: any) {
      setError(err.message || 'Failed to send WhatsApp message');
      console.error('WhatsApp error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvoiceMessage = async () => {
    if (!phoneNumber) {
      setError('Please enter phone number');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await sendWhatsApp({
        mobile_no: phoneNumber,
        customer_name: 'Test Customer',
        invoice_data: 'ACC-SINV-2025-001' // Replace with actual invoice number
      });
      setResult(response);
      console.log('Invoice WhatsApp sent successfully:', response);
    } catch (err: any) {
      setError(err.message || 'Failed to send invoice WhatsApp message');
      console.error('Invoice WhatsApp error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTemplateMessage = async () => {
    if (!phoneNumber || !templateName) {
      setError('Please enter phone number and template name');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const parameters = templateParameters.split(',').map(p => p.trim());
      const response = await sendTemplateWhatsApp(phoneNumber, templateName, parameters);
      setResult(response);
      console.log('Template WhatsApp sent successfully:', response);
    } catch (err: any) {
      setError(err.message || 'Failed to send template WhatsApp message');
      console.error('Template WhatsApp error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="whatsapp-test p-4 border rounded-lg bg-white shadow-sm">
      <h3 className="text-lg font-semibold mb-4">WhatsApp Test</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+254740743521"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Message
          </label>
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Enter your message here..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template Name
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="hello_world"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template Parameters (comma-separated)
            </label>
            <input
              type="text"
              value={templateParameters}
              onChange={(e) => setTemplateParameters(e.target.value)}
              placeholder="John Doe, INV-001, $100.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex space-x-2">
            <button
              onClick={handleSendSimpleMessage}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Simple Message'}
            </button>

            <button
              onClick={handleSendTemplateMessage}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Template Message'}
            </button>

            <button
              onClick={handleSendInvoiceMessage}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Invoice Message'}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {result && (
          <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-md">
            <h4 className="font-semibold">Success!</h4>
            <pre className="text-sm mt-2 overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
