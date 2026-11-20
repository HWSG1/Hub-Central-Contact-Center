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

## 2026-11-18 · Primer administrador local en base remota
Se agrega admin:remote para generar un SQL privado de identidad con revisión previa, destino explícito, MFA obligatorio, bloqueo de repetición y auditoría transaccional. No modifica .env ni conecta a SQL. Se actualiza el capítulo 05. Pruebas de generación automatizadas; ejecución real remota pendiente.

## 2026-11-19 · Confianza configurable del certificado SQL
Se incorpora SQL_TRUST_SERVER_CERTIFICATE (false por defecto; true por elección explícita del operador). Mantiene encrypt=true en ambos modos de autenticación. db:check distingue conexión cifrada de validación de certificado. No modifica .env ni SQL; ver configuración y limitación de identidad en el capítulo 03.

## 2026-11-19 · Selección exclusiva del controlador SQL
Se elimina la importación simultánea de Tedious y msnodesqlv8, que sobrescribía el registro global de mssql y provocaba connection.queryRaw is not a function con SQL_AUTH=sql. Pruebas de regresión para ambos controladores sin conexión a SQL.

## 2026-11-19 · Plantilla Entra local
Bloque OIDC preparado con retorno http://localhost:4200/api/auth/callback e instrucciones para Tenant ID, Client ID y valor del secreto. Acceso corporativo permanece apagado hasta completar datos. Documentada transición a HTTPS y pendientes de MFA/asociación de identidad.

## 2026-11-19 · Módulos incluidos y Corta Cuotas
Centro de módulos con importación de descriptor cerrado, publicación y deshabilitación. Migración 005 registra permisos de administración y uso y permisos SQL de runtime; instalador consolidado regenerado sin alterar 001–004. Operaciones con autoridad transaccional, MFA reciente, alcance y auditoría. Calculadora basada en el Excel, campaña explícita de simulación y sin redondeo intermedio. Pruebas automatizadas y compilación; migración/importación real y prueba visual autenticada pendientes en la otra PC.

## 2026-11-19 · Acceso a Corta Cuotas desde el catálogo
Se sustituye el texto provisional de las tarjetas de Mis aplicaciones por un enlace Angular a la calculadora cuando código y ruta coinciden con el módulo incluido. No se aceptan destinos arbitrarios del catálogo. No requiere migración ni reimportación del módulo; actualizar frontend.

## 2026-11-19 · Reconciliación puntual de historial local
Evidencia del usuario: historial 001/002 y objetos/permisos de 003/004 preexistentes. Preparado artefacto privado con comprobaciones de estructura y permisos, bloqueos transaccionales, destino local explícito, revisión por defecto y auditoría antes de completar historial. Hashes contrastados con migraciones originales y sintaxis validada con ScriptDom SQL Server 2022; no ejecutado contra la base. No se alteraron migraciones ni sus hashes.

## 2026-11-19 · GUID SQL en administración
Se corrige el rechazo de identificadores uniqueidentifier no compatibles con la validación RFC de UUID. Alta de usuarios, asignación de roles y parámetros de rutas usan formato GUID completo. Se conservan validación de estructura, límite y unicidad de roles y controles de autoridad. Incluye pruebas de DTO reales y parámetros con GUID SQL y entradas malformadas.

## 20/11/2026 — Asistente inicial ZIP
- Flujo de seis pasos para módulos incluidos, descarga del paquete de ejemplo, análisis del servidor, instalación y publicación independientes.
- Contrato limitado a manifest.json: tamaño acotado, registro estricto, sin extracción ni ejecución de código; análisis auditado y revalidación al instalar. Permisos y MFA se revalidan transaccionalmente.
- Pruebas de paquetes alterados, tamaño, rutas, autoridad, MFA y auditoría. Sin cambios de esquema. Despliegue de código externo y pruebas de integración con sesión/SQL reales siguen pendientes.
