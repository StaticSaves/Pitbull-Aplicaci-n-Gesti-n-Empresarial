<?php

/**
 * PITBULL Manager v1.0
 * Control de Caja
 */

header('Content-Type: application/json; charset=utf-8');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/config/database.php';

$pdo    = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;
$action = $_GET['action'] ?? null;

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

$usuarioId = (int)$sesion['usuario_id'];

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
if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    if ($raw) $input = json_decode($raw, true) ?? [];
}

try {
    // GET
    if ($method === 'GET') {
        if (!tienePermiso($permisos, 'caja.ver')) {
            http_response_code(403);
            echo json_encode(['error' => 'Sin permiso']);
            exit;
        }

        // Caja abierta del usuario actual
        if ($action === 'actual') {
            $stmt = $pdo->prepare("
                SELECT c.*, u.nombre_completo AS usuario_nombre
                FROM caja c
                JOIN usuarios u ON u.id = c.usuario_id
                WHERE c.usuario_id = ? AND c.estado = 'abierta'
                ORDER BY c.id DESC LIMIT 1
            ");
            $stmt->execute([$usuarioId]);
            $caja = $stmt->fetch();

            if ($caja) {
                // Sumar ventas en efectivo desde que se abrió
                $stmt = $pdo->prepare("
                    SELECT COALESCE(SUM(total), 0) AS total_efectivo
                    FROM ventas
                    WHERE caja_id = ? AND estado = 'completada' AND metodo_pago = 'efectivo'
                ");
                $stmt->execute([$caja['id']]);
                $caja['total_ventas_efectivo'] = (float)$stmt->fetch()['total_efectivo'];

                // Total esperado = apertura + ventas efectivo + ingresos - egresos - retiros
                $stmt = $pdo->prepare("
                    SELECT
                        COALESCE(SUM(CASE WHEN tipo IN ('ingreso_manual','venta') THEN monto ELSE 0 END), 0) AS ingresos,
                        COALESCE(SUM(CASE WHEN tipo IN ('egreso_manual','retiro') THEN monto ELSE 0 END), 0) AS egresos
                    FROM movimientos_caja WHERE caja_id = ?
                ");
                $stmt->execute([$caja['id']]);
                $mov = $stmt->fetch();
                $caja['monto_esperado'] = (float)$caja['monto_apertura']
                    + (float)$mov['ingresos']
                    - (float)$mov['egresos'];
            }
            echo json_encode($caja ?: null);
            exit;
        }
        // Historial de cajas
        if ($action === 'historial') {
            $stmt = $pdo->query("
                SELECT c.*, u.nombre_completo AS usuario_nombre
                FROM caja c
                JOIN usuarios u ON u.id = c.usuario_id
                ORDER BY c.id DESC LIMIT 30
            ");
            echo json_encode($stmt->fetchAll(), JSON_UNESCAPED_UNICODE);
            exit;
        }
        // Detalle de una caja + movimientos
        if ($id) {
            $stmt = $pdo->prepare("
                SELECT c.*, u.nombre_completo AS usuario_nombre,
                       u2.nombre_completo AS usuario_cierre_nombre
                FROM caja c
                JOIN usuarios u ON u.id = c.usuario_id
                LEFT JOIN usuarios u2 ON u2.id = c.usuario_id
                WHERE c.id = ?
            ");
            $stmt->execute([$id]);
            $caja = $stmt->fetch();
            if (!$caja) {
                http_response_code(404);
                echo json_encode(['error' => 'Caja no encontrada']);
                exit;
            }

            $stmt = $pdo->prepare("
                SELECT m.*, u.nombre_completo AS usuario_nombre
                FROM movimientos_caja m
                JOIN usuarios u ON u.id = m.usuario_id
                WHERE m.caja_id = ?
                ORDER BY m.id ASC
            ");
            $stmt->execute([$id]);
            $caja['movimientos'] = $stmt->fetchAll();

            echo json_encode($caja, JSON_UNESCAPED_UNICODE);
            exit;
        }

        http_response_code(400);
        echo json_encode(['error' => 'Acción no especificada']);
        exit;
    }
    // POST - Abrir, cerrar, movimiento
    if ($method === 'POST') {

        // ---------- ABRIR ----------
        if ($action === 'abrir') {
            if (!tienePermiso($permisos, 'caja.abrir')) {
                http_response_code(403);
                echo json_encode(['error' => 'Sin permiso']);
                exit;
            }

            // ¿Ya tiene caja abierta?
            $stmt = $pdo->prepare("SELECT id FROM caja WHERE usuario_id = ? AND estado = 'abierta'");
            $stmt->execute([$usuarioId]);
            if ($stmt->fetch()) {
                http_response_code(409);
                echo json_encode(['error' => 'Ya tienes una caja abierta']);
                exit;
            }

            $montoApertura = (float)($input['monto_apertura'] ?? 0);
            if ($montoApertura < 0) {
                http_response_code(400);
                echo json_encode(['error' => 'Monto inválido']);
                exit;
            }

            $pdo->beginTransaction();

            $stmt = $pdo->prepare("
                INSERT INTO caja (usuario_id, monto_apertura, estado, abierta_en, notas)
                VALUES (?, ?, 'abierta', NOW(), ?)
            ");
            $stmt->execute([$usuarioId, $montoApertura, $input['notas'] ?? null]);
            $cajaId = (int)$pdo->lastInsertId();

            $pdo->prepare("
                INSERT INTO movimientos_caja (caja_id, tipo, monto, concepto, usuario_id)
                VALUES (?, 'apertura', ?, 'Apertura de caja', ?)
            ")->execute([$cajaId, $montoApertura, $usuarioId]);

            $pdo->prepare("
                INSERT INTO auditoria_logs (usuario_id, accion, modulo, entidad, entidad_id)
                VALUES (?, 'abrir_caja', 'caja', 'caja', ?)
            ")->execute([$usuarioId, $cajaId]);

            $pdo->commit();

            echo json_encode(['ok' => true, 'id' => $cajaId, 'mensaje' => 'Caja abierta con ' . number_format($montoApertura, 2)]);
            exit;
        }

        // ---------- CERRAR ----------
        if ($action === 'cerrar') {
            if (!tienePermiso($permisos, 'caja.cerrar')) {
                http_response_code(403);
                echo json_encode(['error' => 'Sin permiso']);
                exit;
            }

            $stmt = $pdo->prepare("
                SELECT * FROM caja WHERE usuario_id = ? AND estado = 'abierta' ORDER BY id DESC LIMIT 1
            ");
            $stmt->execute([$usuarioId]);
            $caja = $stmt->fetch();
            if (!$caja) {
                http_response_code(404);
                echo json_encode(['error' => 'No tienes caja abierta']);
                exit;
            }

            $montoCierre = (float)($input['monto_cierre'] ?? 0);
            $notas = $input['notas'] ?? null;

            // Calcular esperado
            $stmt = $pdo->prepare("
                SELECT
                    COALESCE(SUM(CASE WHEN tipo IN ('ingreso_manual','venta','apertura') THEN monto ELSE 0 END), 0) AS ingresos,
                    COALESCE(SUM(CASE WHEN tipo IN ('egreso_manual','retiro') THEN monto ELSE 0 END), 0) AS egresos
                FROM movimientos_caja WHERE caja_id = ?
            ");
            $stmt->execute([$caja['id']]);
            $mov = $stmt->fetch();
            $esperado = (float)$mov['ingresos'] - (float)$mov['egresos'];

            $stmt = $pdo->prepare("
                SELECT COALESCE(SUM(total), 0) AS t FROM ventas
                WHERE caja_id = ? AND estado = 'completada'
            ");
            $stmt->execute([$caja['id']]);
            $totalVentas = (float)$stmt->fetch()['t'];

            $diferencia = $montoCierre - $esperado;

            $pdo->beginTransaction();

            $stmt = $pdo->prepare("
                UPDATE caja SET
                    monto_cierre = ?, monto_esperado = ?, diferencia_cierre = ?,
                    total_ventas = ?, estado = 'cerrada', cerrada_en = NOW(), notas = CONCAT(COALESCE(notas,''), ?)
                WHERE id = ?
            ");
            $stmt->execute([$montoCierre, $esperado, $diferencia, $totalVentas, "\n--- CIERRE ---\n" . ($notas ?? ''), $caja['id']]);

            $pdo->prepare("
                INSERT INTO movimientos_caja (caja_id, tipo, monto, concepto, usuario_id)
                VALUES (?, 'cierre', ?, ?, ?)
            ")->execute([$caja['id'], $montoCierre, "Cierre de caja. Diferencia: " . number_format($diferencia, 2), $usuarioId]);

            $pdo->prepare("
                INSERT INTO auditoria_logs (usuario_id, accion, modulo, entidad, entidad_id, detalle)
                VALUES (?, 'cerrar_caja', 'caja', 'caja', ?, ?)
            ")->execute([$usuarioId, $caja['id'], json_encode([
                'monto_cierre' => $montoCierre,
                'esperado' => $esperado,
                'diferencia' => $diferencia,
            ])]);

            $pdo->commit();

            echo json_encode([
                'ok' => true,
                'monto_cierre' => $montoCierre,
                'esperado' => $esperado,
                'diferencia' => $diferencia,
                'mensaje' => "Caja cerrada. Diferencia: Bs. " . number_format($diferencia, 2)
            ]);
            exit;
        }

        // ---------- MOVIMIENTO MANUAL ----------
        if ($action === 'movimiento') {
            if (!tienePermiso($permisos, 'caja.movimiento_manual')) {
                http_response_code(403);
                echo json_encode(['error' => 'Sin permiso']);
                exit;
            }

            $stmt = $pdo->prepare("SELECT * FROM caja WHERE usuario_id = ? AND estado = 'abierta' ORDER BY id DESC LIMIT 1");
            $stmt->execute([$usuarioId]);
            $caja = $stmt->fetch();
            if (!$caja) {
                http_response_code(400);
                echo json_encode(['error' => 'No hay caja abierta']);
                exit;
            }

            $tipo = $input['tipo'] ?? null;  // 'ingreso_manual' o 'egreso_manual'
            $monto = (float)($input['monto'] ?? 0);
            $concepto = trim($input['concepto'] ?? '');

            if (!in_array($tipo, ['ingreso_manual', 'egreso_manual'], true)) {
                http_response_code(400);
                echo json_encode(['error' => 'Tipo inválido']);
                exit;
            }
            if ($monto <= 0) {
                http_response_code(400);
                echo json_encode(['error' => 'Monto debe ser mayor a 0']);
                exit;
            }
            if ($concepto === '') {
                http_response_code(400);
                echo json_encode(['error' => 'Concepto obligatorio']);
                exit;
            }

            $pdo->prepare("
                INSERT INTO movimientos_caja (caja_id, tipo, monto, concepto, usuario_id)
                VALUES (?, ?, ?, ?, ?)
            ")->execute([$caja['id'], $tipo, $monto, $concepto, $usuarioId]);

            echo json_encode(['ok' => true, 'mensaje' => 'Movimiento registrado']);
            exit;
        }

        http_response_code(400);
        echo json_encode(['error' => 'Acción no especificada']);
        exit;
    }

    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Error en la base de datos', 'detalle' => $e->getMessage()]);
}
