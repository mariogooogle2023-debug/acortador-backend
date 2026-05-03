const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const nanoid = require('nanoid').nanoid;
const Database = require('better-sqlite3');

const app = express();

// 🔥 IMPORTANTE PARA RENDER
app.set('trust proxy', 1);

const db = new Database('db.sqlite');

app.use(express.json());

// 🔥 CORS MANUAL
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://acortador.odoo.com");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// 🔥 SESSION CORREGIDA
app.use(session({
  name: "acortador_session", // 👈 clave
  secret: 'acortador_secret',
  resave: false,
  saveUninitialized: false,
  proxy: true, // 👈 CLAVE PARA RENDER
  cookie: {
    secure: true,
    sameSite: 'none',
    httpOnly: true
  }
}));

// TEST
app.get('/test', (req, res) => {
  res.send('TEST OK');
});

// ROOT
app.get('/', (req, res) => {
  res.send('Backend funcionando 🚀');
});

// DB
db.prepare(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  short TEXT,
  original TEXT,
  user_id INTEGER
)
`).run();

// REGISTER
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);

  try {
    db.prepare(
      `INSERT INTO users (username, password) VALUES (?, ?)`
    ).run(username, hash);

    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: 'Usuario ya existe' });
  }
});

// LOGIN
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const user = db.prepare(
    `SELECT * FROM users WHERE username = ?`
  ).get(username);

  if (!user) return res.status(400).json({ error: 'No existe' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(400).json({ error: 'Incorrecto' });

  req.session.userId = user.id;

  // 🔥 FORZAR GUARDADO DE SESIÓN
  req.session.save(() => {
    res.json({ ok: true });
  });
});

// SHORTEN
app.post('/shorten', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'No login' });
  }

  const { url } = req.body;
  const short = nanoid(6);

  db.prepare(
    `INSERT INTO links (short, original, user_id) VALUES (?, ?, ?)`
  ).run(short, url, req.session.userId);

  res.json({
    shortUrl: `${req.protocol}://${req.get('host')}/${short}`
  });
});

// REDIRECT
app.get('/:code', (req, res) => {
  const row = db.prepare(
    `SELECT original FROM links WHERE short = ?`
  ).get(req.params.code);

  if (!row) return res.send('No existe');

  res.redirect(row.original);
});

// PORT
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('Servidor corriendo en puerto ' + PORT);
});