const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", "'unsafe-inline'"], styleSrc: ["'self'", "'unsafe-inline'", "https:"], imgSrc: ["'self'", "data:"], fontSrc: ["'self'", "https:", "data:"], formAction: ["'self'"], frameAncestors: ["'self'"], upgradeInsecureRequests: [] } } }));
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/uploads', express.static(path.join(__dirname, 'data', 'uploads')));

const storage = multer.diskStorage({
  destination: path.join(__dirname, 'data', 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato não permitido. Use JPEG, PNG, WebP ou GIF.'));
    }
  }
});

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const adminTokens = new Set();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' }
});

function initDB() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const uploadDir = path.join(dir, 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    const defaultPassword = ADMIN_PASSWORD || 'admin123';
    fs.writeFileSync(DB_PATH, JSON.stringify({
      products: [], categories: [], orders: [],
      storeSettings: {
        name: "Padaria Dona Arte", cnpj: "", whatsapp: "", phone: "",
        address: "", description: "Pão com alma, feito com amor.",
        pixKey: "", pixName: "", pixBank: "",
        adminPassword: defaultPassword, deliveryFee: 5, minOrder: 15, freeDeliveryFrom: 40, deliveryRadius: 5
      },
      horarios: [
        { day: 'Segunda', open: '06:00', close: '19:00', active: true },
        { day: 'Terça', open: '06:00', close: '19:00', active: true },
        { day: 'Quarta', open: '06:00', close: '19:00', active: true },
        { day: 'Quinta', open: '06:00', close: '19:00', active: true },
        { day: 'Sexta', open: '06:00', close: '19:00', active: true },
        { day: 'Sábado', open: '06:00', close: '14:00', active: true },
        { day: 'Domingo', open: '06:00', close: '12:00', active: false }
      ],
      orderCounter: 1000
    }, null, 2));
  }
}
initDB();

function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function sanitizeSettings(settings) {
  const s = { ...settings };
  delete s.adminPassword;
  return s;
}

function validate(input, fields) {
  for (const f of fields) {
    if (f.required && (input[f.name] === undefined || input[f.name] === null || input[f.name] === '')) {
      return `Campo '${f.name}' é obrigatório`;
    }
    if (input[f.name] !== undefined && f.type === 'number' && (typeof input[f.name] !== 'number' || isNaN(input[f.name]))) {
      return `Campo '${f.name}' deve ser um número`;
    }
    if (input[f.name] !== undefined && f.type === 'string' && typeof input[f.name] !== 'string') {
      return `Campo '${f.name}' deve ser texto`;
    }
    if (input[f.name] !== undefined && f.maxLength && typeof input[f.name] === 'string' && input[f.name].length > f.maxLength) {
      return `Campo '${f.name}' excede ${f.maxLength} caracteres`;
    }
  }
  return null;
}

// ============ ADMIN AUTH ============

app.post('/api/admin/login', loginLimiter, (req, res) => {
  const db = readDB();
  const expected = ADMIN_PASSWORD || db.storeSettings.adminPassword;
  if (req.body.password === expected) {
    const token = crypto.randomUUID();
    adminTokens.add(token);
    res.json({ token, success: true });
  } else {
    res.status(401).json({ error: 'Senha incorreta' });
  }
});

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || !adminTokens.has(token)) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
}

// Protege endpoints do admin
app.get('/api/orders', requireAdmin);
app.get('/api/stats', requireAdmin);
app.post('/api/products', requireAdmin);
app.put('/api/products/:id', requireAdmin);
app.delete('/api/products/:id', requireAdmin);
app.patch('/api/products/:id/toggle', requireAdmin);
app.post('/api/categories', requireAdmin);
app.put('/api/categories/:index', requireAdmin);
app.delete('/api/categories/:index', requireAdmin);
app.patch('/api/orders/:id/status', requireAdmin);
app.delete('/api/orders/:id', requireAdmin);
app.put('/api/settings', requireAdmin);
app.put('/api/horarios', requireAdmin);
app.post('/api/upload', requireAdmin);

// ============ PRODUTOS ============

app.get('/api/products', (req, res) => {
  const db = readDB();
  res.json(db.products);
});

app.post('/api/products', (req, res) => {
  const error = validate(req.body, [
    { name: 'name', type: 'string', required: true, maxLength: 100 },
    { name: 'price', type: 'number', required: true }
  ]);
  if (error) return res.status(400).json({ error });
  const db = readDB();
  const maxId = db.products.reduce((max, p) => Math.max(max, p.id), 0);
  const product = { id: maxId + 1, name: req.body.name, cat: req.body.cat || '', emoji: req.body.emoji || '🍞', desc: req.body.desc || '', price: req.body.price, unit: req.body.unit || 'unidade', badge: req.body.badge || undefined, image: req.body.image || undefined, available: true };
  db.products.push(product);
  writeDB(db);
  res.json(product);
});

