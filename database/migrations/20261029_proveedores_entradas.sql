INSERT IGNORE INTO permisos (clave, descripcion, modulo)
VALUES ('proveedores.gestionar', 'Registrar, editar y desactivar proveedores', 'inventario');

INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
JOIN permisos p ON p.clave = 'proveedores.gestionar'
WHERE r.nombre = 'gerente';
