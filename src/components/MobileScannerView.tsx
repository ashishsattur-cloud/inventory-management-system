import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Smartphone,
  ShoppingCart,
  PlusCircle,
  Search,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Volume2,
  VolumeX,
  FlipHorizontal,
  Lightbulb,
  ArrowRight,
  Package,
  Layers,
  Sparkles,
  RefreshCw,
  Monitor,
  Tag,
  MapPin,
  Check
} from 'lucide-react';
import { Product, ClothingCategory } from '../types';
import { apiScanBarcode, apiQuickAddProduct, playChime } from '../services/api';

interface MobileScannerViewProps {
  products: Product[];
  onExitScannerView: () => void;
  serverConnected?: boolean;
}

export const MobileScannerView: React.FC<MobileScannerViewProps> = ({
  products,
  onExitScannerView,
  serverConnected = true,
}) => {
  // Primary Scan Mode: 'cart' (Scan to Bill on Laptop) vs 'add' (Add to Inventory) vs 'lookup' (Price Check)
  const [scanMode, setScanMode] = useState<'cart' | 'add' | 'lookup'>('cart');
  const scanModeRef = useRef<'cart' | 'add' | 'lookup'>('cart');
  useEffect(() => {
    scanModeRef.current = scanMode;
  }, [scanMode]);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<string>('Initializing camera...');

  // Last scan feedback result
  const [lastScanResult, setLastScanResult] = useState<{
    barcode: string;
    product?: Product;
    action: 'cart' | 'incremented' | 'not_found' | 'lookup';
    message: string;
    oldStock?: number;
    newStock?: number;
    timestamp: string;
  } | null>(null);

  // Quick Add Form State when a new barcode is scanned in 'add' mode
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [newBarcode, setNewBarcode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<ClothingCategory>('Saree');
  const [newSellingPrice, setNewSellingPrice] = useState<number>(1200);
  const [newCostPrice, setNewCostPrice] = useState<number>(800);
  const [newStock, setNewStock] = useState<number>(10);
  const [newFabric, setNewFabric] = useState<string>('Pure Cotton');
  const [newRack, setNewRack] = useState<string>('Rack A-1');
  const [isSavingNewProduct, setIsSavingNewProduct] = useState(false);

  // Recent scans feed
  const [recentScans, setRecentScans] = useState<
    Array<{
      id: string;
      barcode: string;
      name: string;
      mode: 'cart' | 'add' | 'lookup';
      time: string;
      price?: number;
      stock?: number;
    }>
  >([]);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScannedTimeRef = useRef<{ barcode: string; time: number }>({ barcode: '', time: 0 });

  // Sound feedback helper
  const triggerAudioFeedback = (type: 'deduct' | 'success' | 'alert') => {
    if (soundEnabled) {
      playChime(type);
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (type === 'alert') {
        navigator.vibrate([100, 50, 100]);
      } else {
        navigator.vibrate(80);
      }
    }
  };

  // Process a scanned or entered barcode
  const handleProcessBarcode = async (rawCode: string) => {
    const trimmed = rawCode.trim();
    if (!trimmed) return;

    const now = Date.now();
    // 1.8s debounce for identical barcode to prevent rapid duplicate bursts
    if (lastScannedTimeRef.current.barcode === trimmed && now - lastScannedTimeRef.current.time < 1800) {
      return;
    }
    lastScannedTimeRef.current = { barcode: trimmed, time: now };

    setIsProcessing(true);
    const activeMode = scanModeRef.current;

    try {
      const res = await apiScanBarcode(trimmed, activeMode, 'Handheld Mobile Scanner', 1);

      if (res.notFound) {
        triggerAudioFeedback('alert');
        setLastScanResult({
          barcode: trimmed,
          action: 'not_found',
          message: `Barcode "${trimmed}" is not yet in the store inventory.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });

        // If in "Add Item" mode, automatically open the Quick Add form!
        if (activeMode === 'add') {
          setNewBarcode(trimmed);
          setNewName('');
          setShowQuickAddModal(true);
        }
        setIsProcessing(false);
        return;
      }

      if (res.success && res.product) {
        const prod = res.product;

        if (activeMode === 'cart') {
          triggerAudioFeedback('success');
          setLastScanResult({
            barcode: trimmed,
            product: prod,
            action: 'cart',
            message: `Sent "${prod.name}" to Counter Laptop Bill (₹${prod.sellingPrice})`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          });

          setRecentScans((prev) => [
            {
              id: 'scan-' + Date.now(),
              barcode: trimmed,
              name: prod.name,
              mode: 'cart',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              price: prod.sellingPrice,
            },
            ...prev.slice(0, 7),
          ]);
        } else if (activeMode === 'add') {
          triggerAudioFeedback('success');
          setLastScanResult({
            barcode: trimmed,
            product: prod,
            action: 'incremented',
            oldStock: res.oldStock,
            newStock: res.newStock,
            message: `Restocked 1 piece of "${prod.name}"! New Inventory: ${res.newStock} pcs`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          });

          setRecentScans((prev) => [
            {
              id: 'scan-' + Date.now(),
              barcode: trimmed,
              name: prod.name,
              mode: 'add',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              stock: res.newStock,
            },
            ...prev.slice(0, 7),
          ]);
        } else {
          // Lookup
          triggerAudioFeedback('success');
          setLastScanResult({
            barcode: trimmed,
            product: prod,
            action: 'lookup',
            message: `Found "${prod.name}" | MRP: ₹${prod.sellingPrice} | Stock: ${prod.stock} pcs | Shelf: ${prod.rackLocation || 'Main Bay'}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          });
        }
      } else {
        triggerAudioFeedback('alert');
        setLastScanResult({
          barcode: trimmed,
          action: 'not_found',
          message: res.error || 'Barcode scan failed on server.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });
      }
    } catch (err) {
      triggerAudioFeedback('alert');
      console.error('Scan processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Save new item directly to inventory
  const handleSaveQuickProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newBarcode.trim()) return;

    setIsSavingNewProduct(true);
    try {
      const res = await apiQuickAddProduct({
        barcode: newBarcode.trim(),
        name: newName.trim(),
        category: newCategory,
        fabricType: newFabric,
        sellingPrice: Number(newSellingPrice) || 1200,
        costPrice: Number(newCostPrice) || 800,
        stock: Number(newStock) || 10,
        rackLocation: newRack.trim() || 'Rack A-1',
        deviceName: 'Mobile Floor Gun',
      });

      if (res.success && res.product) {
        triggerAudioFeedback('success');
        setShowQuickAddModal(false);
        setLastScanResult({
          barcode: res.product.barcode,
          product: res.product,
          action: 'incremented',
          newStock: res.product.stock,
          message: `Added new garment "${res.product.name}" to inventory! Synced to laptop.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });

        setRecentScans((prev) => [
          {
            id: 'scan-' + Date.now(),
            barcode: res.product!.barcode,
            name: res.product!.name,
            mode: 'add',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            stock: res.product!.stock,
          },
          ...prev.slice(0, 7),
        ]);
      } else {
        triggerAudioFeedback('alert');
        alert(res.error || 'Failed to save product.');
      }
    } catch (err) {
      console.error('Error adding product:', err);
      triggerAudioFeedback('alert');
    } finally {
      setIsSavingNewProduct(false);
    }
  };

  // Adjust quantity from recent scan
  const handleAdjustRecentQuantity = async (barcode: string, delta: number) => {
    try {
      await apiScanBarcode(barcode, 'add', 'Mobile Scanner', delta);
    } catch (err) {
      console.error('Failed to adjust quantity:', err);
    }
  };

  // Camera start / stop lifecycle
  useEffect(() => {
    let isCancelled = false;

    const startCamera = async () => {
      const container = document.getElementById('mobile-scanner-viewfinder');
      if (!container) return;

      try {
        if (html5QrCodeRef.current) {
          try {
            await html5QrCodeRef.current.stop();
            html5QrCodeRef.current.clear();
          } catch (e) {}
        }

        const scanner = new Html5Qrcode('mobile-scanner-viewfinder');
        html5QrCodeRef.current = scanner;

        const config = {
          fps: 15,
          qrbox: { width: 260, height: 220 },
          aspectRatio: 1.0,
        };

        await scanner.start(
          { facingMode: cameraFacing },
          config,
          (decodedText) => {
            if (!isCancelled) {
              handleProcessBarcode(decodedText);
            }
          },
          () => {}
        );

        if (!isCancelled) {
          setScannerStatus('Scanner Ready');
          // Check if torch capability is available
          try {
            const capabilities = scanner.getRunningTrackCapabilities();
            if (capabilities && 'torch' in capabilities) {
              setHasTorch(true);
            }
          } catch (e) {}
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Camera start error:', err);
          setScannerStatus('Camera access error. Use manual input below.');
        }
      }
    };

    const timer = setTimeout(startCamera, 300);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      if (html5QrCodeRef.current) {
        try {
          html5QrCodeRef.current.stop().catch(() => {});
        } catch (e) {}
      }
    };
  }, [cameraFacing]);

  // Torch toggle
  const handleToggleTorch = async () => {
    if (!html5QrCodeRef.current) return;
    try {
      const nextTorch = !torchOn;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as any],
      });
      setTorchOn(nextTorch);
    } catch (err) {
      console.warn('Torch not supported on this device:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Top Professional Gun Status Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-3.5 py-2.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-950">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>Mobile Barcode Gun</span>
              <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded text-emerald-400 font-mono">
                v2.1
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <span
                className={`w-2 h-2 rounded-full ${
                  serverConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className={serverConnected ? 'text-emerald-300 font-medium' : 'text-rose-400'}>
                {serverConnected ? 'Connected to Laptop Counter' : 'Server Offline'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Torch Button */}
          {hasTorch && (
            <button
              type="button"
              onClick={handleToggleTorch}
              className={`p-2 rounded-lg border text-xs transition-colors ${
                torchOn
                  ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
              title="Flashlight"
            >
              <Lightbulb className="w-4 h-4" />
            </button>
          )}

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg border text-xs transition-colors ${
              soundEnabled
                ? 'bg-slate-800 text-emerald-400 border-slate-700'
                : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}
            title="Audio Beep Feedback"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Camera Flip */}
          <button
            type="button"
            onClick={() =>
              setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'))
            }
            className="p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-xs hover:text-white"
            title="Switch Camera"
          >
            <FlipHorizontal className="w-4 h-4" />
          </button>

          {/* Exit to Full Desktop Dashboard */}
          <button
            type="button"
            onClick={onExitScannerView}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-medium flex items-center gap-1"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Laptop View</span>
          </button>
        </div>
      </header>

      {/* THE TWO MAIN ACTION BUTTONS: USER REQUESTED TO HAVE "ADD TO CART" & "ADD ITEM" */}
      <div className="p-3 bg-slate-900/90 border-b border-slate-800/80 sticky top-[53px] z-20 backdrop-blur-sm">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
          <span>Select Scanner Task:</span>
          <span className="font-mono text-emerald-400 text-[10px]">
            {scanMode === 'cart' ? '🟢 BILLING MODE' : scanMode === 'add' ? '🔵 INVENTORY RESTOCK' : '⚪ LOOKUP'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* BUTTON 1: ADD TO CART / BILL */}
          <button
            type="button"
            id="mobile-btn-add-to-cart"
            onClick={() => setScanMode('cart')}
            className={`p-3 rounded-xl border flex flex-col items-center text-center transition-all relative ${
              scanMode === 'cart'
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-950/60 ring-2 ring-emerald-400/40'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-sm">
              <ShoppingCart className="w-4 h-4" />
              <span>Add to Cart</span>
            </div>
            <span
              className={`text-[10px] mt-0.5 font-medium ${
                scanMode === 'cart' ? 'text-emerald-100' : 'text-slate-400'
              }`}
            >
              Sends to Laptop Bill
            </span>
            {scanMode === 'cart' && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-200 animate-ping" />
            )}
          </button>

          {/* BUTTON 2: ADD ITEM (INVENTORY) */}
          <button
            type="button"
            id="mobile-btn-add-item"
            onClick={() => setScanMode('add')}
            className={`p-3 rounded-xl border flex flex-col items-center text-center transition-all relative ${
              scanMode === 'add'
                ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-950/60 ring-2 ring-blue-400/40'
                : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-sm">
              <PlusCircle className="w-4 h-4" />
              <span>Add Item</span>
            </div>
            <span
              className={`text-[10px] mt-0.5 font-medium ${
                scanMode === 'add' ? 'text-blue-100' : 'text-slate-400'
              }`}
            >
              Restock or Register
            </span>
            {scanMode === 'add' && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-200 animate-ping" />
            )}
          </button>
        </div>

        {/* Small third toggle for price check / lookup */}
        <div className="flex justify-center mt-1.5">
          <button
            type="button"
            onClick={() => setScanMode(scanMode === 'lookup' ? 'cart' : 'lookup')}
            className={`px-3 py-0.5 rounded-full text-[11px] flex items-center gap-1 transition-colors ${
              scanMode === 'lookup'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search className="w-3 h-3" />
            <span>Price Check &amp; Shelf Rack Lookup Mode</span>
          </button>
        </div>
      </div>

      {/* Main Viewport: Camera Scanner Reticle */}
      <div className="flex-1 flex flex-col items-center justify-start p-3 max-w-md mx-auto w-full">
        {/* Camera Container */}
        <div className="relative w-full aspect-square max-w-[340px] bg-black rounded-2xl overflow-hidden border-2 border-slate-800 shadow-2xl flex items-center justify-center">
          <div id="mobile-scanner-viewfinder" className="w-full h-full object-cover" />

          {/* Aim Reticle Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-56 h-56 border-2 border-emerald-400/70 rounded-2xl relative shadow-inner">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

              {/* Red Laser scanline */}
              <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-0.5 bg-rose-500 shadow-sm shadow-rose-500 animate-pulse" />
            </div>
          </div>

          {/* Scanner Status Badge */}
          <div className="absolute bottom-2 left-2 right-2 bg-slate-900/80 backdrop-blur-xs px-2.5 py-1 rounded-lg text-center text-[10px] text-slate-300 font-mono">
            {isProcessing ? '⚡ Transmitting scan to laptop...' : scannerStatus}
          </div>
        </div>

        {/* Manual Barcode Input Row */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleProcessBarcode(manualInput);
            setManualInput('');
          }}
          className="w-full max-w-[340px] mt-2.5 flex items-center gap-1.5"
        >
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Type barcode tag (e.g. 89010001)..."
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 px-3 py-2 rounded-xl text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            type="submit"
            disabled={!manualInput.trim() || isProcessing}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-emerald-400 border border-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1"
          >
            <span>Scan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Real-time Scan Result Confirmation Box */}
        {lastScanResult && (
          <div
            className={`w-full max-w-[340px] mt-3 p-3.5 rounded-xl border animate-in fade-in slide-in-from-bottom-2 duration-200 ${
              lastScanResult.action === 'cart'
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-100 shadow-lg shadow-emerald-950/50'
                : lastScanResult.action === 'incremented'
                ? 'bg-blue-950/60 border-blue-500 text-blue-100 shadow-lg shadow-blue-950/50'
                : lastScanResult.action === 'not_found'
                ? 'bg-amber-950/60 border-amber-500 text-amber-100'
                : 'bg-slate-900 border-slate-700 text-slate-200'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {lastScanResult.action === 'cart' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : lastScanResult.action === 'incremented' ? (
                  <Package className="w-5 h-5 text-blue-400 shrink-0" />
                ) : lastScanResult.action === 'not_found' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                ) : (
                  <Search className="w-5 h-5 text-slate-400 shrink-0" />
                )}
                <div>
                  <div className="font-bold text-xs leading-tight">
                    {lastScanResult.action === 'cart' && '🛒 Added to Laptop Bill!'}
                    {lastScanResult.action === 'incremented' && '📦 Stock Added to Inventory!'}
                    {lastScanResult.action === 'not_found' && '⚠️ Unregistered Barcode'}
                    {lastScanResult.action === 'lookup' && '🔍 Price & Shelf Check'}
                  </div>
                  <div className="text-[11px] font-mono opacity-70">
                    Tag: {lastScanResult.barcode} • {lastScanResult.timestamp}
                  </div>
                </div>
              </div>

              {lastScanResult.product && (
                <div className="text-right">
                  <div className="text-xs font-black text-amber-300">
                    ₹{lastScanResult.product.sellingPrice}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Stock: {lastScanResult.product.stock}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-2 text-xs font-medium">
              {lastScanResult.message}
            </div>

            {/* Quick action button for unrecognized barcode: Register to Inventory */}
            {lastScanResult.action === 'not_found' && (
              <div className="mt-2.5 pt-2 border-t border-amber-800/60 flex items-center justify-between">
                <span className="text-[11px] text-amber-200">Want to add this item?</span>
                <button
                  type="button"
                  onClick={() => {
                    setNewBarcode(lastScanResult.barcode);
                    setNewName('');
                    setShowQuickAddModal(true);
                  }}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1 shadow-xs"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Register Item Now</span>
                </button>
              </div>
            )}

            {/* Restock Multiplier Buttons in "Add Item" mode */}
            {lastScanResult.action === 'incremented' && lastScanResult.product && (
              <div className="mt-2 pt-2 border-t border-blue-800/60 flex items-center justify-between">
                <span className="text-[11px] text-blue-200">Add more pieces:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleAdjustRecentQuantity(lastScanResult.barcode, 1)}
                    className="px-2 py-0.5 bg-blue-800 hover:bg-blue-700 text-white rounded text-[10px] font-bold"
                  >
                    +1 pc
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustRecentQuantity(lastScanResult.barcode, 5)}
                    className="px-2 py-0.5 bg-blue-800 hover:bg-blue-700 text-white rounded text-[10px] font-bold"
                  >
                    +5 pcs
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustRecentQuantity(lastScanResult.barcode, 10)}
                    className="px-2 py-0.5 bg-blue-800 hover:bg-blue-700 text-white rounded text-[10px] font-bold"
                  >
                    +10 pcs
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recent Scanned Log */}
        {recentScans.length > 0 && (
          <div className="w-full max-w-[340px] mt-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Recent Scans on this Phone:</span>
              <span className="text-[10px] text-slate-500 font-mono">{recentScans.length} tags</span>
            </div>
            <div className="space-y-1.5">
              {recentScans.slice(0, 4).map((scan) => (
                <div
                  key={scan.id}
                  className="bg-slate-900 border border-slate-800/80 rounded-lg p-2 flex items-center justify-between text-xs"
                >
                  <div className="truncate mr-2">
                    <div className="font-semibold text-slate-200 truncate">{scan.name}</div>
                    <div className="text-[10px] font-mono text-slate-500">
                      {scan.barcode} • {scan.time}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {scan.mode === 'cart' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50">
                        <Check className="w-3 h-3" />
                        <span>Billed ₹{scan.price}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-800/50">
                        <Package className="w-3 h-3" />
                        <span>Stock: {scan.stock}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* QUICK ADD NEW GARMENT MODAL (WHEN A NEW BARCODE IS SCANNED IN "ADD ITEM" MODE) */}
      {showQuickAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-t-2xl sm:rounded-2xl p-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Add New Garment to Inventory</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Barcode: {newBarcode}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickAddModal(false)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuickProduct} className="space-y-3 text-xs">
              {/* Garment Name + Quick Chips */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Garment Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Pure Cotton Bagru Print Saree"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                {/* Quick name suggestion chips */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {['Cotton Saree', 'Mulmul Kurti', 'Chanderi Suit', 'Cotton Shirt', 'Dupatta'].map(
                    (preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setNewName(preset)}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded border border-slate-700 transition-colors"
                      >
                        + {preset}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Category & Fabric */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as ClothingCategory)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-white"
                  >
                    <option value="Saree">Saree</option>
                    <option value="Salwar Suit">Salwar Suit</option>
                    <option value="Kurti">Kurti</option>
                    <option value="Dupatta & Stole">Dupatta & Stole</option>
                    <option value="Fabric & Material">Fabric & Material</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Fabric</label>
                  <select
                    value={newFabric}
                    onChange={(e) => setNewFabric(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-white"
                  >
                    <option value="Pure Cotton">Pure Cotton</option>
                    <option value="Mulmul Cotton">Mulmul Cotton</option>
                    <option value="Chanderi Cotton">Chanderi Cotton</option>
                    <option value="Khadi Cotton">Khadi Cotton</option>
                    <option value="Kota Doria">Kota Doria</option>
                  </select>
                </div>
              </div>

              {/* Pricing & Stock */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Selling Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newSellingPrice}
                    onChange={(e) => setNewSellingPrice(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Cost (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={newCostPrice}
                    onChange={(e) => setNewCostPrice(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Initial Stock *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newStock}
                    onChange={(e) => setNewStock(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white font-bold"
                  />
                </div>
              </div>

              {/* Shelf / Rack Location */}
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Rack / Shelf Location
                </label>
                <input
                  type="text"
                  placeholder="e.g., Rack A-3, Shelf 2"
                  value={newRack}
                  onChange={(e) => setNewRack(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickAddModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingNewProduct}
                  className="flex-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-emerald-950 flex items-center justify-center gap-1.5"
                >
                  {isSavingNewProduct ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Save to Inventory &amp; Sync</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
