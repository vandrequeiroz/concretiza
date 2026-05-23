/**
 * seed-projects.js
 * Popula o banco com os 6 projetos de exemplo.
 * Execute uma vez: node seed-projects.js
 */
const fs   = require('fs');
const path = require('path');
const db   = require('./database');

const GALLERY = path.join(__dirname, 'imagens', 'galeria');
const UPLOADS = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS);

// copia arquivo e retorna novo filename em uploads/
function copyToUploads(src) {
  const ext  = path.extname(src);
  const name = Date.now() + '-' + Math.round(Math.random() * 1e6) + ext;
  fs.copyFileSync(path.join(GALLERY, src), path.join(UPLOADS, name));
  return name;
}

const G = [
  'pexels-xt7core-20041659.jpg',
  'pexels-chris-r-2147603956-31039719.jpg',
  'pexels-1460648-3172740.jpg',
  'pexels-sajidulbari-mahmud-2152953116-32863067.jpg',
  'pexels-froydd97-33820662.jpg',
  'pexels-the-ghazi-2152398165-32177952.jpg',
];

function rotated(start) {
  return [0, 1, 2, 3].map(k => G[(start + k) % G.length]);
}

const PROJECTS = [
  {
    name:        'Comerciais e Residenciais',
    description: 'Projetos e execuções de obras comerciais e residenciais em São Roque e região, com foco em qualidade técnica e acabamento diferenciado. A Concretiza atua desde a aprovação do projeto na prefeitura até a entrega das chaves.',
    category:    'Residencial',
    year:        '2022',
    imgs:        rotated(0),
    featured:    0,
  },
  {
    name:        'Indústria em Mairinque',
    description: 'Construção de complexo industrial em Mairinque/SP com estrutura metálica, piso industrial de alta resistência e instalações elétricas e hidráulicas completas. Prazo de execução de 14 meses.',
    category:    'Industrial',
    year:        '2021',
    imgs:        rotated(1),
    featured:    0,
  },
  {
    name:        'Três Lagoas — MT',
    description: 'Projeto e execução de obras em Três Lagoas, Mato Grosso, demonstrando a capacidade da Concretiza em atuar em diferentes regiões do Brasil com o mesmo padrão de qualidade.',
    category:    'Comercial',
    year:        '2020',
    imgs:        rotated(2),
    featured:    0,
  },
  {
    name:        'Edifício Comercial São Roque',
    description: 'Desenvolvimento completo de edifício comercial de múltiplos andares no centro de São Roque/SP — do projeto arquitetônico e estrutural à entrega das chaves, com 12 salas comerciais e subsolo de estacionamento.',
    category:    'Comercial',
    year:        '2023',
    imgs:        rotated(3),
    featured:    0,
  },
  {
    name:        'Residência de Alto Padrão',
    description: 'Projeto arquitetônico e execução de residência de alto padrão em condomínio fechado, com acabamentos nobres, automação residencial e integração paisagística. Área construída de 480 m².',
    category:    'Residencial',
    year:        '2024',
    imgs:        rotated(4),
    featured:    0,
  },
  {
    name:        'Portfólio de Obras Diversas',
    description: 'Seleção de obras variadas realizadas pela equipe Concretiza ao longo dos anos — reformas, ampliações, construções de médio porte e projetos de infraestrutura urbana em São Roque e região.',
    category:    'Infraestrutura',
    year:        '2019',
    imgs:        rotated(5),
    featured:    0,
  },
];

const existing = db.prepare('SELECT COUNT(*) as c FROM projects').get().c;
if (existing > 0) {
  console.log(`Banco já possui ${existing} projeto(s). Seed ignorado.`);
  process.exit(0);
}

const insertProject = db.prepare(
  'INSERT INTO projects (name, description, category, year, featured_image) VALUES (?, ?, ?, ?, ?)'
);
const insertImage = db.prepare('INSERT INTO project_images (project_id, filename) VALUES (?, ?)');

db.transaction(() => {
  PROJECTS.forEach(p => {
    const copiedFiles = p.imgs.map(copyToUploads);
    const featured    = copiedFiles[0];
    const info = insertProject.run(p.name, p.description, p.category, p.year, featured);
    copiedFiles.forEach(fn => insertImage.run(info.lastInsertRowid, fn));
    console.log(`  ✓ ${p.name}`);
  });
})();

console.log('\nSeed concluído — 6 projetos criados.\n');
