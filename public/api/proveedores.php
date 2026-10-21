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

$input = [];
if (in_array($method, ['POST', 'PUT', 'DELETE'])) {
    $raw = file_get_contents('php://input');
    if ($raw) $input = json_decode($raw, true) ?? [];
}

try {
    switch ($method) {

        case 'GET':
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
            $nombre = trim($input['nombre'] ?? '');
            if ($nombre === '') {
                http_response_code(400);
                echo json_encode(['error' => 'El nombre es obligatorio']);
                exit;
            }
            $stmt = $pdo->prepare("
                INSERT INTO proveedores
                    (rif, nombre, contacto, telefono, email, direccion, notas, activo)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            ");
            $stmt->execute([
                $input['rif'] ?? null,
                $nombre,
                $input['contacto'] ?? null,
                $input['telefono'] ?? null,
                $input['email'] ?? null,
                $input['direccion'] ?? null,
                $input['notas'] ?? null,
            ]);
            echo json_encode(['ok' => true, 'id' => (int)$pdo->lastInsertId()]);
            break;

        case 'PUT':
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
    http_response_code(500);
    echo json_encode(['error' => 'Error en la base de datos', 'detalle' => $e->getMessage()]);
}
