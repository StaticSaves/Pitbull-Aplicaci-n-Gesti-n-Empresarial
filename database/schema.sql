-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 10-10-2026 a las 18:02:12
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `pitbull_db`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `auditoria_logs`
--

CREATE TABLE `auditoria_logs` (
  `id` bigint(20) NOT NULL,
  `usuario_id` int(11) DEFAULT NULL,
  `accion` varchar(100) NOT NULL,
  `modulo` varchar(50) NOT NULL,
  `entidad` varchar(50) DEFAULT NULL,
  `entidad_id` int(11) DEFAULT NULL,
  `detalle` text DEFAULT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `caja`
--

CREATE TABLE `caja` (
  `id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `monto_apertura` decimal(12,2) NOT NULL DEFAULT 0.00,
  `monto_cierre` decimal(12,2) DEFAULT NULL,
  `ventas_efectivo` decimal(12,2) DEFAULT 0.00,
  `ventas_otros_metodos` decimal(12,2) DEFAULT 0.00,
  `diferencia` decimal(12,2) DEFAULT NULL,
  `estado` enum('abierta','cerrada') DEFAULT 'abierta',
  `abierta_en` datetime DEFAULT current_timestamp(),
  `cerrada_en` datetime DEFAULT NULL,
  `notas` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `movimientos_caja`
--

CREATE TABLE `movimientos_caja` (
  `id` bigint(20) NOT NULL,
  `caja_id` int(11) NOT NULL,
  `tipo` enum('apertura','cierre','ingreso_manual','venta','egreso_manual','retiro') NOT NULL,
  `monto` decimal(12,2) NOT NULL,
  `concepto` varchar(255) NOT NULL,
  `referencia_id` bigint(20) DEFAULT NULL,
  `usuario_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `categorias`
--

CREATE TABLE `categorias` (
  `id` int(11) NOT NULL,
  `nombre` varchar(80) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `categorias`
--

INSERT INTO `categorias` (`id`, `nombre`, `descripcion`, `activo`, `created_at`) VALUES
(1, 'Construcción', 'Materiales de construcción: cemento, cabilla, bloques', 1, '2026-10-10 15:40:49'),
(2, 'Lubricantes', 'Aceites, grasas y lubricantes para motor', 1, '2026-10-10 15:40:49'),
(3, 'Herramientas', 'Herramientas manuales y eléctricas', 1, '2026-10-10 15:40:49'),
(4, 'Eléctrico', 'Cables, tomacorrientes, breakers', 1, '2026-10-10 15:40:49'),
(5, 'Plomería', 'Tuberías, conexiones, grifería', 1, '2026-10-10 15:40:49');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `gastos`
--

CREATE TABLE `gastos` (
  `id` bigint(20) NOT NULL,
  `concepto` varchar(150) NOT NULL,
  `tipo` enum('flete','empaque','viatico','impuesto','servicio','otro') NOT NULL,
  `monto` decimal(12,2) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `usuario_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `configuracion`
--

CREATE TABLE `configuracion` (
  `clave` varchar(80) NOT NULL,
  `valor` longtext NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`clave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Valores iniciales de la configuración
--

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
('logo_empresa', '', 'Logo de la empresa en formato data URL'),
('impresora_tipo', 'termica', 'Tipo de impresora para comprobantes'),
('impresora_ancho_mm', '72', 'Ancho de papel para impresora térmica o fiscal'),
('impresora_papel', 'a4', 'Tamaño de hoja para impresión normal'),
('impresora_orientacion', 'vertical', 'Orientación de impresión en hojas'),
('impresora_margen_mm', '0', 'Margen de impresión en milímetros'),
('impresora_fuente_px', '10', 'Tamaño de letra de los comprobantes en píxeles');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `mermas`
--

CREATE TABLE `mermas` (
  `id` bigint(20) NOT NULL,
  `producto_id` int(11) NOT NULL,
  `cantidad` int(11) NOT NULL,
  `motivo` enum('dañado','perdido','vencido','robo','otro') NOT NULL,
  `descripcion` text DEFAULT NULL,
  `costo_perdida` decimal(12,2) NOT NULL DEFAULT 0.00,
  `usuario_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `movimientos_stock`
--

CREATE TABLE `movimientos_stock` (
  `id` bigint(20) NOT NULL,
  `producto_id` int(11) NOT NULL,
  `tipo` enum('entrada','salida_venta','salida_merma','ajuste') NOT NULL,
  `cantidad` int(11) NOT NULL,
  `stock_anterior` int(11) NOT NULL,
  `stock_nuevo` int(11) NOT NULL,
  `motivo` varchar(255) DEFAULT NULL,
  `referencia_id` int(11) DEFAULT NULL,
  `usuario_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `movimientos_producto`
--

CREATE TABLE `movimientos_producto` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `producto_id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `tipo` enum('merma','devolucion','ajuste_stock','ajuste_precio') NOT NULL,
  `cantidad` int(11) NOT NULL DEFAULT 0,
  `stock_anterior` int(11) NOT NULL,
  `stock_nuevo` int(11) NOT NULL,
  `precio_anterior` decimal(12,2) DEFAULT NULL,
  `precio_nuevo` decimal(12,2) NOT NULL,
  `impacto` decimal(14,2) NOT NULL DEFAULT 0.00,
  `motivo` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_movimientos_producto_fecha` (`created_at`),
  KEY `idx_movimientos_producto_producto` (`producto_id`),
  KEY `fk_movimientos_producto_usuario` (`usuario_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pedidos`
--

CREATE TABLE `pedidos` (
  `id` bigint(20) NOT NULL,
  `numero` varchar(30) NOT NULL,
  `cliente_nombre` varchar(150) NOT NULL,
  `cliente_telefono` varchar(30) DEFAULT NULL,
  `total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `abono` decimal(12,2) NOT NULL DEFAULT 0.00,
  `saldo` decimal(12,2) NOT NULL DEFAULT 0.00,
  `estado` enum('pendiente','entregado','cancelado') DEFAULT 'pendiente',
  `fecha_entrega_estimada` date DEFAULT NULL,
  `usuario_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `entregado_en` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `pedido_detalle`
--

CREATE TABLE `pedido_detalle` (
  `id` bigint(20) NOT NULL,
  `pedido_id` bigint(20) NOT NULL,
  `producto_id` int(11) NOT NULL,
  `cantidad` int(11) NOT NULL,
  `precio_unitario` decimal(12,2) NOT NULL,
  `subtotal` decimal(12,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `permisos`
--

CREATE TABLE `permisos` (
  `id` int(11) NOT NULL,
  `clave` varchar(80) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `modulo` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `permisos`
--

INSERT INTO `permisos` (`id`, `clave`, `descripcion`, `modulo`, `created_at`) VALUES
(1, 'productos.ver', 'Ver catálogo de productos', 'inventario', '2026-10-10 15:40:48'),
(2, 'productos.crear', 'Crear nuevos productos', 'inventario', '2026-10-10 15:40:48'),
(3, 'productos.editar', 'Editar productos', 'inventario', '2026-10-10 15:40:48'),
(4, 'productos.eliminar', 'Eliminar productos', 'inventario', '2026-10-10 15:40:48'),
(5, 'productos.ver_costos', 'Ver costo de compra de productos', 'inventario', '2026-10-10 15:40:48'),
(6, 'stock.entrada', 'Registrar entrada de mercancía', 'inventario', '2026-10-10 15:40:48'),
(7, 'stock.merma', 'Reportar mermas', 'inventario', '2026-10-10 15:40:48'),
(8, 'ventas.ver', 'Ver listado de ventas', 'ventas', '2026-10-10 15:40:48'),
(9, 'ventas.crear', 'Registrar una venta', 'ventas', '2026-10-10 15:40:48'),
(10, 'ventas.anular', 'Anular una venta', 'ventas', '2026-10-10 15:40:48'),
(11, 'ventas.ver_utilidad', 'Ver margen de utilidad de ventas', 'ventas', '2026-10-10 15:40:48'),
(12, 'pedidos.ver', 'Ver pedidos', 'pedidos', '2026-10-10 15:40:48'),
(13, 'pedidos.crear', 'Crear pedidos/apartados', 'pedidos', '2026-10-10 15:40:48'),
(14, 'pedidos.entregar', 'Marcar pedido como entregado', 'pedidos', '2026-10-10 15:40:48'),
(15, 'caja.abrir', 'Abrir caja', 'caja', '2026-10-10 15:40:48'),
(16, 'caja.cerrar', 'Cerrar caja', 'caja', '2026-10-10 15:40:48'),
(17, 'caja.ver', 'Ver movimientos de caja', 'caja', '2026-10-10 15:40:48'),
(18, 'gastos.ver', 'Ver gastos', 'finanzas', '2026-10-10 15:40:48'),
(19, 'gastos.crear', 'Registrar gastos', 'finanzas', '2026-10-10 15:40:48'),
(20, 'reportes.ver', 'Ver reportes generales', 'finanzas', '2026-10-10 15:40:48'),
(21, 'reportes.ver_utilidad', 'Ver reportes de utilidad y margen', 'finanzas', '2026-10-10 15:40:48'),
(22, 'usuarios.ver', 'Ver usuarios', 'configuracion', '2026-10-10 15:40:48'),
(23, 'usuarios.crear', 'Crear usuarios', 'configuracion', '2026-10-10 15:40:48'),
(24, 'usuarios.editar', 'Editar usuarios', 'configuracion', '2026-10-10 15:40:48'),
(25, 'usuarios.eliminar', 'Eliminar usuarios', 'configuracion', '2026-10-10 15:40:48'),
(26, 'auditoria.ver', 'Ver bitácora de auditoría', 'configuracion', '2026-10-10 15:40:48'),
(27, 'config.editar', 'Editar parámetros del sistema (tasa, IVA)', 'configuracion', '2026-10-10 15:40:48'),
(28, 'roles.gestionar', 'Gestionar permisos asignados a cada rol', 'configuracion', '2026-10-29 12:00:00'),
(29, 'config.tasas', 'Editar tasas de cambio', 'configuracion', '2026-10-29 12:00:00'),
(30, 'config.fiscal', 'Editar parámetros fiscales', 'configuracion', '2026-10-29 12:00:00'),
(31, 'config.empresa', 'Editar datos de la empresa', 'configuracion', '2026-10-29 12:00:00'),
(32, 'config.personalizacion', 'Editar la identidad visual de la empresa', 'configuracion', '2026-10-29 12:00:00'),
(33, 'entradas.ver', 'Ver historial de entradas de mercancía', 'inventario', '2026-10-29 12:00:00'),
(34, 'entradas.crear', 'Registrar entradas de mercancía', 'inventario', '2026-10-29 12:00:00'),
(35, 'almacenes.ver', 'Ver almacenes', 'inventario', '2026-10-29 12:00:00'),
(36, 'almacenes.gestionar', 'Gestionar almacenes', 'inventario', '2026-10-29 12:00:00'),
(37, 'caja.movimiento_manual', 'Registrar ingresos y egresos manuales de caja', 'caja', '2026-10-29 12:00:00'),
(38, 'config.ver', 'Acceder a la sección de configuración', 'configuracion', '2026-10-29 12:00:00'),
(39, 'proveedores.gestionar', 'Registrar, editar y desactivar proveedores', 'inventario', '2026-10-29 12:00:00'),
(40, 'config.impresion', 'Editar los parámetros de impresión', 'configuracion', '2026-10-30 00:00:00');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `productos`
--

CREATE TABLE `productos` (
  `id` int(11) NOT NULL,
  `sku` varchar(50) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `categoria_id` int(11) DEFAULT NULL,
  `proveedor_id` int(11) DEFAULT NULL,
  `precio` decimal(12,2) NOT NULL DEFAULT 0.00,
  `precio_mayorista` decimal(12,2) DEFAULT NULL,
  `costo` decimal(12,2) NOT NULL DEFAULT 0.00,
  `margen_ganancia` decimal(5,2) DEFAULT 15.00,
  `iva` decimal(5,2) DEFAULT 16.00,
  `stock` int(11) NOT NULL DEFAULT 0,
  `stock_minimo` int(11) NOT NULL DEFAULT 0,
  `unidad_medida` varchar(20) DEFAULT 'unidad',
  `imagen` varchar(255) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `productos`
--

INSERT INTO `productos` (`id`, `sku`, `nombre`, `descripcion`, `categoria_id`, `proveedor_id`, `precio`, `precio_mayorista`, `costo`, `margen_ganancia`, `iva`, `stock`, `stock_minimo`, `unidad_medida`, `imagen`, `activo`, `created_at`, `updated_at`) VALUES
(1, 'PIT-001', 'Cemento Gris 42.5kg', 'Saco de cemento gris de 42.5 kg', 1, NULL, 12.50, NULL, 9.00, 15.00, 16.00, 100, 20, 'unidad', NULL, 1, '2026-10-10 15:40:49', '2026-10-10 15:40:49'),
(2, 'PIT-002', 'Cabilla 3/8 x 12m', 'Cabilla corrugada 3/8\" x 12m', 1, NULL, 8.75, NULL, 6.20, 15.00, 16.00, 250, 50, 'unidad', NULL, 1, '2026-10-10 15:40:49', '2026-10-10 15:40:49'),
(3, 'PIT-003', 'Aceite motor 20W-50 1L', 'Aceite mineral para motor, 1L', 2, NULL, 6.30, NULL, 4.10, 15.00, 16.00, 80, 15, 'unidad', NULL, 1, '2026-10-10 15:40:49', '2026-10-10 15:40:49'),
(4, 'PIT-004', 'Martillo de uña 16oz', 'Martillo acero con mango goma', 3, NULL, 9.90, NULL, 7.00, 15.00, 16.00, 35, 10, 'unidad', NULL, 1, '2026-10-10 15:40:49', '2026-10-10 15:40:49');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `proveedores`
--

CREATE TABLE `proveedores` (
  `id` int(11) NOT NULL,
  `rif` varchar(20) DEFAULT NULL,
  `nombre` varchar(150) NOT NULL,
  `contacto` varchar(150) DEFAULT NULL,
  `telefono` varchar(30) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `direccion` text DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `roles`
--

CREATE TABLE `roles` (
  `id` int(11) NOT NULL,
  `nombre` varchar(50) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `es_sistema` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `roles`
--

INSERT INTO `roles` (`id`, `nombre`, `descripcion`, `es_sistema`, `created_at`) VALUES
(1, 'gerente', 'Dueño o director. Control total del sistema.', 1, '2026-10-10 15:40:48'),
(2, 'operador', 'Encargado de almacén. Gestiona stock y mermas.', 1, '2026-10-10 15:40:48'),
(3, 'vendedor', 'Punto de venta y cierre de caja.', 1, '2026-10-10 15:40:48'),
(4, 'soporte', 'Soporte técnico. Mantenimiento sin acceso a datos financieros.', 1, '2026-10-10 15:40:48');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `rol_permiso`
--

CREATE TABLE `rol_permiso` (
  `rol_id` int(11) NOT NULL,
  `permiso_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `rol_permiso`
--

INSERT INTO `rol_permiso` (`rol_id`, `permiso_id`) VALUES
(1, 1),
(1, 2),
(1, 3),
(1, 4),
(1, 5),
(1, 6),
(1, 7),
(1, 8),
(1, 9),
(1, 10),
(1, 11),
(1, 12),
(1, 13),
(1, 14),
(1, 15),
(1, 16),
(1, 17),
(1, 18),
(1, 19),
(1, 20),
(1, 21),
(1, 22),
(1, 23),
(1, 24),
(1, 25),
(1, 26),
(1, 27),
(2, 1),
(2, 2),
(2, 3),
(2, 6),
(2, 7),
(2, 20),
(3, 1),
(3, 8),
(3, 9),
(3, 12),
(3, 13),
(3, 14),
(3, 15),
(3, 16),
(3, 17),
(3, 20),
(4, 20),
(4, 22),
(4, 26),
(1, 28),
(1, 29),
(1, 30),
(1, 31),
(1, 32),
(1, 33),
(1, 34),
(1, 35),
(1, 36),
(1, 37),
(1, 38),
(1, 39),
(1, 40),
(2, 33),
(2, 34),
(2, 35),
(2, 36);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sesiones`
--

CREATE TABLE `sesiones` (
  `id` int(11) NOT NULL,
  `usuario_id` int(11) NOT NULL,
  `token` varchar(255) NOT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `expira_en` datetime NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL,
  `cedula` varchar(20) DEFAULT NULL,
  `nombre_completo` varchar(150) NOT NULL,
  `email` varchar(150) NOT NULL,
  `telefono` varchar(30) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `rol_id` int(11) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `ultimo_login` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `usuarios`
--

INSERT INTO `usuarios` (`id`, `cedula`, `nombre_completo`, `email`, `telefono`, `password_hash`, `rol_id`, `activo`, `ultimo_login`, `created_at`, `updated_at`) VALUES
(1, 'V-12345678', 'Edixon Gerente', 'gerente@laexcelencia.com', '0414-0000001', '$2y$10$./U1PbWwWk3CpcYyAutfMOxzw9vEN5f5bsfAkLmM.MTm1YyA/WNWi', 1, 1, NULL, '2026-10-10 15:40:48', '2026-10-10 15:55:01'),
(2, 'V-23456789', 'Carlos Operador', 'operador@laexcelencia.com', '0414-0000002', '$2y$10$./U1PbWwWk3CpcYyAutfMOxzw9vEN5f5bsfAkLmM.MTm1YyA/WNWi', 2, 1, NULL, '2026-10-10 15:40:48', '2026-10-10 15:55:01'),
(3, 'V-34567890', 'Maria Vendedora', 'vendedor@laexcelencia.com', '0414-0000003', '$2y$10$./U1PbWwWk3CpcYyAutfMOxzw9vEN5f5bsfAkLmM.MTm1YyA/WNWi', 3, 1, NULL, '2026-10-10 15:40:48', '2026-10-10 15:55:01');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `ventas`
--

CREATE TABLE `ventas` (
  `id` bigint(20) NOT NULL,
  `numero_factura` varchar(30) NOT NULL,
  `cliente_nombre` varchar(150) DEFAULT NULL,
  `cliente_cedula` varchar(20) DEFAULT NULL,
  `cliente_telefono` varchar(30) DEFAULT NULL,
  `cliente_direccion` text DEFAULT NULL,
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `descuento` decimal(12,2) NOT NULL DEFAULT 0.00,
  `descuento_global` decimal(12,2) NOT NULL DEFAULT 0.00,
  `iva` decimal(12,2) NOT NULL DEFAULT 0.00,
  `iva_porcentaje` decimal(5,2) NOT NULL DEFAULT 16.00,
  `total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `costo_total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `utilidad` decimal(12,2) NOT NULL DEFAULT 0.00,
  `observaciones` text DEFAULT NULL,
  `metodo_pago` enum('efectivo','pago_movil','transferencia','punto_venta','credito') DEFAULT 'efectivo',
  `estado` enum('completada','anulada','pendiente') DEFAULT 'completada',
  `usuario_id` int(11) NOT NULL,
  `caja_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `anulada_en` datetime DEFAULT NULL,
  `anulada_por` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `venta_detalle`
--

CREATE TABLE `venta_detalle` (
  `id` bigint(20) NOT NULL,
  `venta_id` bigint(20) NOT NULL,
  `producto_id` int(11) NOT NULL,
  `cantidad` int(11) NOT NULL,
  `precio_unitario` decimal(12,2) NOT NULL,
  `costo_unitario` decimal(12,2) NOT NULL,
  `subtotal` decimal(12,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `auditoria_logs`
--
ALTER TABLE `auditoria_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_usuario` (`usuario_id`),
  ADD KEY `idx_accion` (`accion`),
  ADD KEY `idx_fecha` (`created_at`);

--
-- Indices de la tabla `caja`
--
ALTER TABLE `caja`
  ADD PRIMARY KEY (`id`),
  ADD KEY `usuario_id` (`usuario_id`),
  ADD KEY `idx_estado` (`estado`),
  ADD KEY `idx_fecha` (`abierta_en`);

--
-- Indices de la tabla `movimientos_caja`
--
ALTER TABLE `movimientos_caja`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_caja` (`caja_id`),
  ADD KEY `idx_usuario` (`usuario_id`),
  ADD KEY `idx_tipo` (`tipo`),
  ADD KEY `idx_fecha` (`created_at`);

--
-- Indices de la tabla `categorias`
--
ALTER TABLE `categorias`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nombre` (`nombre`);

--
-- Indices de la tabla `gastos`
--
ALTER TABLE `gastos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `usuario_id` (`usuario_id`),
  ADD KEY `idx_tipo` (`tipo`),
  ADD KEY `idx_fecha` (`created_at`);

--
-- Indices de la tabla `mermas`
--
ALTER TABLE `mermas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `usuario_id` (`usuario_id`),
  ADD KEY `idx_producto` (`producto_id`),
  ADD KEY `idx_fecha` (`created_at`);

--
-- Indices de la tabla `movimientos_stock`
--
ALTER TABLE `movimientos_stock`
  ADD PRIMARY KEY (`id`),
  ADD KEY `usuario_id` (`usuario_id`),
  ADD KEY `idx_producto` (`producto_id`),
  ADD KEY `idx_tipo` (`tipo`),
  ADD KEY `idx_fecha` (`created_at`);

--
-- Indices de la tabla `pedidos`
--
ALTER TABLE `pedidos`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `numero` (`numero`),
  ADD KEY `usuario_id` (`usuario_id`),
  ADD KEY `idx_estado` (`estado`),
  ADD KEY `idx_cliente` (`cliente_nombre`);

--
-- Indices de la tabla `pedido_detalle`
--
ALTER TABLE `pedido_detalle`
  ADD PRIMARY KEY (`id`),
  ADD KEY `pedido_id` (`pedido_id`),
  ADD KEY `producto_id` (`producto_id`);

--
-- Indices de la tabla `permisos`
--
ALTER TABLE `permisos`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `clave` (`clave`),
  ADD KEY `idx_modulo` (`modulo`);

--
-- Indices de la tabla `productos`
--
ALTER TABLE `productos`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `sku` (`sku`),
  ADD KEY `idx_sku` (`sku`),
  ADD KEY `idx_nombre` (`nombre`),
  ADD KEY `idx_categoria` (`categoria_id`),
  ADD KEY `idx_proveedor` (`proveedor_id`),
  ADD KEY `idx_activo` (`activo`);

--
-- Indices de la tabla `proveedores`
--
ALTER TABLE `proveedores`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `rif` (`rif`);

--
-- Indices de la tabla `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `nombre` (`nombre`);

--
-- Indices de la tabla `rol_permiso`
--
ALTER TABLE `rol_permiso`
  ADD PRIMARY KEY (`rol_id`,`permiso_id`),
  ADD KEY `permiso_id` (`permiso_id`);

--
-- Indices de la tabla `sesiones`
--
ALTER TABLE `sesiones`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token` (`token`),
  ADD KEY `idx_token` (`token`),
  ADD KEY `idx_usuario` (`usuario_id`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `cedula` (`cedula`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_rol` (`rol_id`);

--
-- Indices de la tabla `ventas`
--
ALTER TABLE `ventas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `numero_factura` (`numero_factura`),
  ADD KEY `anulada_por` (`anulada_por`),
  ADD KEY `idx_fecha` (`created_at`),
  ADD KEY `idx_usuario` (`usuario_id`),
  ADD KEY `idx_estado` (`estado`),
  ADD KEY `fk_ventas_caja` (`caja_id`);

--
-- Indices de la tabla `venta_detalle`
--
ALTER TABLE `venta_detalle`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_venta` (`venta_id`),
  ADD KEY `idx_producto` (`producto_id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `auditoria_logs`
--
ALTER TABLE `auditoria_logs`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `caja`
--
ALTER TABLE `caja`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `movimientos_caja`
--
ALTER TABLE `movimientos_caja`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `categorias`
--
ALTER TABLE `categorias`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de la tabla `gastos`
--
ALTER TABLE `gastos`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `mermas`
--
ALTER TABLE `mermas`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `movimientos_stock`
--
ALTER TABLE `movimientos_stock`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `pedidos`
--
ALTER TABLE `pedidos`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `pedido_detalle`
--
ALTER TABLE `pedido_detalle`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `permisos`
--
ALTER TABLE `permisos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- AUTO_INCREMENT de la tabla `productos`
--
ALTER TABLE `productos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `proveedores`
--
ALTER TABLE `proveedores`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `roles`
--
ALTER TABLE `roles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `sesiones`
--
ALTER TABLE `sesiones`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT de la tabla `ventas`
--
ALTER TABLE `ventas`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `venta_detalle`
--
ALTER TABLE `venta_detalle`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `auditoria_logs`
--
ALTER TABLE `auditoria_logs`
  ADD CONSTRAINT `auditoria_logs_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `caja`
--
ALTER TABLE `caja`
  ADD CONSTRAINT `caja_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Filtros para la tabla `gastos`
--
ALTER TABLE `gastos`
  ADD CONSTRAINT `gastos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Filtros para la tabla `mermas`
--
ALTER TABLE `mermas`
  ADD CONSTRAINT `mermas_ibfk_1` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`),
  ADD CONSTRAINT `mermas_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Filtros para la tabla `movimientos_stock`
--
ALTER TABLE `movimientos_stock`
  ADD CONSTRAINT `movimientos_stock_ibfk_1` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`),
  ADD CONSTRAINT `movimientos_stock_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Filtros para la tabla `pedidos`
--
ALTER TABLE `pedidos`
  ADD CONSTRAINT `pedidos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);

--
-- Filtros para la tabla `pedido_detalle`
--
ALTER TABLE `pedido_detalle`
  ADD CONSTRAINT `pedido_detalle_ibfk_1` FOREIGN KEY (`pedido_id`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `pedido_detalle_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`);

--
-- Filtros para la tabla `productos`
--
ALTER TABLE `productos`
  ADD CONSTRAINT `productos_ibfk_1` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `productos_ibfk_2` FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `rol_permiso`
--
ALTER TABLE `rol_permiso`
  ADD CONSTRAINT `rol_permiso_ibfk_1` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `rol_permiso_ibfk_2` FOREIGN KEY (`permiso_id`) REFERENCES `permisos` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `sesiones`
--
ALTER TABLE `sesiones`
  ADD CONSTRAINT `sesiones_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`);

--
-- Filtros para la tabla `ventas`
--
ALTER TABLE `ventas`
  ADD CONSTRAINT `fk_ventas_caja` FOREIGN KEY (`caja_id`) REFERENCES `caja` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `ventas_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  ADD CONSTRAINT `ventas_ibfk_2` FOREIGN KEY (`anulada_por`) REFERENCES `usuarios` (`id`);

--
-- Filtros para la tabla `venta_detalle`
--
ALTER TABLE `venta_detalle`
  ADD CONSTRAINT `venta_detalle_ibfk_1` FOREIGN KEY (`venta_id`) REFERENCES `ventas` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `venta_detalle_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`);

ALTER TABLE `movimientos_producto`
  ADD CONSTRAINT `fk_movimientos_producto_producto` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`),
  ADD CONSTRAINT `fk_movimientos_producto_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
