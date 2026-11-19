# 06 · Despliegue y operación

## Estado
Este manual documenta el sistema implementado; no certifica su aptitud para producción. La creación de tablas remotas fue confirmada por el usuario, pero no constituye una validación de despliegue completo. Revisar [controles](../docs/security/controls.md), identidad inicial, recuperación, TLS, permisos SQL, respaldos y pruebas integrales antes del pase.

## Empaquetado
En un entorno de compilación con Node compatible: npm.cmd ci, npm.cmd test y npm.cmd run build. Publicar dist/web/browser como frontend estático. La API arranca con node --env-file=.env dist/api/main.js desde la raíz del paquete; necesita package.json/package-lock.json y sus dependencias runtime instaladas con npm.cmd ci --omit=dev. No usar ese modo en la PC donde todavía se necesita compilar.

El .env se proporciona de forma privada en el servidor de aplicación, no en la carpeta pública del sitio web. No colocar código de servidor, .env o .local en el directorio servido por IIS.

## IIS y servicio
Usar el ejemplo infrastructure/iis/web.config, URL Rewrite/ARR y HTTPS aprobado. Proxy /api hacia 127.0.0.1:3000, preservando Host/Origin y deep links Angular. Configurar NODE_ENV=production y APP_ORIGIN exacto con HTTPS. No exponer directamente el puerto de la API, que escucha loopback.

El servicio Windows debe usar identidad dedicada y permisos mínimos. El XML de infrastructure/windows-services es sólo un ejemplo; no instala un servicio. Ajustar directorio de trabajo, acceso al .env y dependencias, logs y reinicio mediante el procedimiento de infraestructura.

La API aplica rate limiting agregado detrás del proxy; definir y probar límites por cliente en el proxy. No habilitar trust proxy sin revisar el diseño.

## Actualización
1. Registrar versión a desplegar y respaldo/restauración para base y secretos.
2. Revisar historial del manual y las migraciones nuevas; probar en entorno equivalente.
3. Detener API antes del cambio SQL. Ejecutar la copia parametrizada del mismo instalador consolidado: revisión y luego aplicación.
4. Publicar los artefactos de la versión, mantener los secretos del ambiente y reiniciar.
5. Verificar conexión, login/MFA, catálogo, permisos, auditoría y flujos afectados con cuentas autorizadas.

El instalador no genera migraciones de reversión. No volver a código antiguo sin comprobar compatibilidad de esquema; el plan de recuperación depende del cambio y del respaldo aprobado. Nunca borrar dbo.hub_migrations para forzar una instalación.
