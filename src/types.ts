export type ClothingCategory = 'Saree' | 'Salwar Suit' | 'Kurti' | 'Dupatta & Stole' | 'Fabric & Material';

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
  supplierId: string;
  rackLocation: string; // e.g. "Rack A-3", "Shelf 2"
  createdAt: string;
  updatedAt: string;
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
