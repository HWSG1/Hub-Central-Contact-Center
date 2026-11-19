# 08 · Historial del manual y del esquema

## 2026-11-18 · Manual consolidado
- Carpeta manual-instalacion como punto de entrada único para requisitos, instalación desde GitHub, .env, SQL, usuarios, despliegue y errores.
- Instalar-Actualizar-Hub.sql generado desde migraciones 001–004, con servidor/base obligatorios, revisión predeterminada, historial y transacción.
- docs:build genera el artefacto sin conectarse a SQL. docs:check verifica sincronización; npm test lo ejecuta.
- Manifiesto de hashes y finales LF para que distintas PCs produzcan el mismo SQL. No se cambiaron las migraciones 001–004 ni sus hashes.
- Se mantienen instaladores anteriores como históricos; no usarlos en instalaciones nuevas.

| Migración | Contenido |
|---|---|
| 001_core.sql | Identidad, sesiones, RBAC, catálogo, auditoría, metadatos de módulos y permisos SQL iniciales |
| 002_local_mfa.sql | Secreto MFA cifrado, contador antirreuso y permisos de actualización de credenciales |
| 003_security_administration.sql | Estado/versiones de roles y usuarios, detalle de auditoría, permisos de administración |
| 004_user_enrollment.sql | Invitaciones de activación y permiso para crear usuarios |

## Evidencia y límites
El usuario aportó capturas de login local y de las cuatro migraciones aplicadas con 19 tablas en SQL remoto. Es evidencia reportada por el usuario, no una prueba automatizada de integración de la API en ese servidor. Los tests de servicios usan adaptadores SQL simulados. La validación automatizada de esta actualización se registra al final de este archivo; no se ejecutan cambios SQL como parte de generar el manual.

Pendiente: importación/ejecución segura de módulos, recuperación de MFA, primer administrador local de producción, validación de IdP real y pruebas integrales de despliegue. Mantener la matriz técnica de controles.

Validación de esta entrega: 61 pruebas aprobadas, docs:check correcto y compilación API/Angular completada. No se ejecutó el SQL consolidado contra ninguna base ni se modificó .env.

## 2026-11-18 · Login ajustado a la altura disponible
- Se reducen espacios verticales y se integra el icono en el encabezado de la tarjeta. El acceso corporativo se muestra sólo si está habilitado.
- Cambio inicial de contraseña en un segundo paso visual; se mantienen usuario y contraseña inicial en memoria hasta completar el flujo. Volver limpia contraseñas y códigos. No se cambia la API ni SQL.
- Revisión visual del login local con error visible, sin enviar credenciales: 1920×900, 1366×650, 1280×600, 768×1024, 390×844 y 375×667, sin desbordamiento horizontal/vertical de página. El estado de cambio obligatorio y el proveedor corporativo no se validaron con identidades reales en esta revisión.
- Compilación API/Angular correcta. Se actualizan instrucciones sobre cuentas de otra PC, TOTP de seis dígitos y errores de servicio. No se ejecutó el bootstrap ni se cambió .env.
