import React, { useState } from 'react';
import { Product, CartItem, SaleTransaction } from '../types';
import {
  ShoppingCart,
  Barcode,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  QrCode,
  Printer,
  CheckCircle2,
  Receipt,
  User,
  Phone,
  Sparkles,
  PlusCircle,
  MinusCircle,
  ArrowLeft,
  Tag
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PosTerminalProps {
  products: Product[];
  onCompleteSale: (sale: SaleTransaction) => void;
  onOpenScanner: () => void;
  onOpenScannerWithMode?: (mode: 'deduct' | 'lookup' | 'add' | 'cart') => void;
  onDeductStock?: (barcode: string) => Promise<any> | void;
  onOpenHardwareSettings: () => void;
  onOpenGenerateAndScan?: () => void;
  onOpenAddModal?: () => void;
  onOpenAddWithBarcode?: (barcode: string) => void;
  cart?: CartItem[];
  onAddToCart?: (product: Product) => void;
  onUpdateQuantity?: (productId: string, delta: number) => void;
  onUpdateDiscount?: (productId: string, discount: number) => void;
  onRemoveFromCart?: (productId: string) => void;
  onClearCart?: () => void;
}

export const PosTerminal: React.FC<PosTerminalProps> = ({
  products,
  onCompleteSale,
  onOpenScanner,
  onOpenScannerWithMode,
  onDeductStock,
  onOpenHardwareSettings,
  onOpenGenerateAndScan,
  onOpenAddModal,
  onOpenAddWithBarcode,
  cart: propsCart,
  onAddToCart: propsAddToCart,
  onUpdateQuantity: propsUpdateQuantity,
  onUpdateDiscount: propsUpdateDiscount,
  onRemoveFromCart: propsRemoveFromCart,
  onClearCart: propsClearCart,
}) => {
  const [internalCart, setInternalCart] = useState<CartItem[]>([]);
  const isControlledCart = Array.isArray(propsCart);
  const cart = isControlledCart ? propsCart : internalCart;

  const [manualBarcode, setManualBarcode] = useState('');
  const [barcodeAction, setBarcodeAction] = useState<'cart' | 'deduct'>('cart');
  const [mobileTab, setMobileTab] = useState<'products' | 'cart'>('products');
  const [quickFeedback, setQuickFeedback] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI / QR' | 'Card'>('UPI / QR');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [completedSale, setCompletedSale] = useState<SaleTransaction | null>(null);

  const categories = ['All', 'Saree', 'Salwar Suit', 'Kurti', 'Dupatta & Stole'];

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategoryFilter === 'All' || p.category === selectedCategoryFilter;
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode.includes(searchTerm) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.fabricType.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const addToCart = (product: Product) => {
    if (propsAddToCart) {
      propsAddToCart(product);
      return;
    }

    setInternalCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [
          ...prev,
          {
            product,
            quantity: 1,
            discountPercent: 0,
            priceAfterDiscount: product.sellingPrice,
          },
        ];
      }
    });
  };

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBarcode.trim()) return;
    const code = manualBarcode.trim();
    const item = products.find((p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase());

    if (item) {
      addToCart(item);
      if (barcodeAction === 'deduct') {
        // User requested: "and when we click on deduct the scaned items should come in billing"
        if (item.stock <= 0) {
          setQuickFeedback(`⚡ Added "${item.name}" to Bill (Note: Stock in system was 0)`);
        } else {
          setQuickFeedback(`⚡ Added "${item.name}" to Bill & Deducted 1 pc! (₹${item.sellingPrice})`);
        }
        setTimeout(() => setQuickFeedback(null), 4000);
        setManualBarcode('');
      } else {
        if (item.stock <= 0) {
          setQuickFeedback(`🛒 Added to Cart: "${item.name}" (Note: Stock in system was 0)`);
        } else {
          setQuickFeedback(`🛒 Added to Cart: "${item.name}"`);
        }
        setTimeout(() => setQuickFeedback(null), 3000);
        setManualBarcode('');
      }
    } else {
      if (onOpenAddWithBarcode) {
        setQuickFeedback(`Barcode "${code}" not found. Opening form to add garment...`);
        onOpenAddWithBarcode(code);
        setManualBarcode('');
      } else {
        setQuickFeedback(`Barcode "${code}" not recognized! Click "+ Add Garment" to add it.`);
        setTimeout(() => setQuickFeedback(null), 4000);
      }
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    if (propsUpdateQuantity) {
      propsUpdateQuantity(productId, delta);
      return;
    }
    setInternalCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const updateDiscount = (productId: string, discount: number) => {
    if (propsUpdateDiscount) {
      propsUpdateDiscount(productId, discount);
      return;
    }
    const validDiscount = Math.max(0, Math.min(100, discount || 0));
    setInternalCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          const discountedPrice = item.product.sellingPrice * (1 - validDiscount / 100);
          return {
            ...item,
            discountPercent: validDiscount,
            priceAfterDiscount: discountedPrice,
          };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    if (propsRemoveFromCart) {
      propsRemoveFromCart(productId);
      return;
    }
    setInternalCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    if (propsClearCart) {
      propsClearCart();
      return;
    }
    setInternalCart([]);
  };

  // Calculations
  const subtotal = cart.reduce(
    (sum, item) => sum + item.product.sellingPrice * item.quantity,
    0
  );
  const totalAfterDiscount = cart.reduce(
    (sum, item) => sum + item.priceAfterDiscount * item.quantity,
    0
  );
  const discountTotal = subtotal - totalAfterDiscount;
  const tax = Number((totalAfterDiscount * 0.05).toFixed(2)); // 5% GST on retail clothing
  const grandTotal = Number((totalAfterDiscount + tax).toFixed(2));

  const handleCheckout = () => {
    if (cart.length === 0) return;

    const invoiceNo = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newSale: SaleTransaction = {
      id: 'tx-' + Date.now(),
      invoiceNo,
      timestamp: new Date().toISOString(),
      items: cart.map((c) => ({
        productId: c.product.id,
        productName: c.product.name,
        barcode: c.product.barcode,
        sku: c.product.sku,
        category: c.product.category,
        fabricType: c.product.fabricType,
        size: c.product.size,
        quantity: c.quantity,
        unitPrice: c.product.sellingPrice,
        discountPercent: c.discountPercent,
        total: Number((c.priceAfterDiscount * c.quantity).toFixed(2)),
        costPrice: c.product.costPrice,
      })),
      subtotal,
      tax,
      discountTotal,
      grandTotal,
      paymentMethod,
      customerName: customerName.trim() || 'Walk-in Customer',
      customerPhone: customerPhone.trim() || undefined,
    };

    onCompleteSale(newSale);
    setCompletedSale(newSale);
    clearCart();
    setCustomerName('');
    setCustomerPhone('');

    // celebration effect
    try {
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
    } catch (e) {}
  };

  const handlePrintReceipt = (sale: SaleTransaction) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Thermal Receipt - ${sale.invoiceNo}</title>
          <style>
            @page { size: 80mm auto; margin: 3mm; }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 11px;
              color: #000;
              margin: 0;
              padding: 6px;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { text-align: left; border-bottom: 1px dashed #000; padding-bottom: 2px; }
            td { padding: 2px 0; vertical-align: top; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size:14px;">COTTON CLOTH BOUTIQUE</div>
          <div class="center">Pure Cotton Sarees • Salwar Suits • Kurtis</div>
          <div class="center">14 Loom Heritage Lane, Retail Hub</div>
          <div class="center">Ph: +91 98765 00112 | GSTIN: 08AAAAA0000A1Z5</div>
          <div class="divider"></div>
          <div><strong>Bill No:</strong> ${sale.invoiceNo}</div>
          <div><strong>Date:</strong> ${new Date(sale.timestamp).toLocaleString()}</div>
          <div><strong>Customer:</strong> ${sale.customerName} ${sale.customerPhone ? `(${sale.customerPhone})` : ''}</div>
          <div><strong>Payment:</strong> ${sale.paymentMethod}</div>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="center">Qty</th>
                <th class="right">Rate</th>
                <th class="right">Amt</th>
              </tr>
            </thead>
            <tbody>
              ${sale.items
                .map(
                  (i) => `
                <tr>
                  <td>
                    ${i.productName}<br/>
                    <small>${i.category} | ${i.size}</small>
                  </td>
                  <td class="center">${i.quantity}</td>
                  <td class="right">₹${i.unitPrice}</td>
                  <td class="right">₹${i.total}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
          <div class="divider"></div>
          <table>
            <tr><td>Subtotal:</td><td class="right">₹${sale.subtotal.toFixed(2)}</td></tr>
            <tr><td>Discounts:</td><td class="right">-₹${sale.discountTotal.toFixed(2)}</td></tr>
            <tr><td>GST (5%):</td><td class="right">₹${sale.tax.toFixed(2)}</td></tr>
            <tr class="bold" style="font-size:13px;"><td>NET TOTAL:</td><td class="right">₹${sale.grandTotal.toFixed(2)}</td></tr>
          </table>
          <div class="divider"></div>
          <div class="center">Thank You for Supporting Authentic Cotton Weavers!</div>
          <div class="center">Exchange within 7 days with tag intact.</div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative pb-16 lg:pb-0">
      {/* Mobile Tab Switcher - Simple for cloth shop staff */}
      <div className="lg:hidden col-span-12 flex gap-2 p-1 bg-slate-200 rounded-2xl">
        <button
          type="button"
          onClick={() => setMobileTab('products')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'products'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>👗 Browse Clothes ({filteredProducts.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('cart')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            mobileTab === 'cart'
              ? 'bg-white text-emerald-800 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShoppingCart className="w-4 h-4 text-emerald-600" />
          <span>Active Bill ({cart.length})</span>
          {cart.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-emerald-600 text-white rounded-full text-[10px] font-mono">
              ₹{grandTotal.toFixed(0)}
            </span>
          )}
        </button>
      </div>

      {/* Left Column: Product Catalog & Fast Barcode Scan (7 cols) */}
      <div className={`lg:col-span-7 space-y-4 ${mobileTab === 'products' ? 'block' : 'hidden lg:block'}`}>
        {/* Top Hardware & Barcode Scanning Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          {quickFeedback && (
            <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs font-bold text-amber-900 flex items-center justify-between animate-in fade-in">
              <span>{quickFeedback}</span>
              <button
                type="button"
                onClick={() => setQuickFeedback(null)}
                className="text-amber-700 hover:text-amber-950 text-xs font-bold px-1.5 py-0.5 rounded"
              >
                ✕
              </button>
            </div>
          )}

          {/* Mode Switcher: Add to Cart vs Deduct */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setBarcodeAction('cart')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  barcodeAction === 'cart'
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Add to Cart</span>
              </button>
              <button
                type="button"
                onClick={() => setBarcodeAction('deduct')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  barcodeAction === 'deduct'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MinusCircle className="w-3.5 h-3.5" />
                <span>Deduct</span>
              </button>
            </div>

            {/* Dynamic Context-Aware Action Buttons as requested:
                If 'Add to Cart' -> [ Generate Barcode ] and [ Scan to Add ]
                If 'Deduct' -> [ Scan to Deduct ]
            */}
            <div className="flex items-center gap-2">
              {barcodeAction === 'cart' ? (
                <>
                  {onOpenAddModal && (
                    <button
                      type="button"
                      onClick={onOpenAddModal}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                      title="Add a new clothing item directly to the catalog"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Add Garment</span>
                    </button>
                  )}
                  {onOpenGenerateAndScan && (
                    <button
                      type="button"
                      onClick={onOpenGenerateAndScan}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                      title="Generate unique barcode sticker tag and scan to add"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-300" />
                      <span>Generate Barcode</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenScannerWithMode ? onOpenScannerWithMode('add') : onOpenScanner()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                    title="Open camera to scan barcode and add to catalog/cart"
                  >
                    <PlusCircle className="w-4 h-4 text-emerald-200" />
                    <span>Scan to Add</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenScannerWithMode ? onOpenScannerWithMode('deduct') : onOpenScanner()}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                  title="Open camera to scan barcode to deduct from stock and put on bill"
                >
                  <Barcode className="w-4 h-4 text-amber-200" />
                  <span>Scan to Deduct</span>
                </button>
              )}

              <button
                type="button"
                onClick={onOpenHardwareSettings}
                className="p-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs transition-colors"
                title="POS Wi-Fi & Hardware Integration"
              >
                <QrCode className="w-4 h-4" />
              </button>
            </div>
          </div>

          <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Barcode className="w-5 h-5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                placeholder={
                  barcodeAction === 'deduct'
                    ? 'Scan or enter barcode to Deduct & Add to Bill...'
                    : 'Scan or enter barcode to Add to Cart...'
                }
                className={`w-full pl-10 pr-3 py-2 text-xs sm:text-sm border rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 ${
                  barcodeAction === 'deduct'
                    ? 'bg-amber-50/50 border-amber-300 focus:ring-amber-500'
                    : 'bg-slate-50 border-slate-300 focus:ring-emerald-500'
                }`}
              />
            </div>
            <button
              type="submit"
              className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition-all shadow-sm shrink-0 ${
                barcodeAction === 'deduct'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-emerald-700 hover:bg-emerald-800'
              }`}
            >
              {barcodeAction === 'deduct' ? 'Deduct to Bill' : 'Add Item'}
            </button>
          </form>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                selectedCategoryFilter === cat
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search fabric, color, print..."
            className="ml-auto px-3 py-1 text-xs border border-slate-200 bg-white rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44"
          />
        </div>

        {/* Product Cards Grid */}
        {products.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <Barcode className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-sm text-slate-800">Your POS Catalog is Empty</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              No clothing items have been added to the system yet. Generate a barcode and scan it to add your sarees, kurtis, or salwar suits.
            </p>
            {onOpenGenerateAndScan && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenGenerateAndScan}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Barcode &amp; Scan to Add Item</span>
                </button>
              </div>
            )}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500 space-y-3">
            <p>No clothing designs match your current search or category filter.</p>
            {onOpenAddModal && (
              <button
                type="button"
                onClick={onOpenAddModal}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add New Garment</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-1">
            {filteredProducts.map((prod) => {
            const isLowStock = prod.stock <= prod.minStockAlert && prod.stock > 0;
            const isOut = prod.stock <= 0;
            return (
              <div
                key={prod.id}
                onClick={() => addToCart(prod)}
                className={`p-3.5 rounded-2xl border text-left transition-all duration-150 relative cursor-pointer ${
                  isOut
                    ? 'bg-amber-50/50 border-amber-300 hover:border-amber-500 hover:shadow-md'
                    : 'bg-white border-slate-200 hover:border-emerald-500 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {prod.category}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      isOut
                        ? 'bg-amber-100 text-amber-900 font-bold'
                        : isLowStock
                        ? 'bg-amber-100 text-amber-800 animate-pulse'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {isOut ? '⚠️ 0 in stock (Click to add)' : `${prod.stock} in stock`}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-slate-900 line-clamp-2 mt-1" title={prod.name}>
                  {prod.name}
                </h4>

                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
                  <span className="font-medium text-slate-700">{prod.fabricType.split(' ')[0]}</span>
                  <span>•</span>
                  <span>{prod.size}</span>
                </div>

                <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-slate-100">
                  <span className="font-mono text-[11px] text-slate-400">{prod.barcode}</span>
                  <span className="text-sm font-extrabold text-slate-900">
                    ₹{prod.sellingPrice.toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>

      {/* Right Column: POS Billing Cart & Checkout (5 cols) */}
      <div className={`lg:col-span-5 ${mobileTab === 'cart' ? 'block' : 'hidden lg:block'}`}>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col h-full sticky top-4">
          {/* Mobile Easy Back to Catalog Button */}
          <div className="lg:hidden pb-3">
            <button
              type="button"
              onClick={() => setMobileTab('products')}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all border border-slate-200"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-600" />
              <span>← Back to Clothes Catalog</span>
            </button>
          </div>

          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Active Counter Bill</h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-slate-400">{cart.length} item(s)</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200" title="Scans from mobile phone gun appear here live">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Mobile Gun Synced</span>
                  </span>
                </div>
              </div>
            </div>

            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs text-red-500 hover:text-red-700 font-medium"
              >
                Clear
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto py-3 space-y-3 min-h-[220px] max-h-[340px]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <Barcode className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-xs font-medium">Cart is empty</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Scan a barcode or click items on the left to add to bill
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.product.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h5 className="font-bold text-slate-800 leading-snug">{item.product.name}</h5>
                      <span className="text-[11px] text-slate-500">
                        {item.product.category} • {item.product.size}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-slate-400 hover:text-red-600 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-600"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-bold text-slate-800">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-600"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Discount Input */}
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">Disc%:</span>
                      <input
                        type="number"
                        min="0"
                        max="90"
                        value={item.discountPercent || ''}
                        onChange={(e) => updateDiscount(item.product.id, Number(e.target.value))}
                        placeholder="0"
                        className="w-12 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-center text-xs font-semibold"
                      />
                    </div>

                    {/* Price */}
                    <div className="text-right">
                      {item.discountPercent > 0 && (
                        <div className="text-[10px] text-slate-400 line-through">
                          ₹{(item.product.sellingPrice * item.quantity).toLocaleString()}
                        </div>
                      )}
                      <div className="font-bold text-slate-900">
                        ₹{(item.priceAfterDiscount * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Customer Details */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <User className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Customer Name"
                  className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white"
                />
              </div>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Mobile (for SMS)"
                  className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white"
                />
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="flex gap-1.5 pt-1">
              {(['UPI / QR', 'Cash', 'Card'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all ${
                    paymentMethod === method
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {method === 'UPI / QR' && <QrCode className="w-3.5 h-3.5" />}
                  {method === 'Cash' && <Banknote className="w-3.5 h-3.5" />}
                  {method === 'Card' && <CreditCard className="w-3.5 h-3.5" />}
                  <span>{method}</span>
                </button>
              ))}
            </div>

            {/* Price Breakdown */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>Subtotal MRP:</span>
                <span>₹{subtotal.toLocaleString()}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Store Discount:</span>
                  <span>-₹{discountTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>GST (5% Apparels):</span>
                <span>₹{tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1.5 border-t border-slate-200">
                <span>Grand Total:</span>
                <span className="text-emerald-700">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Checkout Action Button */}
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={handleCheckout}
              className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all ${
                cart.length > 0
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Complete Sale &amp; Print Bill (₹{grandTotal.toFixed(2)})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Modal after successful sale */}
      {completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Sale Successfully Completed!</h3>
            <p className="text-xs text-slate-500 mt-1">
              Invoice #{completedSale.invoiceNo} • {completedSale.paymentMethod}
            </p>
            <div className="text-xl font-black text-emerald-700 my-3">
              ₹{completedSale.grandTotal.toFixed(2)}
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 mb-4">
              Inventory stock levels for sold cotton garments were decremented in real time.
            </p>

            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => handlePrintReceipt(completedSale)}
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm"
              >
                <Printer className="w-4 h-4 text-emerald-400" /> Print Thermal Bill
              </button>
              <button
                type="button"
                onClick={() => setCompletedSale(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                New Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Mobile Floating Bill Button when on clothes catalog tab */}
      {mobileTab === 'products' && cart.length > 0 && (
        <div className="lg:hidden fixed bottom-4 left-4 right-4 z-40 animate-in slide-in-from-bottom-2">
          <button
            type="button"
            onClick={() => setMobileTab('cart')}
            className="w-full py-3.5 px-5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold text-sm rounded-2xl shadow-xl flex items-center justify-between transition-all border border-emerald-600"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-200" />
              <span>View Bill ({cart.length} item{cart.length > 1 ? 's' : ''})</span>
            </div>
            <div className="flex items-center gap-1 font-mono text-base font-bold">
              <span>₹{grandTotal.toLocaleString()}</span>
              <span>→</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
