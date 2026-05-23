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
