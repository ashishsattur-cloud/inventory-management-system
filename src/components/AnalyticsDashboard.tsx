import React, { useState } from 'react';
import { Product, SaleTransaction, Supplier } from '../types';
import {
  TrendingUp,
  DollarSign,
  Package,
  AlertTriangle,
  FileSpreadsheet,
  Award,
  Calendar,
  Layers,
  ArrowUpRight,
  Download,
  Users,
  Percent,
  Sparkles
} from 'lucide-react';

interface AnalyticsDashboardProps {
  products: Product[];
  sales: SaleTransaction[];
  suppliers: Supplier[];
  onOpenGoogleSync: () => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  products,
  sales,
  suppliers,
  onOpenGoogleSync,
}) => {
  const [selectedMonth, setSelectedMonth] = useState('2026-09');

  // Calculations
  const totalStockPieces = products.reduce((sum, p) => sum + p.stock, 0);
  const totalInventoryCost = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
  const totalInventoryRetailValue = products.reduce((sum, p) => sum + p.stock * p.sellingPrice, 0);
  const expectedProfitMargin = totalInventoryRetailValue > 0
    ? (((totalInventoryRetailValue - totalInventoryCost) / totalInventoryRetailValue) * 100).toFixed(1)
    : '0';

  // Sales Totals
  const totalRevenue = sales.reduce((sum, s) => sum + s.grandTotal, 0);
  const totalUnitsSold = sales.reduce(
    (sum, s) => sum + s.items.reduce((iSum, item) => iSum + item.quantity, 0),
    0
  );

  // Best-selling products aggregation
  const productSalesMap: {
    [id: string]: {
      productName: string;
      category: string;
      totalUnits: number;
      totalRevenue: number;
      stockLeft: number;
    };
  } = {};

  sales.forEach((sale) => {
    sale.items.forEach((item) => {
      if (!productSalesMap[item.productId]) {
        const prod = products.find((p) => p.id === item.productId);
        productSalesMap[item.productId] = {
          productName: item.productName,
          category: item.category,
          totalUnits: 0,
          totalRevenue: 0,
          stockLeft: prod ? prod.stock : 0,
        };
      }
      productSalesMap[item.productId].totalUnits += item.quantity;
      productSalesMap[item.productId].totalRevenue += item.total;
    });
  });

  const bestSellingList = Object.values(productSalesMap).sort(
    (a, b) => b.totalUnits - a.totalUnits
  );

  // Category breakdown
  const categorySummary: {
    [cat: string]: {
      count: number;
      stock: number;
      costVal: number;
      retailVal: number;
    };
  } = {};

  products.forEach((p) => {
    if (!categorySummary[p.category]) {
      categorySummary[p.category] = { count: 0, stock: 0, costVal: 0, retailVal: 0 };
    }
    categorySummary[p.category].count += 1;
    categorySummary[p.category].stock += p.stock;
    categorySummary[p.category].costVal += p.stock * p.costPrice;
    categorySummary[p.category].retailVal += p.stock * p.sellingPrice;
  });

  // Low stock products
  const lowStockItems = products.filter((p) => p.stock <= p.minStockAlert);

  const exportMonthlyReportCSV = () => {
    const headers = ['Invoice No', 'Date', 'Customer', 'Payment Mode', 'Items', 'Total Amount'];
    const rows = sales.map((s) => [
      s.invoiceNo,
      new Date(s.timestamp).toLocaleDateString(),
      `"${s.customerName || 'Walk-in'}"`,
      s.paymentMethod,
      `"${s.items.map((i) => `${i.productName} (x${i.quantity})`).join(', ')}"`,
      s.grandTotal,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `monthly_sales_report_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Google Sheets Trigger */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-5 text-white shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">
            Cotton Apparel Retail Intelligence
          </span>
          <h2 className="text-xl font-bold mt-0.5">Inventory Valuation &amp; Sales Performance</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Real-time stock value across pure cotton sarees, salwar suits, kurtis, and dupattas with automatic low-stock triggers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenGoogleSync}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-950" />
            <span>Sync with Google Sheets</span>
          </button>
          <button
            type="button"
            onClick={exportMonthlyReportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl border border-white/20 transition-all"
          >
            <Download className="w-4 h-4 text-emerald-300" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Core Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Retail Inventory Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span>Total Inventory Value (MRP)</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{totalInventoryRetailValue.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span>Cost Basis: ₹{totalInventoryCost.toLocaleString()}</span>
            <span className="font-semibold text-emerald-700">{expectedProfitMargin}% Margin</span>
          </div>
        </div>

        {/* Realized Sales Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span>Total POS Sales Revenue</span>
            <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
            <span>{sales.length} Bills Generated</span>
            <span className="font-semibold text-blue-700">{totalUnitsSold} pieces sold</span>
          </div>
        </div>

        {/* Live Physical Stock Units */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span>Current Stock Volume</span>
            <div className="p-1.5 bg-purple-50 text-purple-700 rounded-lg">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {totalStockPieces} <span className="text-sm font-normal text-slate-500">pieces</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Across {products.length} catalog styles in warehouse
          </div>
        </div>

        {/* Low-Stock Reorder Alerts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span>Low Stock Reorders</span>
            <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600">
            {lowStockItems.length} <span className="text-sm font-normal text-slate-500">styles</span>
          </div>
          <div className="mt-2 text-xs text-amber-700 font-medium">
            Immediate weaver purchase orders needed
          </div>
        </div>
      </div>

      {/* Grid: Best-Selling Products & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Best-Selling Cotton Products (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Best-Selling Cotton Garments</h3>
                <p className="text-xs text-slate-400">Ranked by units moved through barcode checkout</p>
              </div>
            </div>
            <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              Live Ranking
            </span>
          </div>

          <div className="space-y-3">
            {bestSellingList.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                Complete billing sales in the POS tab to view real-time garment velocity!
              </p>
            ) : (
              bestSellingList.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                        idx === 0
                          ? 'bg-amber-400 text-amber-950'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-800'
                          : idx === 2
                          ? 'bg-amber-700 text-amber-100'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{item.productName}</h4>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="font-semibold text-emerald-700">{item.category}</span>
                        <span>•</span>
                        <span>Stock Remaining: {item.stockLeft} pcs</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-900">
                      {item.totalUnits} Units Sold
                    </div>
                    <div className="text-[11px] text-emerald-700 font-semibold">
                      ₹{item.totalRevenue.toLocaleString()} Revenue
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Low Stock Alerts & Fast Replenish (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Low-Stock Trigger List</h3>
                <p className="text-xs text-slate-400">Items at or below safety threshold</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
              {lowStockItems.length} Alerts
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[320px] pr-1">
            {lowStockItems.length === 0 ? (
              <div className="text-center py-10 text-emerald-600 text-xs">
                All cotton garments are stocked well above minimum safety thresholds!
              </div>
            ) : (
              lowStockItems.map((item) => {
                const sup = suppliers.find((s) => s.id === item.supplierId);
                return (
                  <div
                    key={item.id}
                    className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1.5"
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="font-bold text-amber-950 line-clamp-1">{item.name}</h4>
                      <span className="font-bold text-xs text-red-600 bg-white px-2 py-0.5 rounded border border-amber-200">
                        {item.stock} left (Min: {item.minStockAlert})
                      </span>
                    </div>

                    <div className="text-[11px] text-amber-800 flex items-center justify-between">
                      <span>{item.category} • {item.fabricType}</span>
                      <span className="font-mono">{item.barcode}</span>
                    </div>

                    {sup && (
                      <div className="text-[10px] text-slate-600 bg-white/80 px-2 py-1 rounded border border-amber-100 flex items-center justify-between">
                        <span>Supplier: <strong>{sup.name}</strong> ({sup.city})</span>
                        <a href={`tel:${sup.phone}`} className="text-emerald-700 font-semibold hover:underline">
                          Call Loom
                        </a>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Category Breakdown Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Category-Wise Stock &amp; Valuation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(categorySummary).map(([cat, data]) => (
            <div key={cat} className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800 mb-2">
                <span>{cat}</span>
                <span className="bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-[11px]">
                  {data.count} Styles
                </span>
              </div>
              <div className="text-lg font-black text-slate-900">{data.stock} Pieces</div>
              <div className="mt-2 text-xs text-slate-500 space-y-0.5">
                <div className="flex justify-between">
                  <span>Valuation:</span>
                  <span className="font-semibold text-slate-800">₹{data.retailVal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cost Basis:</span>
                  <span>₹{data.costVal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Sales Report Preview Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Comprehensive Monthly Sales Audit</h3>
            <p className="text-xs text-slate-400">All counter transactions, invoice numbers, and payment reconciliation</p>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            Audit Month: September 2026
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-3 py-2.5">Invoice #</th>
                <th className="px-3 py-2.5">Timestamp</th>
                <th className="px-3 py-2.5">Customer</th>
                <th className="px-3 py-2.5">Garments Purchased</th>
                <th className="px-3 py-2.5">Payment</th>
                <th className="px-3 py-2.5 text-right">Tax (5%)</th>
                <th className="px-3 py-2.5 text-right">Net Bill</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5 font-mono font-bold text-slate-800">{sale.invoiceNo}</td>
                  <td className="px-3 py-2.5 text-slate-500">{new Date(sale.timestamp).toLocaleString()}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-slate-900">{sale.customerName || 'Walk-in'}</div>
                    {sale.customerPhone && (
                      <div className="text-[10px] text-slate-400">{sale.customerPhone}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="space-y-0.5">
                      {sale.items.map((it, idx) => (
                        <div key={idx} className="text-slate-700">
                          {it.productName} <span className="font-bold text-slate-900">x{it.quantity}</span>
                          <span className="text-[10px] text-slate-400 ml-1">({it.size})</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-700">
                    <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                      {sale.paymentMethod}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-500">₹{sale.tax.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-emerald-800 text-sm">
                    ₹{sale.grandTotal.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
