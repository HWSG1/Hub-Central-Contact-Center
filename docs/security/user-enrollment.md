> Instalación vigente: [manual central](../../manual-instalacion/README.md). Las referencias a instaladores separados y evidencias de bloqueo siguientes son históricas; para ejecutar SQL usar el consolidado del manual.

# Nuevo usuario desde el portal

## Instalar esta actualización local
1. Detén la API (Ctrl+C en su terminal).
2. En SSMS, conectado a JanOda_PC_00\SQLEXPRESS01, ejecuta completo database/deployment/Update-User-Enrollment.sql (F5). Requiere las migraciones 001, 002 y 003; si aún falta roles/permisos, aplica primero Update-Security-Administration.sql. No recrees la base ni repitas admin:local.
3. En E:\Odair\Proyectos Personales\Angular\contact-center-hub ejecuta npm.cmd run build:api y npm.cmd run start:api. Mantén npm.cmd run start:web en otra terminal.
4. Cierra sesión y vuelve a entrar con MFA. El rol PLATFORM_ADMIN existente recibe CORE.USERS.CREATE mediante esta migración. La API también exige CORE.USERS.ROLES_ASSIGN para asignar roles iniciales.

## Administrador: Usuarios → Nuevo usuario
- Indica nombre completo, usuario de acceso, roles iniciales y motivo del alta.
- Sólo puedes asignar roles habilitados cuyos permisos estén dentro de tu autoridad. Para crear o renovar invitaciones debes tener una sesión con MFA iniciada en los últimos 15 minutos y no tener restricciones de alcance global.
- Se crea una cuenta local pendiente de activación. No se crea una contraseña temporal ni una sesión.
- La pantalla muestra la dirección /activate y un código privado, una sola vez. Entrega ambos al destinatario por un canal privado; la aplicación no envía correos automáticamente.
- El código vence a las 24 horas. Si se pierde, vence o se bloquea, usa Renovar activación en la tarjeta del usuario. Es necesario introducir un motivo. El código anterior y la clave de autenticador anterior dejan de servir. No se puede renovar una cuenta activada o deshabilitada.
- Puedes deshabilitar una cuenta pendiente para impedir su activación.

## Nuevo usuario: activar la cuenta
1. Abre la dirección de activación del portal. Localmente: http://localhost:4200/activate (desde la misma PC; localhost no sirve en otra computadora). También hay un enlace en el login.
2. Introduce el código entregado por el administrador.
3. Agrega la clave manual en tu autenticador como cuenta basada en tiempo (6 dígitos, 30 segundos).
4. Elige y confirma una contraseña personal de 15–128 caracteres, sin incluir tu usuario, e introduce un código vigente del autenticador.
5. Al finalizar, entra por el login normal con tu usuario, contraseña y un código NUEVO del autenticador. Puede ser necesario esperar el siguiente periodo de 30 segundos.

## Controles y validación
- Código aleatorio de 256 bits; SQL almacena únicamente su hash. No se incluye en URL, logs ni auditoría, y el frontend no lo persiste en almacenamiento del navegador.
- Semilla MFA cifrada con la clave configurada y vinculada al usuario. Tras la activación se elimina la copia cifrada de la invitación; permanece en las credenciales para verificar TOTP.
- MFA obligatorio para todas las altas de este flujo. Contraseña personal Argon2id; no hay contraseñas predeterminadas ni recuperación pública.
- Máximo cinco códigos MFA incorrectos por invitación y límite por IP en los endpoints de activación. La activación consume la invitación y guarda credenciales/auditoría en una transacción, sin iniciar sesión automáticamente.
- Alta, renovación y activación auditadas sin secretos. Las operaciones administrativas conservan los controles de autoridad existentes.
- Validado: 54 pruebas automatizadas y compilación completa API/Angular. La pantalla pública /activate carga y mantiene Continuar deshabilitado sin código. Las pruebas de persistencia usan adaptadores simulados. Pendiente aplicar la migración y verificar alta/activación/login contra SQL Server con cuentas autorizadas. No se han creado usuarios reales en esta entrega ni aplicado cambios a producción.
