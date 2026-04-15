-- Crea la base de datos si esta no existe, y la selecciona
CREATE DATABASE IF NOT EXISTS bd_Productos;
USE bd_Productos;

-- TABLA PROVEEDORES
CREATE TABLE proveedores (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre_empresa VARCHAR(150) NOT NULL,
    contacto_nombre VARCHAR(100),
    telefono VARCHAR(20)
) ENGINE=InnoDB;

-- TABLA CATEGORIAS (organizar el inventario)
CREATE TABLE categorias (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- TABLA PRODUCTOS
-- Incluye código de barras y datos de registro, el stock NO se guarda como valor fijo para evitar errores de sincronización, se calcula o se tiene una tabla de saldo.
CREATE TABLE productos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    codigo_barras VARCHAR(50) UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio_compra DECIMAL(10,2) NOT NULL, -- Costo base del producto
    precio_venta DECIMAL(10,2) NOT NULL,  -- Precio de venta al público
    stock_minimo INT DEFAULT 5,           -- Alerta de reabastecimiento
    categoria_id INT,
    proveedor_id INT,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id),
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
) ENGINE=InnoDB;

-- TABLA ALMACEN / STOCK
-- Cuánto hay físicamente en el momento.
CREATE TABLE inventario_saldo (
    producto_id INT PRIMARY KEY,
    cantidad_actual INT NOT NULL DEFAULT 0,
    ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- TABLA DE MOVIMIENTOS_INVENTARIO
-- Registro de entradas, salidas, mermas y ajustes.
CREATE TABLE movimientos_inventario (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    producto_id INT,
    tipo_movimiento ENUM('ENTRADA', 'SALIDA', 'MERMA', 'AJUSTE') NOT NULL,
    cantidad INT NOT NULL,
    motivo TEXT, -- Ej: "Producto roto", "Compra a proveedor X", "Venta N°01"
    usuario_id INT, -- ID de usuarios para saber quién lo hizo
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB;

-- TABLA VENTAS
CREATE TABLE ventas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    fecha_venta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cliente_nombre VARCHAR(100) DEFAULT 'Venta Mostrador',
    total DECIMAL(10,2) NOT NULL,
    metodo_pago ENUM('EFECTIVO', 'TARJETA', 'TRANSFERENCIA') DEFAULT 'EFECTIVO',
    usuario_id INT -- Quién realizó la venta
) ENGINE=InnoDB;

-- TABLA DETALLE_VENTAS (Muchos a Muchos entre Ventas y Productos)
CREATE TABLE detalle_ventas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    venta_id INT,
    producto_id INT,
    cantidad INT NOT NULL,
    precio_unitario_momento DECIMAL(10,2) NOT NULL, -- Guardamos el precio al que se vendió
    subtotal DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB;

-- TABLA GASTOS (Gastos operativos como luz, renta, transporte, etc.)
CREATE TABLE gastos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    descripcion VARCHAR(255) NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    categoria_gasto ENUM('OPERATIVO', 'ADMINISTRATIVO', 'IMPUESTOS', 'OTROS') DEFAULT 'OPERATIVO',
    fecha_gasto DATE NOT NULL,
    usuario_id INT,
    comprobante_url VARCHAR(255) --  foto de recibo
) ENGINE=InnoDB;