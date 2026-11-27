# 03 · Configuración de .env

El archivo va al lado de package.json y se carga al iniciar la API. No se modifica automáticamente al ejecutar SQL en SSMS. No publicar, enviar en capturas ni sobrescribir un .env existente.

## Desarrollo local
~~~dotenv
NODE_ENV=development
FRONTEND_PORT=4200
BACKEND_PORT=3000
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

SQL mantiene encrypt=true. SQL_TRUST_SERVER_CERTIFICATE=false (predeterminado) exige una cadena confiable y nombre DNS coincidente. Por solicitud explícita del operador se admite SQL_TRUST_SERVER_CERTIFICATE=true para confiar en el certificado presentado sin validarlo, como en el otro proyecto. La conexión permanece cifrada, pero se pierde la verificación de identidad del servidor y queda expuesta a suplantación. La opción aplica a autenticación SQL y Windows; db:check informa si la validación fue omitida. No es necesario configurar una instancia cuando se usa el puerto TCP explícito. Reiniciar la API tras cambiar la variable; recompilar si se actualizó el código. [Referencia de configuración del proyecto](../apps/portal-api/src/database.ts).

## Origen y puertos de la aplicación
APP_ORIGIN es el origen exacto del navegador, sin ruta ni barra final. localhost y 127.0.0.1 son orígenes diferentes. La API escucha en BACKEND_PORT (3000 por defecto) y Angular se inicia en FRONTEND_PORT (4200 por defecto). El comando `npm.cmd run start:web` carga .env y genera `.local/dev-proxy.json` para redirigir /api automáticamente a BACKEND_PORT; no es necesario editar `apps/portal-web/proxy.json` en desarrollo. Angular 22 prioriza la variable genérica PORT sobre --port: el lanzador elimina esa variable únicamente del proceso Angular. La API mantiene compatibilidad con PORT de los .env anteriores cuando BACKEND_PORT no está definido. No se cambia ni publica el .env privado automáticamente.

Si cambia FRONTEND_PORT, actualizar APP_ORIGIN y, si está configurado OIDC, OIDC_REDIRECT_URI y el redirect autorizado en Entra ID. Si cambia BACKEND_PORT en un despliegue mediante IIS, ajustar también el destino del proxy de IIS. No configurar CORS abierto para resolver errores de origen.

En producción: NODE_ENV=production y APP_ORIGIN=https://nombre-aprobado. La API escucha en 127.0.0.1; el proxy HTTPS recibe las conexiones externas.

## Identidad y MFA
LOCAL_AUTH_ENABLED=true habilita el método de acceso local; no crea usuarios. Para el primer administrador local, admin:local puede generar la clave faltante y habilitarlo dentro del entorno de desarrollo autorizado. No usar ese asistente con una base remota de producción.

MFA_ENCRYPTION_KEY debe conservarse para todas las cuentas cifradas de una base. No reemplazarla para resolver un error de login. Separar claves entre ambientes, pero compartir la misma clave autorizada entre instancias de API que atiendan la misma base. Respaldar base y clave por procedimientos seguros y separados.

OIDC requiere issuer HTTPS, client ID, secreto, callback APP_ORIGIN/api/auth/callback y MFA del proveedor, además de asociación explícita de la identidad al usuario. Ver [autenticación](../docs/security/authentication.md). Reiniciar la API tras un cambio de configuración.

## Microsoft Entra: prueba local y posterior publicación
En Registros de aplicaciones → Autenticación → plataforma Web, registrar http://localhost:4200/api/auth/callback. La URI la proporciona el responsable del Hub y el administrador Entra la registra. Usar APP_ORIGIN=http://localhost:4200 y NODE_ENV=development; el proxy de Angular reenvía /api a la API en 3000. Navegador, frontend y API deben ejecutarse en el equipo de prueba.

El bloque OIDC de .env.example deja issuer/client/secret vacíos hasta recibirlos. Completar OIDC_ISSUER=https://login.microsoftonline.com/TENANT_ID/v2.0, OIDC_CLIENT_ID con el ID de aplicación y OIDC_CLIENT_SECRET con el valor del secreto entre comillas. Mantener OIDC_REDIRECT_URI=http://localhost:4200/api/auth/callback y reiniciar API. El .env privado no viaja con Git; trasladar el bloque manualmente a la PC de prueba sin sobrescribir SQL ni MFA.

Posteriormente se puede agregar la URI HTTPS publicada en Entra y cambiar APP_ORIGIN/OIDC_REDIRECT_URI en el despliegue; se recomienda un registro separado para producción y pruebas. La configuración prepara el flujo, pero no acredita integración terminada: falta validar la política MFA de Entra y adaptar su evidencia al chequeo actual amr=mfa, además de asociar las identidades a usuarios y roles del Hub.
