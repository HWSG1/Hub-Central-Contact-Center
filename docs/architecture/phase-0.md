# Fase 0 — arquitectura y alcance
## Referencias
Analizados login_interactivo_premium.html y contact_center_hub_plataforma_modular_bancaria.html, el documento de requisitos y la conversación suministrada. Son especificaciones y referencias visuales; sus scripts no se ejecutan ni se reutilizan como seguridad.
Login: fondo #0d0e12, tarjeta translúcida, rojo #DA282D, partículas. Portal: Inter local, fondo #F7F8FA, tarjetas blancas, navegación lateral, búsqueda y modo oscuro. Se eliminan CDN, cuentas simuladas, acceso por temporizador y proveedores sociales.
## Componentes
Navegador → IIS TLS → Angular y /api → NestJS BFF (127.0.0.1) → SQL Server 2022.
Núcleo: identidad, sesiones, RBAC, catálogo y auditoría. Módulos de negocio separados por contratos y esquemas; no acceso directo entre módulos.
Sesiones opacas: sólo hash en SQL, cookie HttpOnly, 15 minutos de inactividad y 8 horas absolutas. CSRF por token vinculado a sesión y Origin exacto. Permisos reevaluados en cada petición.
OIDC Authorization Code + PKCE; asociación explícita issuer+subject. Cuenta local Argon2id sin registro público. Las cuentas que requieren MFA no acceden por contraseña sola.
## ADR 001 — módulos
Integración frontend en compilación con registro de rutas confiables y lazy loading. No ejecutar ZIP ni rutas de código suministradas por usuarios. Microfrontends no aportan aislamiento; se evaluarán orígenes separados cuando sea necesario.
## ADR 002 — persistencia
SQL Server 2022, SQL parametrizado mediante repositorio; migraciones transaccionales fuera del servicio web. Autenticación Windows preferida en Windows. TLS obligatorio y validación de certificado por defecto en runtime. SQL_TRUST_SERVER_CERTIFICATE=true permite omitir explícitamente la validación por decisión del operador, manteniendo el cifrado; véase el manual 03.
## Infraestructura pendiente
Certificado SQL confiable y nombre DNS coincidente; identidad de servicio; issuer/client OIDC, secreto y redirect URI; política MFA/acr; repositorio firmado y pipeline; SIEM, backup y retención. No se presuponen datos corporativos.
## Fases y aceptación
0: arquitectura, amenazas, modelo y contratos. 1: compilación web/API, persistencia, login real, sesiones, catálogo filtrado, auditoría. 2: administración, MFA local y recuperación. 3: importación segura y registro completo. 4: firmas/pipeline. 5: UAT y revisión ASVS. 6: negocio fuera de alcance.
Aceptación: rechazo sin sesión, usuario deshabilitado/expirado, CSRF incorrecto, permiso ausente y módulo no publicado; logout revoca; sesión expira; errores de SQL nunca conceden acceso; no secretos en frontend; compilación estricta.

## Administración de seguridad
Implementada en el módulo Administration: roles, matriz y usuarios. Migración 003 requerida antes de arrancar la API actualizada. Detalle y límites en docs/security/administration.md. No incluye delegación por alcance ; el alta local desde la web se documenta en docs/security/user-enrollment.md.

Alta local por invitación: requiere migración 004; ver docs/security/user-enrollment.md.

Módulos incluidos: importación de descriptor hub-builtin-v1 y control de publicación implementados para CORTA_CUOTAS, migración 005. El frontend usa ruta lazy estática; la lógica de negocio se ejecuta en servidor con permiso y módulo publicado. Paquetes externos y pipeline siguen fuera de esta entrega.
