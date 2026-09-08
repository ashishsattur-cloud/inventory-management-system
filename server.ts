import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json());

// Persistent storage setup
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'inventory_db.json');

interface StoreData {
  products: any[];
  suppliers: any[];
  sales: any[];
}

function loadData(): StoreData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error loading inventory DB:', err);
  }
  return { products: [], suppliers: [], sales: [] };
}

function saveData(data: StoreData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving inventory DB:', err);
  }
}

let store: StoreData = loadData();

// Real-Time SSE (Server-Sent Events) clients registry
const sseClients = new Set<express.Response>();

interface LiveSyncEvent {
  id: string;
  type: 'ITEM_SCANNED_FOR_BILL' | 'STOCK_INCREMENTED' | 'STOCK_DECREMENTED' | 'PRODUCT_ADDED' | 'CATALOG_UPDATED';
  data: any;
  timestamp: number;
}
let recentEvents: LiveSyncEvent[] = [];

function broadcast(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

function emitEvent(type: LiveSyncEvent['type'], data: any) {
  const event: LiveSyncEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    data,
    timestamp: Date.now(),
  };
  recentEvents.unshift(event);
  if (recentEvents.length > 60) {
    recentEvents = recentEvents.slice(0, 60);
  }
  broadcast(type, data);
}

// Keep-alive heartbeat every 15 seconds to keep mobile connections alive
setInterval(() => {
  for (const client of sseClients) {
    try {
      client.write(': ping\n\n');
    } catch (e) {
      sseClients.delete(client);
    }
  }
}, 15000);

// --- API ROUTES ---

// Health & connection status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    connectedDevices: sseClients.size,
    productsCount: store.products.length,
    serverTime: Date.now(),
  });
});

// Real-time scan events log for robust polling fallback
app.get('/api/scan-events', (req, res) => {
  const since = Number(req.query.since) || 0;
  const events = recentEvents.filter((e) => e.timestamp > since);
  res.json({
    events,
    serverTime: Date.now(),
    connectedDevices: sseClients.size,
  });
});

// SSE Stream for Real-Time Sync between Laptop and Mobile
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);

  // Send initial state upon connection
  res.write(
    `event: INIT\ndata: ${JSON.stringify({
      connectedDevices: sseClients.size,
      store,
    })}\n\n`
  );

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Get all inventory, suppliers, sales
app.get('/api/inventory', (req, res) => {
  res.json(store);
});

// Add or update product
app.post('/api/products', (req, res) => {
  const product = req.body;
  if (!product || !product.barcode) {
    return res.status(400).json({ error: 'Product barcode is required' });
  }

  const existingIdx = store.products.findIndex((p) => p.id === product.id || p.barcode === product.barcode);
  const isNew = existingIdx < 0;
  if (!isNew) {
    store.products[existingIdx] = product;
  } else {
    store.products.unshift(product);
  }

  saveData(store);
  if (isNew) {
    emitEvent('PRODUCT_ADDED', { product, deviceName: req.body.deviceName || 'Scanner' });
  }
  emitEvent('CATALOG_UPDATED', store);
  res.json({ success: true, product, isNew });
});

