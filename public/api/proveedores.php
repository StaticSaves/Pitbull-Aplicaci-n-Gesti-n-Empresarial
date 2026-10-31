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
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

$authorization = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$token = str_starts_with($authorization, 'Bearer ')
    ? substr($authorization, 7)
    : '';
if ($token === '') {
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
$session = $stmt->fetch();
if (!$session) {
    http_response_code(401);
    echo json_encode(['error' => 'Sesión inválida o expirada']);
    exit;
}

$stmt = $pdo->prepare("
    SELECT p.clave FROM permisos p
    JOIN rol_permiso rp ON rp.permiso_id = p.id
    WHERE rp.rol_id = ?
");
$stmt->execute([$session['rol_id']]);
$permissions = array_column($stmt->fetchAll(), 'clave');
$canReadProviders = array_intersect(
    ['entradas.ver', 'entradas.crear', 'stock.entrada'],
    $permissions,
) !== [];
$canManageProviders = in_array('proveedores.gestionar', $permissions, true);

$input = [];
if (in_array($method, ['POST', 'PUT', 'DELETE'])) {
    $raw = file_get_contents('php://input');
    if ($raw) $input = json_decode($raw, true) ?? [];
}

try {
    switch ($method) {

        case 'GET':
            if (!$canReadProviders) {
                http_response_code(403);
                echo json_encode(['error' => 'Sin permiso para consultar proveedores']);
                exit;
            }
            if ($id) {
                $stmt = $pdo->prepare("SELECT * FROM proveedores WHERE id = ?");
                $stmt->execute([$id]);
                $p = $stmt->fetch();
                if (!$p) {
                    http_response_code(404);
                    echo json_encode(['error' => 'Proveedor no encontrado']);
                    exit;
                }
                echo json_encode($p);
            } else {
                $stmt = $pdo->query("
                    SELECT * FROM proveedores
                    WHERE activo = 1
                    ORDER BY nombre ASC
                ");
                echo json_encode($stmt->fetchAll());
            }
            break;

        case 'POST':
            if (!$canManageProviders) {
                http_response_code(403);
                echo json_encode(['error' => 'Sin permiso para registrar proveedores']);
                exit;
            }
            $nombre = trim($input['nombre'] ?? '');
            if ($nombre === '') {
                http_response_code(400);
                echo json_encode(['error' => 'El nombre es obligatorio']);
                exit;
            }
            $rif = trim($input['rif'] ?? '');
            $email = trim($input['email'] ?? '');
            if ($rif !== '') {
                $check = $pdo->prepare("SELECT id FROM proveedores WHERE rif = ? LIMIT 1");
                $check->execute([$rif]);
                if ($check->fetch()) {
                    http_response_code(409);
                    echo json_encode(['error' => 'Ya existe un proveedor con ese RIF']);
                    exit;
                }
            }
            if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode(['error' => 'El correo electrónico no es válido']);
                exit;
            }
            $stmt = $pdo->prepare("
                INSERT INTO proveedores
                    (rif, nombre, contacto, telefono, email, direccion, notas, activo)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            ");
            $stmt->execute([
                $rif !== '' ? $rif : null,
                $nombre,
                trim($input['contacto'] ?? '') ?: null,
                trim($input['telefono'] ?? '') ?: null,
                $email !== '' ? $email : null,
                trim($input['direccion'] ?? '') ?: null,
                trim($input['notas'] ?? '') ?: null,
            ]);
            $providerId = (int)$pdo->lastInsertId();
            $pdo->prepare("
                INSERT INTO auditoria_logs (usuario_id, accion, modulo, entidad, entidad_id, detalle)
                VALUES (?, 'crear_proveedor', 'inventario', 'proveedores', ?, ?)
            ")->execute([
                $session['usuario_id'],
                $providerId,
                json_encode(['nombre' => $nombre, 'rif' => $rif ?: null], JSON_UNESCAPED_UNICODE),
            ]);
            echo json_encode(['ok' => true, 'id' => $providerId]);
            break;

        case 'PUT':
            if (!$canManageProviders) {
                http_response_code(403);
                echo json_encode(['error' => 'Sin permiso para editar proveedores']);
                exit;
            }
            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'ID requerido']);
                exit;
            }
            $stmt = $pdo->prepare("
                UPDATE proveedores SET
                    rif = ?, nombre = ?, contacto = ?, telefono = ?,
                    email = ?, direccion = ?, notas = ?
                WHERE id = ?
            ");
            $stmt->execute([
                $input['rif'] ?? null,
                trim($input['nombre'] ?? ''),
                $input['contacto'] ?? null,
                $input['telefono'] ?? null,
                $input['email'] ?? null,
                $input['direccion'] ?? null,
                $input['notas'] ?? null,
                $id,
            ]);
            echo json_encode(['ok' => true, 'actualizado' => $stmt->rowCount()]);
            break;

        case 'DELETE':
            if (!$canManageProviders) {
                http_response_code(403);
                echo json_encode(['error' => 'Sin permiso para desactivar proveedores']);
                exit;
            }
            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'ID requerido']);
                exit;
            }
            $stmt = $pdo->prepare("UPDATE proveedores SET activo = 0 WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['ok' => true, 'eliminado' => $stmt->rowCount()]);
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'Método no permitido']);
    }
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        http_response_code(409);
        echo json_encode(['error' => 'Ya existe un proveedor con esos datos']);
        exit;
    }
    error_log('Supplier API database error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Error en la base de datos']);
}
