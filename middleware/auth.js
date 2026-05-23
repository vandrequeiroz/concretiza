function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  res.redirect('/login.html');
}

function requireSuperAdmin(req, res, next) {
  if (req.session?.role === 'superadmin') return next();
  res.status(403).json({ error: 'Acesso negado' });
}

module.exports = { requireAuth, requireSuperAdmin };
