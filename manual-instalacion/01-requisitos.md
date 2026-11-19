# 01 · Requisitos

## Equipo que ejecuta la aplicación
- Windows con PowerShell, Git y Node.js **24.x, desde 24.15.0 y menor que 25**, según package.json; npm incluido. No asumir que Node más nuevo pertenece al rango soportado.
- Acceso al repositorio y a los paquetes para npm ci. Angular y TypeScript se instalan como dependencias del proyecto; no hace falta instalar Angular CLI globalmente.
- SQL Server 2022 accesible localmente o por la red/VPN aprobada. La PC del navegador, la PC de la API y el servidor SQL pueden ser equipos distintos.
- Para SQL_AUTH=windows: Microsoft ODBC Driver **17** for SQL Server, usado explícitamente por database.ts, y la identidad Windows correcta. SQL_AUTH=sql usa el controlador JavaScript y el login indicado en .env.
- Si npm ci informa que no existe binario compatible para una dependencia nativa, revisar el error y los requisitos de compilación de esa dependencia. No omitir dependencias o scripts de instalación para ocultar el fallo.
- Nombre DNS del SQL resoluble, puerto autorizado y certificado de servidor confiable. SQL_SERVER debe coincidir con el certificado; no desactivar su validación.
- .env privado. Para cuentas locales con MFA, una MFA_ENCRYPTION_KEY de 32 bytes codificada como 64 caracteres hexadecimales, protegida y respaldada.

Comprobar en PowerShell:

~~~powershell
node --version
npm.cmd --version
git --version
~~~

## Equipo que sólo ejecuta el SQL
SSMS, acceso de red al SQL y una cuenta instaladora autorizada. No necesita Node, Angular ni .env para ejecutar el instalador SQL. La base debe existir y ser exclusiva del Hub. El instalador crea esquema, tablas, índices, rol y permisos: CREATE TABLE por sí solo no basta.

## Aplicación en producción
DNS y HTTPS de la aplicación, IIS con URL Rewrite/ARR o proxy equivalente aprobado, identidad de servicio, acceso SQL mínimo, secretos protegidos, respaldo/restauración y ventana de cambio. No publicar ng serve como servicio de producción. Revisar [06](06-despliegue-operacion.md).

No se ha efectuado una prueba de carga para fijar CPU, RAM o concurrencia de producción. La capacidad debe dimensionarse mediante pruebas con el uso esperado.
