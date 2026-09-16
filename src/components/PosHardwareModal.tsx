import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  Wifi,
  QrCode,
  Laptop,
  Check,
  RefreshCw,
  Radio,
  ArrowLeft,
  X,
  Copy,
  ExternalLink,
  ShieldCheck,
  Globe,
  PlusCircle,
  Play
} from 'lucide-react';
import { Product } from '../types';
import { apiGetNetworkInfo, apiPingGun, NetworkInfoResponse, playChime } from '../services/api';

interface PosHardwareModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onRemoteScan: (barcode: string, product?: Product) => void;
  onDeductStock?: (barcode: string) => Promise<any> | void;
  connectedDevices?: number;
  mobileGunsCount?: number;
}

export const PosHardwareModal: React.FC<PosHardwareModalProps> = ({
  isOpen,
  onClose,
  products,
  onRemoteScan,
  onDeductStock,
  connectedDevices = 1,
  mobileGunsCount = 0,
}) => {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfoResponse | null>(null);
  const [urlMode, setUrlMode] = useState<'cloud' | 'lan' | 'current'>('cloud');
  const [customLanIp, setCustomLanIp] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [lastReceived, setLastReceived] = useState<{ barcode: string; time: string; action: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    apiGetNetworkInfo().then((info) => {
      if (info) {
        setNetworkInfo(info);
        if (info.lanIps && info.lanIps.length > 0) {
          setCustomLanIp(info.lanIps[0]);
        }
      }
    });
  }, [isOpen]);

  // Determine active pairing URL
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const publicCloudUrl =
    networkInfo?.publicCloudUrl ||
    'https://ais-pre-r2peuv22umtyobjxuhb5l4-74331851214.asia-southeast1.run.app';

  let activeScannerUrl = `${publicCloudUrl}?mode=scanner`;
  if (urlMode === 'lan' && customLanIp) {
    activeScannerUrl = `http://${customLanIp}:3000?mode=scanner`;
  } else if (urlMode === 'current') {
    activeScannerUrl = `${currentOrigin}?mode=scanner`;
  }

  // Generate QR Code locally via canvas/data URL
  useEffect(() => {
    if (!activeScannerUrl) return;
    QRCode.toDataURL(activeScannerUrl, {
      width: 240,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code:', err));
  }, [activeScannerUrl]);

  if (!isOpen) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(activeScannerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
        action: `Added to cart (${product?.name || barcode})`,
      });
    }
  };

  const handleTestPingGun = async () => {
    setIsPinging(true);
    setPingStatus('Broadcasting ping to mobile gun...');
    try {
      playChime('chime');
      await apiPingGun('Counter Laptop', 'laptop_ping');
      setPingStatus('✓ Ping signal broadcasted to all connected mobile scanners!');
    } catch (e) {
      setPingStatus('Ping failed to broadcast');
    } finally {
      setIsPinging(false);
      setTimeout(() => setPingStatus(null), 4000);
    }
  };

  const hasMobileActive = (mobileGunsCount && mobileGunsCount > 0) || (networkInfo?.mobileGunsCount && networkInfo.mobileGunsCount > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0"
              title="Return to store"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to POS</span>
            </button>

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
                <Wifi className="w-4 h-4" />
              </div>
              <div className="truncate">
                <h3 className="font-semibold text-sm sm:text-base text-slate-50 leading-tight">
                  Mobile Barcode Gun Connection &amp; QR Pairing
                </h3>
                <p className="text-[11px] text-slate-400 truncate">
                  Scan the QR code on any phone to turn it into a wireless barcode gun
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

        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Live Device Sync Status Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                <span className="font-bold">Real-Time Sync Bridge Status</span>
              </div>
              <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-xs ${
                hasMobileActive ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
              }`}>
                <span className={`w-2 h-2 rounded-full ${hasMobileActive ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`}></span>
                <span>{hasMobileActive ? `🟢 ${networkInfo?.mobileGunsCount || 1} Mobile Gun Active` : 'Waiting for Phone Scan'}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Counter Laptop */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <Laptop className="w-5 h-5 text-slate-800 mx-auto mb-1" />
                <div className="text-xs font-bold text-slate-800">Counter Laptop</div>
                <div className="text-[10px] text-emerald-700 bg-emerald-50 py-0.5 px-1.5 rounded font-bold mt-1 inline-block">
                  SSE Host Active
                </div>
              </div>

              {/* Wi-Fi / Server Bridge */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <Radio className="w-5 h-5 text-emerald-600 mx-auto mb-1 animate-pulse" />
                <div className="text-xs font-bold text-slate-800">Central Sync Server</div>
                <div className="text-[10px] text-slate-600 bg-slate-100 py-0.5 px-1.5 rounded mt-1 inline-block">
                  Sub-second Latency
                </div>
              </div>

              {/* Handheld Mobile Scanner */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <Smartphone className={`w-5 h-5 mx-auto mb-1 ${hasMobileActive ? 'text-emerald-600 animate-bounce' : 'text-slate-400'}`} />
                <div className="text-xs font-bold text-slate-800">Handheld Mobile Gun</div>
                <div className={`text-[10px] py-0.5 px-1.5 rounded font-bold mt-1 inline-block ${
                  hasMobileActive ? 'text-emerald-700 bg-emerald-50' : 'text-slate-500 bg-slate-100'
                }`}>
                  {hasMobileActive ? 'Ready to Scan' : 'Point & Scan QR'}
                </div>
              </div>
            </div>
          </div>

          {/* Connection URL Mode Switcher */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Select Connection Method:
            </label>
            <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1 rounded-xl mb-3">
              <button
                type="button"
                onClick={() => setUrlMode('cloud')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  urlMode === 'cloud'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Internet / Cloud (Best)</span>
              </button>

              <button
                type="button"
                onClick={() => setUrlMode('lan')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  urlMode === 'lan'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Wifi className="w-3.5 h-3.5" />
                <span>Local Wi-Fi (LAN)</span>
              </button>

              <button
                type="button"
                onClick={() => setUrlMode('current')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  urlMode === 'current'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Laptop className="w-3.5 h-3.5" />
                <span>Current Host</span>
              </button>
            </div>

            {urlMode === 'lan' && (
              <div className="mb-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-xs">
                <span className="font-semibold text-slate-700 whitespace-nowrap">Laptop IP on Wi-Fi:</span>
                <input
                  type="text"
                  value={customLanIp}
                  onChange={(e) => setCustomLanIp(e.target.value)}
                  placeholder="e.g. 192.168.1.15"
                  className="flex-1 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-800"
                />
              </div>
            )}

            {/* QR Code and Pairing Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div className="flex flex-col items-center text-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="p-2 bg-white rounded-xl shadow-xs border border-slate-200 mb-2">
                  {qrCodeDataUrl ? (
                    <img src={qrCodeDataUrl} alt="Pairing QR Code" className="w-40 h-40 object-contain rounded-lg" />
                  ) : (
                    <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-400">
                      Generating QR...
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                  Point Phone Camera at this Code
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  No login required on phone • Opens directly into Gun Mode
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Or open directly on mobile browser:
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={activeScannerUrl}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800 truncate"
                    />
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold transition-all shrink-0 flex items-center gap-1"
                      title="Copy URL"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <a
                      href={activeScannerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-xs font-bold transition-all shrink-0"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Mobile Gun Exemption Active:</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    Per your security configuration, the PC software authorization email check is <strong>only for PC software</strong>. Mobile barcode guns connect directly and never require verification.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTestPingGun}
                  disabled={isPinging}
                  className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  <Radio className={`w-3.5 h-3.5 text-emerald-400 ${isPinging ? 'animate-spin' : ''}`} />
                  <span>{isPinging ? 'Broadcasting...' : 'Broadcast Test Ping to Mobile Gun'}</span>
                </button>

                {pingStatus && (
                  <div className="text-[11px] p-2 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 font-semibold text-center">
                    {pingStatus}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Simulation & Verification */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
              <Play className="w-4 h-4 text-emerald-600" />
              Simulate Mobile Gun Scan (Test without phone)
            </h4>
            <div className="space-y-2">
              {products.length === 0 ? (
                <div className="text-xs text-slate-500 p-2 text-center bg-slate-50 rounded-lg">
                  No products in inventory yet. Add an item from the inventory tab.
                </div>
              ) : (
                products.slice(0, 3).map((p, idx) => (
                  <div
                    key={`sim-${p.id || idx}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-800">{p.name}</span>
                      <span className="text-[11px] text-slate-500 ml-2 font-mono">({p.barcode})</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSimulateMobileScan(p.barcode, false)}
                        className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                      >
                        🛒 Scan to Cart
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSimulateMobileScan(p.barcode, true)}
                        className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px]"
                      >
                        ➖ Deduct (-1)
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
