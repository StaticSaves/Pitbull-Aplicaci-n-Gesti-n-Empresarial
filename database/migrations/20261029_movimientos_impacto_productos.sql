CREATE TABLE IF NOT EXISTS movimientos_producto (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  producto_id INT(11) NOT NULL,
  usuario_id INT(11) NOT NULL,
  tipo ENUM('merma', 'devolucion', 'ajuste_stock', 'ajuste_precio') NOT NULL,
  cantidad INT NOT NULL DEFAULT 0,
  stock_anterior INT NOT NULL,
  stock_nuevo INT NOT NULL,
  precio_anterior DECIMAL(12,2) DEFAULT NULL,
  precio_nuevo DECIMAL(12,2) NOT NULL,
  impacto DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  motivo VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_movimientos_producto_fecha (created_at),
  KEY idx_movimientos_producto_producto (producto_id),
  CONSTRAINT fk_movimientos_producto_producto
    FOREIGN KEY (producto_id) REFERENCES productos (id),
  CONSTRAINT fk_movimientos_producto_usuario
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
