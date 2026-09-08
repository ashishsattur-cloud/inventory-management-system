import React, { useState } from 'react';
import { Product, SaleTransaction, Supplier } from '../types';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  X,
  UploadCloud,
  Layers,
  Lock,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import {
  createInventorySpreadsheet,
  updateInventorySheets,
  getGoogleSheetsAccessToken,
} from '../services/googleSheets';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  sales: SaleTransaction[];
  suppliers: Supplier[];
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
  products,
  sales,
  suppliers,
}) => {
  const [spreadsheetId, setSpreadsheetId] = useState(
    localStorage.getItem('cotton_pos_sheet_id') || ''
  );
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(
    localStorage.getItem('cotton_pos_sheet_url') || ''
  );
  const [sheetTitle, setSheetTitle] = useState('Cotton Retail Store - Live Inventory & Sales');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateNewSheet = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await createInventorySpreadsheet(sheetTitle, products, sales, suppliers);
      setSpreadsheetId(res.spreadsheetId);
      setSpreadsheetUrl(res.spreadsheetUrl);
      localStorage.setItem('cotton_pos_sheet_id', res.spreadsheetId);
      localStorage.setItem('cotton_pos_sheet_url', res.spreadsheetUrl);
      setSuccessMsg('Successfully created and synchronized 3 automated tabs with Google Sheets!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating Google Sheet. Check permissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncExisting = async () => {
    if (!spreadsheetId.trim()) {
      setErrorMsg('Please enter a valid Google Spreadsheet ID or URL.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      // Clean ID in case user pasted full URL
      let cleanId = spreadsheetId.trim();
      const match = cleanId.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        cleanId = match[1];
      }

      await updateInventorySheets(cleanId, products, sales, suppliers);
      const url = `https://docs.google.com/spreadsheets/d/${cleanId}`;
      setSpreadsheetUrl(url);
      localStorage.setItem('cotton_pos_sheet_id', cleanId);
      localStorage.setItem('cotton_pos_sheet_url', url);
      setSuccessMsg(`Successfully synced live stock (${products.length} styles) and monthly sales logs!`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating spreadsheet. Make sure your account has edit permissions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-200">
        {/* Header with back button */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-600" />
              <span>← Back</span>
            </button>
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 hidden sm:block">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Google Sheets Sync</h3>
              <p className="text-xs text-slate-400">Automated inventory reporting &amp; sales backup</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          {/* Status notices */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{successMsg}</span>
                {spreadsheetUrl && (
                  <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center gap-1 text-emerald-700 font-bold hover:underline"
                  >
                    <span>Open in Google Sheets</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Connected Sheets Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-3">
            <div className="font-bold text-slate-800 flex items-center justify-between">
              <span>Automatic Spreadsheet Layout Generated:</span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                3 Tabs Synced
              </span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li>
                <strong>Tab 1: Live Inventory Catalog</strong> (Barcode, SKU, Category, Fabric, Cost, MRP, Stock, Alerts, Valuation)
              </li>
              <li>
                <strong>Tab 2: Sales Transactions Log</strong> (Invoice #, Date, Customer, Item names, Sizes, Qty, Total, Payment Method)
              </li>
              <li>
                <strong>Tab 3: Suppliers &amp; Vendors</strong> (Loom name, Contact, Phone, City, Cotton Specialties)
              </li>
            </ul>
          </div>

          {/* Create New Sheet Option */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Option A: Create New Auto-Synced Spreadsheet
            </h4>
            <input
              type="text"
              value={sheetTitle}
              onChange={(e) => setSheetTitle(e.target.value)}
              placeholder="Spreadsheet Title..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
            />
            <button
              type="button"
              disabled={loading}
              onClick={handleCreateNewSheet}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <UploadCloud className="w-4 h-4" />
              )}
              <span>Create &amp; Sync Full Inventory to Google Sheets</span>
            </button>
          </div>

          {/* Sync Existing Sheet Option */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Option B: Sync to an Existing Spreadsheet ID
            </h4>
            <input
              type="text"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              placeholder="Paste Google Spreadsheet ID or Full URL..."
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-xl"
            />
            <button
              type="button"
              disabled={loading || !spreadsheetId.trim()}
              onClick={handleSyncExisting}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>Push Latest Live Updates to This Sheet</span>
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
