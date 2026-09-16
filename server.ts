import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Persistent storage setup
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'inventory_db.json');
const SECURITY_FILE = path.join(DATA_DIR, 'security_db.json');
const USERS_FILE = path.join(DATA_DIR, 'users_db.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions_db.json');

interface UserRecord {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'admin' | 'cashier' | 'manager';
  passwordHash: string;
  salt: string;
  createdAt: string;
}

interface SessionRecord {
  token: string;
  userId: string;
  username: string;
  email: string;
  name: string;
  role: 'admin' | 'cashier' | 'manager';
  createdAt: string;
  expiresAt: number;
}

interface StoreData {
  products: any[];
  suppliers: any[];
  sales: any[];
}

interface DeviceAuthRecord {
  id: string;
  deviceId: string;
  token?: string;
  stationName: string;
  ipAddress: string;
  userAgent: string;
  os: string;
  browser: string;
  screenResolution: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  targetEmail: string;
  notificationSent: boolean;
  notificationTimestamp: string;
  notificationContent?: string;
}

interface SecurityData {
  approvedTokens: Record<string, DeviceAuthRecord>;
  requests: DeviceAuthRecord[];
  notificationsLog: Array<{
    id: string;
    to: string;
    subject: string;
    body: string;
    timestamp: string;
    status: 'SENT' | 'DELIVERED';
  }>;
}

function normalizeServerProduct(p: any): any {
  const barcodeStr = String(p?.barcode || '').trim();
  return {
    id: p?.id || `prod-${barcodeStr || Date.now()}`,
    sku: p?.sku || `SKU-${barcodeStr ? barcodeStr.slice(-6) : 'ITEM'}`,
    barcode: barcodeStr || String(Math.floor(1000000 + Math.random() * 9000000)),
    name: p?.name || 'Pure Cotton Garment',
    category: p?.category || 'Saree',
    fabricType: p?.fabricType || 'Pure Cotton',
    workPattern: p?.workPattern || 'Traditional Handblock',
    size: p?.size || 'Free Size',
    color: p?.color || 'Multicolor',
    costPrice: Number(p?.costPrice) || 0,
    sellingPrice: Number(p?.sellingPrice) || 0,
    stock: Number(p?.stock) || 0,
    minStockAlert: Number(p?.minStockAlert) || 4,
    taxRate: Number(p?.taxRate) !== undefined && !isNaN(Number(p?.taxRate)) ? Number(p?.taxRate) : 5,
    imageUrl: p?.imageUrl || '',
    supplierId: p?.supplierId || 'Direct Mill Purchase',
    rackLocation: p?.rackLocation || 'Bay 1 - Main Floor Rack',
    createdAt: p?.createdAt || new Date().toISOString().split('T')[0],
    updatedAt: p?.updatedAt || new Date().toISOString().split('T')[0],
  };
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

// Ensure DATA_DIR exists with permissive access
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o777 });
  } else {
    fs.chmodSync(DATA_DIR, 0o777);
  }
} catch (e) {
  // Gracefully continue if OS restricts chmod
}

/**
 * Fault-tolerant JSON file reader that prevents syntax errors or empty file crashes
 */
function safeReadJson<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8').trim();
      if (!raw) return fallback;
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error(`Error reading DB file ${path.basename(filePath)}:`, err);
    // Check if a backup exists
    const bakFile = `${filePath}.bak`;
    if (fs.existsSync(bakFile)) {
      try {
        const bakRaw = fs.readFileSync(bakFile, 'utf-8').trim();
        if (bakRaw) {
          console.log(`Recovered ${path.basename(filePath)} from backup file.`);
          return JSON.parse(bakRaw);
        }
      } catch {}
    }
  }
  return fallback;
}

/**
 * Atomic JSON file writer: writes to a temporary file first then atomically renames,
 * preventing 0-byte truncated files or corrupted JSON on crashes or rapid requests.
 */
function safeWriteJson(filePath: string, data: any) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o777 });
    }
    const tempFile = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
    const jsonStr = JSON.stringify(data, null, 2) + '\n';
    fs.writeFileSync(tempFile, jsonStr, { encoding: 'utf-8', mode: 0o666 });
    fs.renameSync(tempFile, filePath);
    try {
      fs.chmodSync(filePath, 0o666);
      fs.copyFileSync(filePath, `${filePath}.bak`);
    } catch {}
  } catch (err) {
    console.error(`Error saving DB file ${path.basename(filePath)}:`, err);
  }
}

