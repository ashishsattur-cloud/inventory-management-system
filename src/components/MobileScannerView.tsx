import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Smartphone,
  CheckCircle2,
  Volume2,
  VolumeX,
  FlipHorizontal,
  Lightbulb,
  Radio,
  ArrowLeft,
  Scan,
  Send,
  Zap,
  Check,
  Laptop
} from 'lucide-react';
import { apiScanBarcode, playChime, apiCheckServerHealth } from '../services/api';

interface MobileScannerViewProps {
  onExitScannerView: () => void;
  serverConnected?: boolean;
}

export const MobileScannerView: React.FC<MobileScannerViewProps> = ({
  onExitScannerView,
  serverConnected = true,
}) => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<string>('Initializing camera...');
  const [internalOnline, setInternalOnline] = useState(serverConnected);
  const [recentScans, setRecentScans] = useState<
    Array<{ barcode: string; time: string; status: 'sent' | 'pending' }>
  >([]);
  const [lastScanned, setLastScanned] = useState<{ barcode: string; time: string } | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isCooldownRef = useRef(false);

  // Proactive health monitoring
  useEffect(() => {
    setInternalOnline(serverConnected);
    apiCheckServerHealth().then((ok) => setInternalOnline(ok));
  }, [serverConnected]);

  useEffect(() => {
    const timer = setInterval(() => {
      apiCheckServerHealth().then((ok) => setInternalOnline(ok));
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const isOnline = serverConnected || internalOnline;

  const triggerFeedback = () => {
    if (soundEnabled) {
      playChime('beep');
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(60);
      } catch (e) {}
    }
  };

  // Main barcode handler: strictly scans and beams to laptop
  const handleBarcodeScanned = async (barcodeString: string) => {
    const trimmed = barcodeString.trim();
    if (!trimmed || isCooldownRef.current || isProcessing) return;

    isCooldownRef.current = true;
    setIsProcessing(true);
    triggerFeedback();

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastScanned({ barcode: trimmed, time: timeStr });
    setRecentScans((prev) => [{ barcode: trimmed, time: timeStr, status: 'sent' }, ...prev.slice(0, 9)]);

    try {
      // Send raw scan to server - laptop will handle according to cursor position in Add to Inventory or active laptop action
      await apiScanBarcode(trimmed, 'cart', 'Handheld Mobile Scanner Gun');
    } catch (err) {
      console.error('Mobile scan dispatch error:', err);
    } finally {
      setIsProcessing(false);
      // Brief cooldown before scanning the next garment
      setTimeout(() => {
        isCooldownRef.current = false;
      }, 1200);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleBarcodeScanned(manualInput.trim());
    setManualInput('');
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
          qrbox: { width: 280, height: 200 },
          aspectRatio: 1.0,
        };

        await scanner.start(
          { facingMode: cameraFacing },
          config,
          (decodedText) => {
            if (!isCancelled) {
              handleBarcodeScanned(decodedText);
            }
          },
          () => {
            // Ignore frame scan failures
          }
        );

        if (!isCancelled) {
          setScannerStatus('Camera Active • Point at garment barcode');
          try {
            const track = (scanner as any)?.html5QrCodeScanner?.videoTrack;
            const capabilities = track?.getCapabilities?.();
            setHasTorch(Boolean(capabilities?.torch));
          } catch (e) {
            setHasTorch(false);
          }
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.warn('Camera start error:', err);
          setScannerStatus('Camera access denied or unavailable. Use manual barcode input below.');
        }
      }
    };

    startCamera();

    return () => {
      isCancelled = true;
      if (html5QrCodeRef.current) {
        try {
          html5QrCodeRef.current.stop().then(() => html5QrCodeRef.current?.clear()).catch(() => {});
        } catch (e) {}
      }
    };
  }, [cameraFacing]);

  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !hasTorch) return;
    try {
      await (html5QrCodeRef.current as any).applyVideoConstraints({
        advanced: [{ torch: !torchOn }],
      });
      setTorchOn(!torchOn);
    } catch (e) {
      console.warn('Torch toggle not supported', e);
    }
  };

  const toggleCameraFacing = () => {
    setCameraFacing((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none pb-8">
      {/* Top Mobile Barcode Gun Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-30 shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/40">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black tracking-tight text-white">Mobile Barcode Gun</h1>
                <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded-sm bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Gun Mode
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
                <span>{isOnline ? 'Connected to Laptop' : 'Connecting to Laptop...'}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2 rounded-xl transition-all ${
                  torchOn ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
                title="Toggle Torch"
              >
                <Lightbulb className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={toggleCameraFacing}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all"
              title="Switch Camera"
            >
              <FlipHorizontal className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl transition-all ${
                soundEnabled ? 'bg-slate-800 text-emerald-400' : 'bg-slate-800 text-slate-500'
              }`}
              title="Toggle Sound"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onExitScannerView}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 text-xs font-bold"
              title="Exit to standard view"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Barcode Viewfinder Section */}
      <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 pt-3 gap-3">
        {/* Sync Instruction Banner */}
        <div className="bg-emerald-950/60 border border-emerald-800/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-200">
          <Laptop className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <span className="font-bold text-emerald-300 block">Scanner Gun Connected to Laptop</span>
            <span>
              All actions (adding garments to inventory, adding to cart, or deducting stock) are selected and controlled from your laptop.
            </span>
          </div>
        </div>

        {/* Viewfinder Frame */}
        <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-slate-700 aspect-[4/3] flex flex-col items-center justify-center shadow-xl">
          <div id="mobile-scanner-viewfinder" className="w-full h-full object-cover" />

          {/* Animated Laser Aiming Line and Corner Brackets */}
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
            <div className="relative w-64 h-40 border-2 border-dashed border-emerald-400/70 rounded-xl flex items-center justify-center">
              {/* Corner accents */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-emerald-400"></div>
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-emerald-400"></div>
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-emerald-400"></div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-emerald-400"></div>

              {/* Laser Sweep Line */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-pulse"></div>

              <div className="absolute bottom-2 text-[11px] font-bold text-emerald-300 bg-black/60 px-2 py-0.5 rounded">
                Align Garment Barcode
              </div>
            </div>
          </div>

          {/* Real-Time Processing Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-emerald-600/30 backdrop-blur-xs flex items-center justify-center gap-2 text-white font-bold text-sm">
              <Zap className="w-5 h-5 text-yellow-300 animate-bounce" />
              <span>Beaming Barcode to Laptop...</span>
            </div>
          )}
        </div>

        {/* Status text */}
        <div className="text-center text-[11px] text-slate-400">
          {scannerStatus}
        </div>

        {/* Last Scanned Feedback Card */}
        {lastScanned && (
          <div className="bg-slate-900 border border-emerald-500/50 rounded-xl p-3 flex items-center justify-between gap-3 shadow-lg animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Sent to Laptop:</span>
                  <code className="text-emerald-300 font-mono text-xs bg-slate-950 px-1.5 py-0.5 rounded">
                    {lastScanned.barcode}
                  </code>
                </div>
                <div className="text-[10px] text-slate-400">
                  {lastScanned.time} • Ready for next garment tag
                </div>
              </div>
            </div>
            <div className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950 px-2 py-1 rounded border border-emerald-800">
              Synced ✓
            </div>
          </div>
        )}

        {/* Manual Barcode Input Fallback */}
        <form onSubmit={handleManualSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Manual Barcode Number Entry</span>
            <span className="text-[10px] text-slate-400">If camera tag is damaged</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="e.g., 3000012 or SKU-KRT-..."
              className="flex-1 bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={!manualInput.trim()}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </div>
        </form>

        {/* Recent Scans List */}
        {recentScans.length > 0 && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Recent Scans Beamed to Laptop</span>
              <span className="text-[10px] text-emerald-400 font-semibold">{recentScans.length} sent</span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {recentScans.map((scan, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-slate-200"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-mono text-[11px] font-bold">
                      {scan.barcode}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span>{scan.time}</span>
                    <span className="text-emerald-400 font-bold">✓ Sent</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
