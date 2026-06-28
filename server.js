const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: path.join(__dirname, 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const DB_PATH = path.join(__dirname, 'data', 'db.json');
const adminTokens = new Set();

function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ============ ADMIN AUTH ============

app.post('/api/admin/login', (req, res) => {
  const db = readDB();
  if (req.body.password === db.storeSettings.adminPassword) {
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

// Protege endpoints de escrita do admin
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
  const db = readDB();
  const maxId = db.products.reduce((max, p) => Math.max(max, p.id), 0);
  const product = { id: maxId + 1, ...req.body, available: true };
  db.products.push(product);
  writeDB(db);
  res.json(product);
});

app.put('/api/products/:id', (req, res) => {
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
  const db = readDB();
  const now = new Date();
  if (!db.orderCounter) db.orderCounter = 1000;
  db.orderCounter++;
  const orderId = String(db.orderCounter);
  const order = {
    id: orderId,
    ...req.body,
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
  res.json(db.storeSettings);
});

app.put('/api/settings', (req, res) => {
  const db = readDB();
  db.storeSettings = { ...db.storeSettings, ...req.body };
  writeDB(db);
  res.json(db.storeSettings);
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
