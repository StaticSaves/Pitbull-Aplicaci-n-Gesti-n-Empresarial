ALTER TABLE `ventas`
  ADD COLUMN `cliente_telefono` varchar(30) DEFAULT NULL AFTER `cliente_cedula`,
  ADD COLUMN `cliente_direccion` text DEFAULT NULL AFTER `cliente_telefono`,
  ADD COLUMN `descuento_global` decimal(12,2) NOT NULL DEFAULT 0.00 AFTER `descuento`,
  ADD COLUMN `iva_porcentaje` decimal(5,2) NOT NULL DEFAULT 16.00 AFTER `iva`,
  ADD COLUMN `observaciones` text DEFAULT NULL AFTER `utilidad`;

CREATE TABLE IF NOT EXISTS `movimientos_caja` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `caja_id` int(11) NOT NULL,
  `tipo` enum('apertura','cierre','ingreso_manual','venta','egreso_manual','retiro') NOT NULL,
  `monto` decimal(12,2) NOT NULL,
  `concepto` varchar(255) NOT NULL,
  `referencia_id` bigint(20) DEFAULT NULL,
  `usuario_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_caja` (`caja_id`),
  KEY `idx_usuario` (`usuario_id`),
  KEY `idx_tipo` (`tipo`),
  KEY `idx_fecha` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
