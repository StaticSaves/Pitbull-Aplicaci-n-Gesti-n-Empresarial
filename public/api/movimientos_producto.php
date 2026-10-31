<?php

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

require_once __DIR__ . '/../../app/config/database.php';

try {
    $pdo = Database::getConnection();
    $method = $_SERVER['REQUEST_METHOD'];
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

    if ($method === 'GET') {
        if (!in_array('reportes.ver', $permissions, true)) {
            http_response_code(403);
            echo json_encode(['error' => 'No tienes permiso para consultar el reporte']);
            exit;
        }

        $rows = $pdo->query("
            SELECT DATE(created_at) AS movement_date, SUM(impacto) AS impact
            FROM movimientos_producto
            WHERE created_at >= CURDATE() - INTERVAL 29 DAY
              AND created_at < CURDATE() + INTERVAL 1 DAY
            GROUP BY DATE(created_at)
            ORDER BY movement_date
        ")->fetchAll();
        echo json_encode(['daily' => $rows], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($method !== 'POST') {
        header('Allow: GET, POST, OPTIONS');
        http_response_code(405);
        echo json_encode(['error' => 'Método no permitido']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode(['error' => 'Los datos enviados no son válidos']);
        exit;
    }

    $tipo = $input['tipo'] ?? '';
    $permisoRequerido = match ($tipo) {
        'merma', 'ajuste_stock' => 'stock.merma',
        'devolucion' => 'stock.entrada',
        default => null,
    };
    if ($permisoRequerido === null) {
        http_response_code(400);
        echo json_encode(['error' => 'Tipo de movimiento no válido']);
        exit;
    }
    if (!in_array($permisoRequerido, $permissions, true)) {
        http_response_code(403);
        echo json_encode(['error' => 'No tienes permiso para registrar este movimiento']);
        exit;
    }

    $productoId = filter_var($input['producto_id'] ?? null, FILTER_VALIDATE_INT);
    $cantidad = filter_var($input['cantidad'] ?? null, FILTER_VALIDATE_INT);
    $motivo = trim((string)($input['motivo'] ?? ''));
    if (!$productoId || !$cantidad || $motivo === '' || mb_strlen($motivo) > 255) {
        http_response_code(400);
        echo json_encode(['error' => 'Producto, cantidad y motivo son obligatorios']);
        exit;
    }
    if ($tipo !== 'ajuste_stock' && $cantidad < 1) {
        http_response_code(400);
        echo json_encode(['error' => 'La cantidad debe ser mayor que cero']);
        exit;
    }

    $pdo->beginTransaction();
    $stmt = $pdo->prepare("
        SELECT id, precio, costo, stock
        FROM productos
        WHERE id = ? AND activo = 1
        FOR UPDATE
    ");
    $stmt->execute([$productoId]);
    $product = $stmt->fetch();
    if (!$product) {
        $pdo->rollBack();
        http_response_code(404);
        echo json_encode(['error' => 'Producto no encontrado o inactivo']);
        exit;
    }

    $stockAnterior = (int)$product['stock'];
    $precio = (float)$product['precio'];
    $cantidadMovimiento = $cantidad;
    $tipoStock = 'ajuste';
    $motivoMerma = 'otro';
    if ($tipo === 'merma') {
        $stockNuevo = $stockAnterior - $cantidad;
        $impacto = -1 * $cantidad * $precio;
        $tipoStock = 'salida_merma';
        $motivoMerma = $input['motivo_merma'] ?? 'otro';
        if (!in_array($motivoMerma, ['dañado', 'perdido', 'vencido', 'robo', 'otro'], true)) {
            $motivoMerma = 'otro';
        }
    } elseif ($tipo === 'devolucion') {
        $stockNuevo = $stockAnterior + $cantidad;
        $impacto = $cantidad * $precio;
        $tipoStock = 'entrada';
    } else {
        $stockNuevo = $stockAnterior + $cantidad;
        $impacto = $cantidad * $precio;
    }

    if ($stockNuevo < 0) {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode(['error' => 'El ajuste no puede dejar existencias negativas']);
        exit;
    }

    $pdo->prepare("UPDATE productos SET stock = ? WHERE id = ?")
        ->execute([$stockNuevo, $productoId]);
    $stmt = $pdo->prepare("
        INSERT INTO movimientos_producto
            (producto_id, usuario_id, tipo, cantidad, stock_anterior, stock_nuevo,
             precio_anterior, precio_nuevo, impacto, motivo)
        VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
    ");
    $stmt->execute([
        $productoId,
        $session['usuario_id'],
        $tipo,
        $cantidadMovimiento,
        $stockAnterior,
        $stockNuevo,
        $precio,
        $impacto,
        $motivo,
    ]);
    $movimientoId = (int)$pdo->lastInsertId();

    if ($tipo === 'merma') {
        $pdo->prepare("
            INSERT INTO mermas (producto_id, cantidad, motivo, descripcion, costo_perdida, usuario_id)
            VALUES (?, ?, ?, ?, ?, ?)
        ")->execute([
            $productoId,
            $cantidad,
            $motivoMerma,
            $motivo,
            $cantidad * (float)$product['costo'],
            $session['usuario_id'],
        ]);
    }

    $pdo->prepare("
        INSERT INTO movimientos_stock
            (producto_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia_id, usuario_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ")->execute([
        $productoId,
        $tipoStock,
        $cantidad,
        $stockAnterior,
        $stockNuevo,
        $motivo,
        $movimientoId,
        $session['usuario_id'],
    ]);
    $pdo->prepare("
        INSERT INTO auditoria_logs (usuario_id, accion, modulo, entidad, entidad_id, detalle)
        VALUES (?, ?, 'inventario', 'productos', ?, ?)
    ")->execute([
        $session['usuario_id'],
        'movimiento_' . $tipo,
        $productoId,
        json_encode(['cantidad' => $cantidad, 'impacto' => $impacto, 'motivo' => $motivo], JSON_UNESCAPED_UNICODE),
    ]);
    $pdo->commit();

    echo json_encode([
        'ok' => true,
        'id' => $movimientoId,
        'stock_nuevo' => $stockNuevo,
        'impacto' => $impacto,
        'mensaje' => 'Movimiento registrado',
    ], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Product movement error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'No se pudo registrar el movimiento']);
}