// Quick add product from mobile scanner or POS
app.post('/api/products/quick-add', (req, res) => {
  const {
    barcode,
    name,
    category = 'Saree',
    fabricType = 'Pure Cotton',
    workPattern = 'Handblock Print',
    size = 'Free Size',
    color = 'Multicolor',
    costPrice = 0,
    sellingPrice = 1200,
    stock = 10,
    minStockAlert = 4,
    rackLocation = 'Bay 1 - Main Floor Rack',
    supplierId = 'Direct Mill Purchase',
    deviceName = 'Mobile Scanner',
  } = req.body;

  if (!barcode || !name) {
    return res.status(400).json({ error: 'Barcode and garment name are required' });
  }

  const cleanBarcode = String(barcode).trim();
  const existing = store.products.find((p) => p.barcode === cleanBarcode);
  if (existing) {
    // If already exists, increment stock instead
    existing.stock += Number(stock) || 1;
    existing.sellingPrice = Number(sellingPrice) || existing.sellingPrice;
    existing.updatedAt = new Date().toISOString().split('T')[0];
    saveData(store);
    emitEvent('STOCK_INCREMENTED', {
      barcode: existing.barcode,
      product: existing,
      newStock: existing.stock,
      deviceName,
      timestamp: new Date().toLocaleTimeString(),
    });
    emitEvent('CATALOG_UPDATED', store);
    return res.json({ success: true, product: existing, restocked: true });
  }

  const newProduct = {
    id: 'prod-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    sku: `SKU-${category.slice(0, 3).toUpperCase()}-${cleanBarcode.slice(-4)}`,
    barcode: cleanBarcode,
    name: name.trim(),
    category,
    fabricType,
    workPattern,
    size,
    color,
    costPrice: Number(costPrice) || 0,
    sellingPrice: Number(sellingPrice) || 1200,
    stock: Math.max(0, Number(stock) || 10),
    minStockAlert: Number(minStockAlert) || 4,
    supplierId,
    rackLocation,
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0],
  };

  store.products.unshift(newProduct);
  saveData(store);
  emitEvent('PRODUCT_ADDED', { product: newProduct, deviceName });
  emitEvent('CATALOG_UPDATED', store);
  res.json({ success: true, product: newProduct });
});

// Delete product
app.delete('/api/products/:id', (req, res) => {
  const { id } = req.params;
  store.products = store.products.filter((p) => p.id !== id && p.barcode !== id);
  saveData(store);
  emitEvent('CATALOG_UPDATED', store);
  res.json({ success: true });
});

// Adjust stock
app.post('/api/products/adjust-stock', (req, res) => {
  const { productId, newStock, delta, reason } = req.body;
  const prod = store.products.find((p) => p.id === productId || p.barcode === productId);
  if (!prod) {
    return res.status(404).json({ error: 'Product not found' });
  }

  if (typeof newStock === 'number') {
    prod.stock = Math.max(0, newStock);
  } else if (typeof delta === 'number') {
    prod.stock = Math.max(0, prod.stock + delta);
  }
  prod.updatedAt = new Date().toISOString().split('T')[0];

  saveData(store);
  emitEvent('CATALOG_UPDATED', store);
  res.json({ success: true, product: prod });
});

