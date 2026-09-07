import React, { useState, useEffect } from 'react';
import { Product, Supplier, ClothingCategory } from '../types';
import { X, Sparkles, Plus, Tag, Check, RefreshCw, Barcode as BarcodeIcon } from 'lucide-react';
import {
  generateStructuredBarcode,
  CATEGORY_MAP,
  detectCategoryFromBarcode
} from '../utils/barcode';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  onAddProduct: (product: Product) => void;
  existingProducts?: Product[];
  initialBarcode?: string;
  onOpenScanner?: () => void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  suppliers,
  onAddProduct,
  existingProducts = [],
  initialBarcode = '',
  onOpenScanner,
}) => {
  const [category, setCategory] = useState<ClothingCategory>('Saree');
  const [name, setName] = useState('');
  const [fabricType, setFabricType] = useState('Pure Mulmul Cotton');
  const [workPattern, setWorkPattern] = useState('Handblock Print');
  const [size, setSize] = useState('6.3m (with blouse)');
  const [color, setColor] = useState('Indigo Navy');
  const [costPrice, setCostPrice] = useState<number>(850);
  const [sellingPrice, setSellingPrice] = useState<number>(1750);
  const [stock, setStock] = useState<number>(10);
  const [minStockAlert, setMinStockAlert] = useState<number>(4);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.name || 'Direct Loom / In-House');
  const [rackLocation, setRackLocation] = useState('Bay 1');
  const [barcode, setBarcode] = useState('');
  const [sku, setSku] = useState('');
  const [catCode, setCatCode] = useState('10');
  const [itemId, setItemId] = useState('00001');

  const regenerateBarcode = (cat: ClothingCategory) => {
    const res = generateStructuredBarcode(cat, existingProducts);
    setBarcode(res.barcode);
    setSku(res.formattedSku);
    setCatCode(res.categoryCode);
    setItemId(res.itemId);
  };

  useEffect(() => {
    if (isOpen) {
      if (initialBarcode) {
        setBarcode(initialBarcode);
        const detected = detectCategoryFromBarcode(initialBarcode);
        if (detected) {
          setCategory(detected);
        }
      } else {
        regenerateBarcode(category);
      }
    }
  }, [initialBarcode, isOpen]);

  if (!isOpen) return null;

  const handleCategoryChange = (newCat: ClothingCategory) => {
    setCategory(newCat);
    regenerateBarcode(newCat);

    if (newCat === 'Saree') {
      setSize('6.3m (with blouse)');
      setFabricType('Pure Mulmul Cotton');
      setRackLocation('Bay 1 - Saree Shelf');
    } else if (newCat === 'Salwar Suit') {
      setSize('Unstitched (3-piece)');
      setFabricType('Chanderi Cotton');
      setRackLocation('Bay 2 - Suit Rack');
    } else if (newCat === 'Kurti') {
      setSize('L (40)');
      setFabricType('Khadi Cotton');
      setRackLocation('Bay 3 - Kurti Hangers');
    } else {
      setSize('2.5m x 1m');
      setFabricType('Kota Doria Cotton');
      setRackLocation('Bay 4 - Dupatta Shelf');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newProduct: Product = {
      id: 'prod-' + Date.now(),
      sku: sku || `${CATEGORY_MAP[category]?.prefix || 'CLT'}-${catCode}-${itemId}`,
      barcode: barcode.trim(),
      name: name.trim(),
      category,
      fabricType,
      workPattern,
      size,
      color,
      costPrice: Number(costPrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      stock: Number(stock) || 0,
      minStockAlert: Number(minStockAlert) || 5,
      supplierId,
      rackLocation: rackLocation || 'Store Floor',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    onAddProduct(newProduct);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-slate-50">Add Clothing Item to Inventory</h3>
              <p className="text-xs text-slate-400">Generates unique barcode tag with category code &amp; item ID</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Category Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Clothing Category *
              </label>
              <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Category Code: {CATEGORY_MAP[category]?.code}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['Saree', 'Salwar Suit', 'Kurti', 'Dupatta & Stole'] as ClothingCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all flex flex-col items-center gap-0.5 ${
                    category === cat
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
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

          {/* Title & SKU */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Item Title / Description *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sanganeri Indigo Floral Mulmul Saree"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>SKU Code</span>
                <button
                  type="button"
                  onClick={() => regenerateBarcode(category)}
                  className="text-[10px] text-emerald-600 hover:underline flex items-center gap-0.5"
                >
                  <RefreshCw className="w-2.5 h-2.5" /> Auto
                </button>
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Structured Barcode details */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-0.5">
                  Unique Structured Barcode
                </label>
                <div className="text-xs text-emerald-700">
                  Category {category} (Code: <span className="font-mono font-bold">{catCode}</span>) • Unique Item ID: <span className="font-mono font-bold">#{itemId}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {onOpenScanner && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenScanner();
                    }}
                    className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-emerald-700 transition-colors shadow-xs"
                  >
                    <BarcodeIcon className="w-3 h-3" /> Scan Existing Tag
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => regenerateBarcode(category)}
                  className="px-2.5 py-1 bg-white text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-emerald-100 transition-colors shadow-xs"
                >
                  <RefreshCw className="w-3 h-3" /> Next Unique ID
                </button>
              </div>
            </div>
            <input
              type="text"
              required
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="mt-2 w-full px-3 py-2 text-sm font-mono tracking-wider font-extrabold bg-white text-slate-900 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Fabric & Work details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Fabric Material / Count
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
                placeholder="e.g. Bagru, Ajrakh, Kalamkari"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Size / Cut Length
              </label>
              <input
                type="text"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Color / Shade
              </label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="e.g. Indigo Navy, Madder Red"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Weaver / Supplier Guild
              </label>
              <input
                type="text"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                placeholder="e.g. Jaipur Weaver Guild"
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cost Price (₹)
              </label>
              <input
                type="number"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Selling MRP (₹) *
              </label>
              <input
                type="number"
                required
                min="0"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono font-bold text-emerald-800 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Initial Stock Qty *
              </label>
              <input
                type="number"
                required
                min="0"
                value={stock}
                onChange={(e) => setStock(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Low Stock Alert Qty
              </label>
              <input
                type="number"
                min="1"
                value={minStockAlert}
                onChange={(e) => setMinStockAlert(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Add Clothing Item</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
