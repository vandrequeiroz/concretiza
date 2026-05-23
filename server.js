const express = require('express');
const session = require('express-session');
const path    = require('path');
const fs      = require('fs');

require('./database'); // inicializa tabelas e admin padrão

const { requireAuth } = require('./middleware/auth');

const app  = express();
const PORT = process.env.PORT || 3000;

const UPLOADS = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS);

// ── middleware ────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret:            process.env.SESSION_SECRET || 'dev-only-change-in-production',
  resave:            false,
  saveUninitialized: false,
  cookie:            { maxAge: 8 * 60 * 60 * 1000 }
}));

// static — serve tudo EXCETO admin.html (protegido por rota dedicada)
app.use((req, res, next) => {
  if (req.path.toLowerCase() === '/admin.html') return next();
  express.static(__dirname)(req, res, next);
});
app.use('/uploads', express.static(UPLOADS));

// ── rotas públicas ────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/projects', require('./routes/projects')); // auth tratado internamente por método

// ── rotas protegidas ──────────────────────────────────
app.get('/admin.html', requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, 'admin.html'))
);
app.use('/api/users',    requireAuth, require('./routes/users'));
app.use('/api/settings',             require('./routes/settings')); // auth tratado internamente

// Adicionar novas rotas aqui:
// app.use('/api/depoimentos', requireAuth, require('./routes/depoimentos'));

// ── start ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  Concretiza Engenharia`);
  console.log(`  Site:  http://localhost:${PORT}`);
  console.log(`  Login: http://localhost:${PORT}/login.html`);
  console.log(`  Admin: http://localhost:${PORT}/admin.html\n`);
});
