-- Crea la base de datos si esta no existe, y la selecciona
CREATE DATABASE IF NOT EXISTS bd_usuarios;
USE bd_usuarios;

-- TABLA ROLES
-- Representa los perfiles del sistema (Admin, , Gerente, Vendedor, Operador y otros)
CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT
) ENGINE=InnoDB; -- Es el motor de almacenamieto, usado para gestionar datos, y garantizar que las operaciones se realicen de forma segura. --

-- TABLA USUARIOS
-- Datos básicos del trabajador. 
CREATE TABLE usuarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    usuario VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    estado ENUM('activo', 'deshabilitado', 'suspendido') DEFAULT 'activo'
) ENGINE=InnoDB;

-- TABLA USUARIOS_ROLES 
-- Aquí relacioamos los usuario para que puede tener múltiples roles.
CREATE TABLE usuarios_roles (
    usuario_id INT,
    rol_id INT,
    PRIMARY KEY (usuario_id, rol_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- TABLA SECCIONES (Vista o pestañas)
-- Páginas de la app: 'Ventas', 'Reporte Ganancias', 'Inventario'.
CREATE TABLE secciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre_interno VARCHAR(50) NOT NULL UNIQUE, -- Ej: 'Seccion_Ventas'
    etiqueta_menu VARCHAR(50) NOT NULL          -- Ej: 'Reporte de Ventas'
) ENGINE=InnoDB;

-- TABLA PERMISOS (Acciones en la app)
-- Qué pueden hacer los usuarios: 'crear', 'editar', 'eliminar', 'visualizar'.
CREATE TABLE permisos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    accion VARCHAR(50) NOT NULL UNIQUE 
) ENGINE=InnoDB;

-- TABLA ROLES_SECCIONES_PERMISOS
-- El Rol Vendedor tiene permiso de Visualizar en la Sección de Ventas.
CREATE TABLE matriz_permisos (
    rol_id INT,
    seccion_id INT,
    permiso_id INT,
    PRIMARY KEY (rol_id, seccion_id, permiso_id),
    FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (seccion_id) REFERENCES secciones(id) ON DELETE CASCADE,
    FOREIGN KEY (permiso_id) REFERENCES permisos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------- --
-- Permisos de Usuario
-- ------------------------------------- --

-- Acciones en la base de datos
INSERT INTO permisos (accion) VALUES ('VER'), ('CREAR'), ('EDITAR'), ('BORRAR');

-- Secciones de la App
INSERT INTO secciones (nombre_interno, etiqueta_menu) VALUES 
('sec_ventas', 'Módulo de Ventas'),
('sec_almacen', 'Inventario y Stock'),
('sec_finanzas', 'Ganancias y Gastos');

-- Roles
INSERT INTO roles (nombre, descripcion) VALUES 
('Admin', 'Soporte Tecnico'),
('Gerente', 'Administrador del Personal'),
('vendedor', 'Personal de Ventas'),
('Operador Stock', 'Personal de Almacen');


-- Permisos vendedor solo puede VER y CREAR en la sección de Ventas
-- No se le asignan registros para 'sec_finanzas', por lo tanto, no tendrá acceso.
INSERT INTO matriz_permisos (rol_id, seccion_id, permiso_id) VALUES 
(3, 1, 1), -- Rol 1 (Vendedor) puede VER (Permiso 1) Ventas (Sección 1)
(3, 1, 2); -- Rol 1 (Vendedor) puede CREAR (Permiso 2) Ventas (Sección 1)

-- Permisos de Soporte Tecnico puede VER, CREAR, EDITAR y BORRAR en Ventas
INSERT INTO matriz_permisos (rol_id, seccion_id, permiso_id) VALUES 
(1, 1, 1), (1, 1, 2), (1, 1, 3), (1, 1, 4), -- Admin puede gestionar Inventario,  estionar Finanzas, ventas y mas. --
(1, 2, 1), (1, 2, 2), (1, 2, 3), (1, 2, 4), 
(1, 3, 1), (1, 3, 2), (1, 3, 3), (1, 3, 4);

-- ------------------------------------- --
-- Datos de Usuario
-- ------------------------------------- --
-- datos para usuarios para soporte tecnico
INSERT INTO usuarios (nombre, apellido, usuario, password, estado) 
VALUES ('Soporte', 'Tecnico', 'Admin', '12345', 'activo');

-- Rol para usuario

INSERT INTO usuarios_roles (usuario_id, rol_id) 
VALUES (1, 1);

-- Visualisacion de los datos ingresados
CREATE VIEW vista_accesos_totales AS  SELECT u.usuario, r.nombre AS rol, s.etiqueta_menu AS modulo, GROUP_CONCAT(p.accion SEPARATOR ', ') 
AS acciones_permitidas 
FROM usuarios u 
JOIN usuarios_roles ur ON u.id = ur.usuario_id 
JOIN roles r ON ur.rol_id = r.id 
JOIN matriz_permisos mp ON r.id = mp.rol_id 
JOIN secciones s ON mp.seccion_id = s.id 
JOIN permisos p ON mp.permiso_id = p.id 
GROUP BY u.id, r.id, s.id, u.usuario, r.nombre, s.etiqueta_menu;

-- Ver Datos --

SELECT * FROM vista_accesos_totales;