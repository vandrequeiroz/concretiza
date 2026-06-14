<?php
session_start();
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$pdo    = getDb();
$method = $_SERVER['REQUEST_METHOD'];
$uri    = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri    = rtrim(preg_replace('#^/api#', '', $uri), '/');
$parts  = explode('/', ltrim($uri, '/'));

// method override for multipart PUT (FormData doesn't support PUT natively)
if ($method === 'POST' && !empty($_POST['_method'])) {
    $method = strtoupper($_POST['_method']);
}

// ── router ────────────────────────────────────────────

// /auth
if ($parts[0] === 'auth') {
    $action = $parts[1] ?? '';

    if ($method === 'POST' && $action === 'login') {
        $body  = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $email = trim($body['email'] ?? '');
        $pass  = $body['password'] ?? '';

        if (!$email || !$pass) jsonError('E-mail e senha são obrigatórios');

        $st = $pdo->prepare('SELECT * FROM users WHERE email = ?');
        $st->execute([$email]);
        $user = $st->fetch();

        if (!$user || !password_verify($pass, $user['password'])) {
            jsonError('Credenciais inválidas', 401);
        }

        $_SESSION['userId']   = $user['id'];
        $_SESSION['userRole'] = $user['role'];
        unset($user['password']);
        jsonResponse(['user' => $user]);
    }

    if ($method === 'POST' && $action === 'logout') {
        session_destroy();
        jsonResponse(['ok' => true]);
    }

    if ($method === 'GET' && $action === 'me') {
        if (empty($_SESSION['userId'])) jsonError('Não autenticado', 401);
        $st = $pdo->prepare('SELECT id, name, email, role FROM users WHERE id = ?');
        $st->execute([$_SESSION['userId']]);
        $user = $st->fetch();
        if (!$user) jsonError('Usuário não encontrado', 404);
        jsonResponse(['user' => $user]);
    }

    jsonError('Rota não encontrada', 404);
}

// /projects
if ($parts[0] === 'projects') {
    $id     = isset($parts[1]) && is_numeric($parts[1]) ? (int)$parts[1] : null;
    $action = $id ? ($parts[2] ?? null) : null;

    // GET /projects
    if ($method === 'GET' && !$id) {
        $st = $pdo->query('SELECT * FROM projects ORDER BY id DESC');
        $projects = $st->fetchAll();
        $result = [];
        foreach ($projects as $p) {
            $result[] = projectWithImages($pdo, $p);
        }
        jsonResponse($result);
    }

    // GET /projects/:id
    if ($method === 'GET' && $id) {
        $st = $pdo->prepare('SELECT * FROM projects WHERE id = ?');
        $st->execute([$id]);
        $p = $st->fetch();
        if (!$p) jsonError('Projeto não encontrado', 404);
        jsonResponse(projectWithImages($pdo, $p));
    }

    // POST /projects — create (auth required)
    if ($method === 'POST' && !$id) {
        requireAuth();
        $name        = trim($_POST['name'] ?? '');
        $description = trim($_POST['description'] ?? '');
        $category    = trim($_POST['category'] ?? '');
        $year        = trim($_POST['year'] ?? '');

        if (!$name) jsonError('Nome é obrigatório');

        $st = $pdo->prepare('INSERT INTO projects (name, description, category, year) VALUES (?, ?, ?, ?)');
        $st->execute([$name, $description, $category, $year]);
        $projectId = $pdo->lastInsertId();

        $uploaded = uploadImages($projectId);

        // first uploaded image becomes featured
        if ($uploaded && !empty($uploaded[0])) {
            $pdo->prepare('UPDATE projects SET featured_image = ? WHERE id = ?')
                ->execute([$uploaded[0], $projectId]);
        }

        $st = $pdo->prepare('SELECT * FROM projects WHERE id = ?');
        $st->execute([$projectId]);
        jsonResponse(projectWithImages($pdo, $st->fetch()), 201);
    }

    // PUT /projects/:id — update (auth required)
    if ($method === 'PUT' && $id) {
        requireAuth();
        $name        = trim($_POST['name'] ?? '');
        $description = trim($_POST['description'] ?? '');
        $category    = trim($_POST['category'] ?? '');
        $year        = trim($_POST['year'] ?? '');

        if (!$name) jsonError('Nome é obrigatório');

        $pdo->prepare('UPDATE projects SET name=?, description=?, category=?, year=? WHERE id=?')
            ->execute([$name, $description, $category, $year, $id]);

        // remove images flagged for deletion
        $remove = json_decode($_POST['removeImages'] ?? '[]', true);
        foreach ((array)$remove as $imgId) {
            $st = $pdo->prepare('SELECT filename FROM project_images WHERE id = ? AND project_id = ?');
            $st->execute([(int)$imgId, $id]);
            $img = $st->fetch();
            if ($img) {
                $file = __DIR__ . '/uploads/' . $img['filename'];
                if (file_exists($file)) unlink($file);
                $pdo->prepare('DELETE FROM project_images WHERE id = ?')->execute([(int)$imgId]);
            }
        }

        uploadImages($id);

        // update featured_image if provided
        if (!empty($_POST['featuredImage'])) {
            $pdo->prepare('UPDATE projects SET featured_image = ? WHERE id = ?')
                ->execute([$_POST['featuredImage'], $id]);
        }

        $st = $pdo->prepare('SELECT * FROM projects WHERE id = ?');
        $st->execute([$id]);
        jsonResponse(projectWithImages($pdo, $st->fetch()));
    }

    // DELETE /projects/:id (auth required)
    if ($method === 'DELETE' && $id) {
        requireAuth();
        // delete physical image files
        $st = $pdo->prepare('SELECT filename FROM project_images WHERE project_id = ?');
        $st->execute([$id]);
        foreach ($st->fetchAll() as $img) {
            $file = __DIR__ . '/uploads/' . $img['filename'];
            if (file_exists($file)) unlink($file);
        }
        $pdo->prepare('DELETE FROM projects WHERE id = ?')->execute([$id]);
        jsonResponse(['ok' => true]);
    }

    // POST /projects/:id/featured (auth required)
    if ($method === 'POST' && $id && $action === 'featured') {
        requireAuth();
        $body     = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $filename = $body['filename'] ?? '';
        if (!$filename) jsonError('filename é obrigatório');

        $pdo->prepare('UPDATE projects SET featured_image = ? WHERE id = ?')
            ->execute([$filename, $id]);
        jsonResponse(['ok' => true]);
    }

    jsonError('Rota não encontrada', 404);
}

