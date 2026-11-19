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
