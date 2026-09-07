import { Product, Supplier, SaleTransaction } from '../types';

export interface ScanResult {
  success: boolean;
  action?: 'deducted' | 'incremented' | 'lookup';
  product?: Product;
  oldStock?: number;
  newStock?: number;
  message?: string;
  error?: string;
}

export interface SyncEventData {
  type: 'INIT' | 'CATALOG_UPDATED' | 'STOCK_DECREMENTED' | 'STOCK_INCREMENTED';
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
export async function apiSaveProduct(product: Product): Promise<boolean> {
  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to save product to server:', err);
    return false;
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

// Scan barcode: Deduct 1 from inventory (-1 stock), add, or lookup
export async function apiScanBarcode(
  barcode: string,
  mode: 'deduct' | 'add' | 'lookup' = 'deduct',
  deviceName = 'Mobile Floor Scanner'
): Promise<ScanResult> {
  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barcode, mode, deviceName }),
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
  onSaleCompleted?: (sale: SaleTransaction) => void;
  onStatusChange?: (status: { connected: boolean; clients: number }) => void;
}

/**
 * Connects to Server-Sent Events (SSE) stream for real-time live sync
 * between Counter Laptop and Mobile Floor Scanners.
 * Accepts either an options object or positional callbacks.
 */
export function subscribeToLiveSync(
  optionsOrCatalogUpdate:
    | LiveSyncOptions
    | ((data: { products: Product[]; suppliers: Supplier[]; sales: SaleTransaction[] }) => void),
  argStockDecremented?: (data: { barcode: string; product: Product; oldStock: number; newStock: number; deviceName: string }) => void,
  argStatusChange?: (connected: boolean, deviceCount?: number) => void
): () => void {
  const onCatalogUpdate: (data: { products: Product[]; suppliers: Supplier[]; sales: SaleTransaction[] }) => void =
    typeof optionsOrCatalogUpdate === 'function'
      ? optionsOrCatalogUpdate
      : optionsOrCatalogUpdate.onCatalogUpdate;

  const onStockDecremented =
    typeof optionsOrCatalogUpdate === 'function'
      ? argStockDecremented
      : optionsOrCatalogUpdate.onStockDecremented;

  const onStockIncremented =
    typeof optionsOrCatalogUpdate === 'object'
      ? optionsOrCatalogUpdate.onStockIncremented
      : undefined;

  const onSaleCompleted =
    typeof optionsOrCatalogUpdate === 'object'
      ? optionsOrCatalogUpdate.onSaleCompleted
      : undefined;

  const onStatusChange =
    typeof optionsOrCatalogUpdate === 'object' && optionsOrCatalogUpdate.onStatusChange
      ? optionsOrCatalogUpdate.onStatusChange
      : (status: { connected: boolean; clients: number }) => {
          argStatusChange?.(status.connected, status.clients);
        };

  let eventSource: EventSource | null = null;
  let retryTimer: any = null;
  let isUnmounted = false;

  function connect() {
    if (isUnmounted) return;

    try {
      eventSource = new EventSource('/api/stream');

      eventSource.onopen = () => {
        onStatusChange?.({ connected: true, clients: 1 });
      };

      eventSource.addEventListener('INIT', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.store) {
            onCatalogUpdate(payload.store);
          }
          if (typeof payload.connectedDevices === 'number') {
            onStatusChange?.({ connected: true, clients: payload.connectedDevices });
          }
        } catch (err) {
          console.error('Error parsing INIT SSE event:', err);
        }
      });

      eventSource.addEventListener('CATALOG_UPDATED', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          onCatalogUpdate(payload);
        } catch (err) {
          console.error('Error parsing CATALOG_UPDATED event:', err);
        }
      });

      eventSource.addEventListener('STOCK_DECREMENTED', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          onStockDecremented?.(payload);
        } catch (err) {
          console.error('Error parsing STOCK_DECREMENTED event:', err);
        }
      });

      eventSource.addEventListener('STOCK_INCREMENTED', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          onStockIncremented?.(payload);
        } catch (err) {
          console.error('Error parsing STOCK_INCREMENTED event:', err);
        }
      });

      eventSource.addEventListener('SALE_COMPLETED', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          onSaleCompleted?.(payload);
        } catch (err) {
          console.error('Error parsing SALE_COMPLETED event:', err);
        }
      });

      eventSource.onerror = () => {
        onStatusChange?.({ connected: false, clients: 1 });
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!isUnmounted) {
          retryTimer = setTimeout(connect, 3000);
        }
      };
    } catch (err) {
      onStatusChange?.({ connected: false, clients: 1 });
      retryTimer = setTimeout(connect, 3000);
    }
  }

  connect();

  return () => {
    isUnmounted = true;
    if (retryTimer) clearTimeout(retryTimer);
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