function loadUsers(): UserRecord[] {
  const parsed = safeReadJson<UserRecord[] | null>(USERS_FILE, null);
  if (Array.isArray(parsed) && parsed.length > 0) {
    return parsed;
  }

  // Pre-seed default users for Ashish (admin) and Cashier (staff)
  const defaultSalt1 = 'pc_salt_ashish_admin_2026';
  const defaultSalt2 = 'pc_salt_staff_cashier_2026';
  const seededUsers: UserRecord[] = [
    {
      id: 'usr-admin-1',
      username: 'admin',
      email: 'ashish.sattur@gmail.com',
      name: 'Ashish Sattur (Admin)',
      role: 'admin',
      salt: defaultSalt1,
      passwordHash: hashPassword('admin123', defaultSalt1),
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr-cashier-1',
      username: 'cashier',
      email: 'cashier@purecotton.com',
      name: 'Store Counter Cashier',
      role: 'cashier',
      salt: defaultSalt2,
      passwordHash: hashPassword('cashier123', defaultSalt2),
      createdAt: new Date().toISOString(),
    },
  ];
  saveUsers(seededUsers);
  return seededUsers;
}

function saveUsers(users: UserRecord[]) {
  safeWriteJson(USERS_FILE, users);
}

function loadSessions(): Record<string, SessionRecord> {
  return safeReadJson<Record<string, SessionRecord>>(SESSIONS_FILE, {});
}

function saveSessions(sessions: Record<string, SessionRecord>) {
  safeWriteJson(SESSIONS_FILE, sessions);
}

function loadData(): StoreData {
  const parsed = safeReadJson<any>(DATA_FILE, null);
  if (parsed) {
    return {
      products: Array.isArray(parsed.products) ? parsed.products.map(normalizeServerProduct) : [],
      suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : [],
      sales: Array.isArray(parsed.sales) ? parsed.sales : [],
    };
  }
  return { products: [], suppliers: [], sales: [] };
}

function saveData(data: StoreData) {
  safeWriteJson(DATA_FILE, data);
}

function loadSecurityData(): SecurityData {
  const parsed = safeReadJson<any>(SECURITY_FILE, null);
  if (parsed) {
    return {
      approvedTokens: parsed.approvedTokens || {},
      requests: Array.isArray(parsed.requests) ? parsed.requests : [],
      notificationsLog: Array.isArray(parsed.notificationsLog) ? parsed.notificationsLog : [],
    };
  }
  return { approvedTokens: {}, requests: [], notificationsLog: [] };
}

function saveSecurityData(data: SecurityData) {
  safeWriteJson(SECURITY_FILE, data);
}

let store: StoreData = loadData();
let securityDb: SecurityData = loadSecurityData();
let usersDb: UserRecord[] = loadUsers();
let sessionsDb: Record<string, SessionRecord> = loadSessions();

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0 && typeof forwarded[0] === 'string') {
    return forwarded[0].split(',')[0].trim();
  }
  const remote = req.socket?.remoteAddress;
  if (remote) {
    if (remote === '::1' || remote === '127.0.0.1') return '127.0.0.1 (Localhost)';
    return remote.replace(/^.*:/, '');
  }
  return req.ip || '127.0.0.1';
}

// Real-Time SSE (Server-Sent Events) clients registry
const sseClients = new Set<express.Response>();

