# 12 · Paquetes independientes

## Contenido y alcance

El ZIP **hub-package-v2** contiene código real: `frontend/index.html` autocontenido, `backend/main.mjs` compilado con sus dependencias, `backend/queries.json`, `migrations/001.json`, `manifest.json` y `signature.txt`. No depende del registro de módulos incluidos ni necesita recompilar Angular/Hub por cada módulo nuevo.

Las migraciones son instrucciones declarativas de tablas, columnas e índices que el instalador traduce a SQL Server. No son SQL arbitrario. Esta primera versión permite consultas de lectura y lógica de cálculo. No admite escrituras de negocio, joins, cambios destructivos de esquema, desinstalación, dependencias npm instaladas en el servidor ni assets externos. Las actualizaciones firmadas de versión pueden reemplazar frontend y backend sin migrar tablas ni modificar contratos de consultas/operaciones; los cambios de SQL siguen requiriendo una migración controlada del Hub. Esas capacidades requieren ampliar el contrato; no deben simularse en el paquete.

## Preparación inicial (una vez por entorno)

1. Actualizar y compilar el Hub con Node 24: `npm.cmd ci` y `npm.cmd run build`.
2. Aplicar hasta **008** mediante [el SQL consolidado](sql/Instalar-Actualizar-Hub.sql), con servidor/base explícitos y revisión inicial `@Apply=0`. Prepara el instalador genérico, no las tablas de este paquete.
3. Disponer de Node **26 o superior** para ejecutar los servicios de módulos. Puede coexistir con Node 24 usado por Angular/Hub. Configurar su ruta absoluta en `MODULE_NODE`.
4. Autorizar el editor mediante su clave pública recibida por un canal confiable. Para el ZIP entregado, copiar el contenido de [development-publisher-public.json](../business-modules/packages/development-publisher-public.json) a `.local/module-publishers.json`. Si el archivo ya tiene editores, incorporar la entrada conservando los demás. No generar otra clave en la PC receptora para verificar un ZIP ya firmado. El ZIP no puede autorizar su propio editor.
5. Reiniciar la API. La cuenta del servicio necesita leer el archivo de confianza y crear/borrar sus propias carpetas temporales. La cuenta web SQL sigue en `hub_runtime`, sin DDL general.

```dotenv
MODULE_NODE="C:/Program Files/nodejs/node.exe"
MODULE_TRUST_FILE=.local/module-publishers.json
```

Esta preparación es del instalador, no un SQL por módulo. Los nuevos módulos compatibles y firmados se instalan desde el frontend.

## Instalar Ofertas TLV

Archivo: [ofertas-tlv-1.0.0.zip](../business-modules/packages/ofertas-tlv-1.0.0.zip).

1. Cuenta administrativa MFA con `CORE.MODULES.MANAGE` → Centro de módulos → Importar módulo (.ZIP).
2. Seleccionar el ZIP, indicar motivo y analizar. Se valida firma Ed25519, editor, hashes, límites, contrato y salud del backend.
3. Revisar esquema **mod_ofertas_tlv**, tabla **base_tlv** y permiso **OFERTAS_TLV.USE**.
4. Confirmar instalación. Se crean tablas/índices, permiso, catálogo, versión, paquete y auditoría en una transacción. Si falla, se revierten los cambios. El módulo queda sin publicar.
5. Publicarlo. Se abre en `/extensions/OFERTAS_TLV`; la interfaz y el backend se leen del ZIP almacenado en SQL.
6. Cargar tus datos en **mod_ofertas_tlv.base_tlv**, con las columnas del [contrato TLV](11-buscador-ofertas.md). El ZIP no incluye registros de clientes.
7. Asignar `OFERTAS_TLV.USE` al rol operativo. La instalación concede el permiso al rol PLATFORM_ADMIN, pero no asigna roles a usuarios ni permisos CORE a operadores.

OFERTAS_TLV es distinto del antiguo OFERTAS integrado: no borra, copia ni sustituye sus tablas ni su permiso OFERTAS.USE. Si ya cargaste información en `ofertas.base_tlv`, debes cargarla explícitamente en el nuevo destino después de validar la instalación. El módulo anterior no se deshabilita automáticamente.

## Crear módulos futuros

