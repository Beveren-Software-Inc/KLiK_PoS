import { toast } from "react-hot-toast";

// Performance monitoring utility
export class PerformanceMonitor {
  private static timers: Map<string, number> = new Map();

  static start(label: string): void {
    this.timers.set(label, performance.now());
    console.log(`🚀 Starting: ${label}`);
  }

  static end(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      console.warn(`Timer ${label} not found`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(label);
    console.log(`✅ Completed: ${label} in ${duration.toFixed(2)}ms`);
    return duration;
  }

  static measure<T>(label: string, fn: () => T | Promise<T>): T | Promise<T> {
    this.start(label);
    const result = fn();

    if (result instanceof Promise) {
      return result.finally(() => this.end(label));
    } else {
      this.end(label);
      return result;
    }
  }
}

// Optimized payment processing with performance monitoring
export async function createSalesInvoiceOptimized(data: any) {
  return PerformanceMonitor.measure('Invoice Creation', async () => {
    const csrfToken = window.csrf_token;

    // Pre-validate data to avoid unnecessary API calls
    if (!data.customer || !data.items || data.items.length === 0) {
      throw new Error('Invalid payment data');
    }

    // Optimize payload size
    const optimizedData = {
      items: data.items.map((item: any) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price
      })),
      customer: {
        id: data.customer.id,
        name: data.customer.name
      },
      paymentMethods: data.paymentMethods,
      subtotal: data.subtotal,
      grandTotal: data.grandTotal,
      amountPaid: data.amountPaid,
      businessType: data.businessType,
      // Only include necessary fields
      ...(data.SalesTaxCharges && { SalesTaxCharges: data.SalesTaxCharges }),
      ...(data.couponDiscount && { couponDiscount: data.couponDiscount }),
      ...(data.roundOffAmount && { roundOffAmount: data.roundOffAmount })
    };

    const response = await fetch('/api/method/klik_pos.api.sales_invoice.create_and_submit_invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Frappe-CSRF-Token': csrfToken
      },
      body: JSON.stringify({ data: optimizedData }),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.message || result.message.success === false) {
      const serverMsg = result._server_messages
        ? JSON.parse(result._server_messages)[0]
        : 'Failed to create invoice';
      throw new Error(serverMsg);
    }

    return result.message;
  });
}

// Performance tips for live site optimization: by Mania
export const PERFORMANCE_TIPS = {
  database: [
    "Enable database query caching",
    "Add indexes on frequently queried fields",
    "Use database connection pooling",
    "Optimize slow queries"
  ],
  server: [
    "Enable server-side caching (Redis)",
    "Use CDN for static assets",
    "Enable gzip compression",
    "Optimize server resources (CPU, RAM)"
  ],
  network: [
    "Minimize API response size",
    "Use HTTP/2 for better multiplexing",
    "Enable keep-alive connections",
    "Reduce number of API calls"
  ],
  frontend: [
    "Implement optimistic UI updates",
    "Use loading states effectively",
    "Cache frequently used data",
    "Minimize bundle size"
  ]
};

// Performance debugging helper
export function debugPerformance() {
  console.group('🔍 Performance Debug Info');
  console.log('Network:', navigator.connection);
  console.log('Memory:', (performance as any).memory);
  console.log('Timing:', performance.timing);
  console.groupEnd();
}
