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
import {
  generateStructuredBarcode,
  parseStructuredBarcode,
  CATEGORY_MAP,
  detectCategoryFromBarcode
} from '../utils/barcode';

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

  // Garment Category (chosen upfront so barcode gets appropriate category number)
  const [category, setCategory] = useState<ClothingCategory>('Saree');

  // Generated Barcode State
  const [generatedBarcode, setGeneratedBarcode] = useState<string>('');
  const [barcodeMeta, setBarcodeMeta] = useState<{ categoryCode: string; itemId: string; sku: string }>({
    categoryCode: '10',
    itemId: '00001',
    sku: 'SAR-10-00001',
  });
  const [verifiedBarcode, setVerifiedBarcode] = useState<string>('');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCodeInput, setManualCodeInput] = useState<string>('');
  const [scannedFeedback, setScannedFeedback] = useState<string | null>(null);

  // Garment Form State
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

  // Generate structured barcode for the selected category
  const createBarcodeForCat = (cat: ClothingCategory) => {
    const result = generateStructuredBarcode(cat, existingProducts);
    setGeneratedBarcode(result.barcode);
    setBarcodeMeta({
      categoryCode: result.categoryCode,
      itemId: result.itemId,
      sku: result.formattedSku,
    });
    setSku(result.formattedSku);
    return result;
  };

  // Helper for generating SKU
  const computeSku = (cat: string, fabric: string, itemId?: string) => {
    const info = CATEGORY_MAP[cat as ClothingCategory] || { prefix: 'CLT', code: '90' };
    const idStr = itemId || barcodeMeta.itemId;
    return `${info.prefix}-${info.code}-${idStr}`;
  };

  // On open, reset and generate barcode for current category
  useEffect(() => {
    if (isOpen) {
      createBarcodeForCat(category);
      setVerifiedBarcode('');
      setStep('generate_and_scan');
      setScannedFeedback(null);
      setName('');
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

  // Handle category change in Step 1
  const handleCategoryChangeInStep1 = (newCat: ClothingCategory) => {
    setCategory(newCat);
    createBarcodeForCat(newCat);

    if (newCat === 'Saree') {
      setSize('6.3m (with blouse)');
      setFabricType('Pure Mulmul Cotton');
      setRackLocation('Bay 1 - Saree Shelf A');
    } else if (newCat === 'Salwar Suit') {
      setSize('Unstitched (3-piece)');
      setFabricType('Chanderi Cotton');
      setRackLocation('Bay 2 - Suit Rack B');
    } else if (newCat === 'Kurti') {
      setSize('L (40)');
      setFabricType('Khadi Cotton');
      setRackLocation('Bay 3 - Kurti Hangers');
    } else {
      setSize('2.5m x 1m');
      setFabricType('Kota Doria Cotton');
      setRackLocation('Bay 4 - Dupatta Rack');
    }
  };

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

  // When a barcode is detected or matched
  const handleBarcodeScannedSuccessfully = (scannedCode: string) => {
    // If the scanned barcode belongs to a known category prefix, update category automatically
    const detectedCat = detectCategoryFromBarcode(scannedCode);
    if (detectedCat) {
      setCategory(detectedCat);
    }

    const parsed = parseStructuredBarcode(scannedCode);
    setVerifiedBarcode(scannedCode);
    setScannedFeedback(`Barcode verified: ${scannedCode} (${parsed.categoryName} #${parsed.itemId})`);

    // Auto populate a default title if empty
    if (!name) {
      setName(`${fabricType} ${category} #${parsed.itemId}`);
    }

    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
      } catch (e) {}
      scannerRef.current = null;
    }
    setIsCameraActive(false);

    // Smooth transition to Step 2
    setTimeout(() => {
      setStep('enter_details');
    }, 400);
  };

  // Start live camera scanner
  const startCameraScanner = () => {
    setIsCameraActive(true);
    setCameraError(null);

    setTimeout(() => {
      try {
        const scanner = new Html5QrcodeScanner(
          'generate-scan-reader-region',
          {
            fps: 10,
            qrbox: { width: 280, height: 180 },
            rememberLastUsedCamera: true,
            supportedScanTypes: [
              Html5QrcodeScanType.SCAN_TYPE_CAMERA,
            ],
          },
          false
        );

        scanner.render(
          (decodedText) => {
            handleBarcodeScannedSuccessfully(decodedText.trim());
          },
          (error) => {
            // normal frame scanning error, ignore
          }
        );

        scannerRef.current = scanner;
      } catch (err: any) {
        setCameraError('Unable to access camera. Please allow camera permissions or enter barcode manually.');
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

  // Printable tag action
  const handlePrintLabel = () => {
    const printWindow = window.open('', '_blank', 'width=450,height=550');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Garment Barcode Tag - ${generatedBarcode}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              margin: 0;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .tag {
              border: 2px dashed #0f172a;
              border-radius: 12px;
              padding: 16px;
              width: 260px;
              text-align: center;
              background: #ffffff;
            }
            .tag-header {
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 1px;
              text-transform: uppercase;
              color: #047857;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 6px;
              margin-bottom: 8px;
            }
            .cat-badge {
              display: inline-block;
              font-size: 11px;
              font-weight: 700;
              background: #f1f5f9;
              padding: 2px 8px;
              border-radius: 4px;
              margin-bottom: 4px;
            }
            .title {
              font-size: 13px;
              font-weight: 700;
              color: #0f172a;
              margin: 4px 0;
            }
            .barcode-box {
              margin: 10px 0;
            }
            .barcode-digits {
              font-family: monospace;
              font-size: 14px;
              font-weight: 900;
              letter-spacing: 2px;
              color: #0f172a;
            }
            .meta {
              font-size: 10px;
              color: #64748b;
              margin-top: 6px;
              border-top: 1px dashed #cbd5e1;
              padding-top: 6px;
            }
            @media print {
              body { padding: 0; }
            }
          </style>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        </head>
        <body>
          <div class="tag">
            <div class="tag-header">🌿 Pure Cotton Retail</div>
            <div class="cat-badge">${category} [Cat Code: ${barcodeMeta.categoryCode}]</div>
            <div class="title">Item ID: #${barcodeMeta.itemId}</div>
            <div class="barcode-box">
              <svg id="barcode-print"></svg>
              <div class="barcode-digits">${generatedBarcode}</div>
            </div>
            <div class="meta">
              SKU: ${barcodeMeta.sku}<br/>
              Scan with Mobile / Wi-Fi POS to Deduct
            </div>
          </div>
          <script>
            window.onload = function() {
              JsBarcode("#barcode-print", "${generatedBarcode}", {
                format: "CODE128",
                width: 1.8,
                height: 48,
                displayValue: false,
                margin: 0
              });
              setTimeout(function() {
                window.print();
              }, 200);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleManualScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCodeInput.trim()) return;
    handleBarcodeScannedSuccessfully(manualCodeInput.trim());
  };

  const handleSubmitNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalBarcode = verifiedBarcode || generatedBarcode;
    const finalStock = Number(stock);
    const safeStock = isNaN(finalStock) || finalStock < 0 ? 10 : finalStock;

    const finalProduct: Product = {
      id: 'prod-' + Date.now(),
      sku: sku || computeSku(category, fabricType, barcodeMeta.itemId),
      barcode: finalBarcode,
      name: name.trim(),
      category,
      fabricType,
      workPattern,
      size,
      color,
      costPrice: Number(costPrice) || 0,
      sellingPrice: Number(sellingPrice) || 1200,
      stock: safeStock,
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
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {step === 'enter_details' ? (
              <button
                type="button"
                onClick={() => setStep('generate_and_scan')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all border border-slate-700"
                title="Back to barcode scan"
              >
                <ArrowLeft className="w-4 h-4 text-emerald-400" />
                <span>← Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all border border-slate-700"
                title="Back to counter"
              >
                <ArrowLeft className="w-4 h-4 text-emerald-400" />
                <span>← Back</span>
              </button>
            )}
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 hidden sm:block">
              <BarcodeIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm sm:text-base text-slate-50">
                {step === 'generate_and_scan'
                  ? 'Generate Barcode Tag'
                  : 'Enter Clothing Item Details'}
              </h3>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                {step === 'generate_and_scan'
                  ? 'Print tag or scan with camera to add directly to store'
                  : `Scanned Barcode: ${verifiedBarcode || generatedBarcode}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workflow Step 1: Generate Barcode & Scan It */}
        {step === 'generate_and_scan' && (
          <div className="p-6 space-y-5">
            {/* Category Selector to establish Category Code */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-800">
                  Select Garment Category (Determines Category Code):
                </label>
                <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                  Category Code: {barcodeMeta.categoryCode}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['Saree', 'Salwar Suit', 'Kurti', 'Dupatta & Stole'] as ClothingCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategoryChangeInStep1(cat)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-0.5 ${
                      category === cat
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className={`text-[10px] font-mono ${category === cat ? 'text-emerald-200' : 'text-slate-500'}`}>
                      Code: {CATEGORY_MAP[cat]?.code}
                    </span>
                  </button>
                ))}
              </div>
            </div>

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
                  Unique {category} Barcode Tag
                </span>
                <button
                  type="button"
                  onClick={() => createBarcodeForCat(category)}
                  className="text-xs text-slate-600 hover:text-emerald-700 font-semibold flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Next Unique Serial
                </button>
              </div>

              {/* Scannable SVG Barcode */}
              <div className="bg-white p-3 rounded-xl shadow-xs border border-slate-200 inline-block my-2 max-w-full overflow-x-auto">
                <svg ref={svgRef} className="mx-auto"></svg>
              </div>

              {/* Breakdown of Category Code + Item ID */}
              <div className="max-w-md mx-auto my-2 p-2.5 bg-white rounded-xl border border-slate-200 text-left grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Category Code</span>
                  <span className="font-mono font-bold text-emerald-700">{barcodeMeta.categoryCode} ({category})</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Unique Item ID</span>
                  <span className="font-mono font-bold text-slate-800">#{barcodeMeta.itemId}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Full Barcode</span>
                  <span className="font-mono font-extrabold text-slate-900">{generatedBarcode}</span>
                </div>
              </div>

              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Scan this tag with your mobile camera or click below to proceed with registering this garment.
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
                    Scan With Camera (Mobile or Laptop Webcam)
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
                    Point camera at the printed clothing tag or barcode on mobile screen.
                  </p>
                </div>
              )}
            </div>

            {/* Manual Scan Input */}
            <form onSubmit={handleManualScanSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualCodeInput}
                onChange={(e) => setManualCodeInput(e.target.value)}
                placeholder="Or type/test scanned barcode number here..."
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors"
              >
                Scan Code
              </button>
            </form>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              >
                ← Cancel &amp; Back to Shop Counter
              </button>
            </div>
          </div>
        )}

        {/* Workflow Step 2: Enter Item Details */}
        {step === 'enter_details' && (
          <form onSubmit={handleSubmitNewItem} className="p-6 space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-900">
                  Verified Barcode: <span className="font-mono font-extrabold">{verifiedBarcode || generatedBarcode}</span>
                </span>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
                {category} [Cat: {barcodeMeta.categoryCode}]
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Garment Design Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bagru Handblock Print Saree with Zari Border"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fabric Type
                </label>
                <input
                  type="text"
                  value={fabricType}
                  onChange={(e) => setFabricType(e.target.value)}
                  placeholder="e.g. Pure Mulmul Cotton"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Craft / Work Pattern
                </label>
                <input
                  type="text"
                  value={workPattern}
                  onChange={(e) => setWorkPattern(e.target.value)}
                  placeholder="e.g. Sanganeri Print, Kalamkari"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Size / Cut
                </label>
                <input
                  type="text"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Color / Shade
                </label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cost Price (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Selling MRP (₹) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold text-emerald-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Initial Stock
                </label>
                <input
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(e) => setStock(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Low Stock Alert
                </label>
                <input
                  type="number"
                  min="1"
                  value={minStockAlert}
                  onChange={(e) => setMinStockAlert(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Weaver / Supplier
                </label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. Maheshwar Handloom Cluster"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Store Rack / Shelf Location
                </label>
                <input
                  type="text"
                  value={rackLocation}
                  onChange={(e) => setRackLocation(e.target.value)}
                  placeholder="e.g. Bay 1 - Saree Shelf A"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setStep('generate_and_scan')}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Back to Barcode
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Save Garment to Inventory</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
