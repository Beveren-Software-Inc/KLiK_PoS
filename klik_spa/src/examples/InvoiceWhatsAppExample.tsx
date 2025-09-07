import React from 'react';
import { InvoiceWhatsAppSender } from '../components/InvoiceWhatsAppSender';
import { sendInvoiceWhatsApp } from '../services/useSharing';

export const InvoiceWhatsAppExample: React.FC = () => {
  const handleSuccess = (result: any) => {
    console.log('Invoice sent successfully:', result);
  };

  const handleError = (error: string) => {
    console.error('Invoice sending failed:', error);
  };

  // Example 2: Direct function call
  const sendInvoiceDirectly = async () => {
    try {
      const result = await sendInvoiceWhatsApp({
        mobile_no: '+254740743521',
        customer_name: 'John Doe',
        invoice_data: 'ACC-SINV-2025-001',
        message: 'Your invoice is ready! Please find the PDF attached.'
      });
      console.log('Direct invoice send result:', result);
    } catch (error) {
      console.error('Direct invoice send error:', error);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Invoice WhatsApp Integration Examples</h1>

      {/* Example 1: Using the component */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Example 1: Using the Component</h2>
        <InvoiceWhatsAppSender
          customerName="John Doe"
          customerPhone="+254740743521"
          invoiceNumber="ACC-SINV-2025-001"
          onSuccess={handleSuccess}
          onError={handleError}
        />
      </div>

      {/* Example 2: Direct function call */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Example 2: Direct Function Call</h2>
        <button
          onClick={sendInvoiceDirectly}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Send Invoice Directly
        </button>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Example 3: Integration with Your Code</h2>
        <div className="bg-gray-100 p-4 rounded-md">
          <p className="text-sm text-gray-700 mb-2">
            Replace your existing <code>sendWhatsApp</code> call with:
          </p>
          <pre className="bg-white p-3 rounded text-sm overflow-x-auto">

          </pre>
        </div>
      </div>
    </div>
  );
};

