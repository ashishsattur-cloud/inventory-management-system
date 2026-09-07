import React, { useState } from 'react';
import { Smartphone, Wifi, QrCode, Laptop, Check, RefreshCw, Radio, ShieldCheck, ArrowLeft, X, MinusCircle } from 'lucide-react';
import { Product } from '../types';

interface PosHardwareModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onRemoteScan: (barcode: string, product?: Product) => void;
  onDeductStock?: (barcode: string) => Promise<any> | void;
  connectedDevices?: number;
}

export const PosHardwareModal: React.FC<PosHardwareModalProps> = ({
  isOpen,
  onClose,
  products,
  onRemoteScan,
  onDeductStock,
  connectedDevices = 1,
}) => {
  const [wifiSsid] = useState('Boutique_Store_Wi-Fi');
  const [lastReceived, setLastReceived] = useState<{ barcode: string; time: string; action: string } | null>(null);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const mobileScannerUrl = `${currentUrl}?mode=scanner`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(mobileScannerUrl)}`;

  const handleSimulateMobileScan = async (barcode: string, deduct = false) => {
    const product = products.find((p) => p.barcode === barcode);
    if (deduct && onDeductStock) {
      await onDeductStock(barcode);
      setLastReceived({
        barcode,
        time: new Date().toLocaleTimeString(),
        action: `Deducted 1 item (${product?.name || barcode})`,
      });
    } else {
      onRemoteScan(barcode, product);
      setLastReceived({
        barcode,
        time: new Date().toLocaleTimeString(),
        action: `Looked up ${product?.name || barcode}`,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
        {/* Top Header with prominent BACK button */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
              title="Return to store"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Store</span>
            </button>

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                <Wifi className="w-4 h-4" />
              </div>
              <div className="truncate">
                <h3 className="font-semibold text-sm sm:text-base text-slate-50 leading-tight">
                  Mobile Wi-Fi Scanner &amp; Hardware Sync
                </h3>
                <p className="text-[11px] text-slate-400 truncate">
                  Laptop and mobile devices stay in 100% sync in real time
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors ml-2 shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Live Network Sync Status Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-3">
              <span>Real-Time Network Sync Status</span>
              <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Connected • {connectedDevices} Device{connectedDevices === 1 ? '' : 's'} Active
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* POS Terminal */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center">
                <Laptop className="w-6 h-6 text-slate-700 mx-auto mb-1.5" />
                <div className="text-xs font-bold text-slate-800">Counter Laptop / POS</div>
                <div className="text-[10px] text-emerald-700 bg-emerald-50 py-0.5 rounded font-medium mt-2">
                  SSE Live Stream Active
                </div>
              </div>

              {/* Wi-Fi Bridge */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center flex flex-col justify-center items-center">
                <Radio className="w-6 h-6 text-emerald-600 mb-1.5 animate-pulse" />
                <div className="text-xs font-bold text-slate-800">Local Wi-Fi Server</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Sub-second Sync</div>
                <div className="mt-1 text-[10px] text-slate-600 bg-slate-100 py-0.5 px-2 rounded">
                  Port 3000
                </div>
              </div>

              {/* Mobile Scanner */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center">
                <Smartphone className="w-6 h-6 text-emerald-700 mx-auto mb-1.5" />
                <div className="text-xs font-bold text-slate-800">Mobile Barcode Gun</div>
                <div className="text-[10px] text-emerald-700 bg-emerald-50 py-0.5 rounded font-medium mt-2">
                  Scan to Deduct (-1)
                </div>
              </div>
            </div>
          </div>

          {/* Connect Mobile Step with QR Code */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-xl p-4 bg-white flex flex-col items-center text-center">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5 w-full justify-center">
                <QrCode className="w-4 h-4 text-emerald-600" />
                Step 1: Scan QR Code with Phone
              </h4>
              <p className="text-xs text-slate-600 mb-3">
                Open phone camera and point at this QR code to launch the Mobile Floor Scanner:
              </p>

              {/* QR Code image */}
              <div className="p-2.5 bg-white border border-slate-300 rounded-xl shadow-xs">
                <img
                  src={qrCodeUrl}
                  alt="Scan to open on phone"
                  className="w-36 h-36 mx-auto rounded-lg"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="mt-2 text-[11px] font-mono text-slate-700 break-all bg-slate-100 px-2 py-1 rounded w-full">
                {currentUrl}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Ensure both laptop and phone are connected to the store Wi-Fi or internet.
              </p>
            </div>

            {/* Test Wi-Fi Barcode Reception & Deduct */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  Step 2: How "Scan to Deduct" Works
                </h4>
                <div className="text-xs text-slate-600 space-y-2 mb-3">
                  <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-950">
                    <strong className="block mb-0.5">🔻 Scan to Deduct Mode:</strong>
                    When staff scans a saree or salwar suit tag on their mobile phone, the server immediately deducts 1 from stock and updates this counter laptop screen in real time!
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Test the wireless sync trigger right now:
                  </p>
                </div>

                <div className="space-y-1.5">
                  {products.length === 0 ? (
                    <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-500">
                      No garments added yet. Use "Generate &amp; Scan Barcode" on the inventory page to add garments first.
                    </div>
                  ) : (
                    products.slice(0, 3).map((p) => (
                      <div
                        key={p.id}
                        className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-800">{p.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {p.barcode} • Stock: <span className="font-bold text-slate-900">{p.stock}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSimulateMobileScan(p.barcode, true)}
                            className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold transition-colors flex items-center gap-1 shadow-2xs"
                          >
                            <MinusCircle className="w-3 h-3" />
                            <span>Deduct 1</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {lastReceived && (
                <div className="mt-3 p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                  <span>{lastReceived.action}</span>
                  <span className="text-[10px] text-emerald-700 font-mono">{lastReceived.time}</span>
                </div>
              )}
            </div>
          </div>

          {/* Local Hardware Integration Details */}
          <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> USB &amp; Bluetooth 1D/2D Laser Guns supported
              </span>
              <span className="flex items-center gap-1">
                <Check className="w-4 h-4 text-emerald-600" /> ESC/POS Thermal Receipt ready
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Hardware sync active • Click "Back to Store" at top to return
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