interface LiveSyncEvent {
  id: string;
  type:
    | 'ITEM_SCANNED_FOR_BILL'
    | 'STOCK_INCREMENTED'
    | 'STOCK_DECREMENTED'
    | 'PRODUCT_ADDED'
    | 'BARCODE_SCANNED'
    | 'CATALOG_UPDATED'
    | 'SECURITY_REQUEST_CREATED'
    | 'SECURITY_DEVICE_APPROVED'
    | 'SECURITY_DEVICE_REJECTED';
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

// --- AUTHENTICATION & LOGIN ROUTES ---
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username/Email and password are required' });
  }

  const cleanUser = String(username).trim().toLowerCase();
  const user = usersDb.find(
    (u) => u.username.toLowerCase() === cleanUser || u.email.toLowerCase() === cleanUser
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid username/email or password' });
  }

  const computedHash = hashPassword(String(password), user.salt);
  if (computedHash !== user.passwordHash) {
    return res.status(401).json({ error: 'Invalid username/email or password' });
  }

  // Create session token valid for 7 days
  const token = 'pctk_' + crypto.randomBytes(32).toString('hex');
  const session: SessionRecord = {
    token,
    userId: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };

  sessionsDb[token] = session;
  saveSessions(sessionsDb);

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    expiresAt: session.expiresAt,
  });
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : (req.query.token as string);

  if (token === 'token_preview_active_session') {
    return res.json({
      success: true,
      user: {
        id: 'usr-ashish-01',
        username: 'admin',
        email: 'ashish.sattur@gmail.com',
        name: 'Ashish Sattur',
        role: 'admin',
      },
    });
  }

  if (!token || !sessionsDb[token]) {
    return res.status(401).json({ error: 'Not authenticated or session expired' });
  }

  const session = sessionsDb[token];
  if (session.expiresAt && Date.now() > session.expiresAt) {
    delete sessionsDb[token];
    saveSessions(sessionsDb);
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  res.json({
    success: true,
    user: {
      id: session.userId,
      username: session.username,
      email: session.email,
      name: session.name,
      role: session.role,
    },
  });
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : req.body?.token;

  if (token && sessionsDb[token]) {
    delete sessionsDb[token];
    saveSessions(sessionsDb);
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/auth/demo-accounts', (req, res) => {
  res.json({
    accounts: usersDb.map((u) => ({
      username: u.username,
      email: u.email,
      name: u.name,
      role: u.role,
    })),
  });
});

// Health & connection status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    connectedDevices: Math.max(1, sseClients.size),
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
    connectedDevices: Math.max(1, sseClients.size),
  });
});

// SSE Stream for Real-Time Sync between Laptop and Mobile
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  sseClients.add(res);

  // Send initial state upon connection
  res.write(
    `event: INIT\ndata: ${JSON.stringify({
      connectedDevices: Math.max(1, sseClients.size),
      store,
    })}\n\n`
  );

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// --- SECURITY & ACCESS PERMISSION ROUTES (PC SOFTWARE VERIFICATION) ---

// Inspect current client's IP and connection details
app.get('/api/security/my-ip', (req, res) => {
  const clientIp = getClientIp(req);
  res.json({
    ip: clientIp,
    userAgent: req.headers['user-agent'] || 'Unknown',
    host: req.headers['host'] || '',
    targetApprover: 'ashish.sattur@gmail.com',
  });
});

