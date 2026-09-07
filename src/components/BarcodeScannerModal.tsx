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
  Plus
} from 'lucide-react';
import { Product } from '../types';
import { playChime } from '../services/api';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onBarcodeDetected: (barcode: string, product?: Product) => void;
  onDeductStock?: (barcode: string) => Promise<any> | void;
  onIncrementStock?: (barcode: string) => Promise<any> | void;
  onOpenAddWithBarcode?: (barcode: string) => void;
  initialMode?: 'deduct' | 'lookup' | 'add';
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
  onOpenAddWithBarcode,
  initialMode = 'deduct',
  title = 'Scan Clothing Barcode',
  subtitle = 'Point camera at garment tag to adjust stock or look up details'
}) => {
  const [scanMode, setScanMode] = useState<'deduct' | 'lookup' | 'add'>(initialMode);
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

  // Reset or clear scanner on modal open/close
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

    setScanMode(initialMode);

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
  }, [isOpen, scanMode]);

  // Handle scanned code with debouncing and stock deduction
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

    if (!matched) {
      playChime('alert');
      setScanResult({
        barcode: trimmed,
        actionMessage: `Barcode "${trimmed}" not found in catalog.`,
        isError: true,
      });
      onBarcodeDetected(trimmed, undefined);
      return;
    }

    if (scanMode === 'deduct') {
      if (matched.stock <= 0) {
        playChime('alert');
        setScanResult({
          barcode: trimmed,
          product: matched,
          actionMessage: `⚠️ "${matched.name}" is already out of stock (0 pcs left)!`,
          isError: true,
        });
        return;
      }

      setIsProcessing(true);
      playChime('deduct');

      if (onDeductStock) {
        try {
          await onDeductStock(trimmed);
        } catch (err) {
          console.error('Error deducting stock:', err);
        }
      }

      setScanResult({
        barcode: trimmed,
        product: matched,
        actionMessage: `Deducted 1 item from inventory! Stock is now ${matched.stock - 1} pcs.`,
        isError: false,
      });
      onBarcodeDetected(trimmed, matched);
      setIsProcessing(false);
    } else if (scanMode === 'add') {
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
        actionMessage: `Added 1 item to inventory! Stock is now ${matched.stock + 1} pcs.`,
        isError: false,
      });
      onBarcodeDetected(trimmed, matched);
      setIsProcessing(false);
    } else {
      // Lookup only
      playChime('success');
      setScanResult({
        barcode: trimmed,
        product: matched,
        actionMessage: `Found "${matched.name}" (Stock: ${matched.stock} pcs, MRP: ₹${matched.sellingPrice})`,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-4">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-slate-50">{title}</h3>
              <p className="text-xs text-slate-300">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scan Mode Selector Tabs */}
        <div className="p-3 bg-slate-100 border-b border-slate-200">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 px-1">
            Choose Scanner Action:
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setScanMode('deduct');
                setScanResult(null);
              }}
              className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                scanMode === 'deduct'
                  ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <MinusCircle className="w-4 h-4" />
              <span>Deduct (-1)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setScanMode('lookup');
                setScanResult(null);
              }}
              className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                scanMode === 'lookup'
                  ? 'bg-slate-800 text-white shadow-sm ring-2 ring-slate-600'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Lookup</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setScanMode('add');
                setScanResult(null);
              }}
              className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                scanMode === 'add'
                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Restock (+1)</span>
            </button>
          </div>

          {/* Mode Guidance banner */}
          <div className="mt-2 text-[11px] text-center font-medium">
            {scanMode === 'deduct' && (
              <span className="text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 inline-block w-full">
                ⚡ <strong>Deduct Mode Active:</strong> Every scanned tag immediately reduces stock count by 1.
              </span>
            )}
            {scanMode === 'lookup' && (
              <span className="text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200 inline-block w-full">
                🔍 <strong>Lookup Mode:</strong> Scans garment tag to display price, rack location, and stock.
              </span>
            )}
            {scanMode === 'add' && (
              <span className="text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 inline-block w-full">
                ➕ <strong>Restock Mode:</strong> Scanning increases inventory stock by 1 per scan.
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
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        onOpenAddWithBarcode(scanResult.barcode);
                        onClose();
                      }}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add &amp; Register Garment with this Barcode →</span>
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
                placeholder={`Type barcode to ${scanMode === 'deduct' ? 'deduct 1' : scanMode === 'add' ? 'add 1' : 'lookup'}...`}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={isProcessing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm shrink-0"
              >
                Scan Code
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

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close Scanner
          </button>
        </div>
      </div>
    </div>
  );
};
