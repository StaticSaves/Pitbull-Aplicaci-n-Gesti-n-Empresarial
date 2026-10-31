INSERT IGNORE INTO permisos (clave, descripcion, modulo) VALUES
('roles.gestionar', 'Gestionar permisos asignados a cada rol', 'configuracion'),
('config.tasas', 'Editar tasas de cambio', 'configuracion'),
('config.fiscal', 'Editar parámetros fiscales', 'configuracion'),
('config.empresa', 'Editar datos de la empresa', 'configuracion'),
('config.personalizacion', 'Editar la identidad visual de la empresa', 'configuracion'),
('entradas.ver', 'Ver historial de entradas de mercancía', 'inventario'),
('entradas.crear', 'Registrar entradas de mercancía', 'inventario'),
('almacenes.ver', 'Ver almacenes', 'inventario'),
('almacenes.gestionar', 'Gestionar almacenes', 'inventario'),
('caja.movimiento_manual', 'Registrar ingresos y egresos manuales de caja', 'caja'),
('config.ver', 'Acceder a la sección de configuración', 'configuracion');

INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
JOIN permisos p ON
    (r.nombre = 'gerente' AND p.clave IN (
        'roles.gestionar', 'config.tasas', 'config.fiscal', 'config.empresa',
        'config.personalizacion', 'entradas.ver', 'entradas.crear',
        'almacenes.ver', 'almacenes.gestionar', 'caja.movimiento_manual', 'config.ver'
    ))
    OR
    (r.nombre = 'operador' AND p.clave IN (
        'entradas.ver', 'entradas.crear', 'almacenes.ver', 'almacenes.gestionar'
    ));
