<p align="center"> <img src="bannerdoble.jpg" alt="Banner del Proyecto" width="600"> </p>
<h1 align="center"> Gestion Empresarial-Proyecto Universitario </h1>
<h2> PITBULL Manager </h2> 

<p>  Este sistema es una aplicacion web de gestion empresarial desarrollada en PHP y JavaScript que permite administrar las operaciones principales de una organizacion, integrando una base de datos instalar en XAMPP normalizada a la Tercera Forma Normal (3FN). </p> 

<h2>  Estructura del Repositorio </h2> 

- `public/`: páginas web, estilos, JavaScript, imágenes y endpoints PHP en `public/api/`.
- `app/config/`: configuración de conexión a MySQL, fuera del directorio público.
- `database/schema.sql`: esquema y datos de inicio para importar en MariaDB/MySQL.
- `.env`: configuración local de conexión, ignorada por Git y bloqueada desde Apache.
- `.env.example`: plantilla de configuración sin credenciales.

Las carpetas `app/` y `database/`, así como los archivos `.env`, están protegidos mediante `.htaccess`.

<h2>  Instalación local en XAMPP </h2>

1. Copia la carpeta completa del proyecto a `C:\xampp\htdocs\Pitbull-dev` (o ajusta la URL al nombre que uses).
2. Abre XAMPP Control Panel e inicia **Apache** y **MySQL**.
3. Entra a `http://localhost/phpmyadmin/` y crea una base de datos llamada `pitbull_db`.
4. Selecciona esa base, importa `database/schema.sql` y ejecuta la importación.
5. Copia `.env.example` como `.env` y completa los datos de tu servidor MySQL.
6. Abre `http://localhost:8012/Pitbull-dev/` si Apache está configurado en el puerto 8012. La raíz redirige al login y, después de autenticar, `public/index.html` muestra el panel principal.

La configuración local inicial utiliza `127.0.0.1:3306`, base `pitbull_db`, usuario `root` y contraseña vacía, que coincide con la configuración habitual de XAMPP. Cambia `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASS` en `.env` para usar otros datos.

Se requiere una versión de PHP compatible con el código (PHP 8 o superior) y la extensión `pdo_mysql` habilitada.

<h2> Base de Datos (3FN) </h2>

* La base de datos fue diseñada para la eliminacion de redundancias y proteger la integridad de datos.
* 1FN. Eliminacion de grupos repetidos.
* 2FN. Eliminacion de dependencias parciales.
* 3FN. Eliminacion de dependencias transitivas.

  <h2> Desarrolladores </h2>

<div align="center">
 
| Nombre y Apellido | Rol en el Proyecto | Rama en el Proyecto | GitHub |
| :--- | :--- | :--- | :--- |
| **Marwin Oroño** | Lider del Proyecto y Desarrollo en General | Main | [@StaticSaves](https://github.com/StaticSaves) |
| **Enyerson Ordoñes** | Encargado de Diseño y Diagramas | Diseños | [@Stiven318's](https://github.com/Stiven318's) |
| **Paula Romero** | Desarrollo de la Estructura de la App | Estructura-app | [@Jenie2115](https://github.com/Jenie2115) |
| **Yorbel Davila** | Desarrollo de la Base de Datos SQL | Desarrollo-sql | [@Blaosj's](https://github.com/Blaosj's) |
