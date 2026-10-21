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

require_once __DIR__ . '/config/database.php';

$pdo    = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : null;
$action = $_GET['action'] ?? null;

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
    echo json_encode(['error' => 'Sesión inválida o expirada']);
    exit;
}

$usuarioActualId = (int)$sesion['usuario_id'];

// Cargar permisos del usuario actual
$stmt = $pdo->prepare("
    SELECT p.clave FROM permisos p
    JOIN rol_permiso rp ON rp.permiso_id = p.id
    WHERE rp.rol_id = ?
");
$stmt->execute([$sesion['rol_id']]);
$permisos = array_column($stmt->fetchAll(), 'clave');

function tienePermiso(array $permisos, string $clave): bool
{
    return in_array($clave, $permisos, true);
}

// Leer body
$input = [];
if (in_array($method, ['POST', 'PUT'])) {
    $raw = file_get_contents('php://input');
    if ($raw) $input = json_decode($raw, true) ?? [];
}

try {
    switch ($method) {

        case 'GET':
            if (!tienePermiso($permisos, 'usuarios.ver')) {
                http_response_code(403);
                echo json_encode(['error' => 'Sin permiso para ver usuarios']);
                exit;
            }

            if ($id) {
                $stmt = $pdo->prepare("
                    SELECT u.id, u.cedula, u.nombre_completo, u.email, u.telefono,
                           u.rol_id, r.nombre AS rol_nombre, u.activo,
                           u.ultimo_login, u.created_at
                    FROM usuarios u
                    JOIN roles r ON r.id = u.rol_id
                    WHERE u.id = ?
                ");
                $stmt->execute([$id]);
                $user = $stmt->fetch();
                if (!$user) {
                    http_response_code(404);
                    echo json_encode(['error' => 'Usuario no encontrado']);
                    exit;
                }
                echo json_encode($user, JSON_UNESCAPED_UNICODE);
            } else {
                $stmt = $pdo->query("
                    SELECT u.id, u.cedula, u.nombre_completo, u.email, u.telefono,
                           u.rol_id, r.nombre AS rol_nombre, u.activo,
                           u.ultimo_login, u.created_at
                    FROM usuarios u
                    JOIN roles r ON r.id = u.rol_id
                    ORDER BY u.activo DESC, u.nombre_completo ASC
                ");
                echo json_encode($stmt->fetchAll(), JSON_UNESCAPED_UNICODE);
            }
            break;

        case 'POST':
            // Reactivar
            if ($action === 'reactivar' && $id) {
                if (!tienePermiso($permisos, 'usuarios.editar')) {
                    http_response_code(403);
                    echo json_encode(['error' => 'Sin permiso']);
                    exit;
                }
                $stmt = $pdo->prepare("UPDATE usuarios SET activo = 1 WHERE id = ?");
                $stmt->execute([$id]);

                // Auditoría
                $pdo->prepare("
                    INSERT INTO auditoria_logs (usuario_id, accion, modulo, entidad, entidad_id)
                    VALUES (?, 'reactivar_usuario', 'usuarios', 'usuarios', ?)
                ")->execute([$usuarioActualId, $id]);

                echo json_encode(['ok' => true, 'mensaje' => 'Usuario reactivado']);
                break;
            }

            // Crear nuevo
            if (!tienePermiso($permisos, 'usuarios.crear')) {
                http_response_code(403);
                echo json_encode(['error' => 'Sin permiso para crear usuarios']);
                exit;
            }

            $cedula    = trim($input['cedula'] ?? '');
            $nombre    = trim($input['nombre_completo'] ?? '');
            $email     = trim($input['email'] ?? '');
            $telefono  = trim($input['telefono'] ?? '');
            $password  = $input['password'] ?? '';
            $rolId     = (int)($input['rol_id'] ?? 0);

            if ($nombre === '' || $email === '' || $password === '' || $rolId <= 0) {
                http_response_code(400);
                echo json_encode(['error' => 'Nombre, email, contraseña y rol son obligatorios']);
                exit;
            }

            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode(['error' => 'Email inválido']);
                exit;
            }

            if (strlen($password) < 6) {
                http_response_code(400);
                echo json_encode(['error' => 'La contraseña debe tener al menos 6 caracteres']);
                exit;
            }

            // Email duplicado
            $check = $pdo->prepare("SELECT id FROM usuarios WHERE email = ?");
            $check->execute([$email]);
            if ($check->fetch()) {
                http_response_code(409);
                echo json_encode(['error' => 'Ya existe un usuario con ese email']);
                exit;
            }

            // Cédula duplicada (si se proporcionó)
            if ($cedula !== '') {
                $check = $pdo->prepare("SELECT id FROM usuarios WHERE cedula = ?");
                $check->execute([$cedula]);
                if ($check->fetch()) {
                    http_response_code(409);
                    echo json_encode(['error' => 'Ya existe un usuario con esa cédula']);
                    exit;
                }
            }

            // Verificar que el rol exista
            $check = $pdo->prepare("SELECT id FROM roles WHERE id = ?");
            $check->execute([$rolId]);
            if (!$check->fetch()) {
                http_response_code(400);
                echo json_encode(['error' => 'Rol no válido']);
                exit;
            }

            $hash = password_hash($password, PASSWORD_DEFAULT);

            $stmt = $pdo->prepare("
                INSERT INTO usuarios
                    (cedula, nombre_completo, email, telefono, password_hash, rol_id, activo)
                VALUES (?, ?, ?, ?, ?, ?, 1)
            ");
            $stmt->execute([
                $cedula ?: null,
                $nombre,
                $email,
                $telefono ?: null,
                $hash,
                $rolId,
            ]);
            $nuevoId = (int)$pdo->lastInsertId();

            // Auditoría
            $pdo->prepare("
                INSERT INTO auditoria_logs (usuario_id, accion, modulo, entidad, entidad_id, detalle)
                VALUES (?, 'crear_usuario', 'usuarios', 'usuarios', ?, ?)
            ")->execute([
                $usuarioActualId,
                $nuevoId,
                json_encode(['email' => $email, 'rol_id' => $rolId], JSON_UNESCAPED_UNICODE)
            ]);

            echo json_encode(['ok' => true, 'id' => $nuevoId, 'mensaje' => 'Usuario creado']);
            break;

        case 'PUT':
            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'ID requerido']);
                exit;
            }

            if ($action === 'cambiar_password') {
                $esPropioUsuario = ($id === $usuarioActualId);
                $esGerente = tienePermiso($permisos, 'usuarios.editar');

                if (!$esPropioUsuario && !$esGerente) {
                    http_response_code(403);
                    echo json_encode(['error' => 'Sin permiso']);
                    exit;
                }

                $passwordNueva = $input['password_nueva'] ?? '';
                if (strlen($passwordNueva) < 6) {
                    http_response_code(400);
                    echo json_encode(['error' => 'La contraseña debe tener al menos 6 caracteres']);
                    exit;
                }

                // Si es el propio usuario, exigir contraseña actual
                if ($esPropioUsuario && !$esGerente) {
                    $passwordActual = $input['password_actual'] ?? '';
                    $stmt = $pdo->prepare("SELECT password_hash FROM usuarios WHERE id = ?");
                    $stmt->execute([$id]);
                    $row = $stmt->fetch();
                    if (!$row || !password_verify($passwordActual, $row['password_hash'])) {
                        http_response_code(401);
                        echo json_encode(['error' => 'Contraseña actual incorrecta']);
                        exit;
                    }
                }

                $hash = password_hash($passwordNueva, PASSWORD_DEFAULT);
                $stmt = $pdo->prepare("UPDATE usuarios SET password_hash = ? WHERE id = ?");
                $stmt->execute([$hash, $id]);

                // Cerrar todas las sesiones del usuario (por seguridad)
                $pdo->prepare("DELETE FROM sesiones WHERE usuario_id = ?")->execute([$id]);

                // Auditoría
                $pdo->prepare("
                    INSERT INTO auditoria_logs (usuario_id, accion, modulo, entidad, entidad_id)
                    VALUES (?, 'cambiar_password', 'usuarios', 'usuarios', ?)
                ")->execute([$usuarioActualId, $id]);

                echo json_encode(['ok' => true, 'mensaje' => 'Contraseña actualizada']);
                break;
            }

            // -------- Actualizar datos --------
            if (!tienePermiso($permisos, 'usuarios.editar')) {
                http_response_code(403);
                echo json_encode(['error' => 'Sin permiso para editar usuarios']);
                exit;
            }

            $cedula   = trim($input['cedula'] ?? '');
            $nombre   = trim($input['nombre_completo'] ?? '');
            $email    = trim($input['email'] ?? '');
            $telefono = trim($input['telefono'] ?? '');
            $rolId    = (int)($input['rol_id'] ?? 0);

            if ($nombre === '' || $email === '' || $rolId <= 0) {
                http_response_code(400);
                echo json_encode(['error' => 'Nombre, email y rol son obligatorios']);
                exit;
            }

            // Email duplicado (otro usuario)
            $check = $pdo->prepare("SELECT id FROM usuarios WHERE email = ? AND id != ?");
            $check->execute([$email, $id]);
            if ($check->fetch()) {
                http_response_code(409);
                echo json_encode(['error' => 'Ya existe otro usuario con ese email']);
                exit;
            }

            $stmt = $pdo->prepare("
                UPDATE usuarios SET
                    cedula = ?, nombre_completo = ?, email = ?, telefono = ?, rol_id = ?
                WHERE id = ?
            ");
            $stmt->execute([
                $cedula ?: null,
                $nombre,
                $email,
                $telefono ?: null,
                $rolId,
                $id,
            ]);

            // Auditoría
            $pdo->prepare("
                INSERT INTO auditoria_logs (usuario_id, accion, modulo, entidad, entidad_id)
                VALUES (?, 'editar_usuario', 'usuarios', 'usuarios', ?)
            ")->execute([$usuarioActualId, $id]);

            echo json_encode(['ok' => true, 'actualizado' => $stmt->rowCount()]);
            break;

        case 'DELETE':
            if (!tienePermiso($permisos, 'usuarios.eliminar')) {
                http_response_code(403);
                echo json_encode(['error' => 'Sin permiso para eliminar usuarios']);
                exit;
            }

            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'ID requerido']);
                exit;
            }

            if ($id === $usuarioActualId) {
                http_response_code(400);
                echo json_encode(['error' => 'No puedes desactivar tu propio usuario']);
                exit;
            }

            // Verificar que no sea el último gerente activo
            $stmt = $pdo->prepare("
                SELECT COUNT(*) AS total
                FROM usuarios
                WHERE rol_id = 1 AND activo = 1 AND id != ?
            ");
            $stmt->execute([$id]);
            $otrosGerentes = (int)$stmt->fetch()['total'];

            $stmt = $pdo->prepare("SELECT rol_id FROM usuarios WHERE id = ?");
            $stmt->execute([$id]);
            $userEliminar = $stmt->fetch();
            if ($userEliminar && (int)$userEliminar['rol_id'] === 1 && $otrosGerentes === 0) {
                http_response_code(400);
                echo json_encode(['error' => 'No puedes desactivar al último gerente del sistema']);
                exit;
            }

            $stmt = $pdo->prepare("UPDATE usuarios SET activo = 0 WHERE id = ?");
            $stmt->execute([$id]);

            // Cerrar sesiones activas
            $pdo->prepare("DELETE FROM sesiones WHERE usuario_id = ?")->execute([$id]);

            // Auditoría
            $pdo->prepare("
                INSERT INTO auditoria_logs (usuario_id, accion, modulo, entidad, entidad_id)
                VALUES (?, 'desactivar_usuario', 'usuarios', 'usuarios', ?)
            ")->execute([$usuarioActualId, $id]);

            echo json_encode(['ok' => true, 'mensaje' => 'Usuario desactivado']);
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'Método no permitido']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Error en la base de datos', 'detalle' => $e->getMessage()]);
}
