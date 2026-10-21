<?php

/**
 * PITBULL Manager v1.0
 * Almacenes / Depósitos
 */

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

require_once __DIR__ . '/config/database.php';

$pdo    = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;

// Autenticación
$token = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
if ($token && strpos($token, 'Bearer ') === 0) $token = substr($token, 7);

if (!$token) {
    http_response_code(401);
    echo json_encode(['error' => 'Token no proporcionado']);
    exit;
}

$stmt = $pdo->prepare("
    SELECT s.usuario_id, u.rol_id
    FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token = ? AND s.expira_en > NOW() AND u.activo = 1 LIMIT 1
");
$stmt->execute([$token]);
$sesion = $stmt->fetch();

if (!$sesion) {
    http_response_code(401);
    echo json_encode(['error' => 'Sesión inválida']);
    exit;
}

$stmt = $pdo->prepare("
    SELECT p.clave FROM permisos p
    JOIN rol_permiso rp ON rp.permiso_id = p.id WHERE rp.rol_id = ?
");
$stmt->execute([$sesion['rol_id']]);
$permisos = array_column($stmt->fetchAll(), 'clave');

function tienePermiso(array $p, string $c): bool
{
    return in_array($c, $p, true);
}

$input = [];
if (in_array($method, ['POST', 'PUT'])) {
    $raw = file_get_contents('php://input');
    if ($raw) $input = json_decode($raw, true) ?? [];
}

try {
    switch ($method) {
        case 'GET':
            if (!tienePermiso($permisos, 'almacenes.ver')) {
                http_response_code(403);
                echo json_encode(['error' => 'Sin permiso']);
                exit;
            }
            if ($id) {
                $stmt = $pdo->prepare("SELECT * FROM almacenes WHERE id = ?");
                $stmt->execute([$id]);
                echo json_encode($stmt->fetch() ?: ['error' => 'No encontrado']);
            } else {
                $stmt = $pdo->query("SELECT * FROM almacenes WHERE activo = 1 ORDER BY es_principal DESC, nombre ASC");
                echo json_encode($stmt->fetchAll(), JSON_UNESCAPED_UNICODE);
            }
            break;

        case 'POST':
            if (!tienePermiso($permisos, 'almacenes.gestionar')) {
                http_response_code(403);
                echo json_encode(['error' => 'Sin permiso']);
                exit;
            }
            $stmt = $pdo->prepare("
                INSERT INTO almacenes (codigo, nombre, direccion, responsable, telefono, es_principal, activo)
                VALUES (?, ?, ?, ?, ?, ?, 1)
            ");
            $stmt->execute([
                trim($input['codigo'] ?? ''),
                trim($input['nombre'] ?? ''),
                $input['direccion'] ?? null,
                $input['responsable'] ?? null,
                $input['telefono'] ?? null,
                (int)($input['es_principal'] ?? 0),
            ]);
            echo json_encode(['ok' => true, 'id' => (int)$pdo->lastInsertId()]);
            break;

        case 'PUT':
            if (!tienePermiso($permisos, 'almacenes.gestionar')) {
                http_response_code(403);
                echo json_encode(['error' => 'Sin permiso']);
                exit;
            }
            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'ID requerido']);
                exit;
            }
            $stmt = $pdo->prepare("
                UPDATE almacenes SET codigo=?, nombre=?, direccion=?, responsable=?, telefono=? WHERE id=?
            ");
            $stmt->execute([
                trim($input['codigo'] ?? ''),
                trim($input['nombre'] ?? ''),
                $input['direccion'] ?? null,
                $input['responsable'] ?? null,
                $input['telefono'] ?? null,
                $id,
            ]);
            echo json_encode(['ok' => true, 'actualizado' => $stmt->rowCount()]);
            break;

        case 'DELETE':
            if (!tienePermiso($permisos, 'almacenes.gestionar')) {
                http_response_code(403);
                echo json_encode(['error' => 'Sin permiso']);
                exit;
            }
            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'ID requerido']);
                exit;
            }
            $stmt = $pdo->prepare("UPDATE almacenes SET activo = 0 WHERE id = ? AND es_principal = 0");
            $stmt->execute([$id]);
            echo json_encode(['ok' => true, 'eliminado' => $stmt->rowCount()]);
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'Método no permitido']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Error en la base de datos', 'detalle' => $e->getMessage()]);
}
