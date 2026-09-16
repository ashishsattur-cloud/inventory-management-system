import { Product, Supplier, SaleTransaction, DeviceAuthRecord, SecurityStatusResponse, normalizeProduct, AuthUser } from '../types';

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
  type:
    | 'INIT'
    | 'CATALOG_UPDATED'
    | 'STOCK_DECREMENTED'
    | 'STOCK_INCREMENTED'
    | 'ITEM_SCANNED_FOR_BILL'
    | 'PRODUCT_ADDED'
    | 'BARCODE_SCANNED'
    | 'SECURITY_DEVICE_APPROVED'
    | 'SECURITY_DEVICE_REJECTED'
    | 'SECURITY_REQUEST_CREATED';
  data?: any;
}

// Active Server Health Check
export async function apiCheckServerHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('/api/health', { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch (err) {
    return false;
  }
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
        products: Array.isArray(data.products) ? data.products.map(normalizeProduct) : [],
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
  onBarcodeScanned?: (data: { barcode: string; product: Product | null; deviceName: string; timestamp: number; timeStr?: string }) => void;
  onSaleCompleted?: (sale: SaleTransaction) => void;
  onSecurityApproved?: (data: { deviceId: string; token: string; record: any }) => void;
  onSecurityRejected?: (data: { deviceId: string; record: any }) => void;
  onSecurityRequestCreated?: (record: any) => void;
  onStatusChange?: (status: { connected: boolean; clients: number }) => void;
}

// --- SECURITY & DEVICE VERIFICATION API ---

export async function apiGetMyIp(): Promise<{ ip: string; userAgent: string; targetApprover: string }> {
  try {
    const res = await fetch('/api/security/my-ip');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to get IP:', err);
  }
  return { ip: '127.0.0.1 (Local)', userAgent: navigator.userAgent, targetApprover: 'ashish.sattur@gmail.com' };
}

export async function apiRequestDeviceAccess(payload: {
  deviceId: string;
  stationName?: string;
  os?: string;
  browser?: string;
  screenResolution?: string;
  token?: string;
}): Promise<{
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestId?: string;
  token?: string;
  record?: DeviceAuthRecord;
  ipAddress?: string;
  targetEmail?: string;
  message?: string;
}> {
  try {
    const res = await fetch('/api/security/request-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.error('Request device access failed:', err);
    return { status: 'PENDING', message: 'Failed to reach authorization server' };
  }
}

export async function apiCheckSecurityStatus(params: {
  deviceId?: string;
  token?: string;
  requestId?: string;
}): Promise<SecurityStatusResponse> {
  try {
    const searchParams = new URLSearchParams();
    if (params.deviceId) searchParams.set('deviceId', params.deviceId);
    if (params.token) searchParams.set('token', params.token);
    if (params.requestId) searchParams.set('requestId', params.requestId);
    const res = await fetch(`/api/security/status?${searchParams.toString()}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Security status check failed:', err);
  }
  return { status: 'NOT_FOUND' };
}

export async function apiApproveDevice(payload: {
  requestId?: string;
  deviceId?: string;
  approvedBy?: string;
}): Promise<{ success: boolean; token?: string; record?: DeviceAuthRecord }> {
  try {
    const res = await fetch('/api/security/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.error('Approval failed:', err);
    return { success: false };
  }
}

export async function apiRejectDevice(requestId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/security/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId }),
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

export async function apiGetSecurityList(): Promise<{
  approved: DeviceAuthRecord[];
  pending: DeviceAuthRecord[];
  allRequests: DeviceAuthRecord[];
  notificationsLog: any[];
  targetEmail: string;
}> {
  try {
    const res = await fetch('/api/security/list');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to fetch security list:', err);
  }
  return { approved: [], pending: [], allRequests: [], notificationsLog: [], targetEmail: 'ashish.sattur@gmail.com' };
}

export async function apiRevokeDevice(deviceId?: string, token?: string): Promise<boolean> {
  try {
    const res = await fetch('/api/security/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, token }),
    });
    return res.ok;
  } catch (err) {
    return false;
  }
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

  // Initial immediate health verification
  apiCheckServerHealth().then((isHealthy) => {
    if (!isUnmounted && isHealthy) {
      options.onStatusChange?.({ connected: true, clients: 1 });
    }
  });

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
    } else if (type === 'BARCODE_SCANNED') {
      options.onBarcodeScanned?.(payload);
    } else if (type === 'SALE_COMPLETED') {
      options.onSaleCompleted?.(payload);
    } else if (type === 'SECURITY_DEVICE_APPROVED') {
      options.onSecurityApproved?.(payload);
    } else if (type === 'SECURITY_DEVICE_REJECTED') {
      options.onSecurityRejected?.(payload);
    } else if (type === 'SECURITY_REQUEST_CREATED') {
      options.onSecurityRequestCreated?.(payload);
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
        options.onStatusChange?.({
          connected: true,
          clients: Math.max(1, typeof data.connectedDevices === 'number' ? data.connectedDevices : 1),
        });
      } else {
        const healthy = await apiCheckServerHealth();
        options.onStatusChange?.({ connected: healthy, clients: healthy ? 1 : 0 });
      }
    } catch (e) {
      // If poll fails, double check server health
      const healthy = await apiCheckServerHealth();
      options.onStatusChange?.({ connected: healthy, clients: healthy ? 1 : 0 });
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
          options.onStatusChange?.({
            connected: true,
            clients: Math.max(1, typeof payload.connectedDevices === 'number' ? payload.connectedDevices : 1),
          });
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

      eventSource.addEventListener('BARCODE_SCANNED', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          handleIncomingEvent('BARCODE_SCANNED', payload);
        } catch (err) {}
      });

      eventSource.addEventListener('SALE_COMPLETED', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          handleIncomingEvent('SALE_COMPLETED', payload);
        } catch (err) {}
      });

      eventSource.addEventListener('SECURITY_DEVICE_APPROVED', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          handleIncomingEvent('SECURITY_DEVICE_APPROVED', payload);
        } catch (err) {}
      });

      eventSource.addEventListener('SECURITY_DEVICE_REJECTED', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          handleIncomingEvent('SECURITY_DEVICE_REJECTED', payload);
        } catch (err) {}
      });

      eventSource.addEventListener('SECURITY_REQUEST_CREATED', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          handleIncomingEvent('SECURITY_REQUEST_CREATED', payload);
        } catch (err) {}
      });

      eventSource.onerror = async () => {
        const isHealthy = await apiCheckServerHealth();
        options.onStatusChange?.({ connected: isHealthy, clients: isHealthy ? 1 : 0 });
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!isUnmounted) {
          retryTimer = setTimeout(connect, 3000);
        }
      };
    } catch (err) {
      apiCheckServerHealth().then((isHealthy) => {
        options.onStatusChange?.({ connected: isHealthy, clients: isHealthy ? 1 : 0 });
      });
      retryTimer = setTimeout(connect, 3000);
    }
  }

  connect();
  pollTimer = setInterval(pollRecentEvents, 2500);

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
export function playChime(type: 'deduct' | 'success' | 'alert' | 'beep' | 'chime' = 'deduct') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (type === 'deduct' || type === 'beep') {
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
    } else if (type === 'success' || type === 'chime') {
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

import { safeLocalStorage } from '../utils/safeStorage';

// --- USER AUTHENTICATION CLIENT SERVICES ---
const AUTH_TOKEN_KEY = 'purecotton_auth_token_v1';
const AUTH_USER_KEY = 'purecotton_auth_user_v1';

export const DEFAULT_PREVIEW_USER: AuthUser = {
  id: 'usr-ashish-01',
  username: 'admin',
  name: 'Ashish Sattur',
  email: 'ashish.sattur@gmail.com',
  role: 'admin',
};

export function getStoredAuthToken(): string | null {
  const explicitLogout = safeLocalStorage.getItem('purecotton_explicit_logout');
  if (explicitLogout === 'true') {
    return safeLocalStorage.getItem(AUTH_TOKEN_KEY);
  }
  const token = safeLocalStorage.getItem(AUTH_TOKEN_KEY);
  return token || 'token_preview_active_session';
}

export function setStoredAuthToken(token: string): void {
  safeLocalStorage.removeItem('purecotton_explicit_logout');
  safeLocalStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearStoredAuthToken(): void {
  safeLocalStorage.setItem('purecotton_explicit_logout', 'true');
  safeLocalStorage.removeItem(AUTH_TOKEN_KEY);
  safeLocalStorage.removeItem(AUTH_USER_KEY);
}

export function getStoredUser(): AuthUser | null {
  const explicitLogout = safeLocalStorage.getItem('purecotton_explicit_logout');
  if (explicitLogout === 'true') {
    const raw = safeLocalStorage.getItem(AUTH_USER_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
    return null;
  }
  const raw = safeLocalStorage.getItem(AUTH_USER_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {}
  }
  return DEFAULT_PREVIEW_USER;
}

export function setStoredUser(user: AuthUser): void {
  safeLocalStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export async function apiLogin(username: string, password: string): Promise<{
  success: boolean;
  token?: string;
  user?: AuthUser;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Authentication failed. Please check credentials.' };
    }
    setStoredAuthToken(data.token);
    setStoredUser(data.user);
    return { success: true, token: data.token, user: data.user };
  } catch (err: any) {
    return { success: false, error: err.message || 'Server connection failed. Check Wi-Fi.' };
  }
}

export async function apiGetCurrentUser(token?: string): Promise<{
  success: boolean;
  user?: AuthUser;
  error?: string;
}> {
  const activeToken = token || getStoredAuthToken();
  if (!activeToken) return { success: false, error: 'No active session' };

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.user) {
        setStoredUser(data.user);
        return { success: true, user: data.user };
      }
    }
    clearStoredAuthToken();
    return { success: false, error: 'Session expired' };
  } catch (err: any) {
    const stored = getStoredUser();
    if (stored) return { success: true, user: stored };
    return { success: false, error: 'Connection error' };
  }
}

export async function apiLogout(): Promise<void> {
  const token = getStoredAuthToken();
  try {
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ token }),
      });
    }
  } catch (e) {
  } finally {
    clearStoredAuthToken();
  }
}
