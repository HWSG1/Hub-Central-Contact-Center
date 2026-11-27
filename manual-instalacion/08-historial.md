# 08 · Historial del manual y del esquema


## 2026-11-26 · Puertos independientes en desarrollo
- `.env.example` define FRONTEND_PORT=4200 y BACKEND_PORT=3000; se conserva APP_ORIGIN=http://localhost:4200. Cada PC modifica su propio `.env` privado sin publicarlo.
- `start:api` usa BACKEND_PORT con compatibilidad para la variable antigua PORT; `start:web` lee solo los puertos del .env sin transmitir secretos del backend a Angular, evita que la variable genérica PORT de Angular 22 sobrescriba el puerto solicitado y genera `.local/dev-proxy.json` apuntando a BACKEND_PORT.
- Los puertos se validan entre 1024 y 65535 y no pueden ser iguales. Se agregan pruebas automatizadas para valores predeterminados, compatibilidad, prioridad y aislamiento de PORT.
- No se alteran claves, identidades, migraciones SQL ni parámetros de producción IIS. Si cambian los puertos fuera del desarrollo local, se deben actualizar también APP_ORIGIN, el redirect OIDC/Entra y el proxy IIS correspondiente.
- Validación final: consultar la ejecución de GitHub Actions del PR asociado antes de adoptar el cambio.

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

## 20/11/2026 — Presentación del centro de módulos
Rediseño basado en el mockup: tabla con estados, acciones compactas, detalle desplegable, motivo de cambio contextual y asistente con zona de arrastre ZIP y pasos adaptables. Sin cambios de API, permisos ni SQL.

Ajuste de acciones al mockup: fila compacta de Detalle, configuración, apertura y permisos; disponibilidad en segunda fila alineada a la derecha. Configuración de solo lectura y controles táctiles de 44 px.

Se retiraron las tarjetas informativas superiores y el bloque de ayuda inferior del centro de módulos para priorizar la tabla y sus acciones.

Asistente compacto: encabezado y pasos reducidos, carga y motivo en dos columnas en escritorio y una en móvil, acción de análisis en el pie. Se documentaron los requisitos de desarrollo de módulos y los límites actuales del importador.

Por solicitud del usuario, se retiró el límite de antigüedad de inicio de sesión de 15 minutos exclusivamente en análisis, instalación, publicación y deshabilitación de módulos. Se conservan sesión vigente, MFA de la cuenta, permisos, alcance y auditoría. Sin cambios de SQL. Reiniciar API tras recompilar.

## 20/11/2026 — Buscador de ofertas y calculadoras
OFERTAS 1.0.0: búsqueda SQL por DNI, IBS o cuenta con varias ofertas por cliente/base; detalle y simuladores Extra, Intra y Corta Cuotas, CSV e impresión. Centro y asistente admiten múltiples módulos. Migración 006 registra un instalador fijo de identidad separada; la tabla ofertas.ofertas_cliente se crea al instalar, no al aplicar 006. Procedimiento sin SQL del ZIP, instalación/auditoría transaccional. Pruebas de servicio y cálculos; parser SQL 2022 correcto. Conexión local no disponible, ejecución SQL real pendiente. No se aplicaron migraciones ni se cargaron datos.

## 2026-11-21 — Contrato de bases TLV
Migración aditiva 007: tabla base_tlv creada por instalación fija del módulo, 33 columnas del consolidado y nueve opcionales. Actualización de instalaciones existentes sin borrar ofertas. Detalle por matriz, condiciones AOL y >1; consultas conservan múltiples ofertas. Plantilla sin datos y diccionario en business-modules/ofertas. Sin carga ni migración ejecutada contra SQL real.

## 2026-11-21 — Entrega ZIP de OFERTAS
Archivo ZIP entregable validado contra el importador real. Centro de módulos limitado a instalados; asistente de carga sin selector ni generación de ejemplos. Se documenta explícitamente la dependencia del código integrado y preparación SQL 007.

## 2026-11-21 — Paquetes completos hub-package-v2
Interfaz y backend provenientes del ZIP firmado, host genérico, ejecutor separado y broker de consultas. Migración 008 prepara una vez el instalador de tablas declarativas. Ofertas TLV independiente conserva columnas y reglas de detalle, usa mod_ofertas_tlv.base_tlv y no altera el módulo anterior. Empaquetador reutilizable y guía 12. SQL real pendiente por conexión local no disponible.

## 2026-11-21 · Corrección de limpieza del ejecutor en Windows
- El error EBUSY reportado al instalar correspondía a borrar la carpeta temporal antes del cierre del proceso Node del módulo.
- Se espera el cierre del proceso y sus canales antes de resolver la ejecución; eliminación con reintentos acotados para bloqueos transitorios.
- No cambia el ZIP, sus firmas, las migraciones ni los permisos de instalación. Requiere recompilar y reiniciar la API.
- Regresión: ejecuciones reales consecutivas verifican respuesta y eliminación de cada carpeta temporal.


## 2026-11-23 · TV_DESEMBOLSOS independiente
Se elimina totalmente TV_Ventas del alcance del nuevo módulo. Se añade el registro directo de certificado, tipo de venta, tipo de desembolso y fecha; consulta mensual obligatoriamente acotada al operador. Migración aditiva 011 prepara concesión de INSERT sobre tabla declarada, sin SQL libre, actor de sesión y protección contra registro repetido. Se añade importador del histórico de TV_Certificados con modo previsualización sin SQL por defecto; los datos originales se mantienen fuera del ZIP y de GitHub. **Pruebas reales SQL, firma de editor autorizado y despliegue aún pendientes**. No se ejecutó ninguna operación productiva.
