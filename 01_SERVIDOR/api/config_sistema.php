<?php

/**
 * PITBULL Manager v1.0
 * API - Configuración del sistema (tasa, IVA, datos empresa)
 *
 * Endpoints:
 *   GET  /api/config_sistema.php           → leer toda la configuración
 *   PUT  /api/config_sistema.php           → actualizar valores (múltiples)
 */

header('Content-Type: application/json; charset=utf-8');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/config/database.php';

$pdo    = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];
// AUTENTICACIÓN
$token = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
if ($token && strpos($token, 'Bearer ') === 0) $token = substr($token, 7);

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
    echo json_encode(['error' => 'Sesión inválida']);
    exit;
}

$stmt = $pdo->prepare("
    SELECT p.clave FROM permisos p
    JOIN rol_permiso rp ON rp.permiso_id = p.id
    WHERE rp.rol_id = ?
");
$stmt->execute([$sesion['rol_id']]);
$permisos = array_column($stmt->fetchAll(), 'clave');

try {
    switch ($method) {
        // GET - Leer configuración
        case 'GET':
            $stmt = $pdo->query("SELECT clave, valor, descripcion FROM configuracion ORDER BY clave");
            $config = [];
            foreach ($stmt->fetchAll() as $row) {
                $config[$row['clave']] = [
                    'valor'       => $row['valor'],
                    'descripcion' => $row['descripcion'],
                ];
            }
            echo json_encode(['ok' => true, 'config' => $config], JSON_UNESCAPED_UNICODE);
            break;
        // PUT - Actualizar configuración
        case 'PUT':
            if (!in_array('config.editar', $permisos, true)) {
                http_response_code(403);
                echo json_encode(['error' => 'No tienes permiso para editar la configuración']);
                exit;
            }

            $raw = file_get_contents('php://input');
            $input = json_decode($raw, true) ?? [];

            if (empty($input)) {
                http_response_code(400);
                echo json_encode(['error' => 'No se enviaron datos para actualizar']);
                exit;
            }

            $pdo->beginTransaction();
            $stmt = $pdo->prepare("
                INSERT INTO configuracion (clave, valor) VALUES (?, ?)
                ON DUPLICATE KEY UPDATE valor = VALUES(valor)
            ");

            foreach ($input as $clave => $valor) {
                $stmt->execute([$clave, (string)$valor]);
            }

            $pdo->commit();

            // Registrar auditoría
            $pdo->prepare("
                INSERT INTO auditoria_logs (usuario_id, accion, modulo, detalle)
                VALUES (?, 'editar_configuracion', 'configuracion', ?)
            ")->execute([$sesion['usuario_id'], json_encode($input, JSON_UNESCAPED_UNICODE)]);

            echo json_encode(['ok' => true, 'mensaje' => 'Configuración actualizada']);
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'Método no permitido']);
    }
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Error en la base de datos', 'detalle' => $e->getMessage()]);
}
