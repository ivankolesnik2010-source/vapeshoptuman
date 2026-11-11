const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Мінімальне читання .env (без додаткових залежностей)
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach((l) => {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) { /* .env може бути відсутнім у production */ }

const PORT = process.env.PORT || 3000;
const PASS = process.env.ADMIN_PASSWORD;
const SECRET = process.env.SESSION_SECRET;
if (!PASS || !SECRET) {
  console.error('Задайте ADMIN_PASSWORD і SESSION_SECRET у файлі .env (див. .env.example)');
  process.exit(1);
}

const express = require('express');
const multer = require('multer');
const Database = require('better-sqlite3');

/* ---------- База даних ---------- */
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
const db = new Database(path.join(__dirname, 'data', 'shop.db'));
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS products(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('d','l','p')),
  hue INTEGER NOT NULL DEFAULT 200,
  price INTEGER NOT NULL CHECK(price >= 0),
  description TEXT NOT NULL DEFAULT '',
  tag TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL,
  items TEXT NOT NULL,
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);

if (db.prepare('SELECT COUNT(*) AS n FROM products').get().n === 0) {
  const ins = db.prepare('INSERT INTO products(name,type,hue,price,description,tag) VALUES (?,?,?,?,?,?)');
  [
    ['Під-система «Димок S»', 'd', 265, 1290, 'Компактна, 1000 мА·год, USB-C', 'Хіт'],
    ['Під-система «Димок Pro»', 'd', 335, 1890, 'Регулювання потужності, 1500 мА·год', ''],
    ['Стартовий набір «М’ята»', 'd', 175, 1590, 'Пристрій, картридж і рідина', 'Набір'],
    ['Рідина «Лісові ягоди»', 'l', 300, 290, '30 мл, 20 мг/мл, ягідний мікс', ''],
    ['Рідина «Холодний кавун»', 'l', 350, 290, '30 мл, 20 мг/мл, з прохолодою', 'Новинка'],
    ['Рідина «Тютюн і горіх»', 'l', 35, 310, '30 мл, 20 мг/мл, м’який тютюновий', ''],
    ['Картриджі «Димок», 3 шт.', 'p', 210, 420, 'Сумісні з серією «Димок»', ''],
    ['Випарники 0,8 Ом, 5 шт.', 'p', 20, 380, 'Змінні, для Pro та S', ''],
    ['Кабель USB-C', 'p', 240, 120, '1 м, швидка зарядка', ''],
  ].forEach((r) => ins.run(...r));
}

/* ---------- Допоміжне ---------- */
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('hex');
const sha = (v) => crypto.createHash('sha256').update(String(v)).digest();
const makeToken = () => { const exp = String(Date.now() + 7 * 864e5); return exp + '.' + sign(exp); };
function okToken(t) {
  if (!t) return false;
  const [exp, sig] = t.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function cookies(req) {
  return Object.fromEntries((req.headers.cookie || '').split(';')
    .map((c) => c.trim().split(/=(.*)/s).slice(0, 2)).filter((a) => a[0]));
}
function requireAdmin(req, res, next) {
  if (okToken(cookies(req).admin)) return next();
  res.status(401).json({ error: 'Потрібен вхід' });
}
function limiter(max, ms) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const arr = (hits.get(req.ip) || []).filter((t) => now - t < ms);
    if (arr.length >= max) return res.status(429).json({ error: 'Забагато спроб. Спробуйте пізніше.' });
    arr.push(now); hits.set(req.ip, arr); next();
  };
}

const IMG_RE = /^\/uploads\/[a-f0-9]{16,}\.(jpg|png|webp)$/;
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const upDir = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(upDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: upDir,
    filename: (r, f, cb) => cb(null, crypto.randomBytes(12).toString('hex') + '.' + EXT[f.mimetype]),
  }),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: (r, f, cb) => cb(null, !!EXT[f.mimetype]),
});
const dropImage = (url) => { if (IMG_RE.test(url || '')) fs.unlink(path.join(upDir, path.basename(url)), () => {}); };

function clean(b) {
  const name = String(b.name || '').trim().slice(0, 80);
  const price = Math.round(Number(b.price));
  const hue = Math.round(Number(b.hue));
  const type = String(b.type);
  const image = String(b.image || '');
  if (!name || !(price >= 0 && price <= 1e6) || !['d', 'l', 'p'].includes(type)) return null;
  if (image && !IMG_RE.test(image)) return null;
  return {
    name, type, price, image,
    hue: hue >= 0 && hue <= 360 ? hue : 200,
    description: String(b.description || '').trim().slice(0, 200),
    tag: String(b.tag || '').trim().slice(0, 20),
    active: b.active === false || b.active === 0 ? 0 : 1,
  };
}

