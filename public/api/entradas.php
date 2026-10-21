<?php

header('Content-Type: application/json; charset=utf-8');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
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
if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    if ($raw) $input = json_decode($raw, true) ?? [];
}

try {
    switch ($method) {
        // GET - Listar / detalle
        case 'GET':
            if (!tienePermiso($permisos, 'entradas.ver')) {
                http_response_code(403);
                echo json_encode(['error' => 'Sin permiso']);
                exit;
            }

            if ($id) {
                // Detalle de una entrada
                $stmt = $pdo->prepare("
                    SELECT e.*, p.nombre AS proveedor_nombre, a.nombre AS almacen_nombre,
                           u.nombre_completo AS usuario_nombre
                    FROM entradas e
                    LEFT JOIN proveedores p ON p.id = e.proveedor_id
                    LEFT JOIN almacenes a ON a.id = e.almacen_id
                    LEFT JOIN usuarios u ON u.id = e.usuario_id
                    WHERE e.id = ?
                ");
                $stmt->execute([$id]);
                $entrada = $stmt->fetch();
                if (!$entrada) {
                    http_response_code(404);
                    echo json_encode(['error' => 'No encontrada']);
                    exit;
                }

                // Detalle de líneas
                $stmt = $pdo->prepare("
                    SELECT ed.*, p.nombre AS producto_nombre, p.sku, p.unidad_medida
                    FROM entrada_detalle ed
                    JOIN productos p ON p.id = ed.producto_id
                    WHERE ed.entrada_id = ?
                ");
                $stmt->execute([$id]);
                $entrada['lineas'] = $stmt->fetchAll();

                echo json_encode($entrada, JSON_UNESCAPED_UNICODE);
            } else {
                // Listar últimas 50
                $stmt = $pdo->query("
                    SELECT e.id, e.numero, e.tipo, e.total, e.created_at,
                           p.nombre AS proveedor_nombre, a.nombre AS almacen_nombre,
                           u.nombre_completo AS usuario_nombre,
                           (SELECT COUNT(*) FROM entrada_detalle WHERE entrada_id = e.id) AS total_lineas
                    FROM entradas e
                    LEFT JOIN proveedores p ON p.id = e.proveedor_id
                    LEFT JOIN almacenes a ON a.id = e.almacen_id
                    LEFT JOIN usuarios u ON u.id = e.usuario_id
                    ORDER BY e.id DESC
                    LIMIT 50
                ");
                echo json_encode($stmt->fetchAll(), JSON_UNESCAPED_UNICODE);
            }
            break;
        // POST - Crear entrada (TRANSACCIÓN)
        case 'POST':
            if (!tienePermiso($permisos, 'entradas.crear')) {
                http_response_code(403);
                echo json_encode(['error' => 'Sin permiso']);
                exit;
            }

            $proveedorId  = !empty($input['proveedor_id']) ? (int)$input['proveedor_id'] : null;
            $almacenId    = (int)($input['almacen_id'] ?? 0);
            $observaciones = $input['observaciones'] ?? null;
            $lineas       = $input['lineas'] ?? [];

            if ($almacenId <= 0) {
                http_response_code(400);
                echo json_encode(['error' => 'Almacén requerido']);
                exit;
            }
            if (empty($lineas)) {
                http_response_code(400);
                echo json_encode(['error' => 'Debe incluir al menos una línea']);
                exit;
            }

            // Verificar almacén existe
            $check = $pdo->prepare("SELECT id FROM almacenes WHERE id = ? AND activo = 1");
            $check->execute([$almacenId]);
            if (!$check->fetch()) {
                http_response_code(400);
                echo json_encode(['error' => 'Almacén no válido']);
                exit;
            }

            // Verificar proveedor si se dio
            if ($proveedorId) {
                $check = $pdo->prepare("SELECT id FROM proveedores WHERE id = ?");
                $check->execute([$proveedorId]);
                if (!$check->fetch()) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Proveedor no válido']);
                    exit;
                }
            }
            // INICIAR TRANSACCIÓN
            $pdo->beginTransaction();

            try {
                // Generar número correlativo ENT-YYYY-NNNNN
                $year = date('Y');
                $stmt = $pdo->prepare("
                    SELECT COUNT(*) AS total FROM entradas WHERE YEAR(created_at) = ?
                ");
                $stmt->execute([$year]);
                $correlativo = (int)$stmt->fetch()['total'] + 1;
                $numero = sprintf('ENT-%d-%05d', $year, $correlativo);

                // Calcular totales de la entrada
                $subtotal = 0;
                $gastosTotal = 0;
                foreach ($lineas as $l) {
                    $cantidad = (int)$l['cantidad'];
                    $costo    = (float)$l['costo_unitario'];
                    $gastos   = (float)($l['gastos_linea'] ?? 0);
                    $subtotal += $cantidad * $costo;
                    $gastosTotal += $gastos;
                }
                $total = $subtotal + $gastosTotal;

                // Insertar cabecera de entrada
                $stmt = $pdo->prepare("
                    INSERT INTO entradas
                        (numero, proveedor_id, almacen_id, tipo, subtotal, gastos_total, total, observaciones, usuario_id)
                    VALUES (?, ?, ?, 'compra', ?, ?, ?, ?, ?)
                ");
                $stmt->execute([
                    $numero,
                    $proveedorId,
                    $almacenId,
                    $subtotal,
                    $gastosTotal,
                    $total,
                    $observaciones,
                    $sesion['usuario_id'],
                ]);
                $entradaId = (int)$pdo->lastInsertId();

                // Insertar líneas + actualizar stock + registrar movimiento
                $stmtDetalle = $pdo->prepare("
                    INSERT INTO entrada_detalle
                        (entrada_id, producto_id, cantidad, costo_unitario, gastos_linea, subtotal, total_linea, observacion)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ");

                $stmtProducto = $pdo->prepare("
                    SELECT id, stock, nombre, costo FROM productos WHERE id = ? AND activo = 1
                ");

                $stmtUpdateStock = $pdo->prepare("
                    UPDATE productos SET stock = stock + ?, costo = ? WHERE id = ?
                ");

                $stmtMovimiento = $pdo->prepare("
                    INSERT INTO movimientos_stock
                        (producto_id, almacen_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia_id, entrada_id, usuario_id)
                    VALUES (?, ?, 'entrada_compra', ?, ?, ?, ?, ?, ?, ?)
                ");

                foreach ($lineas as $l) {
                    $productoId = (int)$l['producto_id'];
                    $cantidad   = (int)$l['cantidad'];
                    $costo      = (float)$l['costo_unitario'];
                    $gastos     = (float)($l['gastos_linea'] ?? 0);
                    $obs        = $l['observacion'] ?? null;

                    if ($cantidad <= 0) throw new Exception("Cantidad debe ser mayor a 0");
                    if ($costo < 0)     throw new Exception("Costo no puede ser negativo");

                    // Verificar producto
                    $stmtProducto->execute([$productoId]);
                    $prod = $stmtProducto->fetch();
                    if (!$prod) throw new Exception("Producto ID $productoId no encontrado o inactivo");

                    $subtotalLinea = $cantidad * $costo;
                    $totalLinea    = $subtotalLinea + $gastos;

                    // Insertar línea
                    $stmtDetalle->execute([
                        $entradaId,
                        $productoId,
                        $cantidad,
                        $costo,
                        $gastos,
                        $subtotalLinea,
                        $totalLinea,
                        $obs
                    ]);

                    // Stock antes y después
                    $stockAntes = (int)$prod['stock'];
                    $stockNuevo = $stockAntes + $cantidad;

                    // Nuevo costo promedio ponderado
                    $costoActual = (float)$prod['costo'];
                    if ($stockAntes > 0 && $costoActual > 0) {
                        $nuevoCosto = (($stockAntes * $costoActual) + ($cantidad * $costo)) / $stockNuevo;
                    } else {
                        $nuevoCosto = $costo;
                    }

                    // Actualizar stock y costo
                    $stmtUpdateStock->execute([$cantidad, round($nuevoCosto, 2), $productoId]);

                    // Registrar movimiento
                    $stmtMovimiento->execute([
                        $productoId,
                        $almacenId,
                        $cantidad,
                        $stockAntes,
                        $stockNuevo,
                        "Entrada de compra #$numero",
                        $entradaId,
                        $entradaId,
                        $sesion['usuario_id'],
                    ]);
                }

                //Auditoría
                $pdo->prepare("
                    INSERT INTO auditoria_logs (usuario_id, accion, modulo, entidad, entidad_id, detalle)
                    VALUES (?, 'crear_entrada', 'inventario', 'entradas', ?, ?)
                ")->execute([
                    $sesion['usuario_id'],
                    $entradaId,
                    json_encode([
                        'numero' => $numero,
                        'proveedor_id' => $proveedorId,
                        'almacen_id' => $almacenId,
                        'total' => $total,
                        'lineas' => count($lineas),
                    ], JSON_UNESCAPED_UNICODE)
                ]);
                // COMMIT
                $pdo->commit();

                echo json_encode([
                    'ok' => true,
                    'id' => $entradaId,
                    'numero' => $numero,
                    'total' => $total,
                    'mensaje' => "Entrada $numero registrada. Stock actualizado."
                ], JSON_UNESCAPED_UNICODE);
            } catch (Exception $e) {
                // ROLLBACK si algo falla
                $pdo->rollBack();
                http_response_code(500);
                echo json_encode([
                    'error' => 'Error al registrar la entrada. Se canceló todo.',
                    'detalle' => $e->getMessage()
                ]);
            }
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
