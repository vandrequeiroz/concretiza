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
  'projetos.hero.title':    'Nossos Projetos',
  'projetos.hero.subtitle': 'Conheça o portfólio completo da Concretiza Engenharia — projetos residenciais, comerciais, industriais e muito mais.',
  // Quem Somos
  'sobre.titulo':  'Sobre a Concretiza',
  'sobre.p1':      'Empresa fundada em 2005, atua na área da construção civil, industrial, comercial e residencial. Busca constantemente a realização de trabalhos de alta qualidade de modo a superar as expectativas de nossos clientes e parceiros de negócios.',
  'sobre.p2':      'Atendemos com soluções confiáveis desde a geração de desenhos, especificações técnicas e lista de materiais até informações precisas das etapas do empreendimento.',
  'sobre.p3':      'A CONCRETIZA tem a constante preocupação em manter sua equipe treinada e estruturada, buscando inovações e tecnologia para oferecer excelência em sua prestação de serviços.',
  'sobre.stat1.n': '+19',  'sobre.stat1.l': 'Anos de Mercado',
  'sobre.stat2.n': '+100', 'sobre.stat2.l': 'Projetos Entregues',
  'sobre.stat3.n': '4',    'sobre.stat3.l': 'Áreas de Atuação',
  'sobre.stat4.n': '100%', 'sobre.stat4.l': 'Comprometimento',
  'sobre.foto':    'imagens/concre_escritorio.jpg',
  // Contato
  'contato.telefone':        '(11) 4712-8099',
  'contato.telefone.label':  'Telefone Fixo — Seg a Sex, 8h às 18h',
  'contato.whatsapp':        '(11) 9 6375-4627',
  'contato.whatsapp.label':  'WhatsApp — Atendimento rápido',
  'contato.whatsapp.numero': '5511963754627',
  'contato.whatsapp.msg':    'Olá! Gostaria de solicitar um orçamento.',
  'contato.email':           'projetos@concretizaengenharia.com.br',
  'contato.email.label':     'Respondemos em até 24h',
  'contato.endereco':        'Praça da República, 189 — Centro',
  'contato.endereco.label':  'São Roque/SP — Visitas com agendamento',
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
