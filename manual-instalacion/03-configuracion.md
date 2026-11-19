# 03 · Configuración de .env

El archivo va al lado de package.json y se carga al iniciar la API. No se modifica automáticamente al ejecutar SQL en SSMS. No publicar, enviar en capturas ni sobrescribir un .env existente.

## Desarrollo local
~~~dotenv
NODE_ENV=development
PORT=3000
APP_ORIGIN=http://localhost:4200
SQL_AUTH=windows
SQL_SERVER=localhost
SQL_PORT=14331
SQL_DATABASE=ContactCenterHub_Dev
SQL_USER=
SQL_PASSWORD=
LOCAL_AUTH_ENABLED=false
OIDC_ISSUER=
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_REDIRECT_URI=
MFA_ENCRYPTION_KEY=
~~~

Usar el DNS que figure en el certificado; localhost sólo funciona si está incluido. El puerto local 14331 corresponde a la instalación de referencia, no a toda instalación SQL Express.

## SQL remoto con autenticación SQL
Sustituir únicamente el bloque SQL por los valores aprobados del ambiente:

~~~dotenv
SQL_AUTH=sql
SQL_SERVER=NOMBRE_DNS_DEL_CERTIFICADO
SQL_PORT=65078
SQL_DATABASE=NOMBRE_BASE_APROBADA
SQL_USER=NOMBRE_LOGIN_APLICACION
SQL_PASSWORD="CONTRASENA_CONFIGURADA_PRIVADAMENTE"
~~~

Con puerto explícito, SQL_SERVER contiene el host/DNS sin barra de instancia y sin coma/puerto. No pegar ejemplos como credenciales reales. Estos valores no crean el login ni la base.

SQL está configurado con encrypt=true y trustServerCertificate=false. La PC o identidad de servicio debe confiar en la cadena CA y resolver el nombre. No añadir una opción para saltar la validación TLS. [Referencia de configuración del proyecto](../apps/portal-api/src/database.ts).

## Origen y puertos de la aplicación
APP_ORIGIN es el origen exacto del navegador, sin ruta ni barra final. localhost y 127.0.0.1 son orígenes diferentes. Si cambia PORT, actualizar también el destino en apps/portal-web/proxy.json y, en despliegue, el proxy de IIS. No configurar CORS abierto para resolver errores de origen.

En producción: NODE_ENV=production y APP_ORIGIN=https://nombre-aprobado. La API escucha en 127.0.0.1; el proxy HTTPS recibe las conexiones externas.

## Identidad y MFA
LOCAL_AUTH_ENABLED=true habilita el método de acceso local; no crea usuarios. Para el primer administrador local, admin:local puede generar la clave faltante y habilitarlo dentro del entorno de desarrollo autorizado. No usar ese asistente con una base remota de producción.

MFA_ENCRYPTION_KEY debe conservarse para todas las cuentas cifradas de una base. No reemplazarla para resolver un error de login. Separar claves entre ambientes, pero compartir la misma clave autorizada entre instancias de API que atiendan la misma base. Respaldar base y clave por procedimientos seguros y separados.

OIDC requiere issuer HTTPS, client ID, secreto, callback APP_ORIGIN/api/auth/callback y MFA del proveedor, además de asociación explícita de la identidad al usuario. Ver [autenticación](../docs/security/authentication.md). Reiniciar la API tras un cambio de configuración.
