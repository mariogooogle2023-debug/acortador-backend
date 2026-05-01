const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { nanoid } = require('nanoid');

const app = express();
const db = new sqlite3.Database('./db.sqlite');

app.use(express.json());

// ⚠️ En producción puedes cambiar esto a tu dominio real
app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(session({
  secret: 'acortador_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    sameSite: 'lax'
  }
}));
app.get('/test', (req, res) => {
  res.send('TEST OK');
});
// 🧠 BASE DE DATOS
db.run(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  password TEXT
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  short TEXT,
  original TEXT,
  user_id INTEGER
)
`);

// 👤 REGISTRO
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  const hash = await bcrypt.hash(password, 10);

  db.run(
    `INSERT INTO users (username, password) VALUES (?, ?)`,
    [username, hash],
    (err) => {
      if (err) return res.status(400).json({ error: 'Usuario ya existe' });
      res.json({ ok: true });
    }
  );
});

// 🔐 LOGIN
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get(
    `SELECT * FROM users WHERE username = ?`,
    [username],
    async (err, user) => {
      if (!user) return res.status(400).json({ error: 'No existe' });

      const ok = await bcrypt.compare(password, user.password);

      if (!ok) return res.status(400).json({ error: 'Incorrecto' });

      req.session.userId = user.id;

      res.json({ ok: true });
    }
  );
});

// 🔗 ACORTAR LINK
app.post('/shorten', (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ error: 'No login' });

  const { url } = req.body;
  const short = nanoid(6);

  db.run(
    `INSERT INTO links (short, original, user_id) VALUES (?, ?, ?)`,
    [short, url, req.session.userId]
  );

  res.json({
    shortUrl: `${req.protocol}://${req.get('host')}/${short}`
  });
});

// 🔁 REDIRECCIÓN
app.get('/:code', (req, res) => {
  db.get(
    `SELECT original FROM links WHERE short = ?`,
    [req.params.code],
    (err, row) => {
      if (!row) return res.send('No existe');
      res.redirect(row.original);
    }
  );
});

// 🚀 TEST
app.get('/', (req, res) => {
  res.send('Backend funcionando 🚀');
});

// 🔥 IMPORTANTE PARA RENDER
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('Servidor corriendo en puerto ' + PORT);
});