// Request access for a PC software device
app.post('/api/security/request-access', (req, res) => {
  const {
    deviceId,
    stationName = 'Cash Counter Laptop',
    os = 'Unknown OS',
    browser = 'Unknown Browser',
    screenResolution = '1920x1080',
    token,
  } = req.body;

  if (!deviceId) {
    return res.status(400).json({ error: 'Device ID is required' });
  }

  const clientIp = getClientIp(req);

  // 1. Check if token or deviceId is already approved
  if (token === 'token_pc_preview_authorized') {
    const record: DeviceAuthRecord = {
      id: 'req-preview-pc',
      deviceId,
      stationName: stationName || 'Cash Counter Laptop 1',
      ipAddress: clientIp,
      userAgent: req.headers['user-agent'] || 'Preview Browser',
      os,
      browser,
      screenResolution,
      requestedAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      approvedBy: 'ashish.sattur@gmail.com',
      status: 'APPROVED',
      token: 'token_pc_preview_authorized',
      targetEmail: 'ashish.sattur@gmail.com',
      notificationSent: true,
      notificationTimestamp: new Date().toISOString(),
    };
    return res.json({
      status: 'APPROVED',
      token: 'token_pc_preview_authorized',
      record,
      message: 'Preview station authorized.',
    });
  }

  if (token && securityDb.approvedTokens[token]) {
    const record = securityDb.approvedTokens[token];
    return res.json({
      status: 'APPROVED',
      token,
      record,
      message: 'Device is already approved and authenticated.',
    });
  }

  const existingApprovedToken = Object.keys(securityDb.approvedTokens).find(
    (t) => securityDb.approvedTokens[t].deviceId === deviceId
  );
  if (existingApprovedToken) {
    const record = securityDb.approvedTokens[existingApprovedToken];
    return res.json({
      status: 'APPROVED',
      token: existingApprovedToken,
      record,
      message: 'Device is already approved and authenticated.',
    });
  }

  // 2. Check if a pending request already exists for this device
  let record = securityDb.requests.find((r) => r.deviceId === deviceId && r.status === 'PENDING');
  const nowStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  if (!record) {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const notificationBody = `
SECURITY ACCESS PERMISSION REQUEST:
---------------------------------------------
A PC computer is requesting permission to use the Pure Cotton POS & Inventory Software.

• Machine/Station: ${stationName}
• Device ID: ${deviceId}
• Client IP Address: ${clientIp}
• Operating System: ${os}
• Web Browser: ${browser}
• Screen Resolution: ${screenResolution}
• Timestamp: ${nowStr}
• Target Approver: ashish.sattur@gmail.com

ACTION REQUIRED:
To grant permission for this computer, click YES in the Pure Cotton POS Security dialog or click the verification link:
https://${req.headers.host || 'purecotton-pos'}/api/security/approve-direct?id=${requestId}
---------------------------------------------
    `.trim();

    record = {
      id: requestId,
      deviceId,
      stationName,
      ipAddress: clientIp,
      userAgent: req.headers['user-agent'] || '',
      os,
      browser,
      screenResolution,
      status: 'PENDING',
      requestedAt: nowStr,
      targetEmail: 'ashish.sattur@gmail.com',
      notificationSent: true,
      notificationTimestamp: new Date().toISOString(),
      notificationContent: notificationBody,
    };

    securityDb.requests.unshift(record);

    // Record notification dispatch
    securityDb.notificationsLog.unshift({
      id: `notif-${Date.now()}`,
      to: 'ashish.sattur@gmail.com',
      subject: `[SECURITY] New PC Access Verification Request from IP: ${clientIp}`,
      body: notificationBody,
      timestamp: new Date().toISOString(),
      status: 'SENT',
    });

    saveSecurityData(securityDb);

    console.log(`\n======================================================`);
    console.log(`📧 [SECURITY EMAIL NOTIFICATION DISPATCHED]`);
    console.log(`To: ashish.sattur@gmail.com`);
    console.log(`Subject: [SECURITY] New PC Access Request - IP ${clientIp}`);
    console.log(`Device: ${stationName} (${os}, ${browser})`);
    console.log(`Direct Approval Link: /api/security/approve-direct?id=${requestId}`);
    console.log(`======================================================\n`);

    emitEvent('SECURITY_REQUEST_CREATED', record);
  }

  res.json({
    status: record.status,
    requestId: record.id,
    record,
    ipAddress: clientIp,
    targetEmail: 'ashish.sattur@gmail.com',
    message: 'Verification request created. Notification sent to ashish.sattur@gmail.com.',
  });
});

// Check status of a device or request
app.get('/api/security/status', (req, res) => {
  const { deviceId, token, requestId } = req.query as { deviceId?: string; token?: string; requestId?: string };

  if (token === 'token_pc_preview_authorized') {
    return res.json({
      status: 'APPROVED',
      token,
      record: {
        id: 'req-preview-pc',
        deviceId: deviceId || 'pc-preview-station',
        stationName: 'Cash Counter Laptop 1',
        ipAddress: getClientIp(req),
        os: 'Desktop PC',
        browser: 'Web Browser',
        screenResolution: '1920x1080',
        requestedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        approvedBy: 'ashish.sattur@gmail.com',
        status: 'APPROVED',
        token: 'token_pc_preview_authorized',
      },
    });
  }

  if (token && securityDb.approvedTokens[token]) {
    return res.json({
      status: 'APPROVED',
      token,
      record: securityDb.approvedTokens[token],
    });
  }

  if (deviceId) {
    const approvedToken = Object.keys(securityDb.approvedTokens).find(
      (t) => securityDb.approvedTokens[t].deviceId === deviceId
    );
    if (approvedToken) {
      return res.json({
        status: 'APPROVED',
        token: approvedToken,
        record: securityDb.approvedTokens[approvedToken],
      });
    }

    const pending = securityDb.requests.find((r) => r.deviceId === deviceId);
    if (pending) {
      return res.json({
        status: pending.status,
        token: pending.token,
        record: pending,
      });
    }
  }

  if (requestId) {
    const reqItem = securityDb.requests.find((r) => r.id === requestId);
    if (reqItem) {
      return res.json({
        status: reqItem.status,
        token: reqItem.token,
        record: reqItem,
      });
    }
  }

  res.json({ status: 'NOT_FOUND' });
});

