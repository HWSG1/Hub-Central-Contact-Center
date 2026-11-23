# Televentas / Desembolsos — análisis previo y contrato propuesto

**Estado:** diseño técnico para revisión; no habilita capturas ni cambia SQL de producción.

## Fuentes examinadas
- Aplicación Power Apps `Desembolos Televentas(1).msapp`, pantallas `Desembolsos` y `DesembolsosV2`.
- ZIP `OFERTAS_TLV_1.3.3.zip` y contratos `hub-package-v2`.
- Tres conexiones SharePoint `.iqy` (enlaces de consulta, sin registros históricos).

## Hallazgos de las tres listas
1. **TV_Ventas se usa:** llamadas, vendedor, cuenta, IBS, monto, estado, cierre y observación.
2. **TV_Certificados se usa:** certificado, venta/desembolso, gestión, estado y fecha venta; admite relación opcional por `ID_TV_VENTAS`.
3. **Usuarios se usa solo para determinar supervisor** en `App.OnStart`. Sustituir su autoridad por roles y permisos del Hub; no conservar autorización de SharePoint.

## Módulo
- Código: `TV_DESEMBOLSOS`
- Permiso básico: `TV_DESEMBOLSOS.USE`
- Esquema: `mod_tv_desembolsos`
- Tablas nuevas declarativas: `ventas` y `certificados`
- UI: **Registrar**, **Mis ventas** (mes actual por defecto, filtro por período), **Supervisión** únicamente con permiso explícito.
- Identidad del operador: desde sesión del Hub, jamás del payload del navegador.
- `FECHA_VENTA` para historial de certificados; `FECHA_REGISTRO` para actividad de llamadas.
- Mantener `GESTION` de 10 dígitos para `TIPO_DESEMBOLSO=CUENTA` y detectar certificado duplicado.

## Bloqueos técnicos que requieren ampliación segura del Hub
El instalador v2, el broker y el worker actuales **solo admiten SELECT de igualdad**. No existe INSERT/UPDATE de negocio desde ZIP; `hub_runtime` solo recibe SELECT en el esquema creado. El backend tampoco tiene consulta por rango de fechas vinculada al usuario de sesión. Un ZIP firmado, por sí solo, no resuelve estos requisitos.

Próxima implementación debe introducir, con migración nueva **sin tocar 008 aplicada**:
- Escrituras declarativas de columnas permitidas (no SQL arbitrario), transacciones, unicidad e idempotencia, permisos SQL mínimos.
- Filtro de actor obligatorio desde sesión, filtro de rango `FECHA_VENTA`, agregación y paginación.
- Auditoría sin PII, pruebas de aislamiento operador/supervisor, CSRF, RBAC y fallo de SQL.
- Actualizar manual de instalación, checksums y pruebas/build.

**No desplegar** hasta aprobar y probar la extensión de escritura. Los `.iqy` no contienen filas; para la carga histórica es indispensable recibir exportaciones `.xlsx`/`.csv` de las listas.

## No objetivos
- No reutilizar permisos de SharePoint como autorización.
- No modificar Ofertas TLV ni otros módulos.
- No ejecutar DDL destructivo ni migrar datos reales automáticamente.
- No simular una firma ni emitir un ZIP que afirme registrar ventas cuando el host no puede escribir.
