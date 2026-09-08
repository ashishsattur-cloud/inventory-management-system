import React, { useState } from 'react';
import { Product, Supplier, ClothingCategory } from '../types';
import { BarcodeTag } from './BarcodeTag';
import {
  Search,
  Filter,
  Plus,
  Printer,
  AlertTriangle,
  ArrowUpDown,
  Edit2,
  Check,
  X,
  Barcode as BarcodeIcon,
  Tag,
  PackageCheck,
  TrendingDown,
  Layers,
  Sparkles,
  Camera,
  PlusCircle,
  Trash2
} from 'lucide-react';

interface InventoryTableProps {
  products: Product[];
  suppliers: Supplier[];
  onUpdateStock: (productId: string, newStock: number, reason: string) => void;
  onOpenAddModal: () => void;
  onOpenScanner: () => void;
  onOpenScannerWithMode?: (mode: 'deduct' | 'lookup' | 'add') => void;
  onDeductStock?: (barcode: string) => Promise<any> | void;
  onDeleteProduct: (productId: string) => void;
  onOpenGenerateAndScan?: () => void;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  products,
  suppliers,
  onUpdateStock,
  onOpenAddModal,
  onOpenScanner,
  onOpenScannerWithMode,
  onDeductStock,
  onDeleteProduct,
  onOpenGenerateAndScan,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [stockFilter, setStockFilter] = useState<'All' | 'LowStock' | 'InStock' | 'OutOfStock'>('All');
  const [activeBarcodeTag, setActiveBarcodeTag] = useState<Product | null>(null);
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [tempStock, setTempStock] = useState<number>(0);

  // In-app deletion states (no iframe window.confirm issues)
  const [itemToDelete, setItemToDelete] = useState<Product | null>(null);
  const [confirmDeleteOutOfStock, setConfirmDeleteOutOfStock] = useState(false);
  const [inventoryNotification, setInventoryNotification] = useState<string | null>(null);

  const categories = ['All', 'Saree', 'Salwar Suit', 'Kurti', 'Dupatta & Stole'];

  const filteredProducts = products.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.barcode.includes(searchTerm) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.fabricType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.color.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;

    let matchesStock = true;
    if (stockFilter === 'LowStock') {
      matchesStock = item.stock <= item.minStockAlert && item.stock > 0;
    } else if (stockFilter === 'OutOfStock') {
      matchesStock = item.stock <= 0;
    } else if (stockFilter === 'InStock') {
      matchesStock = item.stock > item.minStockAlert;
    }

