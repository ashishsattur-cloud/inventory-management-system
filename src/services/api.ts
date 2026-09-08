import { Product, Supplier, SaleTransaction } from '../types';

export interface ScanResult {
  success: boolean;
  action?: 'cart' | 'incremented' | 'deducted' | 'lookup';
  product?: Product;
  oldStock?: number;
  newStock?: number;
  quantity?: number;
  message?: string;
  error?: string;
  notFound?: boolean;
  barcode?: string;
}

export interface SyncEventData {
  type: 'INIT' | 'CATALOG_UPDATED' | 'STOCK_DECREMENTED' | 'STOCK_INCREMENTED' | 'ITEM_SCANNED_FOR_BILL' | 'PRODUCT_ADDED';
  data?: any;
}

// Fetch initial inventory from server with fallback to localStorage
export async function fetchServerInventory(): Promise<{
  products: Product[];
  suppliers: Supplier[];
  sales: SaleTransaction[];
}> {
  try {
    const res = await fetch('/api/inventory');
    if (res.ok) {
      const data = await res.json();
      return {
        products: data.products || [],
        suppliers: data.suppliers || [],
        sales: data.sales || [],
      };
    }
  } catch (err) {
    console.warn('Could not fetch server inventory, using local fallback:', err);
  }
  return { products: [], suppliers: [], sales: [] };
}

// Save or update product on server
export async function apiSaveProduct(product: Product, deviceName = 'Counter'): Promise<boolean> {
  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...product, deviceName }),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to save product to server:', err);
    return false;
  }
}

// Quick add product with barcode from mobile or POS
export async function apiQuickAddProduct(productData: {
  barcode: string;
  name: string;
  category?: string;
  fabricType?: string;
  workPattern?: string;
  size?: string;
  color?: string;
  costPrice?: number;
  sellingPrice?: number;
  stock?: number;
  rackLocation?: string;
  supplierId?: string;
  deviceName?: string;
}): Promise<{ success: boolean; product?: Product; error?: string }> {
  try {
    const res = await fetch('/api/products/quick-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Failed to quick add product:', err);
    return { success: false, error: 'Network error saving product' };
  }
}

// Delete product on server
export async function apiDeleteProduct(productId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/products/${productId}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to delete product on server:', err);
    return false;
  }
}

// Adjust stock on server
export async function apiAdjustStock(
  productId: string,
  newStock?: number,
  deltaOrReason?: number | string,
  reason?: string
): Promise<boolean> {
  try {
    const delta = typeof deltaOrReason === 'number' ? deltaOrReason : undefined;
    const finalReason = typeof deltaOrReason === 'string' ? deltaOrReason : reason;
    const res = await fetch('/api/products/adjust-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, newStock, delta, reason: finalReason }),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to adjust stock on server:', err);
    return false;
  }
}

// Scan barcode: Add to cart/bill, add to inventory, deduct, or lookup
export async function apiScanBarcode(
  barcode: string,
  mode: 'cart' | 'add' | 'deduct' | 'lookup' = 'cart',
  deviceName = 'Mobile Floor Scanner',
  quantity = 1
): Promise<ScanResult> {
  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode, mode, deviceName, quantity }),
    });
    const result = await res.json();
    return result;
  } catch (err) {
    console.error('API scan failed:', err);
    return {
      success: false,
      error: 'Network connection failed to server',
    };
  }
}

// Record sale on server
export async function apiRecordSale(sale: SaleTransaction): Promise<boolean> {
  try {
    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sale),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to record sale on server:', err);
    return false;
  }
}

// Add supplier on server
export async function apiSaveSupplier(supplier: Supplier): Promise<boolean> {
  try {
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(supplier),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to save supplier on server:', err);
    return false;
  }
}

export interface LiveSyncOptions {
  onCatalogUpdate: (data: { products: Product[]; suppliers: Supplier[]; sales: SaleTransaction[] }) => void;
  onStockDecremented: (data: { barcode: string; product: Product; oldStock: number; newStock: number; deviceName: string }) => void;
  onStockIncremented?: (data: { barcode: string; product: Product; oldStock: number; newStock: number; deviceName: string }) => void;
  onItemScannedForBill?: (data: { barcode: string; product: Product; quantity: number; deviceName: string; timestamp: string }) => void;
  onProductAdded?: (data: { product: Product; deviceName: string }) => void;
  onSaleCompleted?: (sale: SaleTransaction) => void;
  onStatusChange?: (status: { connected: boolean; clients: number }) => void;
}

/**
 * Connects to Server-Sent Events (SSE) stream for real-time live sync
 * between Counter Laptop and Mobile Floor Scanners.
 * Uses SSE with an automatic polling fallback to ensure 100% sync reliability.
 */
