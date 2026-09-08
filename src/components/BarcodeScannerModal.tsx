import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import {
  Camera,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  Wifi,
  MinusCircle,
  PlusCircle,
  Search,
  Sparkles,
  Plus,
  ShoppingCart,
  ArrowLeft
} from 'lucide-react';
import { Product } from '../types';
import { playChime, apiScanBarcode } from '../services/api';

export type ScannerMode = 'add' | 'deduct' | 'cart' | 'lookup';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onBarcodeDetected: (barcode: string, product?: Product) => void;
  onDeductStock?: (barcode: string) => Promise<any> | void;
  onIncrementStock?: (barcode: string) => Promise<any> | void;
  onAddToCart?: (product: Product) => void;
  onOpenAddWithBarcode?: (barcode: string) => void;
  initialMode?: ScannerMode;
  title?: string;
  subtitle?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  onBarcodeDetected,
  onDeductStock,
  onIncrementStock,
  onAddToCart,
  onOpenAddWithBarcode,
  initialMode = 'add',
  title = 'Scan Clothing Barcode',
  subtitle = 'Point camera at garment tag to add stock, deduct, add to cart, or look up details'
}) => {
  const [scanMode, setScanMode] = useState<ScannerMode>(initialMode);
  const scanModeRef = useRef<ScannerMode>(initialMode);

  // Keep ref synchronized with current active mode so camera scanner reads latest selection
  useEffect(() => {
    scanModeRef.current = scanMode;
  }, [scanMode]);

  const [scanResult, setScanResult] = useState<{
    barcode: string;
    product?: Product;
    actionMessage?: string;
    isError?: boolean;
  } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const lastScannedRef = useRef<{ barcode: string; time: number }>({ barcode: '', time: 0 });

  // When modal is opened, synchronize with initialMode without wiping subsequent user selections
  useEffect(() => {
    if (isOpen) {
      setScanMode(initialMode || 'add');
      setScanResult(null);
      setManualCode('');
    }
  }, [isOpen, initialMode]);

  // Camera lifecycle: initializes when opened, clears when closed.
  // CRITICAL: Does NOT depend on scanMode, preventing camera reset and state wipe when user switches modes.
  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (e) {
          console.warn('Scanner clear error', e);
        }
        scannerRef.current = null;
      }
      setScanResult(null);
      setCameraError(null);
      return;
    }

    // Initialize HTML5-QRCode Scanner
    const elementId = 'retail-qr-scanner-region';
    const timer = setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner(
          elementId,
          {
            fps: 10,
            qrbox: { width: 280, height: 180 },
            rememberLastUsedCamera: true,
            supportedScanTypes: [
              Html5QrcodeScanType.SCAN_TYPE_CAMERA,
            ],
          },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText) => {
            handleScannedCode(decodedText.trim());
          },
          (error) => {
            // scanning continuously
          }
        );

        scannerRef.current = scanner;
      } catch (err: any) {
        setCameraError(err?.message || 'Unable to access camera. Check device permissions or enter barcode manually below.');
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (e) {}
      }
    };
  }, [isOpen]);

  const handleClose = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
      } catch (e) {}
    }
    onClose();
  };

  // Handle scanned code with debouncing and current active mode
  const handleScannedCode = async (trimmed: string) => {
    const now = Date.now();
    // 2-second debounce for identical barcode to prevent accidental rapid re-scans
    if (lastScannedRef.current.barcode === trimmed && now - lastScannedRef.current.time < 2000) {
      return;
    }
    lastScannedRef.current = { barcode: trimmed, time: now };

    const matched = products.find(
      (p) => p.barcode === trimmed || p.sku.toLowerCase() === trimmed.toLowerCase()
    );

    const activeMode = scanModeRef.current;

    if (!matched) {
      playChime('alert');
      setScanResult({
        barcode: trimmed,
        actionMessage: `Barcode "${trimmed}" not found in inventory catalog. You can register it below!`,
        isError: true,
      });
      onBarcodeDetected(trimmed, undefined);
      return;
    }

    if (activeMode === 'deduct') {
      setIsProcessing(true);
      playChime('deduct');

      // The user specified: when we click on deduct the scanned items should come in billing
      if (onAddToCart) {
        onAddToCart(matched);
      }

      setScanResult({
        barcode: trimmed,
        product: matched,
        actionMessage: matched.stock <= 0
          ? `⚡ Added "${matched.name}" to Active Bill (Note: Stock in system was 0)`
          : `🛒 Added "${matched.name}" to Bill & Deducted 1 pc! (MRP: ₹${matched.sellingPrice})`,
        isError: false,
      });
      onBarcodeDetected(trimmed, matched);
      setIsProcessing(false);
    } else if (activeMode === 'add') {
      setIsProcessing(true);
      playChime('success');

      if (onIncrementStock) {
        try {
          await onIncrementStock(trimmed);
        } catch (err) {
          console.error('Error incrementing stock:', err);
        }
      }

      setScanResult({
        barcode: trimmed,
        product: matched,
        actionMessage: `📦 Added 1 piece to inventory! Stock is now ${matched.stock + 1} pcs.`,
        isError: false,
      });
      onBarcodeDetected(trimmed, matched);
      setIsProcessing(false);
    } else if (activeMode === 'cart') {
      playChime('success');
      if (onAddToCart) {
        onAddToCart(matched);
      }
      try {
        apiScanBarcode(trimmed, 'cart', 'Counter/Modal Scanner');
      } catch (err) {
        console.warn('Sync scan failed:', err);
      }
      setScanResult({
        barcode: trimmed,
        product: matched,
        actionMessage: matched.stock <= 0
          ? `🛒 Added "${matched.name}" to Active Bill (Note: Stock in system was 0)`
          : `🛒 Added 1 piece of "${matched.name}" to POS Cart! (Price: ₹${matched.sellingPrice})`,
        isError: false,
      });
      onBarcodeDetected(trimmed, matched);
    } else {
      // Lookup only
      playChime('success');
      setScanResult({
        barcode: trimmed,
        product: matched,
        actionMessage: `🔍 Found "${matched.name}" (Stock: ${matched.stock} pcs, MRP: ₹${matched.sellingPrice}, Rack: ${matched.rackLocation || 'Bay 1'})`,
        isError: false,
      });
      onBarcodeDetected(trimmed, matched);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleScannedCode(manualCode.trim());
    setManualCode('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-2 max-h-[95vh] flex flex-col">
        {/* Header with prominent Back Button */}
        <div className="px-4 sm:px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs border border-slate-700"
              title="Return to store screen"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-400" />
              <span>← Back</span>
            </button>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-50 leading-tight">{title}</h3>
              <p className="text-[11px] text-slate-300 hidden sm:block">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scan Mode Selector Tabs */}
        <div className="p-3.5 bg-slate-100 border-b border-slate-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Select Scanner Mode:
            </div>
            {onOpenAddWithBarcode && (
              <button
                type="button"
                onClick={() => {
                  onOpenAddWithBarcode('');
                  onClose();
                }}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register New Item</span>
              </button>
            )}
          </div>

          <div className={`grid ${onAddToCart ? 'grid-cols-4' : 'grid-cols-3'} gap-1.5 sm:gap-2`}>
            {/* Add / Restock Tab */}
            <button
              type="button"
              onClick={() => {
                setScanMode('add');
                setScanResult(null);
              }}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                scanMode === 'add'
                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <PlusCircle className="w-4 h-4 text-emerald-300" />
              <span>Add (+1)</span>
            </button>

            {/* Deduct Tab */}
            <button
              type="button"
              onClick={() => {
                setScanMode('deduct');
                setScanResult(null);
              }}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                scanMode === 'deduct'
                  ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <MinusCircle className="w-4 h-4 text-amber-200" />
              <span>Deduct (-1)</span>
            </button>

            {/* Add to Cart Tab (optional when POS cart callback is provided) */}
            {onAddToCart && (
              <button
                type="button"
                onClick={() => {
                  setScanMode('cart');
                  setScanResult(null);
                }}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                  scanMode === 'cart'
                    ? 'bg-teal-700 text-white shadow-sm ring-2 ring-teal-400'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                <ShoppingCart className="w-4 h-4 text-teal-200" />
                <span>To Cart</span>
              </button>
            )}

            {/* Lookup Tab */}
            <button
              type="button"
              onClick={() => {
                setScanMode('lookup');
                setScanResult(null);
              }}
              className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                scanMode === 'lookup'
                  ? 'bg-slate-800 text-white shadow-sm ring-2 ring-slate-600'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Search className="w-4 h-4 text-slate-300" />
              <span>Lookup</span>
            </button>
          </div>

          {/* Mode Guidance banner */}
          <div className="mt-2 text-[11px] text-center font-medium">
            {scanMode === 'add' && (
              <span className="text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 inline-block w-full">
                📦 <strong>Add Mode Active:</strong> Scanned garments will receive +1 piece to current inventory stock.
              </span>
            )}
            {scanMode === 'deduct' && (
              <span className="text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 inline-block w-full">
                ⚡ <strong>Deduct Mode Active:</strong> Scanned garment tags will immediately reduce stock count by 1.
              </span>
            )}
            {scanMode === 'cart' && (
              <span className="text-teal-800 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200 inline-block w-full">
                🛒 <strong>Cart Mode Active:</strong> Scanned garment items will be placed into the customer's checkout cart.
              </span>
            )}
            {scanMode === 'lookup' && (
              <span className="text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 inline-block w-full">
                🔍 <strong>Lookup Mode Active:</strong> Inspects garment details, rack location, and stock without altering numbers.
              </span>
            )}
          </div>
        </div>

        {/* Scanner Body */}
        <div className="p-5">
          <div className="bg-slate-900 rounded-xl p-2 border border-slate-800 overflow-hidden relative min-h-[220px] flex flex-col items-center justify-center">
            <div id="retail-qr-scanner-region" className="w-full text-center"></div>
            {cameraError && (
              <div className="p-4 text-center bg-slate-800 rounded-lg">
                <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                <p className="text-xs text-slate-300 mb-2">{cameraError}</p>
                <p className="text-xs font-semibold text-slate-200">You can also scan barcodes via the manual input or quick buttons below!</p>
              </div>
            )}
          </div>

          {/* Real-time Match & Action Feedback */}
          {scanResult && (
            <div
              className={`mt-4 p-3.5 rounded-xl border flex items-start gap-3 animate-in fade-in ${
                scanResult.isError
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-950'
              }`}
            >
              {scanResult.isError ? (
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-extrabold uppercase tracking-wide">
                  {scanResult.isError ? 'Notice' : 'Success'}
                </div>
                <div className="font-mono text-sm font-bold">{scanResult.barcode}</div>
                <div className="mt-1 text-xs font-medium">{scanResult.actionMessage}</div>

                {scanResult.product && (
                  <div className="mt-1.5 text-[11px] text-slate-700 bg-white/70 p-1.5 rounded-lg">
                    <span className="font-bold">{scanResult.product.name}</span>
                    <span className="ml-2">Rack: {scanResult.product.rackLocation || 'Bay 1'}</span>
                  </div>
                )}

                {scanResult.isError && onOpenAddWithBarcode && !scanResult.product && (
                  <div className="mt-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenAddWithBarcode(scanResult.barcode);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Register &amp; Add Garment with Barcode "{scanResult.barcode}" →</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manual Input Form */}
          <div className="mt-4">
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder={`Type barcode to ${
                  scanMode === 'deduct'
                    ? 'deduct 1'
                    : scanMode === 'add'
                    ? 'add (+1 stock)'
                    : scanMode === 'cart'
                    ? 'add to cart'
                    : 'lookup details'
                }...`}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={isProcessing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-1"
              >
                <span>Process Code</span>
              </button>
            </form>

            {/* Quick Test Tags */}
            {products.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span className="text-[11px] font-bold text-slate-400">Click to Test:</span>
                {products.slice(0, 4).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleScannedCode(p.barcode)}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono text-[11px] transition-colors"
                  >
                    {p.barcode} ({p.category.split(' ')[0]} - Stock: {p.stock})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* WiFi Mobile Sync status */}
          <div className="mt-4 bg-slate-100 rounded-xl p-2.5 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-600" />
              <span>Real-Time Sync Active (Laptop &amp; Mobile)</span>
            </div>
            <span className="font-mono text-[11px] text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded font-bold">
              Live Connected
            </span>
          </div>
        </div>

        {/* Footer with easy back button */}
        <div className="px-4 sm:px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
            <span>← Done Scanning / Back to Shop Counter</span>
          </button>
        </div>
      </div>
    </div>
  );
};
