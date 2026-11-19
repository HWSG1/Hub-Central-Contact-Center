# RBAC inicial
| Rol semilla | Permisos explícitos |
|---|---|
| PLATFORM_ADMIN | CORE.MODULES.READ, CORE.AUDIT.READ, CORE.USERS.READ, CORE.ROLES.READ |
| AUDITOR | CORE.AUDIT.READ |
| READER | Ninguno hasta asignación |
Los nombres son etiquetas. No hay comodines ni superadministrador implícito. La semilla no contiene usuarios. Usuarios/roles son sólo modelo de datos en fase 1, no interfaces de administración completas.
Catálogo: requiere usuario activo, sesión, módulo habilitado, aplicación publicada y permiso. Acceso a recursos del negocio exigirá alcance explícito en cada API del módulo; el guard global no sustituye ese control.
