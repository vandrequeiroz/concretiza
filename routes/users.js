const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../database');
const { requireSuperAdmin } = require('../middleware/auth');
const router  = express.Router();

// GET /api/users
router.get('/', (req, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

// POST /api/users
router.post('/', requireSuperAdmin, (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (exists) return res.status(409).json({ error: 'Este email já está cadastrado' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(
    name.trim(), email.trim().toLowerCase(), hash, role || 'admin'
  );
  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(user);
});

// PUT /api/users/:id
router.put('/:id', requireSuperAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  const { name, email, password, role } = req.body;

  if (email && email !== user.email) {
    const exists = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.trim().toLowerCase(), user.id);
    if (exists) return res.status(409).json({ error: 'Este email já está em uso' });
  }

  const newHash = password ? bcrypt.hashSync(password, 10) : user.password;
  db.prepare('UPDATE users SET name=?, email=?, password=?, role=? WHERE id=?').run(
    name    || user.name,
    email   ? email.trim().toLowerCase() : user.email,
    newHash,
    role    || user.role,
    user.id
  );

  const updated = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(user.id);
  res.json(updated);
});

// DELETE /api/users/:id
router.delete('/:id', requireSuperAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  const total = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (total <= 1) return res.status(400).json({ error: 'Não é possível excluir o único usuário' });

  db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
  res.json({ success: true });
});

module.exports = router;
