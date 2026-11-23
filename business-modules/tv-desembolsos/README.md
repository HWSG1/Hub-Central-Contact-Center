# TV_DESEMBOLSOS — contrato funcional corregido (23/11/2026)

**Estado: diseño documentado, no implementado ni instalable.** No ejecutar SQL productivo sin autorización.

## Fuente de verdad
- Captura actual de Power Apps: el registro operativo de desembolso se hace **directamente**, SIN crear previamente una llamada o una venta.
- Archivo privado de análisis: `Base Sharepoint.xlsx`. Este archivo **NO se agrega al repositorio** ni al ZIP, por contener datos personales y operativos.
- Aplicación original Power Apps y paquete de ejemplo OFERTAS_TLV_1.3.3.

## Datos verificados del Excel
- `TV_Certificados`: **16,538 filas** (16,535 con certificado; 16,526 certificados distintos). 9 certificados se repiten dos veces. Todas las filas tienen `ESTADO=En proceso`. Tipos: EXTRA (6,933), CORTA CUOTAS (5,521), INTRA (4,005); tipo vacío 79. Desembolsos CUENTA (14,292) y VENTANILLA (2,100); faltantes 146. Fecha de venta presente en 16,538. Periodo noviembre 2026: 1,633.
- `TV_Ventas`: 430 registros de la mecánica anterior (391 Cerrada, 39 En trámite). `ID_TV_VENTAS` completo, pero no hay valores de `ID_TV_VENTAS` en certificados para construir una relación confiable.
- `Usuarios`: 22 filas (13 ADMINISTRADOR, 6 SUPERVISOR, 3 JEFE). Es catálogo anterior de Power Apps y no debe constituir autoridad en Hub.
- `CERTIFICADO`: los 16,535 no vacíos tienen 9 dígitos en este extracto. `GESTION`: los 14,314 no vacíos tienen 10 dígitos.

## Formulario actual (exclusivamente los cuatro campos visibles)
1. CERTIFICADO: requerido; expresión `^[0-9]{9}$`. Almacenamiento **texto**, nunca numérico para evitar perder ceros iniciales.
2. TIPO_VENTA: selector `EXTRA`, `INTRA`, `CORTA CUOTAS`.
3. TIPO_DESEMBOLSO: selector `CUENTA`, `VENTANILLA`.
4. FECHA_DESEMBOLSO: selector fecha, requerido; corresponde a `FECHA_VENTA` de la fuente histórica.

El backend genera `CREADO_POR_USER_ID` desde la sesión autenticada, y `FECHA_CREACION` del servidor. No aceptar campos de identidad desde el iframe. `GESTION`, `CUENTA_TC`, `ID_TV_VENTAS` y `OBSERVACION` solo se preservan para legado; no pedirlos en formulario.

## Historial por operador
- Por defecto el mes calendario actual en zona `America/Tegucigalpa`, por `FECHA_DESEMBOLSO`; selector de mes anterior, con límites `>= inicio` y `< inicio del mes siguiente`.
- Paginación y resumen por mes (cantidad de registros y por tipo de venta).
- El usuario solo consulta sus propios registros mediante `core.users.id`; consulta global requiere permiso separado y un diseño de autorización específico.
- Históricos originados de SharePoint vienen con correo `CREADO_POR`; preservar el texto original y mapearlo a IDs del Hub mediante una tabla de equivalencia revisada por administrador. Evitar exponer registros históricos no mapeados a otros operadores.

## Modelo SQL orientativo
Esquema `mod_tv_desembolsos`:
- `certificados`: `certificado varchar(40) NOT NULL`, `tipo_venta nvarchar(300) NULL` (NULL por valores históricos), `tipo_desembolso nvarchar(300) NULL`, `fecha_desembolso date NOT NULL`, `creado_por_user_id nvarchar(300) NULL`, `creado_por_origen nvarchar(300) NULL`, `fecha_creacion_origen` requiere soporte `datetime2` o almacenamiento normalizado alternativo, `gestion varchar(40) NULL`, `id_tv_ventas varchar(40) NULL`, `cuenta_tc varchar(40) NULL`, `observacion nvarchar(2000) NULL`, `origen varchar(40) NOT NULL`.
- `ventas_legacy` (solo archivo histórico de los 430 registros), con columnas de origen necesarias, sin vinculación obligatoria a certificados, para conservar datos sin forzar un proceso antiguo.
- `core` sigue gestionando usuarios/roles/permiso `TV_DESEMBOLSOS.USE`.

**Nota:** el esquema declarativo v2 actual no permite `datetime2`, claves únicas, filtrado por fechas/usuario o escritura de registros. El modelo anterior es propuesta, no un contrato ya admitido.

## Requisito de plataforma antes de un ZIP funcional
El broker v2 (consulta exacta de igualdad, lectura exclusiva) necesita una nueva versión auditada con:
- Escrituras declarativas y parametrizadas `INSERT` únicamente sobre las columnas permitidas del módulo, identidad de actor fijada en servidor.
- Filtros obligatorios por actor y fechas (sin SQL del paquete), paginación, contadores.
- Permisos mínimos para la cuenta runtime; el usuario del paquete no obtiene SQL arbitrario, acceso a otros esquemas ni credenciales.
- Resguardo de idempotencia, política de duplicados: los 9 duplicados del histórico deben preservarse, pero para nuevos registros evitar dobles envíos.
- Migración nueva en Hub; no editar la migración 008 ya aplicada. Actualizar checksum, SQL consolidado mediante `npm run docs:build`, manual e historial; ejecutar `npm test`, `npm run build`, `npm run docs:check`.
- Firmar con editor Ed25519 autorizado en ambiente correspondiente, nunca con firma ficticia.

## Migración de los datos
1. Crear tablas bajo esquema nuevo en QA mediante instalador mejorado.
2. Importar 16,538 certificados y 430 ventas históricas desde export XLSX **fuera del ZIP** mediante proceso controlado, preservando filas y sus metadatos originales (incluye vacíos y duplicados).
3. Validar conteos, fechas, duplicados y correspondencia correo ↔ usuario; resolver identificaciones antes de habilitar el historial individual.
4. No modificar SharePoint ni otros módulos. Conmutar captura a Hub tras prueba UAT.
