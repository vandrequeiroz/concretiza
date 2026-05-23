const Database = require('better-sqlite3');
const path     = require('path');
const bcrypt   = require('bcryptjs');

const db = new Database(path.join(__dirname, 'concretiza.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    email      TEXT    UNIQUE NOT NULL,
    password   TEXT    NOT NULL,
    role       TEXT    NOT NULL DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT    NOT NULL,
    description    TEXT,
    category       TEXT,
    year           TEXT,
    featured_image TEXT,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS project_images (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    filename   TEXT    NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// valores padrão de configurações
const defaults = {
  'projetos.hero.title': 'Nossos Projetos',
  'projetos.hero.subtitle': 'Conheça o portfólio completo da Concretiza Engenharia — projetos residenciais, comerciais, industriais e muito mais.',
};
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
Object.entries(defaults).forEach(([k, v]) => insertSetting.run(k, v));

// cria usuário admin padrão se não existir
const adminEmail = process.env.ADMIN_EMAIL || 'admin@concretiza.com.br';
const adminPass  = process.env.ADMIN_PASSWORD || 'mudar-na-primeira-vez';
const existing   = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
if (!existing) {
  const hash = bcrypt.hashSync(adminPass, 10);
  db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(
    'Administrador', adminEmail, hash, 'superadmin'
  );
  console.log(`Usuário admin criado: ${adminEmail}`);
  console.log('IMPORTANTE: altere a senha no painel de Configurações.');
}

module.exports = db;
