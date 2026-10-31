<?php

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);
    exit;
}

require_once __DIR__ . '/../../app/config/database.php';

try {
    $pdo = Database::getConnection();
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
        SELECT p.clave
        FROM permisos p
        JOIN rol_permiso rp ON rp.permiso_id = p.id
        WHERE rp.rol_id = ?
    ");
    $stmt->execute([$session['rol_id']]);
    $permissions = array_column($stmt->fetchAll(), 'clave');
    $canViewInventory = in_array('productos.ver', $permissions, true);
    $canViewSales = in_array('ventas.ver', $permissions, true);
    $canViewCash = in_array('caja.ver', $permissions, true) ||
        in_array('caja.abrir', $permissions, true) ||
        in_array('caja.cerrar', $permissions, true);
    $canViewReports = in_array('reportes.ver', $permissions, true);

    $data = [
        'generated_at' => date(DATE_ATOM),
        'inventory' => null,
        'sales' => null,
        'cash' => null,
        'product_impact' => null,
    ];

    if ($canViewInventory) {
        $data['inventory'] = [
            'active_products' => (int)$pdo->query("
                SELECT COUNT(*) FROM productos WHERE activo = 1
            ")->fetchColumn(),
            'low_stock_count' => (int)$pdo->query("
                SELECT COUNT(*)
                FROM productos
                WHERE activo = 1 AND stock <= stock_minimo
            ")->fetchColumn(),
            'active_categories' => (int)$pdo->query("
                SELECT COUNT(*) FROM categorias WHERE activo = 1
            ")->fetchColumn(),
            'low_stock' => $pdo->query("
                SELECT id, sku, nombre, stock, stock_minimo, unidad_medida
                FROM productos
                WHERE activo = 1 AND stock <= stock_minimo
                ORDER BY stock ASC, nombre ASC
                LIMIT 6
            ")->fetchAll(),
        ];
    }

    if ($canViewSales) {
        $salesSummary = $pdo->query("
            SELECT
                COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END), 0) AS today_count,
                COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN total ELSE 0 END), 0) AS today_total,
                COALESCE(SUM(CASE WHEN YEAR(created_at) = YEAR(CURDATE())
                    AND MONTH(created_at) = MONTH(CURDATE()) THEN 1 ELSE 0 END), 0) AS month_count,
                COALESCE(SUM(CASE WHEN YEAR(created_at) = YEAR(CURDATE())
                    AND MONTH(created_at) = MONTH(CURDATE()) THEN total ELSE 0 END), 0) AS month_total
            FROM ventas
            WHERE estado <> 'anulada'
        ")->fetch();

        $dailySales = $pdo->query("
            SELECT DATE(created_at) AS sale_date, COUNT(*) AS sale_count, SUM(total) AS total
            FROM ventas
            WHERE estado <> 'anulada'
                AND created_at >= CURDATE() - INTERVAL 6 DAY
                AND created_at < CURDATE() + INTERVAL 1 DAY
            GROUP BY DATE(created_at)
            ORDER BY sale_date
        ")->fetchAll();

        $data['sales'] = [
            'today_count' => (int)$salesSummary['today_count'],
            'today_total' => (float)$salesSummary['today_total'],
            'month_count' => (int)$salesSummary['month_count'],
            'month_total' => (float)$salesSummary['month_total'],
            'daily' => $dailySales,
            'recent' => $pdo->query("
                SELECT id, numero_factura, cliente_nombre, total, metodo_pago, estado, created_at
                FROM ventas
                ORDER BY created_at DESC, id DESC
                LIMIT 6
            ")->fetchAll(),
        ];
    }

    if ($canViewCash) {
        $stmt = $pdo->prepare("
            SELECT COUNT(*)
            FROM caja
            WHERE usuario_id = ? AND estado = 'abierta'
        ");
        $stmt->execute([$session['usuario_id']]);
        $data['cash'] = [
            'my_open_registers' => (int)$stmt->fetchColumn(),
        ];
    }

    if ($canViewReports) {
        $data['product_impact'] = [
            'daily' => $pdo->query("
                SELECT
                    DATE(created_at) AS movement_date,
                    SUM(impacto) AS impact,
                    SUM(CASE WHEN tipo = 'ajuste_precio' THEN 1 ELSE 0 END) AS price_changes,
                    SUM(CASE WHEN tipo = 'ajuste_precio' AND impacto > 0 THEN impacto ELSE 0 END) AS price_increases_impact,
                    SUM(CASE WHEN tipo = 'ajuste_precio' AND impacto < 0 THEN impacto ELSE 0 END) AS price_decreases_impact
                FROM movimientos_producto
                WHERE created_at >= CURDATE() - INTERVAL 29 DAY
                  AND created_at < CURDATE() + INTERVAL 1 DAY
                GROUP BY DATE(created_at)
                ORDER BY movement_date
            ")->fetchAll(),
        ];
    }

    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (PDOException $e) {
    error_log('Dashboard database error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'No se pudieron cargar los datos del dashboard']);
} catch (JsonException $e) {
    error_log('Dashboard response error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'No se pudo preparar la respuesta del dashboard']);
}
