const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const router   = express.Router();
const db       = require('../database');
const { requireAuth }  = require('../middleware/auth');
const upload   = require('../middleware/upload');

const UPLOADS = path.join(__dirname, '..', 'uploads');

function withImages(project) {
  const images = db.prepare('SELECT * FROM project_images WHERE project_id = ? ORDER BY id').all(project.id);
  return { ...project, images };
}

// ── PUBLIC ─────────────────────────────────────────────

// GET /api/projects
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all();
  res.json(rows.map(withImages));
});

// GET /api/projects/:id
router.get('/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Projeto não encontrado' });
  res.json(withImages(p));
});

// ── PROTECTED ──────────────────────────────────────────

// POST /api/projects
router.post('/', requireAuth, upload.array('images', 20), (req, res) => {
  const { name, description, category, year, featured_image } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

  const id = db.transaction(() => {
    const info = db.prepare(
      'INSERT INTO projects (name, description, category, year, featured_image) VALUES (?,?,?,?,?)'
    ).run(name, description || '', category || '', year || '', featured_image || '');
    (req.files || []).forEach(f =>
      db.prepare('INSERT INTO project_images (project_id, filename) VALUES (?,?)').run(info.lastInsertRowid, f.filename)
    );
    return info.lastInsertRowid;
  })();

  res.status(201).json(withImages(db.prepare('SELECT * FROM projects WHERE id = ?').get(id)));
});

// PUT /api/projects/:id
router.put('/:id', requireAuth, upload.array('images', 20), (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Projeto não encontrado' });

  const { name, description, category, year, featured_image, remove_images } = req.body;

  db.transaction(() => {
    db.prepare('UPDATE projects SET name=?,description=?,category=?,year=?,featured_image=? WHERE id=?').run(
      name           ?? p.name,
      description    ?? p.description,
      category       ?? p.category,
      year           ?? p.year,
      featured_image ?? p.featured_image,
      p.id
    );

    const toRemove = remove_images
      ? (Array.isArray(remove_images) ? remove_images : [remove_images])
      : [];
    toRemove.forEach(imgId => {
      const img = db.prepare('SELECT * FROM project_images WHERE id = ?').get(imgId);
      if (img?.project_id === p.id) {
        const fp = path.join(UPLOADS, img.filename);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
        db.prepare('DELETE FROM project_images WHERE id = ?').run(imgId);
      }
    });

    (req.files || []).forEach(f =>
      db.prepare('INSERT INTO project_images (project_id, filename) VALUES (?,?)').run(p.id, f.filename)
    );
  })();

  res.json(withImages(db.prepare('SELECT * FROM projects WHERE id = ?').get(p.id)));
});

// DELETE /api/projects/:id
router.delete('/:id', requireAuth, (req, res) => {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Projeto não encontrado' });

  db.prepare('SELECT * FROM project_images WHERE project_id = ?').all(p.id).forEach(img => {
    const fp = path.join(UPLOADS, img.filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  });
  db.prepare('DELETE FROM projects WHERE id = ?').run(p.id);
  res.json({ success: true });
});

// POST /api/projects/:id/featured
router.post('/:id/featured', requireAuth, (req, res) => {
  db.prepare('UPDATE projects SET featured_image = ? WHERE id = ?').run(req.body.featured_image, req.params.id);
  res.json({ success: true });
});

module.exports = router;
