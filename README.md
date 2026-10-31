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

La configuración local inicial utiliza `127.0.0.1:3306`, base `pitbull_db`, usuario `root` y contraseña vacía, que coincide con la configuración habitual de XAMPP. Cambia `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASS` en `.env` para usar otros datos.

Se requiere una versión de PHP compatible con el código (PHP 8 o superior) y la extensión `pdo_mysql` habilitada.