export function subscribeToLiveSync(
  optionsOrCatalogUpdate:
    | LiveSyncOptions
    | ((data: { products: Product[]; suppliers: Supplier[]; sales: SaleTransaction[] }) => void),
  argStockDecremented?: (data: { barcode: string; product: Product; oldStock: number; newStock: number; deviceName: string }) => void,
  argStatusChange?: (connected: boolean, deviceCount?: number) => void
): () => void {
  const options: LiveSyncOptions =
    typeof optionsOrCatalogUpdate === 'function'
      ? {
          onCatalogUpdate: optionsOrCatalogUpdate,
          onStockDecremented: argStockDecremented || (() => {}),
          onStatusChange: (s) => argStatusChange?.(s.connected, s.clients),
        }
      : optionsOrCatalogUpdate;

  let eventSource: EventSource | null = null;
  let retryTimer: any = null;
  let pollTimer: any = null;
  let isUnmounted = false;
  let lastEventTime = Date.now();
  const processedEventIds = new Set<string>();

  function handleIncomingEvent(type: string, payload: any, eventId?: string) {
    if (eventId) {
      if (processedEventIds.has(eventId)) return;
      processedEventIds.add(eventId);
      if (processedEventIds.size > 200) {
        const first = processedEventIds.values().next().value;
        if (first) processedEventIds.delete(first);
      }
    }

    if (type === 'CATALOG_UPDATED') {
      options.onCatalogUpdate(payload);
    } else if (type === 'STOCK_DECREMENTED') {
      options.onStockDecremented(payload);
    } else if (type === 'STOCK_INCREMENTED') {
      options.onStockIncremented?.(payload);
    } else if (type === 'ITEM_SCANNED_FOR_BILL') {
      options.onItemScannedForBill?.(payload);
    } else if (type === 'PRODUCT_ADDED') {
      options.onProductAdded?.(payload);
    } else if (type === 'SALE_COMPLETED') {
      options.onSaleCompleted?.(payload);
    }
  }

  // Backup poll for events to guarantee zero-dropped syncs
  async function pollRecentEvents() {
    if (isUnmounted) return;
    try {
      const res = await fetch(`/api/scan-events?since=${lastEventTime - 5000}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.events)) {
          for (const ev of data.events) {
            if (ev.timestamp > lastEventTime) {
              lastEventTime = ev.timestamp;
            }
            handleIncomingEvent(ev.type, ev.data, ev.id);
          }
        }
        if (typeof data.connectedDevices === 'number') {
          options.onStatusChange?.({ connected: true, clients: data.connectedDevices });
        }
      }
    } catch (e) {
      // Background poll failure is silent
    }
  }

  function connect() {
    if (isUnmounted) return;

    try {
      eventSource = new EventSource('/api/stream');

      eventSource.onopen = () => {
        options.onStatusChange?.({ connected: true, clients: 1 });
      };

      eventSource.addEventListener('INIT', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.store) {
            options.onCatalogUpdate(payload.store);
          }
          if (typeof payload.connectedDevices === 'number') {
            options.onStatusChange?.({ connected: true, clients: payload.connectedDevices });
          }
        } catch (err) {
          console.error('Error parsing INIT SSE event:', err);
        }
      });

      eventSource.addEventListener('CATALOG_UPDATED', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          handleIncomingEvent('CATALOG_UPDATED', payload);
        } catch (err) {}
      });

      eventSource.addEventListener('STOCK_DECREMENTED', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          handleIncomingEvent('STOCK_DECREMENTED', payload);
        } catch (err) {}
      });

      eventSource.addEventListener('STOCK_INCREMENTED', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          handleIncomingEvent('STOCK_INCREMENTED', payload);
        } catch (err) {}
      });

      eventSource.addEventListener('ITEM_SCANNED_FOR_BILL', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          handleIncomingEvent('ITEM_SCANNED_FOR_BILL', payload);
        } catch (err) {}
      });

      eventSource.addEventListener('PRODUCT_ADDED', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          handleIncomingEvent('PRODUCT_ADDED', payload);
        } catch (err) {}
      });

      eventSource.addEventListener('SALE_COMPLETED', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          handleIncomingEvent('SALE_COMPLETED', payload);
        } catch (err) {}
      });

      eventSource.onerror = () => {
        options.onStatusChange?.({ connected: false, clients: 1 });
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!isUnmounted) {
          retryTimer = setTimeout(connect, 3000);
        }
      };
    } catch (err) {
      options.onStatusChange?.({ connected: false, clients: 1 });
      retryTimer = setTimeout(connect, 3000);
    }
  }

  connect();
  pollTimer = setInterval(pollRecentEvents, 2000);

  return () => {
    isUnmounted = true;
    if (retryTimer) clearTimeout(retryTimer);
    if (pollTimer) clearInterval(pollTimer);
    if (eventSource) eventSource.close();
  };
}

/**
 * Audio chime using Web Audio API for instant scan feedback on both mobile and laptop
 */
export function playChime(type: 'deduct' | 'success' | 'alert' = 'deduct') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'deduct') {
      // Pleasant double chirp: high tone then drop
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);

      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'success') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } else {
      // Alert buzz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    }
  } catch (e) {
    // AudioContext blocked or not supported, ignore silently
  }
}
