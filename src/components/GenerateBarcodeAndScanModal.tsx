import React, { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';
import {
  Barcode as BarcodeIcon,
  Camera,
  Printer,
  RefreshCw,
  CheckCircle2,
  Tag,
  X,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Plus,
  AlertCircle
} from 'lucide-react';
import { Product, Supplier, ClothingCategory } from '../types';

interface GenerateBarcodeAndScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  onAddProduct: (product: Product) => void;
  existingProducts: Product[];
}

export const GenerateBarcodeAndScanModal: React.FC<GenerateBarcodeAndScanModalProps> = ({
  isOpen,
  onClose,
  suppliers,
  onAddProduct,
  existingProducts,
}) => {
  // Step 1: 'generate_and_scan' | Step 2: 'enter_details'
  const [step, setStep] = useState<'generate_and_scan' | 'enter_details'>('generate_and_scan');

  // Generated Barcode State
  const [generatedBarcode, setGeneratedBarcode] = useState<string>('');
  const [verifiedBarcode, setVerifiedBarcode] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCodeInput, setManualCodeInput] = useState<string>('');
  const [scannedFeedback, setScannedFeedback] = useState<string | null>(null);

  // Garment Form State
  const [category, setCategory] = useState<ClothingCategory>('Saree');
  const [name, setName] = useState('');
  const [fabricType, setFabricType] = useState('Pure Mulmul Cotton');
  const [workPattern, setWorkPattern] = useState('Handblock Print');
  const [size, setSize] = useState('6.3m (with blouse)');
  const [color, setColor] = useState('Indigo Navy');
  const [costPrice, setCostPrice] = useState<number>(950);
  const [sellingPrice, setSellingPrice] = useState<number>(1850);
  const [stock, setStock] = useState<number>(12);
  const [minStockAlert, setMinStockAlert] = useState<number>(4);
  const [supplierName, setSupplierName] = useState('Jaipur Weaver Guild');
  const [rackLocation, setRackLocation] = useState('Bay 1 - Saree Shelf A');
  const [sku, setSku] = useState('');

  const svgRef = useRef<SVGSVGElement | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Generate new barcode number
  const createFreshBarcode = () => {
    let code = '';
    do {
      code = '890' + Math.floor(100000000 + Math.random() * 900000000).toString().slice(0, 9);
    } while (existingProducts.some((p) => p.barcode === code));
    return code;
  };

  // Helper for generating SKU
  const computeSku = (cat: string, fabric: string) => {
    const prefix = cat === 'Saree' ? 'SAR' : cat === 'Salwar Suit' ? 'SLW' : cat === 'Kurti' ? 'KUR' : 'DUP';
    const fabCode = fabric.toUpperCase().slice(0, 3).replace(/[^A-Z]/g, '') || 'COT';
    const rand = Math.floor(10 + Math.random() * 90);
    return `${prefix}-${fabCode}-${rand}`;
  };

  // On open, reset and generate barcode
  useEffect(() => {
    if (isOpen) {
      const code = createFreshBarcode();
      setGeneratedBarcode(code);
      setVerifiedBarcode('');
      setStep('generate_and_scan');
      setScannedFeedback(null);
      setName('');
      setSku(computeSku('Saree', 'Pure Mulmul Cotton'));
    } else {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (e) {}
        scannerRef.current = null;
      }
      setIsCameraActive(false);
    }
  }, [isOpen]);

  // Render Barcode SVG whenever generatedBarcode changes
  useEffect(() => {
    if (svgRef.current && generatedBarcode) {
      try {
        JsBarcode(svgRef.current, generatedBarcode, {
          format: 'CODE128',
          lineColor: '#0f172a',
          width: 2.2,
          height: 64,
          displayValue: true,
          fontSize: 14,
          font: 'monospace',
          margin: 10,
          background: '#ffffff',
        });
      } catch (err) {
        console.error('Barcode render error:', err);
      }
    }
  }, [generatedBarcode, step]);

  // Sound feedback on successful scan
  const playScanBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 beep
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.14);
    } catch (e) {}
  };

  // Start Camera Scanner
  const startCameraScanner = () => {
    setIsCameraActive(true);
    setCameraError(null);
    setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner(
          'generate-scan-reader-region',
          {
            fps: 10,
            qrbox: { width: 280, height: 160 },
            rememberLastUsedCamera: true,
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          },
          false
        );

        scanner.render(
          (decodedText) => {
            const scanned = decodedText.trim();
            handleBarcodeScannedSuccessfully(scanned);
          },
          () => {}
        );
        scannerRef.current = scanner;
      } catch (err: any) {
        setCameraError(err?.message || 'Unable to access camera.');
      }
    }, 150);
  };

  const stopCameraScanner = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
      } catch (e) {}
      scannerRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Called when barcode is scanned via camera, simulated, or manual entry
  const handleBarcodeScannedSuccessfully = (code: string) => {
    playScanBeep();
    stopCameraScanner();
    setVerifiedBarcode(code);
    setScannedFeedback(`Barcode ${code} scanned & confirmed!`);

    // Auto-advance to enter item details form
    setTimeout(() => {
      setStep('enter_details');
    }, 450);
  };

  // Print generated label
  const handlePrintLabel = () => {
    const printWindow = window.open('', '_blank', 'width=450,height=550');
    if (!printWindow) {
      alert('Please enable popups to print barcode tag.');
      return;
    }

    const svgHtml = svgRef.current ? svgRef.current.outerHTML : '';
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Garment Barcode - ${generatedBarcode}</title>
          <style>
            @page { size: 50mm 40mm; margin: 2mm; }
            body { font-family: system-ui, sans-serif; margin: 0; padding: 10px; display: flex; justify-content: center; align-items: center; }
            .tag-card { border: 1.5px dashed #0f172a; padding: 10px; text-align: center; width: 240px; border-radius: 8px; }
            .brand { font-size: 11px; font-weight: 800; color: #047857; text-transform: uppercase; letter-spacing: 0.5px; }
            .barcode-box { margin: 8px 0; }
            .prompt { font-size: 9px; color: #475569; margin-top: 4px; }
          </style>
        </head>
        <body>
          <div class="tag-card">
            <div class="brand">Pure Cotton Retail</div>
            <div class="barcode-box">${svgHtml}</div>
            <div class="prompt">Scan to add or bill this garment</div>
          </div>
          <script>window.onload = function() { window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCategoryChange = (newCat: ClothingCategory) => {
    setCategory(newCat);
    if (newCat === 'Saree') {
      setSize('6.3m (with blouse)');
      setFabricType('Pure Mulmul Cotton');
    } else if (newCat === 'Salwar Suit') {
      setSize('M (38")');
      setFabricType('Cotton Slub 3-Piece');
    } else if (newCat === 'Kurti') {
      setSize('L (40")');
      setFabricType('100% Combed Cotton');
    } else {
      setSize('2.5m x 1m');
      setFabricType('Kota Doria Cotton');
    }
    setSku(computeSku(newCat, fabricType));
  };

  const handleSubmitNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalBarcode = verifiedBarcode || generatedBarcode;
    const finalProduct: Product = {
      id: 'prod-' + Date.now(),
      sku: sku || computeSku(category, fabricType),
      barcode: finalBarcode,
      name: name.trim(),
      category,
      fabricType,
      workPattern,
      size,
      color,
      costPrice: Number(costPrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      stock: Number(stock) || 0,
      minStockAlert: Number(minStockAlert) || 4,
      supplierId: supplierName,
      rackLocation: rackLocation || 'Main Display Rack',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    onAddProduct(finalProduct);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 my-6">
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step === 'enter_details' && (
              <button
                type="button"
                onClick={() => setStep('generate_and_scan')}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1 text-xs"
                title="Back to barcode scan"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </button>
            )}
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <BarcodeIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-slate-50">
                {step === 'generate_and_scan'
                  ? 'Step 1: Generate & Scan Barcode'
                  : 'Step 2: Enter Clothing Item Details'}
              </h3>
              <p className="text-xs text-slate-400">
                {step === 'generate_and_scan'
                  ? 'Barcode is generated first, then scanned to add the garment into the system'
                  : `Scanned Barcode: ${verifiedBarcode || generatedBarcode}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workflow Step 1: Generate Barcode & Scan It */}
        {step === 'generate_and_scan' && (
          <div className="p-6 space-y-6">
            {/* Scanned Feedback Notification */}
            {scannedFeedback && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2 animate-bounce">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{scannedFeedback}</span>
              </div>
            )}

            {/* Generated Barcode Card */}
            <div className="bg-slate-50 border-2 border-dashed border-emerald-500/50 rounded-2xl p-5 text-center">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                  Newly Generated Barcode Tag
                </span>
                <button
                  type="button"
                  onClick={() => setGeneratedBarcode(createFreshBarcode())}
                  className="text-xs text-slate-600 hover:text-emerald-700 font-semibold flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Generate Different Code
                </button>
              </div>

              {/* Scannable SVG Barcode */}
              <div className="bg-white p-3 rounded-xl shadow-xs border border-slate-200 inline-block my-2 max-w-full overflow-x-auto">
                <svg ref={svgRef} className="mx-auto"></svg>
              </div>

              <div className="font-mono text-base font-extrabold text-slate-900 tracking-wider">
                {generatedBarcode}
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Scan this barcode with your camera or click below to register this item into the store catalog.
              </p>

              {/* Primary Scan Action Buttons */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleBarcodeScannedSuccessfully(generatedBarcode)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all transform hover:scale-[1.02]"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Scan &amp; Register This Barcode →</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintLabel}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-4 h-4 text-slate-600" />
                  <span>Print Barcode Tag</span>
                </button>
              </div>
            </div>

            {/* Live Camera Scanner Option */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-900">
                    Scan Using Device Camera or Physical Tag
                  </h4>
                </div>
                {!isCameraActive ? (
                  <button
                    type="button"
                    onClick={startCameraScanner}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Open Camera Scanner
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopCameraScanner}
                    className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Turn Off Camera
                  </button>
                )}
              </div>

              {isCameraActive && (
                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div id="generate-scan-reader-region" className="w-full"></div>
                  {cameraError && (
                    <div className="text-xs text-red-600 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> {cameraError}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500 text-center mt-2">
                    Point camera at the barcode on the screen, clothing label, or mobile phone to scan.
                  </p>
                </div>
              )}
            </div>

            {/* Or Scan/Type an Existing Barcode on a Garment */}
            <div className="pt-3 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Have an existing tag on the garment? Scan or type its barcode:
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (manualCodeInput.trim()) {
                    handleBarcodeScannedSuccessfully(manualCodeInput.trim());
                  }
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={manualCodeInput}
                  onChange={(e) => setManualCodeInput(e.target.value)}
                  placeholder="e.g. Scan with USB laser scanner or enter barcode..."
                  className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  Confirm Scan
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Workflow Step 2: Enter Clothing Details for Scanned Barcode */}
        {step === 'enter_details' && (
          <form onSubmit={handleSubmitNewItem} className="p-6 space-y-4">
            {/* Verified Barcode Banner */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                    Scanned &amp; Verified Barcode
                  </span>
                  <div className="font-mono text-sm font-bold text-emerald-950">
                    {verifiedBarcode || generatedBarcode}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep('generate_and_scan')}
                className="text-xs text-emerald-800 hover:underline font-semibold"
              >
                Change Barcode
              </button>
            </div>

            {/* Category Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Clothing Category *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['Saree', 'Salwar Suit', 'Kurti', 'Dupatta & Stole'] as ClothingCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategoryChange(cat)}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                      category === cat
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Name & SKU */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Item Title / Design Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sanganeri Indigo Floral Mulmul Saree"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>SKU Code</span>
                  <button
                    type="button"
                    onClick={() => setSku(computeSku(category, fabricType))}
                    className="text-[10px] text-emerald-600 hover:underline"
                  >
                    Auto
                  </button>
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Fabric, Work & Size */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fabric Type
                </label>
                <input
                  type="text"
                  value={fabricType}
                  onChange={(e) => setFabricType(e.target.value)}
                  placeholder="e.g. Pure Mulmul Cotton, Khadi"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Work / Print Technique
                </label>
                <input
                  type="text"
                  value={workPattern}
                  onChange={(e) => setWorkPattern(e.target.value)}
                  placeholder="e.g. Bagru Block, Ajrakh, Kalamkari"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Size / Length
                </label>
                <input
                  type="text"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="e.g. 6.3m (with blouse) or S, M, L"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Color & Rack Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Color / Shade
                </label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="e.g. Deep Indigo Navy, Mustard Yellow"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Store Shelf / Rack Location
                </label>
                <input
                  type="text"
                  value={rackLocation}
                  onChange={(e) => setRackLocation(e.target.value)}
                  placeholder="e.g. Bay 1 - Saree Shelf A"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Pricing & Stock Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cost Price (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Selling Price (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-bold text-emerald-800 border border-emerald-300 rounded-xl bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Stock Qty *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={stock}
                  onChange={(e) => setStock(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Low Stock Alert
                </label>
                <input
                  type="number"
                  min="1"
                  value={minStockAlert}
                  onChange={(e) => setMinStockAlert(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                />
              </div>
            </div>

            {/* Supplier / Loom Source */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supplier / Weaver Source
              </label>
              {suppliers.length > 0 ? (
                <select
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.city})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. Jaipur Weaver Guild or In-House Production"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              )}
            </div>

            {/* Form Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('generate_and_scan')}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Barcode Scan
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Item to System
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
