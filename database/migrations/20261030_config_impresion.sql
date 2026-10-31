INSERT IGNORE INTO permisos (clave, descripcion, modulo)
VALUES ('config.impresion', 'Editar los parámetros de impresión', 'configuracion');

INSERT IGNORE INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
JOIN permisos p ON p.clave = 'config.impresion'
WHERE r.nombre = 'gerente';

INSERT INTO configuracion (clave, valor, descripcion) VALUES
('impresora_tipo', 'termica', 'Tipo de impresora para comprobantes'),
('impresora_ancho_mm', '72', 'Ancho de papel para impresora térmica o fiscal'),
('impresora_papel', 'a4', 'Tamaño de hoja para impresión normal'),
('impresora_orientacion', 'vertical', 'Orientación de impresión en hojas'),
('impresora_margen_mm', '0', 'Margen de impresión en milímetros'),
('impresora_fuente_px', '10', 'Tamaño de letra de los comprobantes en píxeles')
ON DUPLICATE KEY UPDATE clave = VALUES(clave);
