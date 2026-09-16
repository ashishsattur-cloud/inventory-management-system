import React, { useState, useEffect, useRef } from 'react';
import { Product, Supplier, ClothingCategory } from '../types';
import {
  X,
  Plus,
  Tag,
  RefreshCw,
  Barcode as BarcodeIcon,
  ArrowLeft,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Percent,
  Sparkles,
  Smartphone,
  Check,
  Zap
} from 'lucide-react';
import {
  generateStructuredBarcode,
  CATEGORY_MAP,
  detectCategoryFromBarcode
} from '../utils/barcode';
import { playChime } from '../services/api';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  onAddProduct: (product: Product) => void;
  existingProducts?: Product[];
  initialBarcode?: string;
  mobileScanEvent?: { barcode: string; timestamp: number } | null;
  serverConnected?: boolean;
  onOpenScanner?: () => void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  suppliers,
  onAddProduct,
  existingProducts = [],
  initialBarcode = '',
  mobileScanEvent = null,
  serverConnected = true,
  onOpenScanner,
}) => {
  // Required core fields as requested:
  // 1. Name
  // 2. SKU Code
  // 3. Category
  // 4. Price (Selling & Cost)
  // 5. Barcode
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState<ClothingCategory>('Kurti');
  const [sellingPrice, setSellingPrice] = useState<number | ''>(899);
  const [costPrice, setCostPrice] = useState<number | ''>(450);
  const [barcode, setBarcode] = useState('');

  // Additional helpful garment details
  const [stock, setStock] = useState<number | ''>(12);
  const [size, setSize] = useState('M (38)');
  const [color, setColor] = useState('Indigo Navy');
  const [fabricType, setFabricType] = useState('Pure Cotton');
  const [workPattern, setWorkPattern] = useState('Handblock Print');
  const [taxRate, setTaxRate] = useState<number>(5);
  const [rackLocation, setRackLocation] = useState('Bay 3 - Kurti Hangers');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.name || 'Jaipur Weaver Guild');
  const [customSupplier, setCustomSupplier] = useState('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [minStockAlert, setMinStockAlert] = useState<number | ''>(3);

  const [formError, setFormError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [mobileScanFeedback, setMobileScanFeedback] = useState<string | null>(null);

  // Barcode input ref and exact cursor position tracking
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const cursorPosRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const lastProcessedScanTimestamp = useRef<number>(0);

  const updateCursorPosition = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const target = e.currentTarget;
    cursorPosRef.current = {
      start: target.selectionStart ?? target.value.length,
      end: target.selectionEnd ?? target.value.length,
    };
  };

  const regenerateBarcode = (cat: ClothingCategory) => {
    const res = generateStructuredBarcode(cat, existingProducts);
    setBarcode(res.barcode);
    setSku(res.formattedSku);
    cursorPosRef.current = { start: res.barcode.length, end: res.barcode.length };
  };

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen) {
      setFormError(null);
      setSuccessNotice(null);
      setMobileScanFeedback(null);
      if (!initialBarcode) {
        setName('');
        setImageUrl('');
        setStock(10);
        regenerateBarcode(category);
      } else {
        setBarcode(initialBarcode);
        const detected = detectCategoryFromBarcode(initialBarcode);
        if (detected) setCategory(detected);
        setSku(`SKU-${initialBarcode.slice(-6)}`);
        cursorPosRef.current = { start: initialBarcode.length, end: initialBarcode.length };
      }

      // Automatically focus barcode or name field
      setTimeout(() => {
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus();
          cursorPosRef.current = {
            start: barcodeInputRef.current.value.length,
            end: barcodeInputRef.current.value.length,
          };
        }
      }, 100);
    }
  }, [initialBarcode, isOpen]);

  // Handle incoming mobile scan: enter barcode exactly at the cursor position
  useEffect(() => {
    if (!isOpen || !mobileScanEvent) return;
    if (mobileScanEvent.timestamp <= lastProcessedScanTimestamp.current) return;

    lastProcessedScanTimestamp.current = mobileScanEvent.timestamp;
    const scannedCode = mobileScanEvent.barcode.trim();
    if (!scannedCode) return;

    const input = barcodeInputRef.current;
    let start = cursorPosRef.current.start;
    let end = cursorPosRef.current.end;

    // If the input element is currently focused, use its live selection range
    if (input && document.activeElement === input) {
      start = input.selectionStart ?? start;
      end = input.selectionEnd ?? end;
    }

    setBarcode((prevBarcode) => {
      // Clamp bounds safely
      const safeStart = Math.max(0, Math.min(start, prevBarcode.length));
      const safeEnd = Math.max(safeStart, Math.min(end, prevBarcode.length));

      // Insert scanned barcode exactly where the cursor is placed
      const before = prevBarcode.substring(0, safeStart);
      const after = prevBarcode.substring(safeEnd);
      const nextBarcode = before + scannedCode + after;

      const nextCursorPos = safeStart + scannedCode.length;
      cursorPosRef.current = { start: nextCursorPos, end: nextCursorPos };

      // Restore focus and position cursor right after the newly inserted barcode
      setTimeout(() => {
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus();
          barcodeInputRef.current.setSelectionRange(nextCursorPos, nextCursorPos);
        }
      }, 50);

      return nextBarcode;
    });

    // Provide visual feedback and audio chime
    playChime('chime');
    setMobileScanFeedback(`Auto-entered "${scannedCode}" from mobile scanner at cursor!`);
    setTimeout(() => {
      setMobileScanFeedback(null);
    }, 4000);
  }, [mobileScanEvent, isOpen]);

  if (!isOpen) return null;

  const handleCategoryChange = (newCat: ClothingCategory) => {
    setCategory(newCat);
    regenerateBarcode(newCat);

    if (newCat === 'Saree') {
      setSize('6.3m (with blouse)');
      setFabricType('Pure Mulmul Cotton');
      setWorkPattern('Handblock Chanderi');
      setRackLocation('Bay 1 - Saree Shelf');
      if (costPrice === '' || costPrice === 450) setCostPrice(850);
      if (sellingPrice === '' || sellingPrice === 899) setSellingPrice(1750);
    } else if (newCat === 'Salwar Suit') {
      setSize('Unstitched (3-piece)');
      setFabricType('Chanderi Cotton');
      setWorkPattern('Zari & Block Print');
      setRackLocation('Bay 2 - Suit Rack');
      if (costPrice === '' || costPrice === 850) setCostPrice(650);
      if (sellingPrice === '' || sellingPrice === 1750) setSellingPrice(1450);
    } else if (newCat === 'Kurti') {
      setSize('M (38)');
      setFabricType('Pure Cotton');
      setWorkPattern('Handblock Print');
      setRackLocation('Bay 3 - Kurti Hangers');
      setCostPrice(450);
      setSellingPrice(899);
    } else if (newCat === 'Shirt') {
      setSize('L (40)');
      setFabricType('Loom Khadi Cotton');
      setWorkPattern('Plain Solid & Mandarin');
      setRackLocation('Bay 4 - Men Shirt Section');
      setCostPrice(380);
      setSellingPrice(799);
    } else if (newCat === 'Dupatta & Stole') {
      setSize('2.5m x 1m');
      setFabricType('Kota Doria Cotton');
      setWorkPattern('Zari Border Ajrakh');
      setRackLocation('Bay 5 - Dupatta Shelf');
      setCostPrice(220);
      setSellingPrice(499);
    } else {
      setSize('Per Meter');
      setFabricType('Unstitched Pure Cotton');
      setWorkPattern('Bagru Print');
      setRackLocation('Bay 6 - Fabric Rolls');
      setCostPrice(120);
      setSellingPrice(250);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setFormError('Image size exceeds 2MB limit. Please upload a smaller photo.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageUrl(event.target?.result as string);
      setFormError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Please enter a product name (e.g., Pure Cotton Jaipuri Kurti).');
      return;
    }

    const trimmedBarcode = barcode.trim();
    if (!trimmedBarcode) {
      setFormError('Please provide a barcode. Place cursor in Barcode field and scan using your mobile phone.');
      return;
    }

    // Barcode uniqueness check across existing items
    const duplicate = existingProducts.find(
      (p) => p.barcode.toLowerCase() === trimmedBarcode.toLowerCase()
    );
    if (duplicate) {
      setFormError(
        `Barcode "${trimmedBarcode}" is already assigned to "${duplicate.name}". Barcodes must be unique!`
      );
      return;
    }

    const numericSelling = Number(sellingPrice);
    if (isNaN(numericSelling) || numericSelling < 0) {
      setFormError('Price must be a valid positive number.');
      return;
    }

    const numericCost = Number(costPrice);
    const safeCost = isNaN(numericCost) || numericCost < 0 ? 0 : numericCost;

    const numericStock = Number(stock);
    const safeStock = isNaN(numericStock) || numericStock < 0 ? 0 : numericStock;

    const effectiveSupplier =
      supplierId === '__CUSTOM__'
        ? customSupplier.trim() || 'Direct Purchase'
        : supplierId || 'Direct Loom / In-House';

    const newProduct: Product = {
      id: 'prod-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      sku: sku.trim() || `SKU-${category.slice(0, 3).toUpperCase()}-${trimmedBarcode.slice(-5)}`,
      barcode: trimmedBarcode,
      name: trimmedName,
      category,
      fabricType: fabricType.trim() || 'Pure Cotton',
      workPattern: workPattern.trim() || 'Plain Solid',
      size: size.trim() || 'Free Size',
      color: color.trim() || 'Multicolor',
      costPrice: safeCost,
      sellingPrice: numericSelling,
      stock: safeStock,
      minStockAlert: Number(minStockAlert) || 3,
      taxRate: Number(taxRate) || 5,
      imageUrl: imageUrl || '',
      supplierId: effectiveSupplier,
      rackLocation: rackLocation.trim() || 'Store Floor',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    setSuccessNotice(`Item "${newProduct.name}" added to inventory successfully!`);
    onAddProduct(newProduct);
    setTimeout(() => {
      onClose();
    }, 450);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 my-6 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all border border-slate-700"
              title="Cancel and close"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>Back</span>
            </button>
            <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-50 flex items-center gap-2">
                <span>Add to Inventory</span>
                <span className="text-[10px] font-bold bg-emerald-900/80 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-700/50">
                  Laptop Master
                </span>
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-slate-800">
          {/* Error Message */}
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{formError}</span>
              </div>
              <button
                type="button"
                onClick={() => setFormError(null)}
                className="text-red-500 hover:text-red-800 text-xs px-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Success Message */}
          {successNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* REQUIRED FIELD 1: Category */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Category *</span>
              <span className="text-[11px] text-emerald-700 font-normal">Select garment type</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
              {(
                ['Kurti', 'Saree', 'Shirt', 'Salwar Suit', 'Dupatta & Stole', 'Fabric & Material'] as ClothingCategory[]
              ).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all text-center flex flex-col items-center justify-center ${
                    category === cat
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-600/30'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="truncate w-full">{cat}</span>
                  <span className={`text-[9px] font-mono ${category === cat ? 'text-emerald-200' : 'text-slate-400'}`}>
                    {CATEGORY_MAP[cat]?.code || '00'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* REQUIRED FIELD 2: Name & REQUIRED FIELD 3: SKU Code */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Pure Cotton Handblock Printed Kurti"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>SKU Code *</span>
                <button
                  type="button"
                  onClick={() => regenerateBarcode(category)}
                  className="text-[10px] text-emerald-600 hover:underline flex items-center gap-0.5"
                  title="Generate SKU based on category"
                >
                  <RefreshCw className="w-2.5 h-2.5" /> Auto
                </button>
              </label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="SKU-KRT-10001"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-semibold"
              />
            </div>
          </div>

          {/* REQUIRED FIELD 4: Price (Selling Price & Cost Price) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Price (Selling MRP ₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  required
                  min="0"
                  step="1"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="899"
                  className="w-full pl-7 pr-3 py-2 text-sm font-extrabold text-slate-900 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Cost Price (Purchase ₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="450"
                  className="w-full pl-7 pr-3 py-2 text-sm font-medium text-slate-900 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Quantity in Stock *
              </label>
              <input
                type="number"
                required
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="10"
                className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* REQUIRED FIELD 5: Barcode (with Mobile Scanner Cursor Auto-Insert) */}
          <div className="p-4 bg-emerald-50/80 border-2 border-emerald-300 rounded-2xl shadow-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="block text-xs font-black text-emerald-950 flex items-center gap-1.5">
                  <BarcodeIcon className="w-4 h-4 text-emerald-700" />
                  <span>Barcode *</span>
                </label>
                <p className="text-[11px] text-emerald-800 font-medium">
                  Place cursor inside this field, then scan garment tag using your mobile device.
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 px-2 py-1 bg-white border border-emerald-200 rounded-lg text-[10px] font-bold text-emerald-700 shadow-2xs">
                  <span className={`w-2 h-2 rounded-full ${serverConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}></span>
                  <Smartphone className="w-3 h-3 text-emerald-600" />
                  <span>Mobile Scanner Ready</span>
                </div>

                <button
                  type="button"
                  onClick={() => regenerateBarcode(category)}
                  className="px-2.5 py-1 bg-white text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-100 transition-colors shadow-2xs"
                  title="Generate unique numerical barcode"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Auto-Generate</span>
                </button>
              </div>
            </div>

            {/* Barcode Input with Live Cursor Tracking */}
            <div className="relative">
              <input
                ref={barcodeInputRef}
                type="text"
                required
                value={barcode}
                onChange={(e) => {
                  setBarcode(e.target.value);
                  updateCursorPosition(e);
                }}
                onSelect={updateCursorPosition}
                onClick={updateCursorPosition}
                onKeyUp={updateCursorPosition}
                onFocus={updateCursorPosition}
                placeholder="Click here to place cursor, then scan tag on phone..."
                className="w-full px-3.5 py-2.5 text-base font-mono font-black bg-white text-slate-950 border-2 border-emerald-400 rounded-xl focus:outline-hidden focus:border-emerald-600 focus:ring-3 focus:ring-emerald-500/30 tracking-wider shadow-inner"
              />
              <div className="absolute right-2.5 top-2.5 flex items-center gap-1 text-[11px] font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md pointer-events-none">
                <span>{barcode.length} chars</span>
              </div>
            </div>

            {/* Mobile Scan Instant Notice */}
            {mobileScanFeedback && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 bg-emerald-200/80 px-3 py-1.5 rounded-xl border border-emerald-300 animate-in fade-in">
                <Zap className="w-3.5 h-3.5 text-emerald-700 animate-bounce" />
                <span>{mobileScanFeedback}</span>
              </div>
            )}
          </div>

          {/* Secondary Garment Specifications */}
          <div className="border-t border-slate-200 pt-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Garment Sizing &amp; Location Details
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Size</label>
                <input
                  type="text"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="M (38)"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Color / Shade</label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="Indigo Navy"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Fabric Material</label>
                <input
                  type="text"
                  value={fabricType}
                  onChange={(e) => setFabricType(e.target.value)}
                  placeholder="Pure Cotton"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Rack / Shelf</label>
                <input
                  type="text"
                  value={rackLocation}
                  onChange={(e) => setRackLocation(e.target.value)}
                  placeholder="Bay 3 - Kurti Hangers"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Supplier & Image Attachment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Supplier / Weaver Loom
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} ({s.contactPerson})
                  </option>
                ))}
                <option value="__CUSTOM__">+ Other / Direct Sourcing</option>
              </select>
              {supplierId === '__CUSTOM__' && (
                <input
                  type="text"
                  value={customSupplier}
                  onChange={(e) => setCustomSupplier(e.target.value)}
                  placeholder="Enter supplier / weaver name"
                  className="w-full mt-1.5 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center justify-between">
                <span>Garment Photo (Optional)</span>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="text-[10px] text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </label>
              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer flex items-center justify-center gap-1.5 px-3 py-1.5 border border-dashed border-slate-300 hover:border-emerald-500 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                  <ImageIcon className="w-4 h-4 text-slate-400" />
                  <span>Choose Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />
                </label>
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt="Garment Preview"
                    className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-emerald-900/20 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Save to Inventory</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
