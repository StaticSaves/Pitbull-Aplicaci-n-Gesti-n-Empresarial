<?php

/**
 * PITBULL Manager v1.0
 * API - Configuración del sistema
 *
 * Endpoints:
 *   GET  /api/config_sistema.php?public=printing → leer parámetros de impresión
 *   GET  /api/config_sistema.php           → leer configuración autorizada
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

require_once __DIR__ . '/../../app/config/database.php';

$pdo    = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET' && ($_GET['public'] ?? '') === 'branding') {
    try {
        $stmt = $pdo->query("
            SELECT clave, valor FROM configuracion
            WHERE clave IN (
                'nombre_empresa', 'rif_empresa', 'telefono_empresa',
                'direccion_empresa', 'color_principal', 'color_acento', 'logo_empresa'
            )
        ");
        $branding = [];
        foreach ($stmt->fetchAll() as $row) {
            $branding[$row['clave']] = $row['valor'];
        }
        echo json_encode(['ok' => true, 'branding' => $branding], JSON_UNESCAPED_UNICODE);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al cargar la personalización']);
    }
    exit;
}

if ($method === 'GET' && ($_GET['public'] ?? '') === 'printing') {
    try {
        $stmt = $pdo->query("
            SELECT clave, valor FROM configuracion
            WHERE clave IN (
                'impresora_tipo', 'impresora_ancho_mm', 'impresora_papel',
                'impresora_orientacion', 'impresora_margen_mm', 'impresora_fuente_px'
            )
        ");
        $printing = [];
        foreach ($stmt->fetchAll() as $row) {
            $printing[$row['clave']] = $row['valor'];
        }
        echo json_encode(['ok' => true, 'printing' => $printing], JSON_UNESCAPED_UNICODE);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al cargar los parámetros de impresión']);
    }
    exit;
}

// AUTENTICACIÓN
$token = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
if ($token && strpos($token, 'Bearer ') === 0) $token = substr($token, 7);

if (!$token) {
    http_response_code(401);
    echo json_encode(['error' => 'Token no proporcionado']);
    exit;
}

$stmt = $pdo->prepare("
    SELECT s.usuario_id, u.rol_id, r.nombre AS rol_nombre
    FROM sesiones s
    JOIN usuarios u ON u.id = s.usuario_id
    JOIN roles r ON r.id = u.rol_id
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

$permisosConfiguracion = [
    'tasa_bcv' => 'config.tasas',
    'tasa_paralelo' => 'config.tasas',
    'tasa_usada' => 'config.tasas',
    'iva_porcentaje' => 'config.fiscal',
    'margen_ganancia_default' => 'config.fiscal',
    'nombre_empresa' => 'config.empresa',
    'rif_empresa' => 'config.empresa',
    'telefono_empresa' => 'config.empresa',
    'direccion_empresa' => 'config.empresa',
    'color_principal' => 'config.personalizacion',
    'color_acento' => 'config.personalizacion',
    'logo_empresa' => 'config.personalizacion',
    'impresora_tipo' => 'config.impresion',
    'impresora_ancho_mm' => 'config.impresion',
    'impresora_papel' => 'config.impresion',
    'impresora_orientacion' => 'config.impresion',
    'impresora_margen_mm' => 'config.impresion',
    'impresora_fuente_px' => 'config.impresion',
];
$puedeEditarConfiguracion = static function (string $permiso) use ($permisos): bool {
    return in_array('config.editar', $permisos, true) ||
        in_array($permiso, $permisos, true);
};

try {
    switch ($method) {
        // GET - Leer configuración
        case 'GET':
            if (
                !in_array('config.ver', $permisos, true) &&
                !in_array('config.editar', $permisos, true) &&
                !array_intersect(array_values($permisosConfiguracion), $permisos)
            ) {
                http_response_code(403);
                echo json_encode(['error' => 'No tienes permiso para consultar la configuración']);
                exit;
            }

            $stmt = $pdo->query("SELECT clave, valor, descripcion FROM configuracion ORDER BY clave");
            $config = [];
            foreach ($stmt->fetchAll() as $row) {
                if (
                    !isset($permisosConfiguracion[$row['clave']]) ||
                    !$puedeEditarConfiguracion($permisosConfiguracion[$row['clave']])
                ) {
                    continue;
                }
                $config[$row['clave']] = [
                    'valor'       => $row['valor'],
                    'descripcion' => $row['descripcion'],
                ];
            }
            echo json_encode(['ok' => true, 'config' => $config], JSON_UNESCAPED_UNICODE);
            break;
        // PUT - Actualizar configuración
        case 'PUT':
            if (
                !in_array('config.editar', $permisos, true) &&
                !array_intersect(array_values($permisosConfiguracion), $permisos)
            ) {
                http_response_code(403);
                echo json_encode(['error' => 'No tienes permiso para editar la configuración']);
                exit;
            }

            $raw = file_get_contents('php://input');
            $input = json_decode($raw, true);

            if (!is_array($input) || empty($input)) {
                http_response_code(400);
                echo json_encode(['error' => 'Los datos enviados no son válidos']);
                exit;
            }

            $opcionesImpresion = [
                'impresora_tipo' => ['termica', 'fiscal', 'hoja'],
                'impresora_papel' => ['a4', 'carta', 'oficio'],
                'impresora_orientacion' => ['vertical', 'horizontal'],
            ];
            $rangosImpresion = [
                'impresora_ancho_mm' => [30, 300],
                'impresora_margen_mm' => [0, 25],
                'impresora_fuente_px' => [8, 18],
            ];
            $clavesPermitidas = [
                'tasa_bcv', 'tasa_paralelo', 'tasa_usada', 'iva_porcentaje',
                'margen_ganancia_default', 'nombre_empresa', 'rif_empresa',
                'telefono_empresa', 'direccion_empresa', 'color_principal',
                'color_acento', 'logo_empresa', 'impresora_tipo',
                'impresora_ancho_mm', 'impresora_papel',
                'impresora_orientacion', 'impresora_margen_mm',
                'impresora_fuente_px',
            ];
            foreach ($input as $clave => $valor) {
                if (!in_array($clave, $clavesPermitidas, true) || !is_scalar($valor)) {
                    http_response_code(400);
                    echo json_encode(['error' => 'La configuración contiene un campo no válido']);
                    exit;
                }
                if (!$puedeEditarConfiguracion($permisosConfiguracion[$clave])) {
                    http_response_code(403);
                    echo json_encode(['error' => 'No tienes permiso para modificar esta opción']);
                    exit;
                }
                if (in_array($clave, ['color_principal', 'color_acento'], true) &&
                    !preg_match('/^#[0-9a-fA-F]{6}$/', (string)$valor)) {
                    http_response_code(400);
                    echo json_encode(['error' => 'El formato de color no es válido']);
                    exit;
                }
                if (
                    isset($opcionesImpresion[$clave]) &&
                    !in_array((string)$valor, $opcionesImpresion[$clave], true)
                ) {
                    http_response_code(400);
                    echo json_encode(['error' => 'El valor de impresión no es válido']);
                    exit;
                }
                if (isset($rangosImpresion[$clave])) {
                    [$minimo, $maximo] = $rangosImpresion[$clave];
                    if (
                        !is_numeric($valor) ||
                        floor((float)$valor) !== (float)$valor ||
                        (int)$valor < $minimo ||
                        (int)$valor > $maximo
                    ) {
                        http_response_code(400);
                        echo json_encode(['error' => 'El parámetro numérico de impresión está fuera de rango']);
                        exit;
                    }
                }
                if ($clave === 'logo_empresa' && $valor !== '') {
                    if (
                        strlen((string)$valor) > 410000 ||
                        !preg_match('/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+\/=]+)$/', (string)$valor, $matches)
                    ) {
                        http_response_code(400);
                        echo json_encode(['error' => 'El logo debe ser PNG, JPG o WebP y no superar los 300 KB']);
                        exit;
                    }
                    $imageData = base64_decode($matches[2], true);
                    $imageInfo = $imageData === false ? false : getimagesizefromstring($imageData);
                    $mimeEsperado = $matches[1] === 'jpg' ? 'image/jpeg' : 'image/' . $matches[1];
                    if (
                        !$imageInfo ||
                        strlen($imageData) > 307200 ||
                        $imageInfo[0] > 2048 ||
                        $imageInfo[1] > 2048 ||
                        $imageInfo['mime'] !== $mimeEsperado
                    ) {
                        http_response_code(400);
                        echo json_encode(['error' => 'El logo debe ser una imagen válida de hasta 2048 × 2048 píxeles']);
                        exit;
                    }
                }
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
            ")->execute([
                $sesion['usuario_id'],
                json_encode(array_diff_key($input, ['logo_empresa' => true]), JSON_UNESCAPED_UNICODE),
            ]);

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
