declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => {
            requestAccessToken: () => void;
          };
        };
      };
    };
  }
}

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
// OAuth client ID for project gen-lang-client-0428657176
const CLIENT_ID = '29353031252-k4fvdq332sqvd79dmsrtksq4c8038sq7.apps.googleusercontent.com';

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

export async function getGoogleSheetsAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }

  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services script not yet loaded. Please wait a moment or check your connection.'));
      return;
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (resp) => {
          if (resp.error) {
            reject(new Error(`OAuth authentication failed: ${resp.error}`));
            return;
          }
          if (resp.access_token) {
            cachedAccessToken = resp.access_token;
            // standard Google OAuth tokens last 3600 seconds
            tokenExpiresAt = Date.now() + 3500 * 1000;
            resolve(resp.access_token);
          } else {
            reject(new Error('No access token returned.'));
          }
        },
      });

      client.requestAccessToken();
    } catch (err) {
      reject(err);
    }
  });
}

export function isGoogleConnected(): boolean {
  return !!(cachedAccessToken && Date.now() < tokenExpiresAt);
}

export function disconnectGoogleSheets(): void {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
}

// Create a new Google Spreadsheet with structured sheets:
// 1. "Current Inventory"
// 2. "Monthly Sales Log"
// 3. "Suppliers & Contacts"
export async function createInventorySpreadsheet(
  title: string,
  products: any[],
  sales: any[],
  suppliers: any[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const token = await getGoogleSheetsAccessToken();

  // Create spreadsheet payload
  const createPayload = {
    properties: {
      title: title || `Cotton Cloth Store - Inventory & POS Sync (${new Date().toLocaleDateString()})`,
    },
    sheets: [
      { properties: { title: 'Live Inventory Catalog' } },
      { properties: { title: 'Sales Transactions Log' } },
      { properties: { title: 'Suppliers & Vendors' } },
    ],
  };

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createPayload),
  });

  if (!createRes.ok) {
    const errBody = await createRes.json().catch(() => ({}));
    throw new Error(`Failed to create spreadsheet: ${errBody.error?.message || createRes.statusText}`);
  }

  const sheetData = await createRes.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = sheetData.spreadsheetUrl;

  // Now populate initial data
  await updateInventorySheets(spreadsheetId, products, sales, suppliers);

  return { spreadsheetId, spreadsheetUrl };
}

export async function updateInventorySheets(
  spreadsheetId: string,
  products: any[],
  sales: any[],
  suppliers: any[]
): Promise<void> {
  const token = await getGoogleSheetsAccessToken();

  // 1. Format Product Catalog Rows
  const inventoryHeaders = [
    'Barcode',
    'SKU',
    'Product Name',
    'Category',
    'Fabric / Material Type',
    'Work Pattern',
    'Size',
    'Color',
    'Cost Price (INR)',
    'Selling Price (INR)',
    'Current Stock',
    'Min Alert Stock',
    'Stock Status',
    'Inventory Value (INR)',
    'Rack / Shelf Location',
    'Last Updated'
  ];

  const inventoryRows = products.map((p) => {
    const isLow = p.stock <= p.minStockAlert;
    const isOutOfStock = p.stock <= 0;
    const status = isOutOfStock ? 'OUT OF STOCK' : isLow ? 'LOW STOCK ALERT' : 'IN STOCK';
    const totalVal = p.stock * p.sellingPrice;
    return [
      p.barcode,
      p.sku,
      p.name,
      p.category,
      p.fabricType,
      p.workPattern,
      p.size,
      p.color,
      p.costPrice,
      p.sellingPrice,
      p.stock,
      p.minStockAlert,
      status,
      totalVal,
      p.rackLocation || 'Bay 1',
      p.updatedAt || new Date().toISOString().split('T')[0],
    ];
  });

  // 2. Format Sales Transactions Rows
  const salesHeaders = [
    'Invoice No',
    'Date & Time',
    'Customer Name',
    'Customer Phone',
    'Item Name',
    'Barcode',
    'Category',
    'Size',
    'Quantity',
    'Unit Price (INR)',
    'Total Amount (INR)',
    'Payment Mode'
  ];

  const salesRows: any[] = [];
  sales.forEach((s) => {
    s.items.forEach((item: any) => {
      salesRows.push([
        s.invoiceNo,
        new Date(s.timestamp).toLocaleString(),
        s.customerName || 'Walk-in Customer',
        s.customerPhone || 'N/A',
        item.productName,
        item.barcode,
        item.category,
        item.size,
        item.quantity,
        item.unitPrice,
        item.total,
        s.paymentMethod,
      ]);
    });
  });

  // 3. Format Supplier Rows
  const supplierHeaders = [
    'Supplier ID',
    'Supplier / Loom Name',
    'Contact Person',
    'Phone',
    'Email',
    'City & State',
    'Fabric Specialty',
    'Rating (out of 5)'
  ];

  const supplierRows = suppliers.map((sup) => [
    sup.id,
    sup.name,
    sup.contactPerson,
    sup.phone,
    sup.email,
    sup.city,
    sup.specialty,
    sup.rating
  ]);

  // Batch update values
  const batchData = [
    {
      range: "'Live Inventory Catalog'!A1:P" + (inventoryRows.length + 1),
      values: [inventoryHeaders, ...inventoryRows],
    },
    {
      range: "'Sales Transactions Log'!A1:L" + (salesRows.length + 1),
      values: [salesHeaders, ...salesRows],
    },
    {
      range: "'Suppliers & Vendors'!A1:H" + (supplierRows.length + 1),
      values: [supplierHeaders, ...supplierRows],
    },
  ];

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: batchData,
      }),
    }
  );

  if (!updateRes.ok) {
    const errBody = await updateRes.json().catch(() => ({}));
    throw new Error(`Failed to sync with Google Sheet: ${errBody.error?.message || updateRes.statusText}`);
  }
}
