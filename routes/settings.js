const express = require('express');
const db      = require('../database');
const { requireAuth } = require('../middleware/auth');
const upload  = require('../middleware/upload');
const router  = express.Router();

// GET /api/settings  — público (site consome)
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj  = {};
  rows.forEach(r => { obj[r.key] = r.value; });
  res.json(obj);
});

// PUT /api/settings  — protegido (admin salva)
router.put('/', requireAuth, (req, res) => {
  const updates = req.body; // { "projetos.hero.title": "...", ... }
  if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'Dados inválidos' });

  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  db.transaction(() => {
    Object.entries(updates).forEach(([k, v]) => upsert.run(k, String(v)));
  })();

  res.json({ success: true });
});

// POST /api/settings/foto — upload foto da seção Quem Somos
router.post('/foto', requireAuth, upload.single('foto'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  const filePath = 'uploads/' + req.file.filename;
  db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run('sobre.foto', filePath);
  res.json({ path: filePath });
});

// POST /api/settings/imagem — upload genérico de imagem de seção (key no body)
router.post('/imagem', requireAuth, upload.single('imagem'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  const key = req.body.key;
  if (!key) return res.status(400).json({ error: 'key obrigatória' });
  const filePath = 'uploads/' + req.file.filename;
  db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .run(key, filePath);
  res.json({ path: filePath });
});

module.exports = router;
