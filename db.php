<?php
function getDb() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dbPath = __DIR__ . '/concretiza.db';
    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA foreign_keys = ON');

    $pdo->exec("
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
    ");

    // admin padrão
    $adminEmail = getenv('ADMIN_EMAIL') ?: 'admin@concretiza.com.br';
    $adminPass  = getenv('ADMIN_PASSWORD') ?: 'mudar-na-primeira-vez';
    $st = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $st->execute([$adminEmail]);
    if (!$st->fetch()) {
        $hash = password_hash($adminPass, PASSWORD_BCRYPT);
        $pdo->prepare('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)')->execute(['Administrador', $adminEmail, $hash, 'superadmin']);
    }

    // settings padrão
    $defaults = [
        'projetos.hero.title'    => 'Nossos Projetos',
        'projetos.hero.subtitle' => 'Conheça o portfólio completo da Concretiza Engenharia — projetos residenciais, comerciais, industriais e muito mais.',
        // Quem Somos
        'sobre.titulo'   => 'Sobre a Concretiza',
        'sobre.p1'       => 'Empresa fundada em 2005, atua na área da construção civil, industrial, comercial e residencial. Busca constantemente a realização de trabalhos de alta qualidade de modo a superar as expectativas de nossos clientes e parceiros de negócios.',
        'sobre.p2'       => 'Atendemos com soluções confiáveis desde a geração de desenhos, especificações técnicas e lista de materiais até informações precisas das etapas do empreendimento.',
        'sobre.p3'       => 'A CONCRETIZA tem a constante preocupação em manter sua equipe treinada e estruturada, buscando inovações e tecnologia para oferecer excelência em sua prestação de serviços.',
        'sobre.stat1.n'  => '+19',
        'sobre.stat1.l'  => 'Anos de Mercado',
        'sobre.stat2.n'  => '+100',
        'sobre.stat2.l'  => 'Projetos Entregues',
        'sobre.stat3.n'  => '4',
        'sobre.stat3.l'  => 'Áreas de Atuação',
        'sobre.stat4.n'  => '100%',
        'sobre.stat4.l'  => 'Comprometimento',
        'sobre.foto'     => 'imagens/concre_escritorio.jpg',
        // Contato
        'contato.telefone'         => '(11) 4712-8099',
        'contato.telefone.label'   => 'Telefone Fixo — Seg a Sex, 8h às 18h',
        'contato.whatsapp'         => '(11) 9 6375-4627',
        'contato.whatsapp.label'   => 'WhatsApp — Atendimento rápido',
        'contato.whatsapp.numero'  => '5511963754627',
        'contato.whatsapp.msg'     => 'Olá! Gostaria de solicitar um orçamento.',
        'contato.email'            => 'projetos@concretizaengenharia.com.br',
        'contato.email.label'      => 'Respondemos em até 24h',
        'contato.endereco'         => 'Praça da República, 189 — Centro',
        'contato.endereco.label'   => 'São Roque/SP — Visitas com agendamento',
        // Diferenciais
        'dif1.icone'  => 'fas fa-certificate', 'dif1.titulo' => 'Qualidade Garantida',   'dif1.texto' => 'Melhores materiais e técnicas construtivas para assegurar durabilidade e excelência em cada projeto.',
        'dif2.icone'  => 'fas fa-clock',        'dif2.titulo' => 'Prazo no Cronograma',   'dif2.texto' => 'Cumprimos rigorosamente os prazos com planejamento detalhado e acompanhamento constante de cada etapa.',
        'dif3.icone'  => 'fas fa-users',        'dif3.titulo' => 'Equipe Especializada',  'dif3.texto' => 'Profissionais treinados e atualizados com as inovações do setor, garantindo soluções técnicas de alto nível.',
        'dif4.icone'  => 'fas fa-handshake',    'dif4.titulo' => 'Transparência Total',   'dif4.texto' => 'Relatórios periódicos, controle financeiro detalhado e comunicação direta e honesta com o cliente.',
        'dif5.icone'  => 'fas fa-leaf',         'dif5.titulo' => 'Sustentabilidade',      'dif5.texto' => 'Soluções construtivas que respeitam o meio ambiente com uso consciente de recursos e técnicas sustentáveis.',
        'dif6.icone'  => 'fas fa-shield-alt',   'dif6.titulo' => 'Segurança em Obra',     'dif6.texto' => 'Normas de segurança do trabalho rigorosamente aplicadas para proteger nossa equipe e todos os envolvidos.',
    ];
    $ins = $pdo->prepare('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)');
    foreach ($defaults as $k => $v) $ins->execute([$k, $v]);

    return $pdo;
}

function projectWithImages($pdo, $p) {
    $st = $pdo->prepare('SELECT * FROM project_images WHERE project_id = ? ORDER BY id');
    $st->execute([$p['id']]);
    $p['images'] = $st->fetchAll();
    return $p;
}

function requireAuth() {
    if (empty($_SESSION['userId'])) jsonError('Não autorizado', 401);
}

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function jsonError($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}