// /settings
if ($parts[0] === 'settings') {

    // POST /settings/imagem — upload genérico de imagem de seção
    if ($method === 'POST' && ($parts[1] ?? '') === 'imagem') {
        requireAuth();
        if (empty($_FILES['imagem']) || $_FILES['imagem']['error'] !== UPLOAD_ERR_OK) jsonError('Nenhum arquivo enviado');
        $key = $_POST['key'] ?? '';
        if (!$key) jsonError('key obrigatória');
        $file = $_FILES['imagem'];
        $ext  = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['jpg','jpeg','png','webp'])) jsonError('Formato não permitido');
        $uploadDir = __DIR__ . '/uploads/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
        $filename = uniqid('img_', true) . '.' . $ext;
        if (!move_uploaded_file($file['tmp_name'], $uploadDir . $filename)) jsonError('Erro ao salvar arquivo');
        $path = 'uploads/' . $filename;
        $pdo->prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)')->execute([$key, $path]);
        jsonResponse(['path' => $path]);
    }

    // POST /settings/foto — upload foto da seção Quem Somos
    if ($method === 'POST' && ($parts[1] ?? '') === 'foto') {
        requireAuth();
        if (empty($_FILES['foto']) || $_FILES['foto']['error'] !== UPLOAD_ERR_OK) {
            jsonError('Nenhum arquivo enviado');
        }
        $file = $_FILES['foto'];
        $ext  = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['jpg','jpeg','png','webp'])) jsonError('Formato não permitido');

        $uploadDir = __DIR__ . '/uploads/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
        $filename = 'sobre_' . uniqid('', true) . '.' . $ext;
        if (!move_uploaded_file($file['tmp_name'], $uploadDir . $filename)) jsonError('Erro ao salvar arquivo');

        $path = 'uploads/' . $filename;
        $pdo->prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)')->execute(['sobre.foto', $path]);
        jsonResponse(['path' => $path]);
    }

    if ($method === 'GET') {
        $st = $pdo->query('SELECT key, value FROM settings');
        $rows = $st->fetchAll();
        $out  = [];
        foreach ($rows as $r) $out[$r['key']] = $r['value'];
        jsonResponse($out);
    }

    if ($method === 'PUT') {
        requireAuth();
        $body = json_decode(file_get_contents('php://input'), true);
        if (!is_array($body)) jsonError('JSON inválido');

        $st = $pdo->prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        foreach ($body as $k => $v) {
            $st->execute([trim($k), trim($v)]);
        }
        jsonResponse(['ok' => true]);
    }

    jsonError('Método não permitido', 405);
}

