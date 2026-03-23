// exportUtils.ts
// Utility functions for exporting data to CSV/Excel format

import { formatDate, translateText } from "../i18n/runtime";

export interface ExportableInvoice {
  name: string;
  customer: string;
  posting_date: string;
  due_date?: string;
  grand_total: number;
  outstanding_amount: number;
  status: string;
  mode_of_payment: string;
  currency?: string;
  company?: string;
}

export function exportInvoicesToCSV(invoices: ExportableInvoice[], filename?: string): void {
  if (!invoices || invoices.length === 0) {
    throw new Error(translateText('No invoices to export'));
  }

  // Define CSV headers
  const headers = [
    translateText('Invoice Number'),
    translateText('Customer'),
    translateText('Posting Date'),
    translateText('Due Date'),
    translateText('Grand Total'),
    translateText('Outstanding Amount'),
    translateText('Status'),
    translateText('Payment Method'),
    translateText('Currency')
  ];

  // Convert invoices to CSV rows
  const csvRows = invoices.map(invoice => [
    invoice.name || '',
    invoice.customer || '',
    invoice.posting_date || '',
    invoice.due_date || '',
    invoice.grand_total?.toString() || '0',
    invoice.outstanding_amount?.toString() || '0',
    invoice.status || '',
    invoice.mode_of_payment || '',
    invoice.currency || ''
  ]);

  // Combine headers and rows
  const csvContent = [headers, ...csvRows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');

  // Create and download the file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const defaultFilename = `invoices_export_${timestamp}.csv`;
    link.setAttribute('download', filename || defaultFilename);

    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    URL.revokeObjectURL(url);
  }
}

export function formatCurrencyForExport(amount: number, currency: string = 'SAR'): string {
  return `${amount.toFixed(2)} ${currency}`;
}

export function formatDateForExport(dateString: string): string {
  if (!dateString) return '';

  try {
    return formatDate(dateString, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch {
    return dateString;
  }
}

export function getExportFilename(prefix: string = 'invoices', extension: string = 'csv'): string {
  const timestamp = new Date().toISOString().split('T')[0];
  const timeParts = new Date().toTimeString().split(' ');
  const time = timeParts[0]?.replace(/:/g, '-') || '00-00-00';
  return `${prefix}_export_${timestamp}_${time}.${extension}`;
}
