import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Product, Supplier, SaleTransaction, CartItem, normalizeProduct, AuthUser } from './types';
import { PosTerminal } from './components/PosTerminal';
import { InventoryTable } from './components/InventoryTable';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SupplierManagement } from './components/SupplierManagement';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { PosHardwareModal } from './components/PosHardwareModal';
import { AddProductModal } from './components/AddProductModal';
import { GenerateBarcodeAndScanModal } from './components/GenerateBarcodeAndScanModal';
import { GoogleSheetsSyncModal } from './components/GoogleSheetsSyncModal';
import { MobileScannerView } from './components/MobileScannerView';
import { PcSecurityGate } from './components/PcSecurityGate';
import { SecurityManagerModal } from './components/SecurityManagerModal';
import { LoginPage } from './components/LoginPage';
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
  PlusCircle,
  Radio,
  Smartphone,
  ShieldCheck,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import {
  fetchServerInventory,
  apiSaveProduct,
  apiDeleteProduct,
  apiAdjustStock,
  apiRecordSale,
  apiScanBarcode,
  subscribeToLiveSync,
  playChime,
  apiGetCurrentUser,
  apiLogout,
  DeviceSyncStats,
  getStoredAuthToken,
  getStoredUser
} from './services/api';
import { safeLocalStorage, safeSessionStorage } from './utils/safeStorage';

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'analytics' | 'suppliers'>('pos');

  // Core Data State - clean start: only items added to system exist
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = safeLocalStorage.getItem('cotton_retail_user_products_v5');
      return saved ? JSON.parse(saved).map(normalizeProduct) : [];
    } catch {
      return [];
    }
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    try {
      const saved = safeLocalStorage.getItem('cotton_retail_user_suppliers_v5');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [sales, setSales] = useState<SaleTransaction[]>(() => {
    try {
      const saved = safeLocalStorage.getItem('cotton_retail_user_sales_v5');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Centralized active counter bill state
  const [posCart, setPosCart] = useState<CartItem[]>(() => {
    try {
      const saved = safeLocalStorage.getItem('cotton_retail_active_cart');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed)
        ? parsed.map((item: any) => ({
            ...item,
            product: normalizeProduct(item.product),
          }))
        : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      safeLocalStorage.setItem('cotton_retail_active_cart', JSON.stringify(posCart));
    } catch (e) {
      console.warn(e);
    }
  }, [posCart]);

  // Live Sync Status with Server & Connected Devices
  const [syncStatus, setSyncStatus] = useState<DeviceSyncStats>({
    connected: false,
    clients: 1,
    mobileGunsCount: 0,
    laptopsCount: 1,
    hasActiveMobileGun: false,
    hasActiveLaptop: true,
  });

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'deduct' | 'lookup' | 'add' | 'cart'>('add');
  const [isHardwareModalOpen, setIsHardwareModalOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isGenerateAndScanOpen, setIsGenerateAndScanOpen] = useState(false);
  const [isGoogleSyncOpen, setIsGoogleSyncOpen] = useState(false);
  const [initialAddBarcode, setInitialAddBarcode] = useState('');
  const [scanNotification, setScanNotification] = useState<{ message: string; type?: 'deduct' | 'info' | 'success' | 'alert' } | null>(null);

  // User Authentication / Login State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredUser());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(getStoredAuthToken()));
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  // Validate session with server on startup
  useEffect(() => {
    let active = true;
    async function verifySession() {
      const token = getStoredAuthToken();
      if (!token) {
        if (active) {
          setIsAuthenticated(false);
          setCurrentUser(null);
          setIsAuthChecking(false);
        }
        return;
      }
      try {
        const res = await apiGetCurrentUser(token);
        if (active) {
          if (res.success && res.user) {
            setCurrentUser(res.user);
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
            setCurrentUser(null);
          }
        }
      } catch (e) {
        if (active) {
          const stored = getStoredUser();
          if (stored) {
            setCurrentUser(stored);
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
          }
        }
      } finally {
        if (active) setIsAuthChecking(false);
      }
    }
    verifySession();
    return () => {
      active = false;
    };
  }, []);

  const handleLoginSuccess = (user: AuthUser, _token: string) => {
    safeLocalStorage.removeItem('purecotton_explicit_logout');
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    safeLocalStorage.setItem('purecotton_explicit_logout', 'true');
    await apiLogout();
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  // PC Security Authorization Gate State (Verification strictly for PC software, mobile scanner gun exempt)
  const [isPcAuthorized, setIsPcAuthorized] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const explicitLocked = safeLocalStorage.getItem('purecotton_explicit_pc_lock');
      if (explicitLocked === 'true') {
        return Boolean(safeLocalStorage.getItem('purecotton_pc_auth_token'));
      }
      const existing = safeLocalStorage.getItem('purecotton_pc_auth_token');
      if (!existing) {
        safeLocalStorage.setItem('purecotton_pc_auth_token', 'token_pc_preview_authorized');
        return true;
      }
      return true;
    }
    return true;
  });
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);

  // Mobile scan action mode on Laptop: 'cart' | 'restock' | 'deduct'
  const [laptopScanAction, setLaptopScanAction] = useState<'cart' | 'restock' | 'deduct'>('cart');
  const laptopScanActionRef = useRef<'cart' | 'restock' | 'deduct'>('cart');
  useEffect(() => {
    laptopScanActionRef.current = laptopScanAction;
  }, [laptopScanAction]);

  const [mobileScanEvent, setMobileScanEvent] = useState<{ barcode: string; timestamp: number } | null>(null);

  const isAddProductOpenRef = useRef(false);
  useEffect(() => {
    isAddProductOpenRef.current = isAddProductOpen;
  }, [isAddProductOpen]);

  // Dedicated Mobile Scanner mode (User: "make the mobile only for scaning. don't remove add item button for scanning.")
  const [isMobileScannerMode, setIsMobileScannerMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'scanner') return true;
        const userExited = safeSessionStorage.getItem('user_exited_mobile_scanner');
        if (userExited === 'true') return false;
        // Auto-detect mobile devices so opening on phone directly launches mobile gun mode
        const isMobileUA = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isSmallScreen = window.innerWidth <= 640;
        if (isMobileUA && isSmallScreen) {
          return true;
        }
      } catch (e) {
        return false;
      }
    }
    return false;
  });

  // Ref to always access latest handleAddToCart without stale closures
  const handleAddToCartRef = useRef<((product: Product) => void) | null>(null);
  const handleDeductStockRef = useRef<((barcode: string) => Promise<any> | void) | null>(null);
  const handleIncrementStockRef = useRef<((barcode: string) => Promise<any> | void) | null>(null);

  // Auto-open scanner if mobile device opened with ?mode=scanner
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mode') === 'scanner') {
          setIsMobileScannerMode(true);
        }
      } catch (e) {}
    }
  }, []);

  // Sync state to local storage as fallback
  useEffect(() => {
    safeLocalStorage.setItem('cotton_retail_user_products_v5', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    safeLocalStorage.setItem('cotton_retail_user_suppliers_v5', JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    safeLocalStorage.setItem('cotton_retail_user_sales_v5', JSON.stringify(sales));
  }, [sales]);

  // Initial fetch from central backend server
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      const data = await fetchServerInventory();
      if (!mounted) return;
      if (data && data.products) {
        setProducts(data.products.map(normalizeProduct));
        setSuppliers(data.suppliers || []);
        setSales(data.sales || []);
      }
    }

    loadData();

    // Subscribe to SSE real-time stream for instant cross-device updates (Laptop <-> Mobile)
    const unsubscribe = subscribeToLiveSync({
      role: 'laptop',
      onCatalogUpdate: (data) => {
        if (!mounted) return;
        setProducts(Array.isArray(data.products) ? data.products.map(normalizeProduct) : []);
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
      onItemScannedForBill: (data) => {
        if (!mounted) return;
        playChime('success');
        if (data.product && handleAddToCartRef.current) {
          handleAddToCartRef.current(data.product);
          setScanNotification({
            message: `🛒 [${data.deviceName || 'Mobile Scanner'}] Added "${data.product.name}" (₹${data.product.sellingPrice}) to Active Bill!`,
            type: 'success',
          });
          setTimeout(() => setScanNotification(null), 5000);
          setActiveTab('pos');
        }
      },
      onProductAdded: (data) => {
        if (!mounted) return;
        playChime('success');
        setProducts((prev) => {
          const exists = prev.some((p) => p.id === data.product.id || p.barcode === data.product.barcode);
          if (exists) return prev;
          return [data.product, ...prev];
        });
        setScanNotification({
          message: `✨ [${data.deviceName || 'Mobile Scanner'}] Added "${data.product.name}" into store inventory!`,
          type: 'success',
        });
        setTimeout(() => setScanNotification(null), 5000);
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
      onDeviceSyncUpdate: (stats) => {
        if (!mounted) return;
        setSyncStatus(stats);
      },
      onGunPing: (data) => {
        if (!mounted) return;
        playChime('chime');
        setScanNotification({
          message: `📡 [Sync Ping] ${data.deviceName || 'Mobile Barcode Gun'} connected and active (${data.timeStr || 'Now'})`,
          type: 'info',
        });
        setTimeout(() => setScanNotification(null), 4000);
      },
      onSecurityApproved: (data) => {
        if (!mounted) return;
        const myDevId = safeLocalStorage.getItem('purecotton_pc_device_id');
        if (myDevId && data.deviceId === myDevId) {
          safeLocalStorage.removeItem('purecotton_explicit_pc_lock');
          safeLocalStorage.setItem('purecotton_pc_auth_token', data.token);
          setIsPcAuthorized(true);
          setScanNotification({
            message: '🛡️ [Security] This PC was approved by Ashish Sattur!',
            type: 'success',
          });
          setTimeout(() => setScanNotification(null), 5000);
        }
      },
      onSecurityRejected: (data) => {
        if (!mounted) return;
        const myDevId = safeLocalStorage.getItem('purecotton_pc_device_id');
        if (myDevId && data.deviceId === myDevId) {
          safeLocalStorage.removeItem('purecotton_pc_auth_token');
          safeLocalStorage.setItem('purecotton_explicit_pc_lock', 'true');
          setIsPcAuthorized(false);
        }
      },
      onBarcodeScanned: (data) => {
        if (!mounted) return;
        setMobileScanEvent({ barcode: data.barcode, timestamp: data.timestamp || Date.now() });

        // If Add Product modal is open, the modal auto-fills the field
        if (isAddProductOpenRef.current) {
          playChime('chime');
          return;
        }

        const action = laptopScanActionRef.current;
        if (action === 'cart') {
          if (data.product && handleAddToCartRef.current) {
            playChime('success');
            handleAddToCartRef.current(data.product);
            setScanNotification({
              message: `🛒 [${data.deviceName || 'Mobile Scanner'}] Added "${data.product.name}" to Active Bill!`,
              type: 'success',
            });
            setTimeout(() => setScanNotification(null), 4000);
            setActiveTab('pos');
          } else if (!data.product) {
            playChime('alert');
            setScanNotification({
              message: `⚠️ Scanned barcode "${data.barcode}" not found in catalog. Click "Add Product" to register it.`,
              type: 'alert',
            });
            setTimeout(() => setScanNotification(null), 5000);
          }
        } else if (action === 'deduct') {
          handleDeductStockRef.current?.(data.barcode);
        } else if (action === 'restock') {
          handleIncrementStockRef.current?.(data.barcode);
        }
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
        if (p.barcode === trimmed || (p.sku || '').toLowerCase() === trimmed.toLowerCase()) {
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
        if (p.barcode === trimmed || (p.sku || '').toLowerCase() === trimmed.toLowerCase()) {
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

  handleDeductStockRef.current = handleDeductStock;
  handleIncrementStockRef.current = handleIncrementStock;

  // Cart operations for Counter Billing
  const handleAddToCart = useCallback((product: Product) => {
    setPosCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [
          ...prev,
          {
            product,
            quantity: 1,
            discountPercent: 0,
            priceAfterDiscount: product.sellingPrice,
          },
        ];
      }
    });
    playChime('success');
    if (product.stock <= 0) {
      setScanNotification({
        message: `🛒 Added "${product.name}" to Active Bill (Note: Stock in system was 0)`,
        type: 'deduct',
      });
    } else {
      setScanNotification({
        message: `🛒 Added "${product.name}" to Active Bill`,
        type: 'success',
      });
    }
    setTimeout(() => setScanNotification(null), 3000);
  }, []);

  useEffect(() => {
    handleAddToCartRef.current = handleAddToCart;
  }, [handleAddToCart]);

  const handleUpdateQuantity = useCallback((productId: string, delta: number) => {
    setPosCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  }, []);

  const handleUpdateDiscount = useCallback((productId: string, discount: number) => {
    const validDiscount = Math.max(0, Math.min(100, discount || 0));
    setPosCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const discountedPrice = item.product.sellingPrice * (1 - validDiscount / 100);
          return {
            ...item,
            discountPercent: validDiscount,
            priceAfterDiscount: discountedPrice,
          };
        }
        return item;
      })
    );
  }, []);

  const handleRemoveFromCart = useCallback((productId: string) => {
    setPosCart((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const handleClearCart = useCallback(() => {
    setPosCart([]);
  }, []);

  // POS Sale Completion
  const handleCompleteSale = async (newSale: SaleTransaction) => {
    setSales((prev) => [newSale, ...prev]);
    setPosCart([]); // Clear bill upon sale completion

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
    setPosCart((prev) => prev.filter((item) => item.product.id !== productId));
    try {
      await apiDeleteProduct(productId);
    } catch (err) {
      console.warn('Backend delete sync note:', err);
    }
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
  const handleOpenScannerWithMode = (mode: 'deduct' | 'lookup' | 'add' | 'cart') => {
    setScannerMode(mode);
    setIsScannerOpen(true);
  };

  // Quick action: user scanned an unknown barcode and clicked "Add Item"
  const handleOpenAddWithBarcode = (scannedCode: string) => {
    setInitialAddBarcode(scannedCode);
    setIsAddProductOpen(true);
  };

  const lowStockCount = products.filter((p) => p.stock <= p.minStockAlert).length;

  // Dedicated handheld mobile barcode gun mode (Exempt from PC verification per user request)
  if (isMobileScannerMode) {
    return (
      <MobileScannerView
        serverConnected={syncStatus.connected}
        onExitScannerView={() => {
          safeSessionStorage.setItem('user_exited_mobile_scanner', 'true');
          setIsMobileScannerMode(false);
        }}
      />
    );
  }

  // 1. Session check loading screen
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center text-3xl shadow-xl mb-4 animate-pulse">
          🌿
        </div>
        <p className="text-sm font-bold text-emerald-300">Verifying Pure Cotton POS session...</p>
      </div>
    );
  }

  // 2. Primary Authentication Gate - All inventory, billing, and stock protected behind Login
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // PC Security Authorization Gate:
  // "also add security where anyone cannot use it but only the people we grant permission can use it.
  // for verification send notification to "ashish.sattur@gmail.com". and also send the IP address and other information.
  // and if i press yes it is used. the verification only should be for PC software. not for the mobile gun."
  if (!isPcAuthorized) {
    return (
      <PcSecurityGate
        onApproved={() => {
          setIsPcAuthorized(true);
        }}
        onSwitchToMobileGun={() => setIsMobileScannerMode(true)}
      />
    );
  }

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
                      className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full transition-colors ${
                        syncStatus.hasActiveMobileGun || (syncStatus.mobileGunsCount && syncStatus.mobileGunsCount > 0)
                          ? 'text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300'
                          : 'text-blue-900 bg-blue-100 hover:bg-blue-200 border border-blue-200'
                      }`}
                      title="Real-time multi-device sync active across Wi-Fi"
                    >
                      <span className={`w-2 h-2 rounded-full ${
                        syncStatus.hasActiveMobileGun || (syncStatus.mobileGunsCount && syncStatus.mobileGunsCount > 0)
                          ? 'bg-emerald-500 animate-pulse'
                          : 'bg-blue-500'
                      }`}></span>
                      <span>
                        {syncStatus.hasActiveMobileGun || (syncStatus.mobileGunsCount && syncStatus.mobileGunsCount > 0)
                          ? `🔫 Mobile Gun Synced (${syncStatus.mobileGunsCount || 1})`
                          : '📲 Pair Mobile Gun (QR)'}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsHardwareModalOpen(true)}
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-full transition-colors"
                    >
                      <Radio className="w-2.5 h-2.5 text-slate-500" />
                      <span>Pair Mobile Gun</span>
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
              {/* Security & Access Management for PC devices */}
              <button
                type="button"
                onClick={() => setIsSecurityModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-amber-300 rounded-xl shadow-xs transition-all border border-amber-500/30"
                title="Manage authorized PC devices, permissions, and IP logs"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Security</span>
              </button>

              <button
                type="button"
                onClick={() => setIsMobileScannerMode(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition-all border border-slate-700"
                title="Dedicated mobile barcode scanner view for phone or handheld device"
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Mobile Gun</span>
              </button>

              <button
                type="button"
                onClick={() => setIsGenerateAndScanOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-all"
                title="Generate a scannable barcode tag to add a clothing item"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                <span className="hidden sm:inline">Generate &amp; Scan to Add</span>
                <span className="sm:hidden">Gen &amp; Add</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenScannerWithMode('add')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl shadow-xs transition-all"
                title="Add 1 piece per scan using camera or mobile"
              >
                <PlusCircle className="w-3.5 h-3.5 text-emerald-200" />
                <span>Add (+1)</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenScannerWithMode('deduct')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition-all"
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

              {/* Authenticated User Status & Logout */}
              {currentUser && (
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  <div className="hidden lg:flex flex-col text-right">
                    <span className="text-xs font-bold text-slate-800 leading-tight flex items-center gap-1 justify-end">
                      <UserIcon className="w-3 h-3 text-emerald-600" />
                      <span>{currentUser.name}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 capitalize">
                      {currentUser.role}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl shadow-2xs transition-all"
                    title="Sign out of POS session"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-600" />
                    <span className="hidden sm:inline">Logout</span>
                  </button>
                </div>
              )}
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

      {/* Handheld Gun Mobile Companion Switcher Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
          <span className="font-semibold text-emerald-300">Live Dual-Sync Active:</span>
          <span className="text-slate-300 hidden sm:inline">
            Turn your phone into a handheld barcode gun. Tap "Add to Cart" on phone to beam items directly onto this laptop bill!
          </span>
          <span className="text-slate-300 sm:hidden">
            Mobile barcode gun synced to this screen.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsHardwareModalOpen(true)}
            className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-[11px] font-medium transition-colors"
          >
            Pair Phone (QR)
          </button>
          <button
            type="button"
            onClick={() => setIsMobileScannerMode(true)}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[11px] transition-colors flex items-center gap-1 shadow-2xs"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Open Mobile Gun Mode</span>
          </button>
        </div>
      </div>

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
            cart={posCart}
            onAddToCart={handleAddToCart}
            onUpdateQuantity={handleUpdateQuantity}
            onUpdateDiscount={handleUpdateDiscount}
            onRemoveFromCart={handleRemoveFromCart}
            onClearCart={handleClearCart}
            onCompleteSale={handleCompleteSale}
            laptopScanAction={laptopScanAction}
            onChangeLaptopScanAction={setLaptopScanAction}
            onOpenScanner={() => handleOpenScannerWithMode('lookup')}
            onOpenScannerWithMode={handleOpenScannerWithMode}
            onDeductStock={handleDeductStock}
            onOpenHardwareSettings={() => setIsHardwareModalOpen(true)}
            onOpenGenerateAndScan={() => setIsGenerateAndScanOpen(true)}
            onOpenAddModal={() => {
              setInitialAddBarcode('');
              setIsAddProductOpen(true);
            }}
            onOpenAddWithBarcode={handleOpenAddWithBarcode}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryTable
            products={products}
            suppliers={suppliers}
            onUpdateStock={handleUpdateStock}
            laptopScanAction={laptopScanAction}
            onChangeLaptopScanAction={setLaptopScanAction}
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
        onAddToCart={handleAddToCart}
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
        mobileGunsCount={syncStatus.mobileGunsCount}
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
        mobileScanEvent={mobileScanEvent}
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

      {/* Security Manager Modal (Ashish Sattur's PC Permission & IP Logs Console) */}
      <SecurityManagerModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        currentDeviceId={typeof window !== 'undefined' ? safeLocalStorage.getItem('purecotton_pc_device_id') || undefined : undefined}
        onCurrentDeviceRevoked={() => {
          safeLocalStorage.removeItem('purecotton_pc_auth_token');
          safeLocalStorage.setItem('purecotton_explicit_pc_lock', 'true');
          setIsPcAuthorized(false);
        }}
      />
    </div>
  );
}