// /users
if ($parts[0] === 'users') {
    requireAuth();
    $id = isset($parts[1]) && is_numeric($parts[1]) ? (int)$parts[1] : null;

    $requireSuper = function () {
        if (($_SESSION['userRole'] ?? '') !== 'superadmin') {
            jsonError('Acesso restrito', 403);
        }
    };

    if ($method === 'GET' && !$id) {
        $st = $pdo->query('SELECT id, name, email, role, created_at FROM users ORDER BY id');
        jsonResponse($st->fetchAll());
    }

    if ($method === 'POST' && !$id) {
        $requireSuper();
        $body  = json_decode(file_get_contents('php://input'), true);
        $name  = trim($body['name'] ?? '');
        $email = trim($body['email'] ?? '');
        $pass  = $body['password'] ?? '';
        $role  = $body['role'] ?? 'admin';

        if (!$name || !$email || !$pass) jsonError('name, email e password são obrigatórios');

        $hash = password_hash($pass, PASSWORD_BCRYPT);
        try {
            $pdo->prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
                ->execute([$name, $email, $hash, $role]);
        } catch (Exception $e) {
            jsonError('E-mail já cadastrado', 409);
        }
        $newId = $pdo->lastInsertId();
        $st = $pdo->prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?');
        $st->execute([$newId]);
        jsonResponse($st->fetch(), 201);
    }

    if ($method === 'PUT' && $id) {
        $requireSuper();
        $body  = json_decode(file_get_contents('php://input'), true);
        $name  = trim($body['name'] ?? '');
        $email = trim($body['email'] ?? '');
        $role  = $body['role'] ?? 'admin';

        if (!$name || !$email) jsonError('name e email são obrigatórios');

        if (!empty($body['password'])) {
            $hash = password_hash($body['password'], PASSWORD_BCRYPT);
            $pdo->prepare('UPDATE users SET name=?, email=?, password=?, role=? WHERE id=?')
                ->execute([$name, $email, $hash, $role, $id]);
        } else {
            $pdo->prepare('UPDATE users SET name=?, email=?, role=? WHERE id=?')
                ->execute([$name, $email, $role, $id]);
        }
        $st = $pdo->prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?');
        $st->execute([$id]);
        jsonResponse($st->fetch());
    }

    if ($method === 'DELETE' && $id) {
        $requireSuper();
        if ($id === (int)$_SESSION['userId']) jsonError('Não pode deletar a si mesmo');
        $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
        jsonResponse(['ok' => true]);
    }

    jsonError('Rota não encontrada', 404);
}

jsonError('Rota não encontrada', 404);

// ── helpers ───────────────────────────────────────────

function uploadImages(int $projectId): array {
    global $pdo;
    $uploaded = [];
    $uploadDir = __DIR__ . '/uploads/';

    if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

    $files = $_FILES['images[]'] ?? $_FILES['images'] ?? [];
    if (empty($files['name'])) return [];

    // normalize single file to array
    if (!is_array($files['name'])) {
        $files = array_map(fn($v) => [$v], $files);
    }

    $count = count($files['name']);
    for ($i = 0; $i < $count; $i++) {
        if ($files['error'][$i] !== UPLOAD_ERR_OK) continue;

        $ext      = strtolower(pathinfo($files['name'][$i], PATHINFO_EXTENSION));
        $allowed  = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
        if (!in_array($ext, $allowed)) continue;

        $filename = uniqid('img_', true) . '.' . $ext;
        $dest     = $uploadDir . $filename;

        if (move_uploaded_file($files['tmp_name'][$i], $dest)) {
            $pdo->prepare('INSERT INTO project_images (project_id, filename) VALUES (?, ?)')
                ->execute([$projectId, $filename]);
            $uploaded[] = $filename;
        }
    }

    return $uploaded;
}
