> Instalación vigente: [manual central](../../manual-instalacion/README.md). Las referencias a instaladores separados y evidencias de bloqueo siguientes son históricas; para ejecutar SQL usar el consolidado del manual.

# Administración de roles, permisos y usuarios

## Activación local
1. Detén la API con Ctrl+C en su terminal.
2. Abre database/deployment/Update-Security-Administration.sql en SSMS, conectado a JanOda_PC_00\SQLEXPRESS01. Ejecuta TODO el archivo con F5. No necesita modo SQLCMD. Se limita a ContactCenterHub_Dev y verifica las migraciones 001 y 002 por hash. Se puede repetir: omite 003 si ya está registrada con el mismo hash.
3. En la carpeta del proyecto ejecuta npm.cmd run build:api y luego npm.cmd run start:api. Mantén npm.cmd run start:web en otra terminal.
4. Cierra sesión en el portal y vuelve a entrar con tu cuenta y MFA. Aparecen Roles y permisos y Usuarios según los permisos de la cuenta.

No vuelvas a ejecutar el alta inicial ni regeneres MFA para esta actualización. El SQL añade permisos administrativos al rol PLATFORM_ADMIN existente. No crea cuentas ni modifica contraseñas. Para otros entornos, el DBA debe revisar la migración 003 y usar el proceso versionado; el archivo de SSMS está limitado deliberadamente a esta PC.

## Uso
- Roles: crear con código único, editar nombre/descripción, habilitar o deshabilitar. El código se mantiene estable; no se elimina historial.
- Permisos: consulta de permisos actuales y matriz de asignación con búsqueda. Sólo se asignan permisos registrados y presentes en la autoridad del operador.
- Usuarios: consulta y búsqueda de cuentas existentes, estado y asignación de roles. Incluye alta local por invitación desde Nuevo usuario; no incluye recuperación de MFA.
- Cada escritura exige un motivo y una sesión con MFA iniciada hace menos de 15 minutos. Si se supera ese plazo, cerrar e iniciar sesión otra vez.
- No puedes editar tu propio acceso ni un rol que tengas asignado. Con un solo administrador es normal que su rol esté protegido; puede crear roles adicionales para otras cuentas existentes.
- No se permite administrar cuentas con permisos fuera de tu autoridad, incluso si provienen de roles deshabilitados. También se verifica cada usuario afectado por un cambio de rol.
- Una cuenta administrativa requiere MFA. Debe quedar al menos un administrador activo, no expirado, sin cambio de contraseña pendiente y con los seis permisos de administración.
- Las cuentas con restricciones de alcance no pueden usar esta administración global. Delegación por unidad/recurso queda pendiente.
- Cambios de permisos, asignaciones o estado revocan las sesiones afectadas. Los roles deshabilitados dejan de otorgar permisos.
- Dos cambios concurrentes con versión desactualizada generan conflicto; recarga y revisa antes de guardar.

## Auditoría y límites de validación
Cada cambio exitoso guarda actor, fecha, acción, recurso, correlación, motivo y estado anterior/posterior en core.audit_events, dentro de la misma transacción. Si falla la escritura de auditoría, se revierte el cambio. Las denegaciones de política también se registran. No se guardan contraseñas ni secretos MFA en estos eventos. La pantalla Auditoría existente permite consultarlos.

Validación: 54 pruebas automatizadas aprobadas y compilación Angular/API correcta. Las pruebas transaccionales usan un adaptador simulado; no sustituyen validación en SQL Server. Pendiente: aplicar 003 en SQL real, comprobar el flujo en navegador con cuentas autorizadas y revisar permisos de la identidad de servicio antes de producción. No se declara certificación ni cumplimiento ASVS.

Alta local por invitación: requiere migración 004; ver docs/security/user-enrollment.md.