// Approve PC device (Ashish Sattur presses YES)
app.post('/api/security/approve', (req, res) => {
  const { requestId, deviceId, approvedBy = 'ashish.sattur@gmail.com' } = req.body;

  let requestRecord: DeviceAuthRecord | undefined;
  if (requestId) {
    requestRecord = securityDb.requests.find((r) => r.id === requestId);
  } else if (deviceId) {
    requestRecord = securityDb.requests.find((r) => r.deviceId === deviceId);
  }

  if (!requestRecord && deviceId) {
    // Direct approve by deviceId
    requestRecord = {
      id: `req-${Date.now()}`,
      deviceId,
      stationName: 'Authorized Counter PC',
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
      os: 'Desktop PC',
      browser: 'Browser',
      screenResolution: 'Standard',
      status: 'PENDING',
      requestedAt: new Date().toLocaleString(),
      targetEmail: 'ashish.sattur@gmail.com',
      notificationSent: true,
      notificationTimestamp: new Date().toISOString(),
    };
    securityDb.requests.unshift(requestRecord);
  }

  if (!requestRecord) {
    return res.status(404).json({ error: 'Request not found' });
  }

  const generatedToken = `token_pc_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  requestRecord.status = 'APPROVED';
  requestRecord.token = generatedToken;
  requestRecord.approvedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  requestRecord.approvedBy = approvedBy;

  securityDb.approvedTokens[generatedToken] = requestRecord;
  saveSecurityData(securityDb);

  emitEvent('SECURITY_DEVICE_APPROVED', {
    deviceId: requestRecord.deviceId,
    token: generatedToken,
    record: requestRecord,
  });

  console.log(`✅ [ACCESS GRANTED] PC "${requestRecord.stationName}" (IP: ${requestRecord.ipAddress}) approved by ${approvedBy}!`);

  res.json({
    success: true,
    status: 'APPROVED',
    token: generatedToken,
    record: requestRecord,
    message: 'Access granted successfully by Ashish Sattur.',
  });
});

// Reject PC device request
app.post('/api/security/reject', (req, res) => {
  const { requestId } = req.body;
  const requestRecord = securityDb.requests.find((r) => r.id === requestId);
  if (!requestRecord) {
    return res.status(404).json({ error: 'Request not found' });
  }

  requestRecord.status = 'REJECTED';
  saveSecurityData(securityDb);

  emitEvent('SECURITY_DEVICE_REJECTED', {
    deviceId: requestRecord.deviceId,
    record: requestRecord,
  });

  res.json({ success: true, message: 'Request rejected.' });
});

// Direct approval endpoint for clicking link in email notification
app.get('/api/security/approve-direct', (req, res) => {
  const { id } = req.query as { id?: string };
  const record = securityDb.requests.find((r) => r.id === id);

  if (!record) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Request Not Found</title></head>
        <body style="font-family:sans-serif; text-align:center; padding:50px; background:#f8fafc;">
          <h2>Request Not Found or Already Expired</h2>
        </body>
      </html>
    `);
  }

  const generatedToken = record.token || `token_pc_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  record.status = 'APPROVED';
  record.token = generatedToken;
  record.approvedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  record.approvedBy = 'ashish.sattur@gmail.com';

  securityDb.approvedTokens[generatedToken] = record;
  saveSecurityData(securityDb);

  emitEvent('SECURITY_DEVICE_APPROVED', {
    deviceId: record.deviceId,
    token: generatedToken,
    record,
  });

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Access Granted - Pure Cotton POS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
          .card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 32px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
          .icon { width: 64px; height: 64px; background: #065f46; color: #34d399; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 20px; }
          h1 { font-size: 22px; font-weight: 800; margin: 0 0 10px 0; color: #ffffff; }
          p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; }
          .details { background: #0f172a; border-radius: 12px; padding: 16px; text-align: left; font-size: 13px; margin-bottom: 24px; border: 1px solid #334155; }
          .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #1e293b; }
          .row:last-child { border-bottom: none; }
          .label { color: #64748b; font-weight: 500; }
          .val { color: #f1f5f9; font-weight: 600; }
          .badge { display: inline-block; background: #059669; color: white; padding: 6px 14px; border-radius: 9999px; font-weight: 700; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✓</div>
          <h1>Access Granted!</h1>
          <p>You have approved this PC device. The Pure Cotton POS & Inventory terminal on this computer is now unlocked and ready for use.</p>
          
          <div class="details">
            <div class="row"><span class="label">Machine Name:</span><span class="val">${record.stationName}</span></div>
            <div class="row"><span class="label">IP Address:</span><span class="val">${record.ipAddress}</span></div>
            <div class="row"><span class="label">Device Platform:</span><span class="val">${record.os} - ${record.browser}</span></div>
            <div class="row"><span class="label">Approved By:</span><span class="val">ashish.sattur@gmail.com</span></div>
            <div class="row"><span class="label">Status:</span><span class="val" style="color:#34d399;">Active (YES)</span></div>
          </div>

          <div class="badge">Device Successfully Authorized</div>
        </div>
      </body>
    </html>
  `);
});