La fuente de referencia está en [ofertas-package](../business-modules/ofertas-package/manifest.json). Cada módulo tiene código único, permiso `<CODIGO>.USE` y esquema `mod_<codigo>`. El backend exporta `handle(operation,input,api)` y responde `{ok:true}` a `health` sin SQL. `api.query(nombre,parametros)` solo puede ejecutar las consultas declaradas del módulo; no recibe credenciales ni SQL libre.

El frontend envía al padre `{type:'hub:request',id,operation,input}` y recibe `{type:'hub:response',id,result}` o `error`. Debe validar que el mensaje provenga de `parent`. El contenedor autentica las peticiones y añade CSRF; nunca entrega esos secretos al iframe. Empaquetar estilos/scripts en un HTML y dependencias backend en un ESM, sin CDN ni red directa.

El contrato admite hasta 10 tablas, 100 columnas por tabla, 5 índices por tabla, 20 operaciones, 2 MB comprimidos y 4 MB descomprimidos. Agrega automáticamente `id` identity, `activo` y `cargado_en`: no declararlos como columnas propias. Las consultas son SELECT con filtros de igualdad parametrizados, orden por id y páginas de 50 más una fila de continuidad.

Para crear un editor de desarrollo en la PC autora (no repetir en el servidor para reemplazar una clave):

```powershell
npm.cmd run modules:publisher
```

La clave privada queda en `.local/module-keys/development-private.pem`, ignorada por Git. No copiarla al servidor. En producción, usar un editor y clave controlados por el equipo responsable. Distribuir solo la clave pública a los servidores autorizados.

Empaquetar Ofertas:

```powershell
npm.cmd run modules:package:offers
```

Empaquetar otro módulo:

```powershell
npm.cmd run modules:pack -- business-modules/mi-modulo .local/module-keys/development-private.pem business-modules/packages/mi-modulo-1.0.0.zip
```

El comando compila, firma y valida el ZIP; no cambia el registro ni recompila el núcleo del Hub.

## Ejecución y recuperación

