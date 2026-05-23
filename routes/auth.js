const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../database');
const router  = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Email ou senha incorretos' });
  }

  req.session.userId = user.id;
  req.session.name   = user.name;
  req.session.email  = user.email;
  req.session.role   = user.role;

  res.json({ success: true, name: user.name, role: user.role });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Não autenticado' });
  res.json({ id: req.session.userId, name: req.session.name, email: req.session.email, role: req.session.role });
});

module.exports = router;
