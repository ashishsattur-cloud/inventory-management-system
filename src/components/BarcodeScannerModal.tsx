import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import { Camera, RefreshCw, X, CheckCircle2, AlertCircle, Wifi, Laptop, Smartphone, Plus } from 'lucide-react';
import { Product } from '../types';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onBarcodeDetected: (barcode: string, product?: Product) => void;
  onOpenAddWithBarcode?: (barcode: string) => void;
  title?: string;
  subtitle?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  onBarcodeDetected,
  onOpenAddWithBarcode,
  title = 'Scan Clothing Barcode',
  subtitle = 'Use your built-in camera, mobile Wi-Fi scanner, or handheld laser'
}) => {
  const [scanResult, setScanResult] = useState<{ barcode: string; product?: Product } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

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
            qrbox: { width: 260, height: 160 },
            rememberLastUsedCamera: true,
            supportedScanTypes: [
              Html5QrcodeScanType.SCAN_TYPE_CAMERA,
            ],
          },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText) => {
            const trimmed = decodedText.trim();
            const matched = products.find((p) => p.barcode === trimmed || p.sku.toLowerCase() === trimmed.toLowerCase());
            setScanResult({ barcode: trimmed, product: matched });
            onBarcodeDetected(trimmed, matched);
            // Play POS beep tone
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 beep
              gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.12);
            } catch (e) {
              // audio context fallback
            }
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

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const trimmed = manualCode.trim();
    const matched = products.find((p) => p.barcode === trimmed || p.sku.toLowerCase() === trimmed.toLowerCase());
    setScanResult({ barcode: trimmed, product: matched });
    onBarcodeDetected(trimmed, matched);
    setManualCode('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
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

        {/* Scanner Body */}
        <div className="p-5">
          <div className="bg-slate-50 rounded-xl p-2 border border-slate-200 overflow-hidden relative min-h-[220px] flex flex-col items-center justify-center">
            <div id="retail-qr-scanner-region" className="w-full text-center"></div>
            {cameraError && (
              <div className="p-4 text-center">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-xs text-slate-600 mb-2">{cameraError}</p>
                <p className="text-xs font-semibold text-slate-700">You can also scan barcodes via the manual box or quick buttons below!</p>
              </div>
            )}
          </div>

          {/* Real-time Match Feedback */}
          {scanResult && (
            <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Barcode Scanned</div>
                <div className="font-mono text-sm font-semibold text-emerald-950">{scanResult.barcode}</div>
                {scanResult.product ? (
                  <div className="mt-1 text-xs text-emerald-900">
                    <span className="font-semibold">{scanResult.product.name}</span>
                    <span className="ml-2 text-emerald-700">
                      (Stock: {scanResult.product.stock} pcs | ₹{scanResult.product.sellingPrice})
                    </span>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <div className="text-xs text-amber-800">
                      No matching garment in catalog with barcode <strong className="font-mono">{scanResult.barcode}</strong>.
                    </div>
                    {onOpenAddWithBarcode && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenAddWithBarcode(scanResult.barcode);
                          onClose();
                        }}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add &amp; Register Garment with this Barcode →</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Manual Input or Fast Test Barcodes */}
          <div className="mt-4">
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Or type/paste Barcode (e.g. 890123400101)..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-sm"
              >
                Enter
              </button>
            </form>

            {products.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span className="text-[11px] font-medium text-slate-400">Quick Test Tags:</span>
                {products.slice(0, 4).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setScanResult({ barcode: p.barcode, product: p });
                      onBarcodeDetected(p.barcode, p);
                    }}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-mono text-[11px] transition-colors"
                  >
                    {p.barcode} ({p.category.split(' ')[0]})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* WiFi Mobile Pairing Note */}
          <div className="mt-4 bg-slate-100 rounded-xl p-3 flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-600" />
              <span>Mobile Scanner over Wi-Fi is active</span>
            </div>
            <span className="font-mono text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
              POS Terminal #1
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Done Scanning
          </button>
        </div>
      </div>
    </div>
  );
};
