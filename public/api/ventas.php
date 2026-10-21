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

$pdo = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];
$id = isset($_GET['id']) ? (int)$_GET['id'] : null;

// Autenticación
$token = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
if ($token && strpos($token, 'Bearer ') === 0) $token = substr($token, 7);
if (!$token) {
    http_response_code(401);
    echo json_encode(['error' => 'Token no proporcionado']);
    exit;
}

$stmt = $pdo->prepare("
    SELECT s.usuario_id, u.rol_id FROM sesiones s
    JOIN usuarios u ON u.id = s.usuario_id
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
    if ($method === 'GET') {
        if (!tienePermiso($permisos, 'ventas.ver')) {
            http_response_code(403);
            echo json_encode(['error' => 'Sin permiso']);
            exit;
        }

        if ($id) {
            $stmt = $pdo->prepare("
                SELECT v.*, u.nombre_completo AS usuario_nombre
                FROM ventas v JOIN usuarios u ON u.id = v.usuario_id
                WHERE v.id = ?
            ");
            $stmt->execute([$id]);
            $venta = $stmt->fetch();
            if (!$venta) {
                http_response_code(404);
                echo json_encode(['error' => 'No encontrada']);
                exit;
            }

            $stmt = $pdo->prepare("
    SELECT vd.*, p.nombre AS producto_nombre, p.sku, p.unidad_medida
    FROM venta_detalle vd
    JOIN productos p ON p.id = vd.producto_id
    WHERE vd.venta_id = ?
");
            $stmt->execute([$id]);
            $venta['lineas'] = $stmt->fetchAll();

            echo json_encode($venta, JSON_UNESCAPED_UNICODE);
        } else {
            $stmt = $pdo->query("
                SELECT v.id, v.numero_factura, v.cliente_nombre, v.total, v.estado,
                       v.metodo_pago, v.created_at, u.nombre_completo AS usuario_nombre,
                       (SELECT COUNT(*) FROM venta_detalle WHERE venta_id = v.id) AS total_lineas
                FROM ventas v JOIN usuarios u ON u.id = v.usuario_id
                ORDER BY v.id DESC LIMIT 100
            ");
            echo json_encode($stmt->fetchAll(), JSON_UNESCAPED_UNICODE);
        }
        exit;
    }
    if ($method === 'POST') {
        if (!tienePermiso($permisos, 'ventas.crear')) {
            http_response_code(403);
            echo json_encode(['error' => 'Sin permiso']);
            exit;
        }

        $lineas = $input['lineas'] ?? [];
        if (empty($lineas)) {
            http_response_code(400);
            echo json_encode(['error' => 'Debe incluir al menos un producto']);
            exit;
        }

        // Verificar caja abierta
        $stmt = $pdo->prepare("SELECT id FROM caja WHERE usuario_id = ? AND estado = 'abierta' LIMIT 1");
        $stmt->execute([$usuarioId]);
        $caja = $stmt->fetch();
        if (!$caja) {
            http_response_code(400);
            echo json_encode(['error' => 'No hay caja abierta. Abre una caja antes de vender.']);
            exit;
        }
        $cajaId = (int)$caja['id'];

        // Config IVA
        $stmt = $pdo->query("SELECT valor FROM configuracion WHERE clave = 'iva_porcentaje'");
        $ivaConfig = (float)($stmt->fetch()['valor'] ?? 16);

        $aplicaIVA = !empty($input['aplica_iva']);
        $descuentoGlobal = (float)($input['descuento_global'] ?? 0);
        $metodoPago = $input['metodo_pago'] ?? 'efectivo';

        $pdo->beginTransaction();

        try {
            // Número factura
            $year = date('Y');
            $stmt = $pdo->prepare("SELECT COUNT(*) AS t FROM ventas WHERE YEAR(created_at) = ?");
            $stmt->execute([$year]);
            $correlativo = (int)$stmt->fetch()['t'] + 1;
            $numeroFactura = sprintf('FAC-%d-%05d', $year, $correlativo);

            $subtotal = 0;
            $costoTotal = 0;

            // Insertar cabecera (con placeholders)
            $stmt = $pdo->prepare("
                INSERT INTO ventas
                    (numero_factura, cliente_nombre, cliente_cedula, cliente_telefono, cliente_direccion,
                     subtotal, descuento, descuento_global, iva, iva_porcentaje, total, costo_total, utilidad,
                     metodo_pago, estado, usuario_id, caja_id, observaciones)
                VALUES (?, ?, ?, ?, ?, ?, 0, ?, 0, ?, 0, 0, 0, ?, 'completada', ?, ?, ?)
            ");
            $stmt->execute([
                $numeroFactura,
                $input['cliente_nombre'] ?? null,
                $input['cliente_cedula'] ?? null,
                $input['cliente_telefono'] ?? null,
                $input['cliente_direccion'] ?? null,
                0, // subtotal temporal
                $descuentoGlobal,
                $ivaConfig,
                $metodoPago,
                $usuarioId,
                $cajaId,
                $input['observaciones'] ?? null,
            ]);
            $ventaId = (int)$pdo->lastInsertId();

            $stmtProducto = $pdo->prepare("SELECT id, stock, nombre, precio, costo FROM productos WHERE id = ? AND activo = 1");
            $stmtUpdateStock = $pdo->prepare("UPDATE productos SET stock = stock - ? WHERE id = ?");
            $stmtDetalle = $pdo->prepare("
                INSERT INTO venta_detalle
                    (venta_id, producto_id, cantidad, precio_unitario, costo_unitario, subtotal)
                VALUES (?, ?, ?, ?, ?, ?)
            ");
            $stmtMovimiento = $pdo->prepare("
                INSERT INTO movimientos_stock
                    (producto_id, almacen_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia_id, usuario_id)
                VALUES (?, NULL, 'salida_venta', ?, ?, ?, ?, ?, ?)
            ");

            foreach ($lineas as $l) {
                $prodId = (int)$l['producto_id'];
                $cantidad = (int)$l['cantidad'];
                if ($cantidad <= 0) throw new Exception("Cantidad inválida");

                $stmtProducto->execute([$prodId]);
                $prod = $stmtProducto->fetch();
                if (!$prod) throw new Exception("Producto ID $prodId no encontrado");

                if ((int)$prod['stock'] < $cantidad) {
                    throw new Exception("Stock insuficiente de '{$prod['nombre']}'. Disponible: {$prod['stock']}");
                }

                $precio = isset($l['precio_unitario']) && $l['precio_unitario'] !== ''
                    ? (float)$l['precio_unitario']
                    : (float)$prod['precio'];
                $costoUnit = (float)$prod['costo'];
                $subtotalLinea = $cantidad * $precio;

                $stmtDetalle->execute([$ventaId, $prodId, $cantidad, $precio, $costoUnit, $subtotalLinea]);

                $stockAntes = (int)$prod['stock'];
                $stockNuevo = $stockAntes - $cantidad;
                $stmtUpdateStock->execute([$cantidad, $prodId]);
                $stmtMovimiento->execute([
                    $prodId,
                    $cantidad,
                    $stockAntes,
                    $stockNuevo,
                    "Venta $numeroFactura",
                    $ventaId,
                    $usuarioId
                ]);

                $subtotal += $subtotalLinea;
                $costoTotal += $cantidad * $costoUnit;
            }

            // IVA y total
            $baseGravable = max(0, $subtotal - $descuentoGlobal);
            $montoIVA = $aplicaIVA ? round($baseGravable * ($ivaConfig / 100), 2) : 0;
            $total = $baseGravable + $montoIVA;
            $utilidad = $total - $costoTotal;

            $pdo->prepare("
                UPDATE ventas SET
                    subtotal = ?, descuento = ?, iva = ?, total = ?, costo_total = ?, utilidad = ?
                WHERE id = ?
            ")->execute([$subtotal, $descuentoGlobal, $montoIVA, $total, $costoTotal, $utilidad, $ventaId]);

            // Movimiento de caja
            $pdo->prepare("
                INSERT INTO movimientos_caja (caja_id, tipo, monto, concepto, referencia_id, usuario_id)
                VALUES (?, 'venta', ?, ?, ?, ?)
            ")->execute([$cajaId, $total, "Venta $numeroFactura", $ventaId, $usuarioId]);

            // Auditoría
            $pdo->prepare("
                INSERT INTO auditoria_logs (usuario_id, accion, modulo, entidad, entidad_id, detalle)
                VALUES (?, 'crear_venta', 'ventas', 'ventas', ?, ?)
            ")->execute([$usuarioId, $ventaId, json_encode([
                'numero' => $numeroFactura,
                'total' => $total,
                'lineas' => count($lineas)
            ])]);

            $pdo->commit();

            echo json_encode([
                'ok' => true,
                'id' => $ventaId,
                'numero_factura' => $numeroFactura,
                'subtotal' => $subtotal,
                'descuento' => $descuentoGlobal,
                'iva' => $montoIVA,
                'total' => $total,
                'mensaje' => "Venta $numeroFactura registrada"
            ], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            $pdo->rollBack();
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
        exit;
    }

    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'Error en BD', 'detalle' => $e->getMessage()]);
}
