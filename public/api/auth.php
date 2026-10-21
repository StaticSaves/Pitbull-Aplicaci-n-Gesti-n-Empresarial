<?php

header('Content-Type: application/json; charset=utf-8');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../../app/config/database.php';

$pdo    = Database::getConnection();
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Leer JSON del body
$input = [];
if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    if ($raw) $input = json_decode($raw, true) ?? [];
}

// Token
$token = $_SERVER['HTTP_AUTHORIZATION'] ?? ($input['token'] ?? null);
if ($token && strpos($token, 'Bearer ') === 0) {
    $token = substr($token, 7);
}

try {
    switch ($action) {
        // LOGIN
        case 'login':
            if ($method !== 'POST') {
                http_response_code(405);
                echo json_encode(['error' => 'Método no permitido']);
                exit;
            }

            $email    = trim($input['email'] ?? '');
            $password = $input['password'] ?? '';

            if ($email === '' || $password === '') {
                http_response_code(400);
                echo json_encode(['error' => 'Email y contraseña son obligatorios']);
                exit;
            }

            // Buscar usuario con su rol
            $stmt = $pdo->prepare("
                SELECT u.*, r.nombre AS rol_nombre
                FROM usuarios u
                JOIN roles r ON r.id = u.rol_id
                WHERE u.email = ? AND u.activo = 1
                LIMIT 1
            ");
            $stmt->execute([$email]);
            $usuario = $stmt->fetch();

            if (!$usuario || !password_verify($password, $usuario['password_hash'])) {
                http_response_code(401);
                echo json_encode(['error' => 'Credenciales incorrectas']);
                exit;
            }

            // Obtener permisos del rol
            $stmt = $pdo->prepare("
                SELECT p.clave
                FROM permisos p
                JOIN rol_permiso rp ON rp.permiso_id = p.id
                WHERE rp.rol_id = ?
                ORDER BY p.clave
            ");
            $stmt->execute([$usuario['rol_id']]);
            $permisos = array_column($stmt->fetchAll(), 'clave');

            // Generar token único
            $token = bin2hex(random_bytes(32));
            $expira = date('Y-m-d H:i:s', strtotime('+8 hours'));

            // Guardar sesión en BD
            $stmt = $pdo->prepare("
                INSERT INTO sesiones (usuario_id, token, ip, user_agent, expira_en)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $usuario['id'],
                $token,
                $_SERVER['REMOTE_ADDR'] ?? null,
                substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 250),
                $expira,
            ]);

            // Actualizar último login
            $pdo->prepare("UPDATE usuarios SET ultimo_login = NOW() WHERE id = ?")
                ->execute([$usuario['id']]);

            // Devolver datos (SIN el hash)
            echo json_encode([
                'ok' => true,
                'token' => $token,
                'expira_en' => $expira,
                'usuario' => [
                    'id'              => (int)$usuario['id'],
                    'nombre_completo' => $usuario['nombre_completo'],
                    'email'           => $usuario['email'],
                    'cedula'          => $usuario['cedula'],
                    'rol_id'          => (int)$usuario['rol_id'],
                    'rol_nombre'      => $usuario['rol_nombre'],
                ],
                'permisos' => $permisos,
            ], JSON_UNESCAPED_UNICODE);
            break;
        // LOGOUT
        case 'logout':
            if (!$token) {
                http_response_code(400);
                echo json_encode(['error' => 'Token no proporcionado']);
                exit;
            }
            $stmt = $pdo->prepare("DELETE FROM sesiones WHERE token = ?");
            $stmt->execute([$token]);
            echo json_encode(['ok' => true, 'mensaje' => 'Sesión cerrada']);
            break;
        // VERIFICAR TOKEN
        case 'verificar':
            if (!$token) {
                http_response_code(401);
                echo json_encode(['error' => 'Token no proporcionado']);
                exit;
            }
            $stmt = $pdo->prepare("
                SELECT s.*, u.nombre_completo, u.email, u.rol_id, r.nombre AS rol_nombre
                FROM sesiones s
                JOIN usuarios u ON u.id = s.usuario_id
                JOIN roles r   ON r.id = u.rol_id
                WHERE s.token = ? AND s.expira_en > NOW() AND u.activo = 1
                LIMIT 1
            ");
            $stmt->execute([$token]);
            $sesion = $stmt->fetch();

            if (!$sesion) {
                http_response_code(401);
                echo json_encode(['error' => 'Token inválido o expirado']);
                exit;
            }

            // Obtener permisos
            $stmt = $pdo->prepare("
                SELECT p.clave
                FROM permisos p
                JOIN rol_permiso rp ON rp.permiso_id = p.id
                WHERE rp.rol_id = ?
            ");
            $stmt->execute([$sesion['rol_id']]);
            $permisos = array_column($stmt->fetchAll(), 'clave');

            echo json_encode([
                'ok' => true,
                'usuario' => [
                    'id'              => (int)$sesion['usuario_id'],
                    'nombre_completo' => $sesion['nombre_completo'],
                    'email'           => $sesion['email'],
                    'rol_id'          => (int)$sesion['rol_id'],
                    'rol_nombre'      => $sesion['rol_nombre'],
                ],
                'permisos' => $permisos,
            ], JSON_UNESCAPED_UNICODE);
            break;

        case 'yo':
            // Mismo comportamiento que verificar
            $_GET['action'] = 'verificar';
            // Redirige manualmente 
            if (!$token) {
                http_response_code(401);
                echo json_encode(['error' => 'Token no proporcionado']);
                exit;
            }
            $stmt = $pdo->prepare("
                SELECT s.*, u.nombre_completo, u.email, u.rol_id, r.nombre AS rol_nombre
                FROM sesiones s
                JOIN usuarios u ON u.id = s.usuario_id
                JOIN roles r   ON r.id = u.rol_id
                WHERE s.token = ? AND s.expira_en > NOW()
                LIMIT 1
            ");
            $stmt->execute([$token]);
            $sesion = $stmt->fetch();
            if (!$sesion) {
                http_response_code(401);
                echo json_encode(['error' => 'Token inválido']);
                exit;
            }
            echo json_encode(['ok' => true, 'usuario' => $sesion]);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'Acción no especificada o inválida']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Error en la base de datos', 'detalle' => $e->getMessage()]);
}
