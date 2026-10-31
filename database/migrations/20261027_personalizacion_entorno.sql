CREATE TABLE IF NOT EXISTS `configuracion` (
  `clave` varchar(80) NOT NULL,
  `valor` longtext NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`clave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `configuracion` MODIFY `valor` longtext NOT NULL;

INSERT INTO `configuracion` (`clave`, `valor`, `descripcion`) VALUES
('tasa_bcv', '0', 'Tasa BCV en Bs. por USD'),
('tasa_paralelo', '0', 'Tasa paralela en Bs. por USD'),
('tasa_usada', 'bcv', 'Tasa de cambio activa'),
('iva_porcentaje', '16', 'Porcentaje de IVA'),
('margen_ganancia_default', '15', 'Margen de ganancia por defecto'),
('nombre_empresa', 'PITBULL', 'Nombre de la empresa'),
('rif_empresa', '', 'RIF de la empresa'),
('telefono_empresa', '', 'Teléfono de la empresa'),
('direccion_empresa', '', 'Dirección de la empresa'),
('color_principal', '#1e3a8a', 'Color principal de la interfaz'),
('color_acento', '#3b82f6', 'Color de acento de la interfaz'),
('logo_empresa', '', 'Logo de la empresa en formato data URL')
ON DUPLICATE KEY UPDATE `clave` = VALUES(`clave`);