    return matchesSearch && matchesCategory && matchesStock;
  });

  const lowStockCount = products.filter((p) => p.stock <= p.minStockAlert).length;
  const outOfStockProducts = products.filter((p) => p.stock <= 0);
  const outOfStockCount = outOfStockProducts.length;
  const totalStockUnits = products.reduce((acc, p) => acc + p.stock, 0);
  const totalValuationCost = products.reduce((acc, p) => acc + p.stock * p.costPrice, 0);
  const totalValuationRetail = products.reduce((acc, p) => acc + p.stock * p.sellingPrice, 0);

  const startStockEdit = (product: Product) => {
    setEditingStockId(product.id);
    setTempStock(product.stock);
  };

  const saveStockEdit = (productId: string) => {
    onUpdateStock(productId, tempStock, 'Manual Quick Adjustment');
    setEditingStockId(null);
  };

  const handleConfirmSingleDelete = () => {
    if (!itemToDelete) return;
    const removedName = itemToDelete.name;
    onDeleteProduct(itemToDelete.id);
    setItemToDelete(null);
    setInventoryNotification(`🗑️ Removed "${removedName}" from store catalog.`);
    setTimeout(() => setInventoryNotification(null), 3500);
  };

  const handleConfirmBulkDeleteOutOfStock = () => {
    const count = outOfStockProducts.length;
    outOfStockProducts.forEach((p) => {
      onDeleteProduct(p.id);
    });
    setConfirmDeleteOutOfStock(false);
    setInventoryNotification(`🗑️ Removed all ${count} out-of-stock garments from catalog.`);
    setTimeout(() => setInventoryNotification(null), 4000);
  };

  const printBatchBarcodes = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;

    const cardsHtml = filteredProducts
      .map(
        (p) => `
      <div style="border:1px dashed #334155; padding:8px; width:220px; text-align:center; font-family:sans-serif; page-break-inside:avoid; margin:6px; display:inline-block; border-radius:6px;">
        <div style="font-size:10px; font-weight:bold; color:#047857; text-transform:uppercase;">Pure Cotton Heritage</div>
        <div style="font-size:11px; font-weight:bold; height:24px; overflow:hidden; margin:2px 0;">${p.name}</div>
        <div style="font-size:10px; color:#475569;">${p.category} | ${p.size}</div>
        <div style="font-family:monospace; font-size:12px; font-weight:bold; margin:6px 0; letter-spacing:1px; background:#f8fafc; padding:3px;">
          * ${p.barcode} *
        </div>
        <div style="font-size:13px; font-weight:800; color:#0f172a;">MRP: ₹${p.sellingPrice.toLocaleString()}</div>
        <div style="font-size:9px; color:#64748b;">${p.sku} | ${p.rackLocation || 'Bay 1'}</div>
      </div>
    `
      )
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Batch Barcode Print (${filteredProducts.length} Items)</title>
          <style>
            body { margin: 10px; background: #fff; }
            .grid { display: flex; flex-wrap: wrap; justify-content: flex-start; }
          </style>
        </head>
        <body>
          <h3 style="font-family:sans-serif; margin-bottom:8px;">Barcode Price Tags - Cotton Apparel Catalog</h3>
          <div class="grid">${cardsHtml}</div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-4">
      {/* Top Metric Strip for Inventory */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Total Garment Catalog</span>
          <div className="text-xl font-black text-slate-900 mt-1">{products.length} SKUs</div>
          <span className="text-[11px] text-slate-400">{totalStockUnits} total pieces in store</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Current Stock Valuation (Cost)</span>
          <div className="text-xl font-black text-slate-900 mt-1">₹{totalValuationCost.toLocaleString()}</div>
          <span className="text-[11px] text-emerald-600 font-medium">Retail: ₹{totalValuationRetail.toLocaleString()}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium">Stock Status Alerts</span>
          <div className="text-xl font-black text-amber-600 mt-1 flex items-center gap-1.5">
            <AlertTriangle className="w-5 h-5" />
            {lowStockCount} Items Low
          </div>
          <span className="text-[11px] text-amber-700">Need replenishment</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-center">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenAddModal}
              className="py-2 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all"
              title="Directly add a new garment to inventory"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add New Garment</span>
            </button>
            {onOpenGenerateAndScan && (
              <button
                type="button"
                onClick={onOpenGenerateAndScan}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5"
                title="Generate barcode sticker tag and add"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Barcode Tag</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenScannerWithMode ? onOpenScannerWithMode('lookup') : onOpenScanner()}
              className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5"
              title="Scan barcode to look up clothing item"
            >
              <BarcodeIcon className="w-3.5 h-3.5 text-slate-600" />
              <span>Scan to Check</span>
            </button>
            {outOfStockCount > 0 && (
              <button
                type="button"
                onClick={() => setConfirmDeleteOutOfStock(true)}
                className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
                title="Remove all out of stock garments from inventory"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                <span>Remove Out of Stock ({outOfStockCount})</span>
              </button>
            )}
            {products.length > 0 && (
              <button
                type="button"
                onClick={printBatchBarcodes}
                title="Print all visible barcode tags"
                className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-1 transition-all"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-400" /> Print Tags
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                selectedCategory === cat
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Low stock filter toggle */}
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none"
          >
            <option value="All">All Stock Levels</option>
            <option value="LowStock">⚠️ Low Stock Alerts Only ({lowStockCount})</option>
            <option value="OutOfStock">Out of Stock</option>
            <option value="InStock">Healthy Stock</option>
          </select>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search barcode, fabric, SKU..."
              className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 w-52"
            />
          </div>
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Item &amp; Category</th>
                <th className="px-3 py-3">Barcode / SKU</th>
                <th className="px-3 py-3">Fabric &amp; Work</th>
                <th className="px-3 py-3">Size / Color</th>
                <th className="px-3 py-3">Cost Price</th>
                <th className="px-3 py-3">Selling MRP</th>
                <th className="px-3 py-3">Current Stock</th>
                <th className="px-3 py-3">Alert Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16 px-4">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
                        <BarcodeIcon className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-bold text-slate-800">Your Clothing Catalog is Empty</h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Only garments you add to the system will appear here. Start by generating a barcode and scanning it to register your first clothing item!
                      </p>
                      <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                        {onOpenGenerateAndScan && (
                          <button
                            type="button"
                            onClick={onOpenGenerateAndScan}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>Generate Barcode &amp; Scan to Add</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={onOpenScanner}
                          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
                        >
                          <Camera className="w-4 h-4 text-emerald-400" />
                          <span>Scan Existing Tag</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400 text-xs">
                    No items found matching the current search &amp; filter criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isLow = p.stock <= p.minStockAlert && p.stock > 0;
                  const isOut = p.stock <= 0;
                  const supplier = suppliers.find((s) => s.id === p.supplierId);

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Name & Category */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 leading-snug">{p.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {p.category}
                          </span>
                          <span className="text-[11px] text-slate-400">Loc: {p.rackLocation || 'Bay 1'}</span>
                        </div>
                      </td>

                      {/* Barcode */}
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setActiveBarcodeTag(p)}
                          className="font-mono text-xs font-semibold text-slate-800 hover:text-emerald-700 flex items-center gap-1 group/btn"
                          title="Click to view & print barcode label"
                        >
                          <BarcodeIcon className="w-3.5 h-3.5 text-slate-400 group-hover/btn:text-emerald-600" />
                          <span>{p.barcode}</span>
                        </button>
                        <div className="text-[10px] text-slate-400 font-mono">{p.sku}</div>
                      </td>

                      {/* Fabric & Work */}
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-800">{p.fabricType}</div>
                        <div className="text-[11px] text-slate-500">{p.workPattern}</div>
                      </td>

                      {/* Size & Color */}
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-800">{p.size}</div>
                        <div className="text-[11px] text-slate-500">{p.color}</div>
                      </td>

                      {/* Cost */}
                      <td className="px-3 py-3 font-medium text-slate-600">
                        ₹{p.costPrice.toLocaleString()}
                      </td>

                      {/* Retail */}
                      <td className="px-3 py-3 font-bold text-slate-900">
                        ₹{p.sellingPrice.toLocaleString()}
                      </td>

                      {/* Real-time Stock Quantity & Quick Adjustment */}
                      <td className="px-3 py-3">
                        {editingStockId === p.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={tempStock}
                              onChange={(e) => setTempStock(Number(e.target.value))}
                              className="w-16 px-1.5 py-1 text-xs font-bold border border-emerald-500 rounded bg-white"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => saveStockEdit(p.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingStockId(null)}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className={`font-bold text-sm ${p.stock <= 0 ? 'text-red-600' : 'text-slate-900'}`}>{p.stock}</span>
                            <button
                              type="button"
                              onClick={() => onDeductStock ? onDeductStock(p.barcode) : onUpdateStock(p.id, Math.max(0, p.stock - 1), 'Quick Deduct')}
                              disabled={p.stock <= 0}
                              title="Deduct 1 piece"
                              className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-amber-800 rounded border border-amber-200 transition-colors"
                            >
                              -1
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateStock(p.id, p.stock + 1, 'Quick Restock')}
                              title="Add 1 piece"
                              className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded border border-emerald-200 transition-colors"
                            >
                              +1
                            </button>
                            {p.stock <= 0 && (
                              <button
                                type="button"
                                onClick={() => onUpdateStock(p.id, 10, 'Quick Restock +10')}
                                title="Quick restock +10 pieces"
                                className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded border border-emerald-300 transition-colors whitespace-nowrap"
                              >
                                +10 Restock
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => startStockEdit(p)}
                              title="Custom stock level adjustment"
                              className="text-slate-400 hover:text-emerald-700 opacity-60 group-hover:opacity-100 transition-opacity ml-0.5"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        <div className="text-[10px] text-slate-400">Min: {p.minStockAlert}</div>
                      </td>

                      {/* Alert Status */}
                      <td className="px-3 py-3">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full animate-pulse">
                            Low Stock Alert
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            In Stock
                          </span>
                        )}
                      </td>

                      {/* Action buttons */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setActiveBarcodeTag(p)}
                            title="Generate & print barcode label"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setItemToDelete(p)}
                            className="p-1.5 text-red-500 hover:text-red-700 rounded-lg hover:bg-red-50 transition-colors border border-transparent hover:border-red-200"
                            title={`Remove "${p.name}" from catalog (Wrong Mark)`}
                          >
                            <X className="w-4 h-4 font-bold" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating In-App Inventory Notification */}
      {inventoryNotification && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-2.5 bg-slate-900 text-white rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold border border-slate-700 animate-in slide-in-from-bottom duration-200">
          <span>{inventoryNotification}</span>
        </div>
      )}

      {/* Single Item Deletion Confirmation Modal (In-App, never blocked by iframe) */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Remove Garment from Catalog?</h3>
                <p className="text-xs text-slate-500">This item will be deleted from your inventory and POS counter.</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 my-4 space-y-1.5 text-xs">
              <div className="font-bold text-slate-900 text-sm">{itemToDelete.name}</div>
              <div className="text-slate-600 flex flex-wrap items-center gap-2">
                <span>Barcode: <strong className="font-mono">{itemToDelete.barcode}</strong></span>
                <span>•</span>
                <span>Category: <strong>{itemToDelete.category}</strong></span>
                <span>•</span>
                <span>Size: <strong>{itemToDelete.size}</strong></span>
              </div>
              <div className="pt-1">
                {itemToDelete.stock <= 0 ? (
                  <span className="inline-block px-2.5 py-1 bg-red-100 text-red-800 rounded-md font-bold text-xs">
                    ⚠️ Currently Out of Stock (0 pcs)
                  </span>
                ) : (
                  <span className="inline-block px-2.5 py-1 bg-slate-200 text-slate-700 rounded-md font-medium text-xs">
                    Current Stock: {itemToDelete.stock} pcs
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel / Keep Item
              </button>
              <button
                type="button"
                onClick={handleConfirmSingleDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Remove Item</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Out-of-Stock Confirmation Modal */}
      {confirmDeleteOutOfStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Remove All Out-of-Stock Items?</h3>
                <p className="text-xs text-slate-500">
                  Clean up {outOfStockCount} zero-stock clothing records from catalog.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 my-4 leading-relaxed bg-amber-50 p-3 rounded-xl border border-amber-200">
              Are you sure you want to remove all <strong>{outOfStockCount}</strong> out-of-stock garments? This will permanently delete them from the inventory table.
            </p>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={() => setConfirmDeleteOutOfStock(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDeleteOutOfStock}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove All {outOfStockCount} Items</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Tag Modal Preview */}
      {activeBarcodeTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 relative">
            <button
              onClick={() => setActiveBarcodeTag(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-700 p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-sm font-bold text-slate-900 mb-3">Individual Item Barcode Label</h3>
            <BarcodeTag product={activeBarcodeTag} standalone={true} />
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setActiveBarcodeTag(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Close Tag
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
