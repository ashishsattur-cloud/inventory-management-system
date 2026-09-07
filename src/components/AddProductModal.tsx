import React, { useState } from 'react';
import { Product, Supplier, ClothingCategory } from '../types';
import { X, Sparkles, Plus, Tag, Check, RefreshCw, Barcode as BarcodeIcon } from 'lucide-react';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  onAddProduct: (product: Product) => void;
  initialBarcode?: string;
  onOpenScanner?: () => void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  suppliers,
  onAddProduct,
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
  const [barcode, setBarcode] = useState(initialBarcode || generateNewBarcode());
  const [sku, setSku] = useState(generateSku('Saree', 'Pure Mulmul'));

  React.useEffect(() => {
    if (initialBarcode) {
      setBarcode(initialBarcode);
    }
  }, [initialBarcode, isOpen]);

  if (!isOpen) return null;

  function generateNewBarcode() {
    // Generate standard 12-digit EAN/UPC style number
    return '890' + Math.floor(100000000 + Math.random() * 900000000).toString().slice(0, 9);
  }

  function generateSku(cat: string, fabric: string) {
    const prefix = cat === 'Saree' ? 'SAR' : cat === 'Salwar Suit' ? 'SLW' : cat === 'Kurti' ? 'KUR' : 'DUP';
    const fabCode = fabric.toUpperCase().slice(0, 3).replace(/\s/g, '');
    const rand = Math.floor(10 + Math.random() * 90);
    return `${prefix}-${fabCode}-${rand}`;
  }

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
    setSku(generateSku(newCat, fabricType));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newProduct: Product = {
      id: 'prod-' + Date.now(),
      sku: sku || generateSku(category, fabricType),
      barcode: barcode || generateNewBarcode(),
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
              <p className="text-xs text-slate-400">Generates unique barcode tag and updates live catalog</p>
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
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {cat}
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
                  onClick={() => setSku(generateSku(category, fabricType))}
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

          {/* Barcode details */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-0.5">
                  Assigned Barcode (EAN-128 / Code128)
                </label>
                <div className="text-xs text-emerald-700">
                  Scan an existing garment tag or use this generated barcode.
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
                    <BarcodeIcon className="w-3 h-3" /> Scan with Camera
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setBarcode(generateNewBarcode())}
                  className="px-2.5 py-1 bg-white text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-emerald-100 transition-colors shadow-xs"
                >
                  <RefreshCw className="w-3 h-3" /> New Barcode
                </button>
              </div>
            </div>
            <input
              type="text"
              required
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="mt-2 w-full px-3 py-2 text-sm font-mono tracking-wider font-bold bg-white text-slate-900 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                placeholder="e.g. Pure Mulmul Cotton, Khadi, Chanderi"
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
                placeholder="e.g. Bagru, Ajrakh, Kalamkari, Kantha"
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
                placeholder="e.g. Free Size (6.3m) or S, M, L, XL"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Color & Rack */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Color & Shade
              </label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="e.g. Mustard Yellow & Gold"
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
                placeholder="e.g. Bay 2 - Saree Shelf B"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Pricing & Stock */}
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
                min="0"
                required
                value={stock}
                onChange={(e) => setStock(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Low-Stock Alert Qty
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

          {/* Supplier assignment */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Supplier / Weaver Source
            </label>
            {suppliers.length > 0 ? (
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {suppliers.map((sup) => (
                  <option key={sup.id} value={sup.name}>
                    {sup.name} ({sup.city})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                placeholder="e.g. Jaipur Handloom Guild or In-House Production"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
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
              <Plus className="w-4 h-4" /> Save &amp; Generate Barcode Tag
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