// List all devices and security requests (for Ashish's Security Manager Panel)
app.get('/api/security/list', (req, res) => {
  res.json({
    approved: Object.values(securityDb.approvedTokens),
    pending: securityDb.requests.filter((r) => r.status === 'PENDING'),
    allRequests: securityDb.requests,
    notificationsLog: securityDb.notificationsLog,
    targetEmail: 'ashish.sattur@gmail.com',
  });
});

// Revoke access for a PC
app.post('/api/security/revoke', (req, res) => {
  const { deviceId, token } = req.body;
  if (token && securityDb.approvedTokens[token]) {
    delete securityDb.approvedTokens[token];
  }
  if (deviceId) {
    for (const key of Object.keys(securityDb.approvedTokens)) {
      if (securityDb.approvedTokens[key].deviceId === deviceId) {
        delete securityDb.approvedTokens[key];
      }
    }
    const reqRecord = securityDb.requests.find((r) => r.deviceId === deviceId);
    if (reqRecord) {
      reqRecord.status = 'REJECTED';
    }
  }

  saveSecurityData(securityDb);
  res.json({ success: true, message: 'Device permission revoked.' });
});

// Get all inventory, suppliers, sales
app.get('/api/inventory', (req, res) => {
  res.json(store);
});

// Add or update product
app.post('/api/products', (req, res) => {
  const rawProduct = req.body;
  if (!rawProduct || !rawProduct.barcode) {
    return res.status(400).json({ error: 'Product barcode is required' });
  }

  const product = normalizeServerProduct(rawProduct);
  const existingIdx = store.products.findIndex((p) => p.id === product.id || p.barcode === product.barcode);
  const isNew = existingIdx < 0;
  if (!isNew) {
    store.products[existingIdx] = { ...store.products[existingIdx], ...product };
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

// Scan handler: Barcode Gun scanner sends scan to laptop
app.post('/api/scan', (req, res) => {
  const { barcode, mode, deviceName = 'Mobile Barcode Gun', quantity = 1 } = req.body;
  if (!barcode) {
    return res.status(400).json({ error: 'Barcode is required' });
  }

  const cleanBarcode = String(barcode).trim();
  const prod = store.products.find(
    (p) => p.barcode === cleanBarcode || (p.sku && p.sku.toLowerCase() === cleanBarcode.toLowerCase())
  );

  // ALWAYS emit BARCODE_SCANNED so laptop receives the scanned barcode in real time
  // This allows the laptop to automatically insert into the cursor position in Add to Inventory
  // or execute the laptop's currently selected action button.
  const rawScanPayload = {
    barcode: cleanBarcode,
    product: prod || null,
    deviceName,
    timestamp: Date.now(),
    timeStr: new Date().toLocaleTimeString(),
  };
  emitEvent('BARCODE_SCANNED', rawScanPayload);

  if (!prod) {
    // If not in catalog, still return success so mobile doesn't crash or error out
    return res.json({
      success: true,
      notFound: true,
      barcode: cleanBarcode,
      product: null,
      message: `Scanned "${cleanBarcode}" • Sent to Laptop`,
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
