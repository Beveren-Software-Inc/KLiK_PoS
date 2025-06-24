const API_BASE_URL = "https://m-alnakheel-test.frappe.cloud"

// Remove API credentials from client-side code - now handled server-side
class ERPNextAPI {
  constructor() {
    this.baseURL = API_BASE_URL
    this.headers = {
      "Content-Type": "application/json",
    }
  }

  async request(endpoint, options = {}) {
    // Proxy through our secure API routes
    const url = `/api/erpnext${endpoint}`
    const config = {
      headers: this.headers,
      ...options,
    }

    try {
      const response = await fetch(url, config)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return await response.json()
    } catch (error) {
      console.error("API request failed:", error)
      throw error
    }
  }

  // Authentication
  async login(username, password) {
    return this.request("/login", {
      method: "POST",
      body: JSON.stringify({ usr: username, pwd: password }),
    })
  }

  // Products
  async getProducts(filters = {}) {
    const params = new URLSearchParams(filters)
    return this.request(`/products?${params}`)
  }

  // Create Sales Invoice
  async createInvoice(invoiceData) {
    return this.request("/invoices", {
      method: "POST",
      body: JSON.stringify({
        customer: invoiceData.customer || null,
        items: invoiceData.items.map((item) => ({
          item_code: item.itemCode,
          qty: item.qty,
          rate: item.unitPrice,
        })),
        pos_profile: "Main POS",
        is_pos: 1,
        ...invoiceData,
      }),
    })
  }

  // Get Invoice Details
  async getInvoiceDetails(invoiceId) {
    return this.request(`/invoices/${invoiceId}`)
  }

  // Get ZATCA QR Code
  async getZATCAQR(invoiceId) {
    return this.request(`/zatca-qr/${invoiceId}`)
  }

  // Get Wallet QR Code
  async getWalletQR(invoiceId, wallet) {
    return this.request(`/wallet-qr/${invoiceId}?wallet=${wallet}`)
  }

  // Check Payment Status
  async checkPaymentStatus(invoiceId) {
    return this.request(`/payment-status/${invoiceId}`)
  }

  // Download Receipt
  async downloadReceipt(invoiceId) {
    return this.request(`/receipts/${invoiceId}`)
  }

  // Send Invoice
  async sendInvoice(invoiceId, recipient, methods, message) {
    return this.request("/send-invoice", {
      method: "POST",
      body: JSON.stringify({
        invoiceId,
        to: recipient,
        methods,
        message,
      }),
    })
  }

  // Get Customers
  async getCustomers() {
    return this.request("/customers")
  }
}

export default new ERPNextAPI()
