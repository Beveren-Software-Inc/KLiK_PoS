import erpnextAPI from "./api.js"
import offlineDB from "./db.js"

class SyncManager {
  constructor() {
    this.isSyncing = false
    this.syncCallbacks = []
  }

  onSyncComplete(callback) {
    this.syncCallbacks.push(callback)
  }

  async syncPendingInvoices() {
    if (this.isSyncing || !navigator.onLine) return

    this.isSyncing = true
    let syncedCount = 0

    try {
      const pendingInvoices = await offlineDB.getAllPendingInvoices()

      for (const pendingInvoice of pendingInvoices) {
        try {
          const result = await erpnextAPI.createInvoice(pendingInvoice.data)

          if (result.message) {
            await offlineDB.markInvoiceSynced(pendingInvoice.tempId)
            syncedCount++
          }
        } catch (error) {
          console.error("Failed to sync invoice:", pendingInvoice.tempId, error)
        }
      }

      // Notify callbacks
      this.syncCallbacks.forEach((callback) => {
        callback({ syncedCount, total: pendingInvoices.length })
      })

      return { syncedCount, total: pendingInvoices.length }
    } catch (error) {
      console.error("Sync failed:", error)
      throw error
    } finally {
      this.isSyncing = false
    }
  }

  async syncProducts() {
    if (!navigator.onLine) return

    try {
      const products = await erpnextAPI.getProducts()
      await offlineDB.saveProducts(products.data || [])
      return products.data || []
    } catch (error) {
      console.error("Failed to sync products:", error)
      // Return cached products if sync fails
      return await offlineDB.getProducts()
    }
  }
}

export default new SyncManager()
