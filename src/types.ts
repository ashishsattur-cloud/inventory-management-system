export type ClothingCategory = 'Saree' | 'Salwar Suit' | 'Kurti' | 'Shirt' | 'Dupatta & Stole' | 'Fabric & Material';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'admin' | 'cashier' | 'manager';
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: ClothingCategory;
  fabricType: string; // e.g., 'Pure Cotton', 'Mulmul Cotton', 'Chanderi Cotton', 'Khadi Cotton', 'Kota Doria'
  workPattern: string; // e.g., 'Handblock Print', 'Ajrakh', 'Kalamkari', 'Embroidery', 'Plain Solid', 'Bagru'
  size: string; // 'Free Size' (for Saree), 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'Unstitched'
  color: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minStockAlert: number;
  taxRate?: number; // e.g. 5, 12, 18, 0
  imageUrl?: string;
  supplierId: string;
  rackLocation: string; // e.g. "Rack A-3", "Shelf 2"
  createdAt: string;
  updatedAt: string;
}

export function normalizeProduct(p: any): Product {
  const barcodeStr = String(p?.barcode || '').trim();
  const cat = (p?.category as ClothingCategory) || 'Saree';
  return {
    id: p?.id || `prod-${barcodeStr || Date.now()}`,
    sku: p?.sku || `SKU-${barcodeStr ? barcodeStr.slice(-6) : 'ITEM'}`,
    barcode: barcodeStr || String(Math.floor(1000000 + Math.random() * 9000000)),
    name: p?.name || 'Pure Cotton Garment',
    category: cat,
    fabricType: p?.fabricType || 'Pure Cotton',
    workPattern: p?.workPattern || 'Traditional Handblock',
    size: p?.size || 'Free Size',
    color: p?.color || 'Multicolor',
    costPrice: Number(p?.costPrice) || 0,
    sellingPrice: Number(p?.sellingPrice) || 0,
    stock: Number(p?.stock) || 0,
    minStockAlert: Number(p?.minStockAlert) || 4,
    taxRate: Number(p?.taxRate) !== undefined && !isNaN(Number(p?.taxRate)) ? Number(p?.taxRate) : 5,
    imageUrl: p?.imageUrl || '',
    supplierId: p?.supplierId || 'Direct Mill Purchase',
    rackLocation: p?.rackLocation || 'Bay 1 - Main Floor Rack',
    createdAt: p?.createdAt || new Date().toISOString().split('T')[0],
    updatedAt: p?.updatedAt || new Date().toISOString().split('T')[0],
  };
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string; // e.g. 'Jaipur', 'Surat', 'Chanderi', 'Coimbatore'
  specialty: string;
  rating: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discountPercent: number;
  priceAfterDiscount: number;
}

export interface SaleTransaction {
  id: string;
  invoiceNo: string;
  timestamp: string;
  items: {
    productId: string;
    productName: string;
    barcode: string;
    sku: string;
    category: ClothingCategory;
    fabricType: string;
    size: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    total: number;
    costPrice: number;
  }[];
  subtotal: number;
  tax: number;
  discountTotal: number;
  grandTotal: number;
  paymentMethod: 'Cash' | 'UPI / QR' | 'Card' | 'Split';
  customerName?: string;
  customerPhone?: string;
}

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  barcode: string;
  oldStock: number;
  newStock: number;
  delta: number;
  reason: 'Barcode Scan Count' | 'Damage / Defect' | 'Customer Return' | 'Manual Correction' | 'New Stock Inward';
  timestamp: string;
  notes?: string;
}

export interface POSHardwareStatus {
  wifiConnected: boolean;
  networkSsid?: string;
  handheldScannerActive: boolean;
  thermalPrinterStatus: 'Connected' | 'Ready' | 'Offline';
  mobileCompanionUrl: string;
}

export interface DeviceAuthRecord {
  id: string;
  deviceId: string;
  token?: string;
  stationName: string;
  ipAddress: string;
  userAgent: string;
  os: string;
  browser: string;
  screenResolution: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  targetEmail: string;
  notificationSent: boolean;
  notificationTimestamp: string;
}

export interface SecurityStatusResponse {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_FOUND';
  token?: string;
  record?: DeviceAuthRecord;
  message?: string;
}
