import React, { useState } from 'react';
import { Smartphone, Wifi, QrCode, Laptop, Check, RefreshCw, Radio, ShieldCheck, ArrowLeft, X } from 'lucide-react';
import { Product } from '../types';

interface PosHardwareModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onRemoteScan: (barcode: string, product?: Product) => void;
}

export const PosHardwareModal: React.FC<PosHardwareModalProps> = ({
  isOpen,
  onClose,
  products,
  onRemoteScan,
}) => {
  const [wifiSsid] = useState('Boutique_Store_5G');
  const [ipAddress] = useState('192.168.1.145:3000');
  const [lastReceived, setLastReceived] = useState<{ barcode: string; time: string } | null>(null);

  if (!isOpen) return null;

  const handleSimulateMobileScan = (barcode: string) => {
    const product = products.find((p) => p.barcode === barcode);
    setLastReceived({ barcode, time: new Date().toLocaleTimeString() });
    onRemoteScan(barcode, product);
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
                  Wi-Fi Mobile Barcode Gun &amp; Hardware Manual
                </h3>
                <p className="text-[11px] text-slate-400 truncate">
                  Connect mobile phones as wireless handheld scanners over store Wi-Fi
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
          {/* Architecture Diagram Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-3">
              <span>Local Store Network Status</span>
              <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Connected to {wifiSsid}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* POS Terminal */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center">
                <Laptop className="w-6 h-6 text-slate-700 mx-auto mb-1.5" />
                <div className="text-xs font-bold text-slate-800">Counter POS Terminal</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{ipAddress}</div>
                <div className="mt-2 text-[10px] text-emerald-600 bg-emerald-50 py-0.5 rounded font-medium">
                  Listening for Scans
                </div>
              </div>

              {/* Wi-Fi Bridge */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center flex flex-col justify-center items-center">
                <Radio className="w-6 h-6 text-emerald-600 mb-1.5 animate-pulse" />
                <div className="text-xs font-bold text-slate-800">Local Wi-Fi Bridge</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Zero-Lag WebSocket / UDP</div>
                <div className="mt-2 text-[10px] text-slate-600 bg-slate-100 py-0.5 px-2 rounded">
                  Port: 3000
                </div>
              </div>

              {/* Mobile Scanner */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center">
                <Smartphone className="w-6 h-6 text-emerald-700 mx-auto mb-1.5" />
                <div className="text-xs font-bold text-slate-800">Mobile Barcode Gun</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Any Android / iPhone</div>
                <div className="mt-2 text-[10px] text-emerald-700 bg-emerald-50 py-0.5 rounded font-medium">
                  Sync Ready
                </div>
              </div>
            </div>
          </div>

          {/* Connect Mobile Step */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-xl p-4 bg-white">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-emerald-600" />
                Step 1: Open on Store Floor Mobile
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Connect your staff smartphone to the same store Wi-Fi network (<strong>{wifiSsid}</strong>).
                Open the app URL or scan the camera interface directly from the device:
              </p>
              <div className="mt-3 bg-slate-900 text-slate-200 font-mono text-[11px] p-2.5 rounded-lg break-all">
                {window.location.origin}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                The mobile screen switches automatically to high-speed barcode scanning mode with audio feedback.
              </p>
            </div>

            {/* Test Wi-Fi Barcode Reception */}
            <div className="border border-slate-200 rounded-xl p-4 bg-white">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                Step 2: Test Mobile Wi-Fi Scan Trigger
              </h4>
              <p className="text-xs text-slate-500 mb-3">
                Simulate a barcode transmitted wirelessly from staff walking across saree &amp; kurti racks:
              </p>

              <div className="space-y-2">
                {products.length === 0 ? (
                  <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-500">
                    No products added to catalog yet. Once you scan/add items, you can test remote beam triggers here.
                  </div>
                ) : (
                  products.slice(0, 3).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSimulateMobileScan(p.barcode)}
                      className="w-full text-left p-2 rounded-lg bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 transition-colors flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-800">{p.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{p.barcode} • {p.category}</div>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
                        Beam Scan →
                      </span>
                    </button>
                  ))
                )}
              </div>

              {lastReceived && (
                <div className="mt-3 p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                  <span>Received Barcode: <strong>{lastReceived.barcode}</strong></span>
                  <span className="text-[10px] text-emerald-700">{lastReceived.time}</span>
                </div>
              )}
            </div>
          </div>

          {/* Local Hardware Integration Details - No bottom back button, instructions at top */}
          <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center justify-between text-xs text-slate-600">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> USB &amp; Bluetooth Laser Scanners supported
              </span>
              <span className="flex items-center gap-1">
                <Check className="w-4 h-4 text-emerald-600" /> ESC/POS Thermal Receipt ready
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Hardware setup active • Click "Back to Store" at top to return
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

