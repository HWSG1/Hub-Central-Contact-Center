# Matriz de controles — estado verificable
Objetivo: controles aplicables ASVS 5.0 nivel 2 y evaluación nivel 3 para operaciones sensibles. No se declara cumplimiento.
| Área | Implementación | Evidencia / pendiente |
|---|---|---|
| Autenticación local | Argon2id, cuenta autorizada, error genérico, bloqueo, apagado configurable | Tests de política; login local confirmado por captura del usuario; prueba integral remota pendiente |
| Corporativa | OIDC Code + PKCE, state, nonce, cookies de transacción, issuer+subject | Prueba con IdP real pendiente; Kerberos/LDAPS no implementados |
| MFA | OIDC amr=mfa o MFA local TOTP con secreto AES-GCM y contador antirreuso | Alta local por CLI/SSMS con confirmación MFA y cambio inicial; WebAuthn, recuperación y acr corporativo pendientes |
| Sesiones | Hash opaco, 15 min/8h, revocación, reevaluación estado/permisos | Tests de límite y guard; integración SQL pendiente |
| CSRF | Origin exacto para login y escrituras, token de sesión para escrituras autenticadas | Tests de rechazo de token y origen |
| RBAC | Guard global, permisos explícitos, catálogo autorizado | Administración de roles/usuarios y matriz implementada; pruebas de autoridad, MFA, último administrador y rollback. Integración SQL/UI y alcances por recurso pendientes |
| Datos | Consultas parametrizadas, migraciones versionadas, FK/índices | 001–004 aplicadas en SQL remoto según captura del usuario; validación de runtime pendiente |
| Seguridad HTTP | Helmet, CSP frontend de build, no-store, sin CORS global | Validación IIS y CSP desplegada pendiente |
| Auditoría | Login/logout/denegaciones/consulta auditoría, runtime append-only | Recursos y before/after administrativos implementados; pruebas de rollback. Origen/SIEM y permisos SQL reales pendientes |
| Suministro | Dependencias bloqueadas tras instalación | SCA y revisión humana requeridas antes de UAT |
| Módulos | Contrato/Schema, registro SQL y catálogo | Importación, verificación firma, cuarentena, estados, pipeline y UI de gestión pendientes |
| Recuperación | Sin endpoint público inseguro | Recuperación segura y política de credenciales comprometidas pendientes |
Regla de salida: no habilitar cuentas locales administrativas ni operaciones bancarias hasta completar MFA, recuperación, pruebas integrales y revisión de seguridad.

Alta de usuarios local: migración 004, permiso CORE.USERS.CREATE, invitación de 24h, activación de un solo uso, contraseña personal y MFA obligatorio. Auditoría transaccional y pruebas con adaptador simulado. Pantalla pública verificada; integración SQL real pendiente. Ver user-enrollment.md.

Bootstrap remoto local: admin:remote genera SQL privado con destino explícito y revisión por defecto; exige migraciones verificadas, MFA y cambio inicial, y rechaza bootstrap existente. Validación automatizada del generador; integración SQL remota y recuperación pendientes.

SQL TLS: cifrado obligatorio; validación del certificado por defecto. Excepción solicitada por el operador: SQL_TRUST_SERVER_CERTIFICATE=true omite la autenticación del servidor mediante certificado. No considerar verificada la identidad SQL con esa opción; pendiente prueba remota.