El backend corre en un proceso nuevo por operación, sin heredar `.env`, claves ni credenciales. Tiene lectura solo de su carpeta temporal; red, procesos, addons y escritura denegados; memoria limitada, 4 operaciones concurrentes, 8 consultas por operación, salida acotada y 10 segundos de ejecución. El [modelo de permisos de Node](https://nodejs.org/api/permissions.html) es defensa adicional, no aislamiento de sistema operativo contra código hostil. Instalar solo código revisado de editores confiables.

El frontend usa iframe sandbox sin same-origin, CSP y puente de mensajes ligado a su ventana. Se permiten los eventos de formularios, pero CSP prohíbe envíos directos; la comunicación con el servidor pasa por el Hub. La revisión del editor sigue siendo necesaria.

Cada operación revalida usuario, sesión, permiso, publicación y alcance. Alcances no implementados se deniegan. Se vuelve a verificar la firma al ejecutar; retirar un editor impide ejecutar sus paquetes. No se copian datos de clientes a la auditoría.

Los fallos de instalación se registran como FAILURE sin contenido sensible. Si SQL está inaccesible, tampoco puede persistirse la auditoría. Una instalación fallida puede reintentarse si no hubo commit; un esquema o código existente se rechaza sin borrar datos. No eliminarlos manualmente para forzar un reintento.

## Validación

117 pruebas aprobadas y compilación web/API correcta. Se probaron firmas/alteraciones, contratos, transacción de instalación/rollback, consultas, permisos del proceso y ejecución real del backend extraído del ZIP con datos sintéticos. La prueba de navegador verificó búsqueda, detalle y cálculo (primera cuota de 248 en el caso de prueba), sin errores JavaScript ni desbordamiento horizontal a 390 px. Se verificó sintaxis de 008 y del consolidado con parser SQL Server 2022. La conexión SQL local no respondió (258): no se aplicó 008 ni se confirmó todavía el flujo completo con SQL y sesión real.

## Error EBUSY al importar en Windows

Si la terminal muestra `EBUSY ... rmdir ... hub-module-*`, el proceso del módulo todavía retenía su carpeta temporal durante la limpieza. No depende de la ubicación del ZIP. El ejecutor espera ahora el evento de cierre del proceso y sus canales antes de eliminar la carpeta, con reintentos acotados por bloqueos transitorios de Windows.

Después de actualizar el código, detener la API, ejecutar `npm.cmd run build:api` y volver a iniciar con `npm.cmd run start:api`. Reintentar el mismo ZIP desde el asistente. No eliminar tablas ni cambiar permisos SQL para corregir este error. La comprobación de salud ocurre antes de crear las tablas del paquete y cualquier fallo en la transacción revierte la instalación.

## Actualizaciones de código firmado (Ofertas TLV 1.3.3)

La corrección de la matriz de TC TITULAR toma el valor visual de **MONTO** de la columna SQL **LIMITE**. Se conserva el encabezado del detalle y se evita sustituir el dato por el valor de la columna MONTO, destinada a otras bases.

Para actualizar desde 1.3.2 se necesita una versión del Hub que permita actualizaciones firmadas de backend, conservando exactamente el contrato SQL de `backend/queries.json` y `migrations/001.json`. El instalador vuelve a validar la firma Ed25519, editor autorizado, versiones y salud del backend en sandbox, sin ejecutar DDL ni reemplazar registros de ofertas. El nuevo paquete requiere una firma emitida por el editor autorizado; nunca se instala un ZIP modificado manualmente sin re-firmar.

En producción, mantener el control de cambios y realizar primero una prueba en QA con datos sintéticos. Para paquetes de desarrollo, registrar la clave pública del editor de manera controlada y conservar las claves anteriores.


## Extensión controlada para el módulo TV_DESEMBOLSOS (migración 011)

La nueva versión del Hub admite, además de las consultas SELECT originales, la declaración estricta `kind: "insert"` con tabla, columnas, campo actor del servidor y unicidad lógica por certificado. Este contrato es **append-only**; no admite UPDATE, DELETE ni SQL arbitrario enviado desde un ZIP.

El instalador valida que los campos de escritura pertenezcan a las tablas declaradas; en instalaciones nuevas concede `INSERT` únicamente sobre el objeto correspondiente mediante `core.grant_package_append` (migración 011). La inserción se parametriza desde el servidor, incorpora `req.user.id` y evita duplicados activos con `UPDLOCK,HOLDLOCK`. Los demás módulos, incluidos Ofertas TLV, mantienen consultas de lectura sin ampliar sus concesiones SQL. Las actualizaciones que cambien contratos SQL de un módulo ya instalado siguen sin permitirse automáticamente.

Las consultas con `scope: "actor_month"` añaden obligatoriamente filtros de identidad desde sesión y período mensual con límite exclusivo del mes siguiente. El cliente no puede seleccionar otro actor. Los permisos `TV_DESEMBOLSOS.USE`, sesión vigente, controles MFA del Hub, CSRF y revalidación de publicación siguen siendo obligatorios.

### Instalación operativa

1. Obtener una versión aprobada del Hub que incorpore la migración 011 y los cambios al broker/worker; instalar dependencias y compilar mediante `npm ci`, `npm test`, `npm run build`, `npm run docs:check`.
2. Un DBA revisa y aplica `manual-instalacion/sql/Instalar-Actualizar-Hub.sql` con servidor/base verificados, `@Apply=0` para revisar primero y posteriormente `@Apply=1` en el entorno autorizado. No editar las migraciones 001–010.
3. Empaquetar y **firmar** con la clave privada Ed25519 del editor autorizado: `npm run modules:pack -- business-modules/tv-desembolsos RUTA_PRIVADA_EDITOR business-modules/packages/tv-desembolsos-1.0.0.zip`. No usar una firma simulada.
4. Validar clave pública de confianza en `MODULE_TRUST_FILE` y Node 26 en `MODULE_NODE`. En QA autorizar solo claves del entorno QA.
5. En la interfaz: **Centro de módulos → Importar módulo → Analizar → Instalar → Publicar**. Revisar tabla `mod_tv_desembolsos.certificados`, permiso `TV_DESEMBOLSOS.USE`, y asignarlo mediante la administración de roles.
6. Validar captura de los cuatro campos y consulta por mes, el aislamiento entre operadores, el rechazo de duplicados y la auditoría; documentar resultados antes de producción.

La importación histórica de los **16,538 registros de TV_Certificados** es opcional y externa al ZIP. No utilizar TV_Ventas. Véase `business-modules/tv-desembolsos/README.md` para los detalles del CSV, sus valores incompletos y mapeo administrativo de usuarios históricos.

**Importante:** no se ha ejecutado esta migración contra SQL Server real en esta entrega. La instalación completa requiere pruebas y revisión por DBA/Seguridad de la Información.