// Scan handler: Scan to Cart/Billing, Add to Inventory, Deduct, or Lookup
app.post('/api/scan', (req, res) => {
  const { barcode, mode = 'cart', deviceName = 'Mobile Scanner', quantity = 1 } = req.body;
  if (!barcode) {
    return res.status(400).json({ error: 'Barcode is required' });
  }

  const cleanBarcode = String(barcode).trim();
  const prod = store.products.find(
    (p) => p.barcode === cleanBarcode || (p.sku && p.sku.toLowerCase() === cleanBarcode.toLowerCase())
  );

  if (!prod) {
    return res.status(404).json({
      success: false,
      notFound: true,
      error: `Barcode "${cleanBarcode}" not registered in store catalog`,
      barcode: cleanBarcode,
    });
  }

  // MODE 1: ADD TO CART / BILL (Real-Time Counter Sync)
  if (mode === 'cart' || mode === 'bill') {
    const qty = typeof quantity === 'number' && quantity > 0 ? quantity : 1;
    const scanEventPayload = {
      barcode: prod.barcode,
      product: prod,
      quantity: qty,
      deviceName,
      timestamp: new Date().toLocaleTimeString(),
    };

    emitEvent('ITEM_SCANNED_FOR_BILL', scanEventPayload);

    return res.json({
      success: true,
      action: 'cart',
      product: prod,
      quantity: qty,
      message: `Added 1 pc of "${prod.name}" to Laptop Bill (₹${prod.sellingPrice})`,
    });
  }

  // MODE 2: ADD ITEM (Restock or Register to Inventory)
  if (mode === 'add') {
    const addQty = typeof quantity === 'number' && quantity > 0 ? quantity : 1;
    const oldStock = prod.stock;
    prod.stock += addQty;
    prod.updatedAt = new Date().toISOString().split('T')[0];
    saveData(store);

    const scanEventPayload = {
      barcode: prod.barcode,
      product: prod,
      oldStock,
      newStock: prod.stock,
      addedQty: addQty,
      deviceName,
      timestamp: new Date().toLocaleTimeString(),
    };

    emitEvent('STOCK_INCREMENTED', scanEventPayload);
    emitEvent('CATALOG_UPDATED', store);

    return res.json({
      success: true,
      action: 'incremented',
      product: prod,
      oldStock,
      newStock: prod.stock,
      message: `Restocked ${addQty} pc(s) for "${prod.name}". Current Stock: ${prod.stock}`,
    });
  }

  // MODE 3: DEDUCT
  if (mode === 'deduct') {
    const deductQty = typeof quantity === 'number' && quantity > 0 ? quantity : 1;
    const oldStock = prod.stock;
    prod.stock = Math.max(0, prod.stock - deductQty);
    prod.updatedAt = new Date().toISOString().split('T')[0];

    // Record automatic scan sale/deduction
    const deductionSale = {
      id: 'tx-scan-' + Date.now(),
      invoiceNo: `SCAN-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toISOString(),
      items: [
        {
          productId: prod.id,
          productName: prod.name,
          barcode: prod.barcode,
          sku: prod.sku,
          category: prod.category,
          fabricType: prod.fabricType,
          size: prod.size,
          quantity: deductQty,
          unitPrice: prod.sellingPrice,
          discountPercent: 0,
          total: prod.sellingPrice * deductQty,
          costPrice: prod.costPrice || 0,
        },
      ],
      subtotal: prod.sellingPrice * deductQty,
      discountTotal: 0,
      tax: Number((prod.sellingPrice * deductQty * 0.05).toFixed(2)),
      grandTotal: Number((prod.sellingPrice * deductQty * 1.05).toFixed(2)),
      paymentMethod: 'Scan to Deduct',
      notes: `Deducted via scan from ${deviceName}`,
    };

    store.sales.unshift(deductionSale);
    saveData(store);

    const scanEventPayload = {
      barcode: prod.barcode,
      product: prod,
      oldStock,
      newStock: prod.stock,
      deviceName,
      timestamp: new Date().toLocaleTimeString(),
    };

    emitEvent('STOCK_DECREMENTED', scanEventPayload);
    emitEvent('CATALOG_UPDATED', store);

    return res.json({
      success: true,
      action: 'deducted',
      product: prod,
      oldStock,
      newStock: prod.stock,
      message: `Stock for "${prod.name}" reduced from ${oldStock} to ${prod.stock} (-${deductQty})`,
    });
  }

  // Lookup mode
  res.json({
    success: true,
    action: 'lookup',
    product: prod,
  });
});

// Record complete sale transaction
app.post('/api/sales', (req, res) => {
  const sale = req.body;
  if (!sale || !sale.items) {
    return res.status(400).json({ error: 'Invalid sale data' });
  }

  store.sales.unshift(sale);

  // Decrement products in inventory
  for (const item of sale.items) {
    const prod = store.products.find((p) => p.id === item.productId || p.barcode === item.barcode);
    if (prod) {
      prod.stock = Math.max(0, prod.stock - item.quantity);
      prod.updatedAt = new Date().toISOString().split('T')[0];
    }
  }

  saveData(store);
  broadcast('CATALOG_UPDATED', store);
  res.json({ success: true, sale });
});

// Add supplier
app.post('/api/suppliers', (req, res) => {
  const supplier = req.body;
  if (!supplier || !supplier.name) {
    return res.status(400).json({ error: 'Supplier name is required' });
  }

  const existingIdx = store.suppliers.findIndex((s) => s.id === supplier.id);
  if (existingIdx >= 0) {
    store.suppliers[existingIdx] = supplier;
  } else {
    store.suppliers.unshift(supplier);
  }

  saveData(store);
  broadcast('CATALOG_UPDATED', store);
  res.json({ success: true, supplier });
});

// --- VITE / STATIC INTEGRATION ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pure Cotton POS & Inventory Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
