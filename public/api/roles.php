<?php

header('Content-Type: application/json; charset=utf-8');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../../app/config/database.php';

$pdo = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

$token = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
if ($token && strpos($token, 'Bearer ') === 0) {
    $token = substr($token, 7);
}

if (!$token) {
    http_response_code(401);
    echo json_encode(['error' => 'Token no proporcionado']);
    exit;
}

$stmt = $pdo->prepare("
    SELECT s.usuario_id, u.rol_id
    FROM sesiones s
    JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token = ? AND s.expira_en > NOW() AND u.activo = 1
    LIMIT 1
");
$stmt->execute([$token]);
$sesion = $stmt->fetch();

if (!$sesion) {
    http_response_code(401);
    echo json_encode(['error' => 'Sesión inválida o expirada']);
    exit;
}

$stmt = $pdo->prepare("
    SELECT p.clave
    FROM permisos p
    JOIN rol_permiso rp ON rp.permiso_id = p.id
    WHERE rp.rol_id = ?
");
$stmt->execute([$sesion['rol_id']]);
$permisosActuales = array_column($stmt->fetchAll(), 'clave');

try {
    if ($method === 'GET' && $action === 'permisos') {
        if (!in_array('roles.gestionar', $permisosActuales, true)) {
            http_response_code(403);
            echo json_encode(['error' => 'No tienes permiso para gestionar roles']);
            exit;
        }

        $roles = $pdo->query("
            SELECT r.id, r.nombre, r.descripcion, r.es_sistema,
                   GROUP_CONCAT(p.clave ORDER BY p.clave SEPARATOR ',') AS permisos
            FROM roles r
            LEFT JOIN rol_permiso rp ON rp.rol_id = r.id
            LEFT JOIN permisos p ON p.id = rp.permiso_id
            GROUP BY r.id
            ORDER BY r.id
        ")->fetchAll();

        foreach ($roles as &$rol) {
            $rol['id'] = (int)$rol['id'];
            $rol['es_sistema'] = (bool)$rol['es_sistema'];
            $rol['permisos'] = $rol['permisos'] === null || $rol['permisos'] === ''
                ? []
                : explode(',', $rol['permisos']);
        }
        unset($rol);

        $catalogo = $pdo->query("
            SELECT id, clave, descripcion, modulo
            FROM permisos
            ORDER BY modulo, clave
        ")->fetchAll();

        echo json_encode([
            'roles' => $roles,
            'permisos' => $catalogo,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($method === 'GET') {
        if (
            !in_array('usuarios.crear', $permisosActuales, true) &&
            !in_array('usuarios.editar', $permisosActuales, true)
        ) {
            http_response_code(403);
            echo json_encode(['error' => 'No tienes permiso para consultar roles']);
            exit;
        }

        $roles = $pdo->query("
            SELECT id, nombre, descripcion
            FROM roles
            ORDER BY id
        ")->fetchAll();
        echo json_encode($roles, JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($method === 'PUT') {
        if (!in_array('roles.gestionar', $permisosActuales, true)) {
            http_response_code(403);
            echo json_encode(['error' => 'No tienes permiso para gestionar roles']);
            exit;
        }
        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Rol requerido']);
            exit;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        if (!is_array($input) || !isset($input['permisos']) || !is_array($input['permisos'])) {
            http_response_code(400);
            echo json_encode(['error' => 'La lista de permisos no es válida']);
            exit;
        }

        $stmt = $pdo->prepare("SELECT id, nombre FROM roles WHERE id = ?");
        $stmt->execute([$id]);
        $rol = $stmt->fetch();
        if (!$rol) {
            http_response_code(404);
            echo json_encode(['error' => 'Rol no encontrado']);
            exit;
        }

        foreach ($input['permisos'] as $clave) {
            if (!is_string($clave) || $clave === '') {
                http_response_code(400);
                echo json_encode(['error' => 'La lista contiene un permiso no válido']);
                exit;
            }
        }
        $claves = array_values(array_unique($input['permisos']));
        $stmt = $pdo->query("SELECT id, clave FROM permisos");
        $catalogo = $stmt->fetchAll();
        $idsPorClave = [];
        foreach ($catalogo as $permiso) {
            $idsPorClave[$permiso['clave']] = (int)$permiso['id'];
        }

        foreach ($claves as $clave) {
            if (!isset($idsPorClave[$clave])) {
                http_response_code(400);
                echo json_encode(['error' => 'La lista contiene un permiso no válido']);
                exit;
            }
        }

        if (in_array('roles.gestionar', $claves, true) && strtolower($rol['nombre']) !== 'gerente') {
            http_response_code(400);
            echo json_encode(['error' => 'Solo el rol gerente puede gestionar permisos de roles']);
            exit;
        }
        if (strtolower($rol['nombre']) === 'gerente' && !in_array('roles.gestionar', $claves, true)) {
            $claves[] = 'roles.gestionar';
        }

        $pdo->beginTransaction();
        $pdo->prepare("DELETE FROM rol_permiso WHERE rol_id = ?")->execute([$id]);
        $insert = $pdo->prepare("INSERT INTO rol_permiso (rol_id, permiso_id) VALUES (?, ?)");
        foreach ($claves as $clave) {
            $insert->execute([$id, $idsPorClave[$clave]]);
        }
        $pdo->prepare("
            INSERT INTO auditoria_logs (usuario_id, accion, modulo, entidad, entidad_id, detalle)
            VALUES (?, 'editar_permisos_rol', 'configuracion', 'roles', ?, ?)
        ")->execute([
            $sesion['usuario_id'],
            $id,
            json_encode(['rol' => $rol['nombre'], 'permisos' => $claves], JSON_UNESCAPED_UNICODE),
        ]);
        $pdo->commit();

        echo json_encode(['ok' => true, 'mensaje' => 'Permisos del rol actualizados']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Error al gestionar roles: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'No se pudieron procesar los roles']);
}
