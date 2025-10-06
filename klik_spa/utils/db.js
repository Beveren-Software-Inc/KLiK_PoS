const DB_NAME = "mars_pos";
const DB_VERSION = 1;

const STORES = {
	PRODUCTS: "products",
	PENDING_INVOICES: "pendingInvoices",
	CUSTOMERS: "customers",
};

class OfflineDB {
	constructor() {
		this.db = null;
	}

	async openDB() {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				this.db = request.result;
				resolve(this.db);
			};

			request.onupgradeneeded = (event) => {
				const db = event.target.result;

				// Products store
				if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
					const productsStore = db.createObjectStore(STORES.PRODUCTS, {
						keyPath: "itemCode",
					});
					productsStore.createIndex("category", "category", { unique: false });
					productsStore.createIndex("nameEn", "nameEn", { unique: false });
					productsStore.createIndex("nameAr", "nameAr", { unique: false });
				}

				// Pending invoices store
				if (!db.objectStoreNames.contains(STORES.PENDING_INVOICES)) {
					const invoicesStore = db.createObjectStore(STORES.PENDING_INVOICES, {
						keyPath: "tempId",
					});
					invoicesStore.createIndex("timestamp", "timestamp", { unique: false });
				}

				// Customers store
				if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
					const customersStore = db.createObjectStore(STORES.CUSTOMERS, {
						keyPath: "name",
					});
					customersStore.createIndex("customer_name", "customer_name", {
						unique: false,
					});
				}
			};
		});
	}

	async saveProducts(products) {
		if (!this.db) await this.openDB();

		const transaction = this.db.transaction([STORES.PRODUCTS], "readwrite");
		const store = transaction.objectStore(STORES.PRODUCTS);

		for (const product of products) {
			await store.put(product);
		}

		return transaction.complete;
	}

	async getProducts() {
		if (!this.db) await this.openDB();

		const transaction = this.db.transaction([STORES.PRODUCTS], "readonly");
		const store = transaction.objectStore(STORES.PRODUCTS);

		return new Promise((resolve, reject) => {
			const request = store.getAll();
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	async savePendingInvoice(invoiceData) {
		if (!this.db) await this.openDB();

		const transaction = this.db.transaction([STORES.PENDING_INVOICES], "readwrite");
		const store = transaction.objectStore(STORES.PENDING_INVOICES);

		const pendingInvoice = {
			tempId: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			timestamp: new Date().toISOString(),
			data: invoiceData,
			synced: false,
		};

		return new Promise((resolve, reject) => {
			const request = store.add(pendingInvoice);
			request.onsuccess = () => resolve(pendingInvoice.tempId);
			request.onerror = () => reject(request.error);
		});
	}

	async getAllPendingInvoices() {
		if (!this.db) await this.openDB();

		const transaction = this.db.transaction([STORES.PENDING_INVOICES], "readonly");
		const store = transaction.objectStore(STORES.PENDING_INVOICES);

		return new Promise((resolve, reject) => {
			const request = store.getAll();
			request.onsuccess = () => resolve(request.result.filter((invoice) => !invoice.synced));
			request.onerror = () => reject(request.error);
		});
	}

	async deletePendingInvoice(tempId) {
		if (!this.db) await this.openDB();

		const transaction = this.db.transaction([STORES.PENDING_INVOICES], "readwrite");
		const store = transaction.objectStore(STORES.PENDING_INVOICES);

		return new Promise((resolve, reject) => {
			const request = store.delete(tempId);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	async markInvoiceSynced(tempId) {
		if (!this.db) await this.openDB();

		const transaction = this.db.transaction([STORES.PENDING_INVOICES], "readwrite");
		const store = transaction.objectStore(STORES.PENDING_INVOICES);

		return new Promise((resolve, reject) => {
			const getRequest = store.get(tempId);
			getRequest.onsuccess = () => {
				const invoice = getRequest.result;
				if (invoice) {
					invoice.synced = true;
					const putRequest = store.put(invoice);
					putRequest.onsuccess = () => resolve();
					putRequest.onerror = () => reject(putRequest.error);
				} else {
					resolve();
				}
			};
			getRequest.onerror = () => reject(getRequest.error);
		});
	}
}

export default new OfflineDB();
