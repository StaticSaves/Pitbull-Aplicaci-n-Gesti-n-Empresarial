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

// Cargar permisos del rol
$stmt = $pdo->prepare("
    SELECT p.clave
    FROM permisos p
    JOIN rol_permiso rp ON rp.permiso_id = p.id
    WHERE rp.rol_id = ?
");
$stmt->execute([$sesion['rol_id']]);
$permisos = array_column($stmt->fetchAll(), 'clave');

function tienePermiso(array $permisos, string $clave): bool
{
    return in_array($clave, $permisos, true);
}

// Verificar permiso según método HTTP
$permisoRequerido = match ($method) {
    'GET'    => 'productos.ver',
    'POST'   => 'productos.crear',
    'PUT'    => 'productos.editar',
    'DELETE' => 'productos.eliminar',
    default  => null,
};

$puedeConsultarParaMovimientos = $method === 'GET' &&
    (tienePermiso($permisos, 'stock.merma') || tienePermiso($permisos, 'stock.entrada'));
if ($permisoRequerido && !tienePermiso($permisos, $permisoRequerido) && !$puedeConsultarParaMovimientos) {
    http_response_code(403);
    echo json_encode([
        'error' => "No tienes permiso para esta acción",
        'permiso_requerido' => $permisoRequerido,
    ]);
    exit;
}

// Leer body JSON para POST/PUT/DELETE
$input = [];
if (in_array($method, ['POST', 'PUT', 'DELETE'])) {
    $raw = file_get_contents('php://input');
    if ($raw) {
        $input = json_decode($raw, true) ?? [];
    }
}

try {
    switch ($method) {

        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare("
                    SELECT p.*, c.nombre AS categoria_nombre, pr.nombre AS proveedor_nombre
                    FROM productos p
                    LEFT JOIN categorias c  ON c.id  = p.categoria_id
                    LEFT JOIN proveedores pr ON pr.id = p.proveedor_id
                    WHERE p.id = ?
                ");
                $stmt->execute([$id]);
                $prod = $stmt->fetch();
                if (!$prod) {
                    http_response_code(404);
                    echo json_encode(['error' => 'Producto no encontrado']);
                    exit;
                }
                if (!tienePermiso($permisos, 'productos.ver_costos')) {
                    unset($prod['costo'], $prod['margen_ganancia']);
                }
                echo json_encode($prod);
            } else {
                $stmt = $pdo->query("
                    SELECT p.*, c.nombre AS categoria_nombre
                    FROM productos p
                    LEFT JOIN categorias c ON c.id = p.categoria_id
                    WHERE p.activo = 1
                    ORDER BY p.id DESC
                ");
                $productos = $stmt->fetchAll();
                if (!tienePermiso($permisos, 'productos.ver_costos')) {
                    foreach ($productos as &$producto) {
                        unset($producto['costo'], $producto['margen_ganancia']);
                    }
                    unset($producto);
                }
                echo json_encode($productos);
            }
            break;

        case 'POST':
            $sku    = trim($input['sku'] ?? '');
            $nombre = trim($input['nombre'] ?? '');

            if ($sku === '' || $nombre === '') {
                http_response_code(400);
                echo json_encode(['error' => 'SKU y nombre son obligatorios']);
                exit;
            }

            // Verificar SKU duplicado
            $check = $pdo->prepare("SELECT id FROM productos WHERE sku = ?");
            $check->execute([$sku]);
            if ($check->fetch()) {
                http_response_code(409);
                echo json_encode(['error' => 'Ya existe un producto con ese SKU']);
                exit;
            }

            $stmt = $pdo->prepare("
                INSERT INTO productos
                    (sku, nombre, descripcion, categoria_id, proveedor_id,
                     precio, precio_mayorista, costo, stock, stock_minimo,
                     unidad_medida, activo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            ");
            $stmt->execute([
                $sku,
                $nombre,
                $input['descripcion'] ?? null,
                !empty($input['categoria_id']) ? (int)$input['categoria_id'] : null,
                !empty($input['proveedor_id']) ? (int)$input['proveedor_id'] : null,
                (float)($input['precio'] ?? 0),
                isset($input['precio_mayorista']) && $input['precio_mayorista'] !== ''
                    ? (float)$input['precio_mayorista'] : null,
                tienePermiso($permisos, 'productos.ver_costos')
                    ? (float)($input['costo'] ?? 0)
                    : 0,
                (int)($input['stock'] ?? 0),
                (int)($input['stock_minimo'] ?? 0),
                $input['unidad_medida'] ?? 'unidad',
            ]);

            echo json_encode([
                'ok' => true,
                'id' => (int)$pdo->lastInsertId(),
                'mensaje' => 'Producto creado correctamente'
            ]);
            break;

        case 'PUT':
            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'ID requerido']);
                exit;
            }

            $pdo->beginTransaction();
            $stmtActual = $pdo->prepare("
                SELECT precio, stock
                FROM productos
                WHERE id = ? AND activo = 1
                FOR UPDATE
            ");
            $stmtActual->execute([$id]);
            $productoActual = $stmtActual->fetch();
            if (!$productoActual) {
                $pdo->rollBack();
                http_response_code(404);
                echo json_encode(['error' => 'Producto no encontrado']);
                exit;
            }

            $puedeVerCostos = tienePermiso($permisos, 'productos.ver_costos');
            $actualizarCosto = $puedeVerCostos ? "costo = ?," : "";
            $sql = "
                UPDATE productos SET
                    sku              = ?,
                    nombre           = ?,
                    descripcion      = ?,
                    categoria_id     = ?,
                    proveedor_id     = ?,
                    precio           = ?,
                    precio_mayorista = ?,
                    $actualizarCosto
                    stock            = ?,
                    stock_minimo     = ?,
                    unidad_medida    = ?
                WHERE id = ?
            ";
            $stmt = $pdo->prepare($sql);
            $parametros = [
                trim($input['sku'] ?? ''),
                trim($input['nombre'] ?? ''),
                $input['descripcion'] ?? null,
                !empty($input['categoria_id']) ? (int)$input['categoria_id'] : null,
                !empty($input['proveedor_id']) ? (int)$input['proveedor_id'] : null,
                (float)($input['precio'] ?? 0),
                isset($input['precio_mayorista']) && $input['precio_mayorista'] !== ''
                    ? (float)$input['precio_mayorista'] : null,
            ];
            if ($puedeVerCostos) {
                $parametros[] = (float)($input['costo'] ?? 0);
            }
            array_push(
                $parametros,
                (int)($input['stock'] ?? 0),
                (int)($input['stock_minimo'] ?? 0),
                $input['unidad_medida'] ?? 'unidad',
                $id
            );
            $stmt->execute($parametros);
            $precioNuevo = (float)($input['precio'] ?? 0);
            $precioAnterior = (float)$productoActual['precio'];
            if (round($precioNuevo - $precioAnterior, 2) !== 0.0) {
                $pdo->prepare("
                    INSERT INTO movimientos_producto
                        (producto_id, usuario_id, tipo, cantidad, stock_anterior, stock_nuevo,
                         precio_anterior, precio_nuevo, impacto, motivo)
                    VALUES (?, ?, 'ajuste_precio', 0, ?, ?, ?, ?, ?, ?)
                ")->execute([
                    $id,
                    $sesion['usuario_id'],
                    (int)$productoActual['stock'],
                    (int)$productoActual['stock'],
                    $precioAnterior,
                    $precioNuevo,
                    round(($precioNuevo - $precioAnterior) * (int)$productoActual['stock'], 2),
                    'Cambio del precio de venta',
                ]);
            }
            $pdo->commit();

            echo json_encode([
                'ok' => true,
                'actualizado' => $stmt->rowCount(),
                'mensaje' => 'Producto actualizado'
            ]);
            break;

        case 'DELETE':
            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'ID requerido']);
                exit;
            }
            $stmt = $pdo->prepare("UPDATE productos SET activo = 0 WHERE id = ?");
            $stmt->execute([$id]);

            echo json_encode([
                'ok' => true,
                'eliminado' => $stmt->rowCount(),
                'mensaje' => 'Producto desactivado'
            ]);
            break;
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Método no permitido']);
    }
} catch (PDOException $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode([
        'error' => 'Error en la base de datos',
        'detalle' => $e->getMessage()
    ]);
}
