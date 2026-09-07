import React, { useState, useEffect } from 'react';
import { Product, Supplier, SaleTransaction } from './types';
import { PosTerminal } from './components/PosTerminal';
import { InventoryTable } from './components/InventoryTable';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SupplierManagement } from './components/SupplierManagement';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { PosHardwareModal } from './components/PosHardwareModal';
import { AddProductModal } from './components/AddProductModal';
import { GenerateBarcodeAndScanModal } from './components/GenerateBarcodeAndScanModal';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Camera,
  Wifi,
  FileSpreadsheet,
  AlertTriangle,
  Plus,
  Sparkles,
  CheckCircle2,
  Trash2
} from 'lucide-react';

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'analytics' | 'suppliers'>('pos');

  // Core Data State - starts empty: only items added by the user are stored
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      localStorage.removeItem('cotton_retail_products');
    } catch (e) {}

    const saved = localStorage.getItem('cotton_retail_user_products_v5');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    try {
      localStorage.removeItem('cotton_retail_suppliers');
    } catch (e) {}

    const saved = localStorage.getItem('cotton_retail_user_suppliers_v5');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [sales, setSales] = useState<SaleTransaction[]>(() => {
    try {
      localStorage.removeItem('cotton_retail_sales');
    } catch (e) {}

    const saved = localStorage.getItem('cotton_retail_user_sales_v5');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  // Sync state to localStorage
  useEffect(() => {
    localStorage.setItem('cotton_retail_user_products_v5', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('cotton_retail_user_suppliers_v5', JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem('cotton_retail_user_sales_v5', JSON.stringify(sales));
  }, [sales]);

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isHardwareModalOpen, setIsHardwareModalOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isGenerateAndScanOpen, setIsGenerateAndScanOpen] = useState(false);
  const [isGoogleSyncOpen, setIsGoogleSyncOpen] = useState(false);
  const [initialAddBarcode, setInitialAddBarcode] = useState('');
  const [scanNotification, setScanNotification] = useState<string | null>(null);

  // Real-time stock update on sale completion
  const handleCompleteSale = (newSale: SaleTransaction) => {
    setSales((prev) => [newSale, ...prev]);

    // Decrement stock in real time
    setProducts((prev) =>
      prev.map((prod) => {
        const soldItem = newSale.items.find((item) => item.productId === prod.id);
        if (soldItem) {
          const newQty = Math.max(0, prod.stock - soldItem.quantity);
          return {
            ...prod,
            stock: newQty,
            updatedAt: new Date().toISOString().split('T')[0],
          };
        }
        return prod;
      })
    );
  };

  // Manual stock adjustment
  const handleUpdateStock = (productId: string, newStock: number, reason: string) => {
    setProducts((prev) =>
      prev.map((prod) => {
        if (prod.id === productId) {
          return {
            ...prod,
            stock: Math.max(0, newStock),
            updatedAt: new Date().toISOString().split('T')[0],
          };
        }
        return prod;
      })
    );
  };

  const handleAddProduct = (newProduct: Product) => {
    setProducts((prev) => [newProduct, ...prev]);
    setScanNotification(`Item "${newProduct.name}" added to inventory with barcode ${newProduct.barcode}!`);
    setTimeout(() => setScanNotification(null), 4000);
  };

  const handleDeleteProduct = (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const handleAddSupplier = (newSupplier: Supplier) => {
    setSuppliers((prev) => [newSupplier, ...prev]);
  };

  // Handle incoming barcode scan from camera or Wi-Fi mobile scanner
  const handleBarcodeDetected = (barcode: string, product?: Product) => {
    if (product) {
      setScanNotification(`Scanned "${product.name}" (${barcode}) • Stock: ${product.stock}`);
    } else {
      setScanNotification(`Scanned barcode: ${barcode} (Not in catalog yet)`);
    }
    setTimeout(() => setScanNotification(null), 3500);
  };

  // Quick action: user scanned an unknown barcode and clicked "Add Item"
  const handleOpenAddWithBarcode = (scannedCode: string) => {
    setInitialAddBarcode(scannedCode);
    setIsAddProductOpen(true);
  };

  const lowStockCount = products.filter((p) => p.stock <= p.minStockAlert).length;

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans">
      {/* Top Main Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Store Brand Identity */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-700 to-teal-900 flex items-center justify-center text-white font-black text-lg shadow-sm">
                🌿
              </div>
              <div>
                <h1 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                  Pure Cotton Retail &amp; POS
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                    Live
                  </span>
                </h1>
                <p className="text-[11px] text-slate-500 font-medium">
                  Cotton Sarees • Salwar Suits • Kurtis • Real-Time Inventory
                </p>
              </div>
            </div>

            {/* Quick Action Buttons on Header */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsGenerateAndScanOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-all"
                title="Generate a scannable barcode tag to add a clothing item"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                <span>Generate &amp; Scan to Add</span>
              </button>

              <button
                type="button"
                onClick={() => setIsHardwareModalOpen(true)}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                title="Wi-Fi Mobile Barcode Gun & POS Hardware Setup"
              >
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span>Wi-Fi Mobile POS</span>
              </button>

              <button
                type="button"
                onClick={() => setIsGoogleSyncOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl transition-colors shadow-2xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                <span>Sheets Sync</span>
              </button>

              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition-all"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Scan Barcode</span>
              </button>
            </div>
          </div>

          {/* Navigation Bar Tabs */}
          <div className="flex space-x-1 sm:space-x-4 border-t border-slate-100 -mb-px overflow-x-auto">
            <button
              onClick={() => setActiveTab('pos')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'pos'
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>POS Billing Terminal</span>
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'inventory'
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Garment Inventory ({products.length})</span>
              {lowStockCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-500 text-white animate-pulse">
                  {lowStockCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'analytics'
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard &amp; Monthly Reports</span>
            </button>

            <button
              onClick={() => setActiveTab('suppliers')}
              className={`py-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors ${
                activeTab === 'suppliers'
                  ? 'border-emerald-600 text-emerald-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Suppliers &amp; Looms ({suppliers.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Floating Notification for Real-Time Scans / Updates */}
      {scanNotification && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in slide-in-from-bottom duration-200 border border-slate-800">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{scanNotification}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'pos' && (
          <PosTerminal
            products={products}
            onCompleteSale={handleCompleteSale}
            onOpenScanner={() => setIsScannerOpen(true)}
            onOpenHardwareSettings={() => setIsHardwareModalOpen(true)}
            onOpenGenerateAndScan={() => setIsGenerateAndScanOpen(true)}
            onOpenAddWithBarcode={handleOpenAddWithBarcode}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryTable
            products={products}
            suppliers={suppliers}
            onUpdateStock={handleUpdateStock}
            onOpenAddModal={() => {
              setInitialAddBarcode('');
              setIsAddProductOpen(true);
            }}
            onOpenScanner={() => setIsScannerOpen(true)}
            onDeleteProduct={handleDeleteProduct}
            onOpenGenerateAndScan={() => setIsGenerateAndScanOpen(true)}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsDashboard
            products={products}
            sales={sales}
            suppliers={suppliers}
            onOpenGoogleSync={() => setIsGoogleSyncOpen(true)}
          />
        )}

        {activeTab === 'suppliers' && (
          <SupplierManagement
            suppliers={suppliers}
            products={products}
            onAddSupplier={handleAddSupplier}
          />
        )}
      </main>

      {/* Workflow Modal: Generate Barcode First, Then Scan to Add */}
      <GenerateBarcodeAndScanModal
        isOpen={isGenerateAndScanOpen}
        onClose={() => setIsGenerateAndScanOpen(false)}
        suppliers={suppliers}
        onAddProduct={handleAddProduct}
        existingProducts={products}
      />

      {/* Barcode Scanner Modal with camera, mobile Wi-Fi, and quick register */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        products={products}
        onBarcodeDetected={handleBarcodeDetected}
        onOpenAddWithBarcode={handleOpenAddWithBarcode}
      />

      {/* Local POS Hardware & Wi-Fi Manual with back button at top */}
      <PosHardwareModal
        isOpen={isHardwareModalOpen}
        onClose={() => setIsHardwareModalOpen(false)}
        products={products}
        onRemoteScan={handleBarcodeDetected}
      />

      {/* Direct Add Product Modal */}
      <AddProductModal
        isOpen={isAddProductOpen}
        onClose={() => {
          setIsAddProductOpen(false);
          setInitialAddBarcode('');
        }}
        suppliers={suppliers}
        onAddProduct={handleAddProduct}
        initialBarcode={initialAddBarcode}
        onOpenScanner={() => setIsScannerOpen(true)}
      />

      {/* Google Sheets Sync & Automated Reporting Modal */}
      <GoogleSheetsSyncModal
        isOpen={isGoogleSyncOpen}
        onClose={() => setIsGoogleSyncOpen(false)}
        products={products}
        sales={sales}
        suppliers={suppliers}
      />
    </div>
  );
}
