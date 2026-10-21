# PITBULL Manager

Aplicación web PHP y JavaScript para instalar en XAMPP.

## Estructura

- `public/`: páginas web, estilos, JavaScript, imágenes y endpoints PHP en `public/api/`.
- `app/config/`: configuración de conexión a MySQL, fuera del directorio público.
- `database/schema.sql`: esquema y datos de inicio para importar en MariaDB/MySQL.
- `.env`: configuración local de conexión, ignorada por Git y bloqueada desde Apache.
- `.env.example`: plantilla de configuración sin credenciales.

Las carpetas `app/` y `database/`, así como los archivos `.env`, están protegidos mediante `.htaccess`.

## Instalación local en XAMPP

1. Copia la carpeta completa del proyecto a `C:\xampp\htdocs\Pitbull-dev` (o ajusta la URL al nombre que uses).
2. Abre XAMPP Control Panel e inicia **Apache** y **MySQL**.
3. Entra a `http://localhost/phpmyadmin/` y crea una base de datos llamada `pitbull_db`.
4. Selecciona esa base, importa `database/schema.sql` y ejecuta la importación.
5. Copia `.env.example` como `.env` y completa los datos de tu servidor MySQL.
6. Abre `http://localhost:8012/Pitbull-dev/` si Apache está configurado en el puerto 8012. La raíz redirige al login y, después de autenticar, `public/index.html` muestra el panel principal.

La configuración local inicial utiliza `127.0.0.1:3306`, base `pitbull_db`, usuario `root` y contraseña vacía, que coincide con la configuración habitual de XAMPP. Cambia `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASS` en `.env` para usar otros datos. No publiques ese archivo ni guardes credenciales reales en `.env.example`.

Se requiere una versión de PHP compatible con el código (PHP 8 o superior) y la extensión `pdo_mysql` habilitada.

## Panel principal

El panel carga métricas de inventario, ventas y caja desde la API autenticada `public/api/dashboard.php`. Los indicadores financieros, el inventario y el estado de caja se consultan solo cuando el rol del usuario dispone del permiso correspondiente. La vista de productos se conserva en `public/productos.html`.

## Importante: esquema y endpoints

El volcado SQL existente no está sincronizado con todas las consultas de la API. Entre otras diferencias, faltan tablas usadas por los endpoints de almacenes, entradas, configuración y movimientos de caja; algunas rutas también esperan columnas que no existen en el volcado. Por eso, importar el SQL permite crear la base inicial, pero no garantiza que todos los módulos funcionen. Hay que alinear el esquema con esos endpoints antes de usar todas las funciones.

Los usuarios de demostración incluidos en el volcado deben cambiar sus contraseñas antes de exponer la aplicación a otros equipos o a Internet.
