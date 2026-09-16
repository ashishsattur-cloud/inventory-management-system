import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Smartphone,
  Volume2,
  VolumeX,
  FlipHorizontal,
  Lightbulb,
  ArrowLeft,
  Send,
  Zap,
  Check,
  Laptop,
  PlusCircle,
  ShoppingCart,
  MinusCircle,
  Tag,
  X,
  Radio,
  RefreshCw,
  Plus
} from 'lucide-react';
import {
  apiScanBarcode,
  playChime,
  apiCheckServerHealth,
  apiPingGun,
  apiQuickAddProduct
} from '../services/api';

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
  const [isPinging, setIsPinging] = useState(false);
  const [pingFeedback, setPingFeedback] = useState<string | null>(null);

  // Scan modes: Cart (Add to Bill), Add (+1 / Restock), Deduct (-1)
  const [scanAction, setScanAction] = useState<'cart' | 'add' | 'deduct'>('cart');

  // Quick Add Item Modal for scanning
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [newGarmentBarcode, setNewGarmentBarcode] = useState('');
  const [newGarmentName, setNewGarmentName] = useState('');
  const [newGarmentCategory, setNewGarmentCategory] = useState('Kurti');
  const [newGarmentPrice, setNewGarmentPrice] = useState('899');
  const [newGarmentStock, setNewGarmentStock] = useState('10');
  const [isSavingGarment, setIsSavingGarment] = useState(false);
  const [quickAddMessage, setQuickAddMessage] = useState<string | null>(null);

  const [recentScans, setRecentScans] = useState<
    Array<{ barcode: string; time: string; status: 'sent' | 'pending'; actionName: string }>
  >([]);
  const [lastScanned, setLastScanned] = useState<{
    barcode: string;
    time: string;
    actionName: string;
    productName?: string;
  } | null>(null);

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
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const isOnline = serverConnected || internalOnline;

  const triggerFeedback = () => {
    if (soundEnabled) {
      playChime('beep');
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(70);
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

    const actionLabels: Record<string, string> = {
      cart: 'Add to Bill',
      add: 'Add Item / Restock (+1)',
      deduct: 'Deduct Stock (-1)',
    };
    const actionLabel = actionLabels[scanAction] || 'Scan';

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastScanned({ barcode: trimmed, time: timeStr, actionName: actionLabel });
    setRecentScans((prev) => [
      { barcode: trimmed, time: timeStr, status: 'sent', actionName: actionLabel },
      ...prev.slice(0, 8),
    ]);

    try {
      const res = await apiScanBarcode(trimmed, scanAction, 'Handheld Mobile Scanner Gun');
      if (res.product) {
        setLastScanned({
          barcode: trimmed,
          time: timeStr,
          actionName: actionLabel,
          productName: res.product.name,
        });
      } else if (res.notFound) {
        // If unknown garment barcode, prompt Quick Add
        setNewGarmentBarcode(trimmed);
        setLastScanned({
          barcode: trimmed,
          time: timeStr,
          actionName: 'New Tag (Not in Catalog)',
        });
      }
    } catch (err) {
      console.error('Mobile scan dispatch error:', err);
    } finally {
      setIsProcessing(false);
      // Brief cooldown before scanning next tag
      setTimeout(() => {
        isCooldownRef.current = false;
      }, 1000);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleBarcodeScanned(manualInput.trim());
    setManualInput('');
  };

  const handleTestPing = async () => {
    setIsPinging(true);
    setPingFeedback('Testing connection with laptop...');
    try {
      const ok = await apiPingGun('Handheld Mobile Barcode Gun', 'ping');
      if (ok) {
        playChime('chime');
        setPingFeedback('✓ Synced with Laptop! Response OK');
      } else {
        setPingFeedback('⚠️ Laptop offline or waking up. Please verify Wi-Fi.');
      }
    } catch (e) {
      setPingFeedback('⚠️ Failed to ping laptop. Check network.');
    } finally {
      setIsPinging(false);
      setTimeout(() => setPingFeedback(null), 4000);
    }
  };

  // Quick Add Item from Mobile Gun
  const handleSaveQuickItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGarmentName.trim() || !newGarmentBarcode.trim()) {
      setQuickAddMessage('Please enter both garment name and barcode');
      return;
    }

    setIsSavingGarment(true);
    setQuickAddMessage(null);

    try {
      const res = await apiQuickAddProduct({
        barcode: newGarmentBarcode.trim(),
        name: newGarmentName.trim(),
        category: newGarmentCategory,
        sellingPrice: Number(newGarmentPrice) || 899,
        stock: Number(newGarmentStock) || 10,
        deviceName: 'Mobile Scanner Gun (Quick Add)',
      });

      if (res.success) {
        playChime('success');
        setQuickAddMessage(`✓ "${newGarmentName}" saved to laptop inventory!`);
        setTimeout(() => {
          setIsQuickAddOpen(false);
          setQuickAddMessage(null);
          setNewGarmentName('');
          setNewGarmentBarcode('');
        }, 1200);
      } else {
        setQuickAddMessage(res.error || 'Failed to save garment');
      }
    } catch (err: any) {
      setQuickAddMessage('Connection error saving garment');
    } finally {
      setIsSavingGarment(false);
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
            // Frame scan miss
          }
        );

        if (!isCancelled) {
          setScannerStatus('Camera active • Aim laser at barcode tag');
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
          setScannerStatus('Camera not accessible. You can use manual entry or check camera permissions.');
        }
      }
    };

    startCamera();

    return () => {
      isCancelled = true;
      if (html5QrCodeRef.current) {
        try {
          html5QrCodeRef.current
            .stop()
            .then(() => html5QrCodeRef.current?.clear())
            .catch(() => {});
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
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none pb-12">
      {/* Top Mobile Barcode Gun Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-30 shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/40 shrink-0">
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
                <span>{isOnline ? 'Connected to Counter Laptop' : 'Connecting to Laptop...'}</span>
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
              title="Exit Mobile Scanner"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Barcode Viewfinder Section */}
      <main className="flex-1 flex flex-col max-w-md mx-auto w-full px-4 pt-3 gap-3">
        {/* Connection & Live Sync Indicator */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 text-xs">
            <Laptop className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-white block text-xs">Counter Laptop Synced</span>
              <span className="text-[10px] text-slate-400">Scans arrive immediately on PC</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleTestPing}
            disabled={isPinging}
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-bold text-emerald-300 flex items-center gap-1 transition-all active:scale-95 shrink-0"
          >
            <Radio className={`w-3 h-3 text-emerald-400 ${isPinging ? 'animate-spin' : ''}`} />
            <span>{isPinging ? 'Pinging...' : 'Test Sync'}</span>
          </button>
        </div>

        {pingFeedback && (
          <div className="text-xs p-2 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-300 animate-in fade-in">
            {pingFeedback}
          </div>
        )}

        {/* Scan Mode & Add Item Control Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-bold">
            <span>Choose Action for Scanned Tags:</span>
            {/* The "Add Item" button for scanning requested by user */}
            <button
              type="button"
              onClick={() => {
                setNewGarmentBarcode(lastScanned?.barcode || '');
                setIsQuickAddOpen(true);
              }}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-950/80 px-2 py-1 rounded-lg border border-emerald-800"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>➕ Add Item</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setScanAction('cart')}
              className={`py-2 px-1.5 rounded-lg font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all ${
                scanAction === 'cart'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="text-[11px]">Add to Bill</span>
            </button>

            <button
              type="button"
              onClick={() => setScanAction('add')}
              className={`py-2 px-1.5 rounded-lg font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all ${
                scanAction === 'add'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span className="text-[11px]">Add Item (+1)</span>
            </button>

            <button
              type="button"
              onClick={() => setScanAction('deduct')}
              className={`py-2 px-1.5 rounded-lg font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all ${
                scanAction === 'deduct'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <MinusCircle className="w-4 h-4" />
              <span className="text-[11px]">Deduct (-1)</span>
            </button>
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

              <div className="absolute bottom-2 text-[11px] font-bold text-emerald-300 bg-black/70 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Align Garment Tag Barcode
              </div>
            </div>
          </div>

          {/* Real-Time Processing Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-emerald-600/30 backdrop-blur-xs flex items-center justify-center gap-2 text-white font-bold text-sm">
              <Zap className="w-5 h-5 text-yellow-300 animate-bounce" />
              <span>Beaming Tag to Laptop...</span>
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
                <div className="text-xs font-bold text-white flex items-center gap-1.5 flex-wrap">
                  <span>Sent:</span>
                  <code className="text-emerald-300 font-mono text-xs bg-slate-950 px-1.5 py-0.5 rounded">
                    {lastScanned.barcode}
                  </code>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                    {lastScanned.actionName}
                  </span>
                </div>
                {lastScanned.productName && (
                  <div className="text-[11px] font-semibold text-emerald-300 mt-0.5">
                    {lastScanned.productName}
                  </div>
                )}
                <div className="text-[10px] text-slate-400">
                  {lastScanned.time} • Synced to Counter Laptop
                </div>
              </div>
            </div>
            <div className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950 px-2 py-1 rounded border border-emerald-800 shrink-0">
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
              placeholder="e.g., 3000001 or SKU-..."
              className="flex-1 bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-emerald-500 font-mono"
            />
            <button
              type="submit"
              disabled={!manualInput.trim()}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0"
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
                    <span className="text-[10px] text-slate-400">({scan.actionName})</span>
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

      {/* Quick Add Item Bottom Sheet Modal */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                  <Tag className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-white">Add Item to Inventory</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickAddOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickItem} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Garment Barcode</label>
                <input
                  type="text"
                  required
                  value={newGarmentBarcode}
                  onChange={(e) => setNewGarmentBarcode(e.target.value)}
                  placeholder="e.g. 3000025"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Garment Name</label>
                <input
                  type="text"
                  required
                  value={newGarmentName}
                  onChange={(e) => setNewGarmentName(e.target.value)}
                  placeholder="e.g. Pure Cotton Anarkali Kurti"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Category</label>
                  <select
                    value={newGarmentCategory}
                    onChange={(e) => setNewGarmentCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="Kurti">Kurti</option>
                    <option value="Saree">Saree</option>
                    <option value="Salwar Suit">Salwar Suit</option>
                    <option value="Dress Material">Dress Material</option>
                    <option value="Dupatta">Dupatta</option>
                    <option value="Lehenga">Lehenga</option>
                    <option value="Bottom Wear">Bottom Wear</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={newGarmentPrice}
                    onChange={(e) => setNewGarmentPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Initial Stock (Pieces)</label>
                <input
                  type="number"
                  min="1"
                  value={newGarmentStock}
                  onChange={(e) => setNewGarmentStock(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>

              {quickAddMessage && (
                <div className={`p-2 rounded-lg text-xs font-medium ${
                  quickAddMessage.startsWith('✓') ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-800'
                }`}>
                  {quickAddMessage}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuickAddOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingGarment}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-bold text-white shadow-md flex items-center justify-center gap-1.5"
                >
                  {isSavingGarment ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save to Inventory</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
