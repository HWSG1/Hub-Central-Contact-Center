# 02 · Instalar en otra PC

## 1. Obtener el código
Clonar el repositorio o descargar una versión aprobada. Abrir la carpeta que contiene package.json en VS Code. Usar una ubicación local destinada al proyecto; por ejemplo C:\Proyectos\Hub-Central-Contact-Center. No subir .env ni archivos de alta privada a Git.

~~~powershell
git clone https://github.com/HWSG1/Hub-Central-Contact-Center.git
cd Hub-Central-Contact-Center
npm.cmd ci
~~~

Si ya tienes la carpeta clonada, no vuelvas a clonar dentro de ella. Revisar cambios locales antes de actualizar la versión. Continuar cada paso sólo si el anterior termina correctamente.

## 2. Configurar
Sólo para una instalación sin .env:

~~~powershell
if (!(Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
~~~

Editar los valores según [03](03-configuracion.md). Copiar el código a otra PC NO copia .env, usuarios ni la clave MFA. Si la nueva API va a usar una base que ya contiene cuentas MFA, necesita la misma clave de cifrado autorizada de ese ambiente. No ejecutar admin:local para regenerarla.

## 3. Base y primer acceso
Preparar el esquema con el único SQL de [04](04-base-datos.md). Si ya existen las cuatro migraciones compatibles, no recrear las tablas. Verificar conexión desde la PC de la API:

~~~powershell
npm.cmd run db:check
~~~

Un resultado satisfactorio comprueba conexión SQL y base de destino, no todos los permisos de runtime. Preparar el primer acceso según [05](05-acceso-usuarios.md).

## 4. Compilar e iniciar
La carpeta dist está excluida de GitHub. Por eso una copia recién clonada no puede arrancar con start:api sin compilar antes.

~~~powershell
npm.cmd run build
~~~

Debe generar dist/api/main.js y el frontend en dist/web/browser. Para compilar sólo la API: npm.cmd run build:api.

Terminal 1, en la raíz del proyecto:

~~~powershell
npm.cmd run start:api
~~~

Terminal 2, en la misma carpeta:

~~~powershell
npm.cmd run start:web
~~~

Abrir http://localhost:4200 (o el valor de FRONTEND_PORT configurado en .env). Mantener ambas terminales abiertas. start:web lee FRONTEND_PORT y BACKEND_PORT del .env, elimina PORT únicamente del proceso Angular para evitar conflictos y prepara el proxy /api automáticamente; para producción seguir [06](06-despliegue-operacion.md). Si el .env existente usa PORT=3000, sigue siendo válido para la API, pero se recomienda añadir FRONTEND_PORT=4200 y BACKEND_PORT=3000 sin borrar ni reemplazar otros valores privados.

No confundir usar una base alojada en un servidor de producción con desplegar la aplicación completa a producción. Las pruebas desde una PC conectada a esa base también escriben datos reales y requieren el cambio autorizado.