app.put('/api/products/:id', (req, res) => {
  const error = validate(req.body, [
    { name: 'name', type: 'string', maxLength: 100 },
    { name: 'price', type: 'number' }
  ]);
  if (error) return res.status(400).json({ error });
  const db = readDB();
  const idx = db.products.findIndex(p => p.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Produto não encontrado' });
  db.products[idx] = { ...db.products[idx], ...req.body, id: db.products[idx].id };
  writeDB(db);
  res.json(db.products[idx]);
});

app.delete('/api/products/:id', (req, res) => {
  const db = readDB();
  db.products = db.products.filter(p => p.id != req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

app.patch('/api/products/:id/toggle', (req, res) => {
  const db = readDB();
  const p = db.products.find(x => x.id == req.params.id);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado' });
  p.available = !p.available;
  writeDB(db);
  res.json(p);
});

// ============ CATEGORIAS ============

app.get('/api/categories', (req, res) => {
  const db = readDB();
  res.json(db.categories);
});

app.post('/api/categories', (req, res) => {
  const db = readDB();
  db.categories.push(req.body.name);
  writeDB(db);
  res.json(db.categories);
});

app.put('/api/categories/:index', (req, res) => {
  const db = readDB();
  db.categories[req.params.index] = req.body.name;
  writeDB(db);
  res.json(db.categories);
});

app.delete('/api/categories/:index', (req, res) => {
  const db = readDB();
  db.categories.splice(req.params.index, 1);
  writeDB(db);
  res.json(db.categories);
});

// ============ PEDIDOS ============

app.get('/api/orders', (req, res) => {
  const db = readDB();
  res.json(db.orders);
});

app.post('/api/orders', (req, res) => {
  const error = validate(req.body, [
    { name: 'client', type: 'string', required: true, maxLength: 100 },
    { name: 'phone', type: 'string', required: true, maxLength: 20 },
    { name: 'address', type: 'string', maxLength: 300 },
    { name: 'type', type: 'string', maxLength: 50 },
    { name: 'pay', type: 'string', maxLength: 50 },
    { name: 'total', type: 'number', required: true },
    { name: 'obs', type: 'string', maxLength: 500 }
  ]);
  if (error) return res.status(400).json({ error });

  const db = readDB();
  const now = new Date();
  if (!db.orderCounter) db.orderCounter = 1000;
  db.orderCounter++;
  const orderId = String(db.orderCounter);
  const order = {
    id: orderId,
    client: req.body.client,
    phone: req.body.phone,
    address: req.body.address || '',
    type: req.body.type || 'Retirada',
    items: req.body.items || [],
    pay: req.body.pay || '',
    total: req.body.total,
    obs: req.body.obs || '',
    status: 'pending',
    time: now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0'),
    createdAt: now.toISOString()
  };
  db.orders.unshift(order);
  writeDB(db);
  res.json(order);
});

app.patch('/api/orders/:id/status', (req, res) => {
  const db = readDB();
  const o = db.orders.find(x => x.id == req.params.id);
  if (!o) return res.status(404).json({ error: 'Pedido não encontrado' });
  o.status = req.body.status;
  writeDB(db);
  res.json(o);
});

app.delete('/api/orders/:id', (req, res) => {
  const db = readDB();
  db.orders = db.orders.filter(o => o.id != req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

// ============ LOJA ============

app.get('/api/settings', (req, res) => {
  const db = readDB();
  res.json(sanitizeSettings(db.storeSettings));
});

app.put('/api/settings', (req, res) => {
  const error = validate(req.body, [
    { name: 'name', type: 'string', maxLength: 100 },
    { name: 'whatsapp', type: 'string', maxLength: 20 },
    { name: 'deliveryFee', type: 'number' },
    { name: 'minOrder', type: 'number' },
    { name: 'freeDeliveryFrom', type: 'number' },
    { name: 'deliveryRadius', type: 'number' }
  ]);
  if (error) return res.status(400).json({ error });
  const db = readDB();
  db.storeSettings = { ...db.storeSettings, ...req.body };
  writeDB(db);
  res.json(sanitizeSettings(db.storeSettings));
});

app.get('/api/horarios', (req, res) => {
  const db = readDB();
  res.json(db.horarios);
});

app.put('/api/horarios', (req, res) => {
  const db = readDB();
  db.horarios = req.body;
  writeDB(db);
  res.json(db.horarios);
});

// ============ UPLOAD ============

app.post('/api/upload', (req, res) => {
  upload.single('foto')(req, res, (err) => {
    if (err) return res.status(400).json({ error: 'Erro no upload: ' + err.message });
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    res.json({ url: '/uploads/' + req.file.filename });
  });
});

// ============ ESTATÍSTICAS ============

app.get('/api/stats', (req, res) => {
  const db = readDB();
  const today = db.orders;
  const total = today.reduce((s, o) => s + o.total, 0);
  const waiting = today.filter(o => o.status !== 'delivered').length;
  const counts = {};
  today.forEach(o => o.items.forEach(i => counts[i.name] = (counts[i.name]||0) + i.qty));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  res.json({
    totalOrders: today.length,
    totalRevenue: total,
    waitingOrders: waiting,
    topProduct: top ? top[0] : null
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  🥖 Padaria Dona Arte rodando em:`);
  console.log(`  📍 Site público: http://localhost:${PORT}`);
  console.log(`  🔧 Painel admin: http://localhost:${PORT}/admin`);
  console.log(`  📡 API:          http://localhost:${PORT}/api\n`);
});
