> Instalación vigente: [manual central](../../manual-instalacion/README.md). Las referencias a instaladores separados y evidencias de bloqueo siguientes son históricas; para ejecutar SQL usar el consolidado del manual.

# Primer administrador local — Contact Center Hub

Esta entrega añade alta por terminal/SSMS, MFA TOTP y cambio de contraseña inicial. No crea cuentas ni contraseñas automáticamente.

## 1. Base inicial
Ejecutar database/deployment/Install-Local.sql completo en SSMS contra localhost\SQLEXPRESS01 si no se hizo antes. Debe existir ContactCenterHub_Dev con la migración 001 registrada. No ejecutar 001_core.sql suelto ni editar migraciones aplicadas.

## 2. Preparar tu cuenta desde VS Code
En una terminal normal, dentro de E:\Odair\Proyectos Personales\Angular\contact-center-hub:

    npm.cmd run admin:local

El asistente pide usuario y nombre, luego una contraseña inicial de 15–128 caracteres (entrada oculta), y su confirmación. No uses tu nombre de usuario dentro de la contraseña. No introduzcas credenciales en argumentos ni las compartas en el chat.
Agrega una cuenta de tipo TOTP en una aplicación autenticadora mediante clave manual. El asistente muestra la clave una sola vez durante ese proceso y pide el código vigente para confirmar la vinculación. Algoritmo SHA1, 6 dígitos, periodo 30 segundos.
Genera un archivo PRIVADO en .local/alta-admin-<id>.sql; la ruta exacta aparece en la terminal. Contiene hash Argon2id y secreto MFA cifrado, no la contraseña ni el secreto TOTP en claro.
También genera MFA_ENCRYPTION_KEY en .env si falta y habilita LOCAL_AUTH_ENABLED. .env y .local están excluidos de Git. Protege estos archivos y conserva una copia privada de la clave; perderla impide validar los autenticadores. No regenerar la clave para solucionar errores.
El asistente requiere NODE_ENV=development y SQL_DATABASE=ContactCenterHub_Dev. Usa una terminal interactiva, no el panel Output/Debug Console ni entrada por tuberías.

## 3. Ejecutar el alta en SSMS
Abre el archivo privado generado y ejecuta TODO con F5 en SQLEXPRESS01 local. Aplica 002_local_mfa.sql con su hash, crea la cuenta con rol PLATFORM_ADMIN, exige MFA y cambio inicial, registra auditoría y sella el bootstrap en una transacción.
El comando no puede repetir el alta si ya se inicializó el portal o existe un administrador de plataforma. No borres la marca para volver a intentarlo: revisar el estado antes de cualquier recuperación.
Si todo sale bien verás ADMINISTRADOR LOCAL CREADO. No ejecutar otra alta ni editar manualmente require_mfa.

## 4. Resolver la conexión cifrada local
La comprobación actual devuelve certificado SQL no confiable. Crear la cuenta por SSMS no arregla la conexión de la API.
Primero puedes comprobar sin modificar nada:

    npm.cmd run db:check

Si no configuraste un certificado y esta es tu instancia de desarrollo, se incluye scripts/configure-local-sql-tls.ps1. Sin parámetros sólo muestra un diagnóstico.
Para aplicarlo: abre PowerShell COMO ADMINISTRADOR, con el mismo usuario Windows que ejecuta VS Code, entra a la carpeta del proyecto y revisa el script. Ejecuta:

    .\scripts\configure-local-sql-tls.ps1 -Apply

Crea un certificado de servidor local válido por un año con SAN localhost y nombre del equipo; concede lectura de la clave a la cuenta de SQLEXPRESS01, confía en el certificado público únicamente para tu usuario Windows y lo asocia a la instancia. Rechaza reemplazar otro certificado ya configurado. No modifica otras instancias, no desactiva cifrado ni TrustServerCertificate.
Para aplicar la asociación debes reiniciar SQL Server (SQLEXPRESS01) desde Configuration Manager. Esto interrumpe TODAS las aplicaciones conectadas a esa instancia: elige un momento apropiado. Alternativamente ejecuta el asistente con -Apply -RestartSql sólo cuando puedas interrumpirlas.
Si PowerShell bloquea el script por una política corporativa, no cambies esa política: solicita firma/aprobación o sigue el procedimiento manual con Configuration Manager.
Después ejecutar npm.cmd run db:check desde la terminal normal de VS Code. Debe confirmar conexión cifrada con ContactCenterHub_Dev. No usar este certificado ni asistente en producción; allí corresponde certificado corporativo y cuenta de servicio dedicada.

## 5. Iniciar sesión
Reinicia la API para cargar .env y la compilación nueva:

    npm.cmd run start:api

Mantén el frontend en otra terminal:

    npm.cmd run start:web

Abre http://localhost:4200. Ingresa el usuario que elegiste, la contraseña inicial y un NUEVO código del autenticador (el usado al generar el alta no sirve de nuevo). El formulario pedirá otra contraseña de 15–128 caracteres y confirmación. Si cambió el código mientras escribías, actualízalo antes de enviar.
Sólo entonces se crea la sesión y se abre el portal. Los siguientes ingresos usan la contraseña nueva y un código vigente. No hay aplicaciones de negocio publicadas inicialmente; es normal ver catálogo vacío.

## Límites y verificaciones
- 28 pruebas aprobadas: MFA contra vector RFC 6238, cifrado autenticado ligado al usuario, replay, carrera de consumo, cuentas bloqueadas, cambio inicial, política, entrada oculta y SQL de alta.
- Backend compilado; Angular compilado con CI=true (sin caché persistente). Se explicitó rootDir para TypeScript 6.
- Las pruebas del servicio usan persistencia sustituida; aún no hubo prueba completa con SQL porque TLS sigue bloqueado. El asistente de certificado sólo se validó sintácticamente, no se ejecutó con -Apply.
- El terminal automatizado no permitió modo de entrada oculta (setRawMode EPERM). Se probó ese comportamiento con una terminal sustituida; ejecutar el asistente en tu terminal normal de VS Code.
- No se ha generado tu cuenta: usuario, contraseña y vinculación del teléfono deben ingresarse por ti.
- No hay recuperación automática de MFA ni reseteo público. Si pierdes el autenticador, se requiere un procedimiento administrativo auditado; no existe bypass. Comprobación completa de contraseñas comprometidas y endurecimiento corporativo pendientes de UAT.
- Primer administrador local sólo para desarrollo en esta entrega. No habilitar cuentas locales administrativas en producción hasta completar recuperación, revisión de seguridad y operaciones.
