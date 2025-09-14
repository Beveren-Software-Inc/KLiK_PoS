interface SyncStatus {
  isOnline: boolean;
  lastSync: Date | null;
  pendingUpdates: number;
  isSyncing: boolean;
}

interface StockUpdate {
  item_code: string;
  available: number;
  timestamp: number;
}

class BackgroundSyncService {
  private isOnline = navigator.onLine;
  private lastSync: Date | null = null;
  private pendingUpdates = 0;
  private isSyncing = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private listeners: Map<string, ((status: SyncStatus) => void)[]> = new Map();
  private stockUpdateQueue: StockUpdate[] = [];

  constructor() {
    this.setupEventListeners();
    this.startPeriodicSync();
  }

  private setupEventListeners(): void {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyListeners();
      this.processQueuedUpdates();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyListeners();
    });

    // Listen for visibility changes to sync when tab becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline) {
        this.syncStockUpdates();
      }
    });

    // Listen for focus events
    window.addEventListener('focus', () => {
      if (this.isOnline) {
        this.syncStockUpdates();
      }
    });
  }

  private startPeriodicSync(): void {
    // Sync every 30 seconds when online
    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.syncStockUpdates();
      }
    }, 30000);
  }

  private async syncStockUpdates(): Promise<void> {
    if (this.isSyncing || !this.isOnline) {
      return;
    }

    this.isSyncing = true;
    this.notifyListeners();

    try {
      const response = await fetch('/api/method/klik_pos.api.item.get_stock_updates');
      const resData = await response.json();

      if (resData?.message && typeof resData.message === 'object') {
        const stockUpdates = resData.message;
        const updateCount = Object.keys(stockUpdates).length;

        if (updateCount > 0) {
          // Convert to our format and queue for processing
          const updates: StockUpdate[] = Object.entries(stockUpdates).map(([item_code, available]) => ({
            item_code,
            available: available as number,
            timestamp: Date.now()
          }));

          this.queueStockUpdates(updates);
          this.lastSync = new Date();
          console.log(`Background sync: Updated ${updateCount} items`);
        }
      }
    } catch (error) {
      console.error('Background sync failed:', error);
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  private queueStockUpdates(updates: StockUpdate[]): void {
    this.stockUpdateQueue.push(...updates);
    this.pendingUpdates = this.stockUpdateQueue.length;
    this.notifyListeners();

    // Process updates immediately
    this.processQueuedUpdates();
  }

  private processQueuedUpdates(): void {
    if (this.stockUpdateQueue.length === 0) {
      return;
    }

    // Emit updates to listeners
    const updates = [...this.stockUpdateQueue];
    this.stockUpdateQueue = [];
    this.pendingUpdates = 0;
    this.notifyListeners();

    // Notify listeners about the updates
    this.emit('stock_updates', updates);
  }

  private notifyListeners(): void {
    const status: SyncStatus = {
      isOnline: this.isOnline,
      lastSync: this.lastSync,
      pendingUpdates: this.pendingUpdates,
      isSyncing: this.isSyncing
    };

    this.emit('status_change', status);
  }

  private emit(event: string, data: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error('Error in background sync listener:', error);
        }
      });
    }
  }

  public on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  public off(event: string, callback: (data: any) => void): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  public getStatus(): SyncStatus {
    return {
      isOnline: this.isOnline,
      lastSync: this.lastSync,
      pendingUpdates: this.pendingUpdates,
      isSyncing: this.isSyncing
    };
  }

  public forceSync(): Promise<void> {
    return this.syncStockUpdates();
  }

  public destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.listeners.clear();
  }
}

// Export singleton instance
export const backgroundSyncService = new BackgroundSyncService();
export default backgroundSyncService;
