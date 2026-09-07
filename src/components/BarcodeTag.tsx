import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer, Copy, Check, Tag } from 'lucide-react';
import { Product } from '../types';

interface BarcodeGeneratorProps {
  product: Product;
  onPrint?: () => void;
  standalone?: boolean;
}

export const BarcodeTag: React.FC<BarcodeGeneratorProps> = ({ product, onPrint, standalone = false }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    if (svgRef.current && product.barcode) {
      try {
        JsBarcode(svgRef.current, product.barcode, {
          format: 'CODE128',
          lineColor: '#1e293b',
          width: 1.8,
          height: 48,
          displayValue: true,
          fontSize: 12,
          font: 'monospace',
          margin: 6,
          background: '#ffffff',
        });
      } catch (err) {
        console.error('Barcode render error:', err);
      }
    }
  }, [product.barcode, product.sku]);

  const handleCopyBarcode = () => {
    navigator.clipboard.writeText(product.barcode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintSingle = () => {
    const printWindow = window.open('', '_blank', 'width=450,height=550');
    if (!printWindow) {
      alert('Please allow popups to print barcode labels.');
      return;
    }

    const svgHtml = svgRef.current ? svgRef.current.outerHTML : '';
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Label - ${product.name}</title>
          <style>
            @page {
              size: 50mm 40mm;
              margin: 2mm;
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              margin: 0;
              padding: 6px;
              color: #0f172a;
              display: flex;
              justify-content: center;
              align-items: center;
              background: #fff;
            }
            .label-card {
              border: 1.5px dashed #334155;
              border-radius: 6px;
              padding: 8px;
              width: 240px;
              text-align: center;
              box-sizing: border-box;
            }
            .brand-name {
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 0.8px;
              text-transform: uppercase;
              color: #047857;
              margin-bottom: 2px;
            }
            .item-title {
              font-size: 12px;
              font-weight: 700;
              line-height: 1.2;
              margin: 2px 0;
              max-height: 28px;
              overflow: hidden;
            }
            .attributes {
              font-size: 10px;
              color: #475569;
              margin: 3px 0;
              display: flex;
              justify-content: space-around;
              border-top: 1px dotted #cbd5e1;
              border-bottom: 1px dotted #cbd5e1;
              padding: 2px 0;
            }
            .price-tag {
              font-size: 14px;
              font-weight: 800;
              color: #0f172a;
              margin-top: 4px;
            }
            .rack {
              font-size: 9px;
              color: #64748b;
            }
            svg {
              max-width: 100%;
              height: auto;
            }
          </style>
        </head>
        <body>
          <div class="label-card">
            <div class="brand-name">Pure Cotton Heritage POS</div>
            <div class="item-title">${product.name}</div>
            <div class="attributes">
              <span><strong>${product.category}</strong></span>
              <span>•</span>
              <span>${product.size}</span>
              <span>•</span>
              <span>${product.fabricType.split(' ')[0]}</span>
            </div>
            <div style="display:flex; justify-content:center; margin: 4px 0;">
              ${svgHtml}
            </div>
            <div class="price-tag">MRP: ₹${product.sellingPrice.toLocaleString()}</div>
            <div class="rack">${product.rackLocation || 'Bay 1'} | SKU: ${product.sku}</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div id={`barcode-tag-${product.id}`} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col items-center">
      <div className="w-full flex items-center justify-between text-xs text-emerald-800 font-semibold mb-1 pb-1 border-b border-slate-100">
        <span className="flex items-center gap-1">
          <Tag className="w-3.5 h-3.5 text-emerald-600" /> Cotton Boutique Label
        </span>
        <span className="text-slate-500 font-mono">{product.sku}</span>
      </div>

      <div className="text-center w-full px-1">
        <h4 className="text-sm font-bold text-slate-800 truncate" title={product.name}>
          {product.name}
        </h4>
        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mt-0.5">
          <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium">{product.category}</span>
          <span>{product.size}</span>
          <span>•</span>
          <span className="truncate max-w-[120px]">{product.fabricType}</span>
        </div>
      </div>

      {/* Barcode Render SVG */}
      <div className="my-2 bg-slate-50 p-2 rounded-lg flex justify-center w-full overflow-hidden border border-slate-100">
        <svg ref={svgRef} className="max-w-full h-auto"></svg>
      </div>

      <div className="w-full flex items-center justify-between mt-1 pt-2 border-t border-slate-100">
        <div>
          <span className="text-xs text-slate-400 block leading-none">Retail MRP</span>
          <span className="text-base font-bold text-slate-900">₹{product.sellingPrice.toLocaleString()}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyBarcode}
            title="Copy barcode digits"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handlePrintSingle}
            className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg shadow-sm transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Label</span>
          </button>
        </div>
      </div>
    </div>
  );
};