/* ---------- Сервер ---------- */
const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; frame-ancestors 'none'",
  });
  next();
});
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

/* --- Публічне API --- */
app.get('/api/products', (req, res) => {
  res.json(db.prepare('SELECT id,name,type,hue,price,description,tag,image FROM products WHERE active=1 ORDER BY id').all());
});

app.post('/api/orders', limiter(10, 3600e3), (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  const phone = String(b.phone || '').trim();
  const city = String(b.city || '').trim();
  const digits = phone.replace(/\D/g, '');
  if (b.age !== true) return res.status(400).json({ error: 'Замовлення можливе лише з 18 років.' });
  if (name.length < 2 || name.length > 60 || digits.length < 10 || digits.length > 13 || city.length < 3 || city.length > 120)
    return res.status(400).json({ error: 'Перевірте ім’я, телефон і місто з відділенням.' });
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > 30)
    return res.status(400).json({ error: 'Кошик порожній.' });

  const get = db.prepare('SELECT id,name,price FROM products WHERE id=? AND active=1');
  const lines = [];
  for (const it of b.items) {
    const id = Number(it.id), qty = Number(it.qty);
    const p = Number.isInteger(id) ? get.get(id) : null;
    if (!p || !Number.isInteger(qty) || qty < 1 || qty > 20)
      return res.status(409).json({ error: 'Деякі товари вже недоступні. Оновіть сторінку.' });
    lines.push({ id: p.id, name: p.name, price: p.price, qty });
  }
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const r = db.prepare('INSERT INTO orders(name,phone,city,items,total) VALUES (?,?,?,?,?)')
    .run(name, phone.slice(0, 30), city, JSON.stringify(lines), total);
  res.json({ id: r.lastInsertRowid });
});

/* --- Адмін-API --- */
app.post('/api/admin/login', limiter(8, 15 * 60e3), (req, res) => {
  const ok = crypto.timingSafeEqual(sha(req.body && req.body.password), sha(PASS));
  if (!ok) return res.status(401).json({ error: 'Невірний пароль' });
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.set('Set-Cookie', `admin=${makeToken()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure}`);
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => {
  res.set('Set-Cookie', 'admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ ok: true });
});

app.use('/api/admin', requireAdmin);

app.get('/api/admin/products', (req, res) => {
  res.json(db.prepare('SELECT * FROM products ORDER BY id DESC').all());
});
app.post('/api/admin/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Дозволені лише JPG, PNG або WebP до 3 МБ.' });
  res.json({ url: '/uploads/' + req.file.filename });
});
app.post('/api/admin/products', (req, res) => {
  const p = clean(req.body || {});
  if (!p) return res.status(400).json({ error: 'Вкажіть назву, тип і ціну.' });
  const r = db.prepare('INSERT INTO products(name,type,hue,price,description,tag,image,active) VALUES (@name,@type,@hue,@price,@description,@tag,@image,@active)').run(p);
  res.json({ id: r.lastInsertRowid });
});
app.put('/api/admin/products/:id', (req, res) => {
  const old = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  const p = clean(req.body || {});
  if (!old) return res.status(404).json({ error: 'Товар не знайдено' });
  if (!p) return res.status(400).json({ error: 'Вкажіть назву, тип і ціну.' });
  db.prepare('UPDATE products SET name=@name,type=@type,hue=@hue,price=@price,description=@description,tag=@tag,image=@image,active=@active WHERE id=@id').run({ ...p, id: old.id });
  if (old.image && old.image !== p.image) dropImage(old.image);
  res.json({ ok: true });
});
app.delete('/api/admin/products/:id', (req, res) => {
  const old = db.prepare('SELECT image FROM products WHERE id=?').get(req.params.id);
  if (!old) return res.status(404).json({ error: 'Товар не знайдено' });
  db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  dropImage(old.image);
  res.json({ ok: true });
});
app.get('/api/admin/orders', (req, res) => {
  const rows = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 200').all();
  res.json(rows.map((o) => ({ ...o, items: JSON.parse(o.items) })));
});
app.patch('/api/admin/orders/:id', (req, res) => {
  const st = String((req.body || {}).status);
  if (!['new', 'confirmed', 'shipped', 'done', 'cancelled'].includes(st)) return res.status(400).json({ error: 'Невірний статус' });
  db.prepare('UPDATE orders SET status=? WHERE id=?').run(st, req.params.id);
  res.json({ ok: true });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Не знайдено' }));
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) return res.status(400).json({ error: 'Файл завеликий (максимум 3 МБ).' });
  console.error(err);
  res.status(500).json({ error: 'Помилка сервера' });
});

app.listen(PORT, () => console.log(`Магазин: http://localhost:${PORT}   Адмінка: http://localhost:${PORT}/admin`));
