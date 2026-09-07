import React, { useState, useEffect, useCallback } from 'react';
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
  Sparkles,
  CheckCircle2,
  MinusCircle,
  Radio
} from 'lucide-react';
import {
  fetchServerInventory,
  apiSaveProduct,
  apiDeleteProduct,
  apiAdjustStock,
  apiRecordSale,
  apiScanBarcode,
  subscribeToLiveSync,
  playChime
} from './services/api';

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'analytics' | 'suppliers'>('pos');

  // Core Data State - clean start: only items added to system exist
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('cotton_retail_user_products_v5');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    try {
      const saved = localStorage.getItem('cotton_retail_user_suppliers_v5');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [sales, setSales] = useState<SaleTransaction[]>(() => {
    try {
      const saved = localStorage.getItem('cotton_retail_user_sales_v5');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Live Sync Status with Server & Connected Devices
  const [syncStatus, setSyncStatus] = useState<{ connected: boolean; clients: number }>({
    connected: false,
    clients: 1,
  });

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'deduct' | 'lookup' | 'add'>('deduct');
  const [isHardwareModalOpen, setIsHardwareModalOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isGenerateAndScanOpen, setIsGenerateAndScanOpen] = useState(false);
  const [isGoogleSyncOpen, setIsGoogleSyncOpen] = useState(false);
  const [initialAddBarcode, setInitialAddBarcode] = useState('');
  const [scanNotification, setScanNotification] = useState<{ message: string; type?: 'deduct' | 'info' | 'success' } | null>(null);

  // Auto-open scanner if mobile device opened with ?mode=scanner
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('mode') === 'scanner') {
        setScannerMode('deduct');
        setIsScannerOpen(true);
      }
    }
  }, []);

  // Sync state to local storage as fallback
  useEffect(() => {
    localStorage.setItem('cotton_retail_user_products_v5', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('cotton_retail_user_suppliers_v5', JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem('cotton_retail_user_sales_v5', JSON.stringify(sales));
  }, [sales]);

  // Initial fetch from central backend server
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      const data = await fetchServerInventory();
      if (!mounted) return;
      if (data && data.products) {
        setProducts(data.products);
        setSuppliers(data.suppliers || []);
        setSales(data.sales || []);
      }
    }

    loadData();

    // Subscribe to SSE real-time stream for instant cross-device updates (Laptop <-> Mobile)
    const unsubscribe = subscribeToLiveSync({
      onCatalogUpdate: (data) => {
        if (!mounted) return;
        setProducts(data.products || []);
        if (data.suppliers) setSuppliers(data.suppliers);
        if (data.sales) setSales(data.sales);
      },
      onStockDecremented: (data) => {
        if (!mounted) return;
        playChime('deduct');
        setProducts((prev) =>
          prev.map((p) => (p.id === data.product.id ? { ...p, stock: data.newStock } : p))
        );
        setScanNotification({
          message: `🔻 [Floor Scan] "${data.product.name}" deducted! New stock: ${data.newStock} pcs`,
          type: 'deduct',
        });
        setTimeout(() => setScanNotification(null), 4000);
      },
      onStockIncremented: (data) => {
        if (!mounted) return;
        playChime('success');
        setProducts((prev) =>
          prev.map((p) => (p.id === data.product.id ? { ...p, stock: data.newStock } : p))
        );
        setScanNotification({
          message: `📦 [Restock] "${data.product.name}" added (+1)! New stock: ${data.newStock} pcs`,
          type: 'success',
        });
        setTimeout(() => setScanNotification(null), 4000);
      },
      onSaleCompleted: (newSale) => {
        if (!mounted) return;
        setSales((prev) => [newSale, ...prev]);
        setProducts((prev) =>
          prev.map((prod) => {
            const soldItem = newSale.items?.find((item) => item.productId === prod.id);
            if (soldItem) {
              return { ...prod, stock: Math.max(0, prod.stock - soldItem.quantity) };
            }
            return prod;
          })
        );
      },
      onStatusChange: (status) => {
        if (!mounted) return;
        setSyncStatus(status);
      },
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Stock deduction handler (-1 stock)
  const handleDeductStock = useCallback(async (barcode: string) => {
    const trimmed = barcode.trim();
    // Optimistic local update
    let matchedItem: Product | undefined;
    setProducts((prev) =>
      prev.map((p) => {
        if (p.barcode === trimmed || p.sku.toLowerCase() === trimmed.toLowerCase()) {
          matchedItem = p;
          const updatedStock = Math.max(0, p.stock - 1);
          return { ...p, stock: updatedStock };
        }
        return p;
      })
    );

    // Call server to persist and broadcast to all connected mobile & laptop devices
    try {
      const res = await apiScanBarcode(trimmed, 'deduct');
      if (res && res.product) {
        matchedItem = res.product;
      }
    } catch (e) {
      console.warn('Sync call failed, running locally:', e);
    }

    playChime('deduct');
    if (matchedItem) {
      const remaining = Math.max(0, matchedItem.stock - 1);
      setScanNotification({
        message: `🔻 Deducted 1 piece of "${matchedItem.name}" (Stock: ${remaining})`,
        type: 'deduct',
      });
    } else {
      setScanNotification({
        message: `🔻 Barcode ${trimmed} stock deducted by 1`,
        type: 'deduct',
      });
    }
    setTimeout(() => setScanNotification(null), 3500);
  }, []);

  // Stock increment handler (+1 stock)
  const handleIncrementStock = useCallback(async (barcode: string) => {
    const trimmed = barcode.trim();
    let matchedItem: Product | undefined;
    setProducts((prev) =>
      prev.map((p) => {
        if (p.barcode === trimmed || p.sku.toLowerCase() === trimmed.toLowerCase()) {
          matchedItem = p;
          return { ...p, stock: p.stock + 1 };
        }
        return p;
      })
    );

    try {
      const res = await apiScanBarcode(trimmed, 'add');
      if (res && res.product) {
        matchedItem = res.product;
      }
    } catch (e) {
      console.warn('Sync call failed, running locally:', e);
    }

    playChime('success');
    if (matchedItem) {
      setScanNotification({
        message: `📦 Restocked 1 piece of "${matchedItem.name}" (Stock: ${matchedItem.stock + 1})`,
        type: 'success',
      });
    }
    setTimeout(() => setScanNotification(null), 3500);
  }, []);

  // POS Sale Completion
  const handleCompleteSale = async (newSale: SaleTransaction) => {
    setSales((prev) => [newSale, ...prev]);

    // Decrement stock locally
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

    // Sync to backend server
    await apiRecordSale(newSale);
  };

  // Manual stock adjustment
  const handleUpdateStock = async (productId: string, newStock: number, reason: string) => {
    const safeStock = Math.max(0, newStock);
    setProducts((prev) =>
      prev.map((prod) => {
        if (prod.id === productId) {
          return {
            ...prod,
            stock: safeStock,
            updatedAt: new Date().toISOString().split('T')[0],
          };
        }
        return prod;
      })
    );
    await apiAdjustStock(productId, safeStock, reason);
  };

  // Add Product to catalog
  const handleAddProduct = async (newProduct: Product) => {
    setProducts((prev) => [newProduct, ...prev]);
    setScanNotification({
      message: `✨ Added "${newProduct.name}" (Barcode: ${newProduct.barcode}) to inventory!`,
      type: 'success',
    });
    setTimeout(() => setScanNotification(null), 4000);

    // Persist to backend server
    await apiSaveProduct(newProduct);
  };

  // Delete Product
  const handleDeleteProduct = async (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    await apiDeleteProduct(productId);
  };

  // Add Supplier
  const handleAddSupplier = (newSupplier: Supplier) => {
    setSuppliers((prev) => [newSupplier, ...prev]);
  };

  // Handle incoming barcode scan from camera or Wi-Fi mobile scanner
  const handleBarcodeDetected = (barcode: string, product?: Product) => {
    if (product) {
      setScanNotification({
        message: `Scanned "${product.name}" (${barcode}) • Stock: ${product.stock}`,
        type: 'info',
      });
    } else {
      setScanNotification({
        message: `Scanned barcode: ${barcode} (Not in catalog yet)`,
        type: 'info',
      });
    }
    setTimeout(() => setScanNotification(null), 3500);
  };

  // Open scanner with specified mode
  const handleOpenScannerWithMode = (mode: 'deduct' | 'lookup' | 'add') => {
    setScannerMode(mode);
    setIsScannerOpen(true);
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
                <h1 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Pure Cotton Retail &amp; POS</span>
                  {syncStatus.connected ? (
                    <button
                      type="button"
                      onClick={() => setIsHardwareModalOpen(true)}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-full transition-colors"
                      title="Real-time multi-device sync active across Wi-Fi"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Synced ({syncStatus.clients} device{syncStatus.clients === 1 ? '' : 's'})</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsHardwareModalOpen(true)}
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-full transition-colors"
                    >
                      <Radio className="w-2.5 h-2.5 text-slate-500" />
                      <span>Local Mode</span>
                    </button>
                  )}
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
                onClick={() => handleOpenScannerWithMode('deduct')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition-all"
                title="Deduct 1 piece per scan using camera or mobile"
              >
                <MinusCircle className="w-3.5 h-3.5 text-amber-200" />
                <span>Scan to Deduct (-1)</span>
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
                onClick={() => handleOpenScannerWithMode('lookup')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition-all"
              >
                <Camera className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Camera Scan</span>
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
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in slide-in-from-bottom duration-200 border ${
            scanNotification.type === 'deduct'
              ? 'bg-amber-900 text-white border-amber-700'
              : 'bg-slate-900 text-white border-slate-800'
          }`}
        >
          {scanNotification.type === 'deduct' ? (
            <MinusCircle className="w-4 h-4 text-amber-300 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{scanNotification.message}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'pos' && (
          <PosTerminal
            products={products}
            onCompleteSale={handleCompleteSale}
            onOpenScanner={() => handleOpenScannerWithMode('lookup')}
            onOpenScannerWithMode={handleOpenScannerWithMode}
            onDeductStock={handleDeductStock}
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
            onOpenScanner={() => handleOpenScannerWithMode('lookup')}
            onOpenScannerWithMode={handleOpenScannerWithMode}
            onDeductStock={handleDeductStock}
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
        onDeductStock={handleDeductStock}
        onIncrementStock={handleIncrementStock}
        onOpenAddWithBarcode={handleOpenAddWithBarcode}
        initialMode={scannerMode}
      />

      {/* Local POS Hardware & Wi-Fi Manual with back button at top */}
      <PosHardwareModal
        isOpen={isHardwareModalOpen}
        onClose={() => setIsHardwareModalOpen(false)}
        products={products}
        onRemoteScan={handleBarcodeDetected}
        onDeductStock={handleDeductStock}
        connectedDevices={syncStatus.clients}
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
        existingProducts={products}
        initialBarcode={initialAddBarcode}
        onOpenScanner={() => handleOpenScannerWithMode('lookup')}
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
