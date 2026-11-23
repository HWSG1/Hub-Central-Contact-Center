# Administracion de bases TLV — Hub + Ofertas 1.3

## Alcance
La actualización de **módulo ZIP 1.3.0** incorpora el PDF con el diseño de amortización autorizado y los iconos de PDF, Excel y CSV. La administración de bases no funciona dentro del iframe: es una pantalla **nativa del Hub**, accesible desde Centro de módulos → Buscador de ofertas TLV → Configuración (engranaje) → **Administrar bases TLV**.

## Requisitos
- Actualizar a una version aprobada del Hub que incorpore la migracion 010, compilar API y frontend y reiniciar ambos.
- **Instalacion integrada (migracion 010):** el DBA aplica una sola vez el SQL consolidado `manual-instalacion/sql/Instalar-Actualizar-Hub.sql`, primero con `@Apply=0` para revisar y luego `@Apply=1` tras autorizacion y respaldo. La migracion `010_tlv_auditoria_installer.sql` registra `core.prepare_tlv_auditoria_v1`. Esta rutina, preaprobada y sin codigo recibido del ZIP, prepara las tablas y procedimientos de auditoria TLV al instalar el modulo. Si OFERTAS_TLV ya estaba instalado, la misma migracion 010 completa la auditoria sin reemplazar ofertas existentes.
- El procedimiento requiere el esquema `mod_ofertas_tlv` bajo el propietario controlado `hub_package_owner`. No ejecutar SQL arbitrario incorporado en ZIP ni suprimir estas comprobaciones.
- No reinstalar modulos existentes para reparar auditoria: aplicar la migracion de forma controlada.
- En el **servidor donde se ejecuta la API**: Python 3 y paquete pyodbc, además de ODBC Driver 18 (o cambiar con autorización en el importador).
- La API soporta SQL_AUTH=windows o SQL_AUTH=sql. El importador Python hereda exclusivamente la configuracion de autenticacion del proceso local, sin credenciales en argumentos ni logs. Para SQL_AUTH=sql, asegurar que SQL_USER y SQL_PASSWORD estan presentes en el archivo .env protegido (no compartirlos).
- Si el servidor SQL de Windows para el importador difiere del SQL_SERVER de Node, definir TLV_IMPORT_SQL_SERVER en .env con el nombre exacto que funciona con pyodbc. Opcional TLV_PYTHON con ruta a python.exe.
- Solo cuentas con CORE.MODULES.MANAGE, MFA obligatorio y sesión iniciada hace menos de 15 minutos pueden ver el panel, previsualizar o cargar. Es un permiso administrativo; no concederlo a los operadores.

## Uso
1. Seleccionar un archivo **.xlsx o .csv** (límite 30 MB; XLSX hoja `Consulta1`). Se admiten subconjuntos de las **42 columnas oficiales** del módulo Ofertas TLV, en cualquier orden; las ausentes se cargan como `NULL`. El archivo `Noviembre 2026.xlsx` (36 columnas) es estructuralmente compatible. Las columnas obligatorias son `TIPO_BASE` y al menos un identificador (`DNI`, `CODIGO_CLIENTE` o `CUENTA`).
2. **Previsualizar**: no modifica SQL, recorre todas las filas, comprueba columnas, tipos, ceros iniciales, fechas Excel y conteos por TIPO_BASE.
3. Verificar totales y rechazados = 0. La comprobación dura 10 minutos y está ligada a la misma sesión y SHA-256 del archivo.
4. Escribir **CAMBIAR_BASE** y activar. El backend vuelve a validar los registros y los carga inicialmente con activo=0; solo cuando termina activa el lote nuevo e inactiva el anterior en transacción.
5. Consultar historial: carga, responsable, fecha, esperado/insertado/rechazado, activos/inactivos. Los eventos también se auditan en core.audit_events.
6. Si hay errores, no ejecutar múltiples cargas a ciegas; consultar la bitácora y usar el procedimiento de restauración con autorización DBA.

## Advertencias
- No ejecutamos cargas reales ni verificamos permisos del servicio Windows desde ChatGPT. Se requiere una prueba end-to-end en el entorno local/preproducción.
- El proceso HTTP de importación puede tardar minutos. Para producción de alto tráfico se recomienda ejecutar los lotes como trabajos con cola y sondeo de estado.
- Los registros históricos permanecen físicamente en SQL Server. Definir política de retención, capacidad, respaldos y restauración.
- CSV: UTF-8 y encabezados del contrato TLV (se permiten columnas opcionales ausentes); .xlsx admite fechas seriadas Excel 1900/1904. Se soportan alias documentados como `COD_CLIENTE_IBS` → `CODIGO_CLIENTE`, `IDENTIDAD` → `DNI`, `CUENTA_TC` → `CUENTA`, `PRODUCTO` → `NOMBRE_TC`, `PAGO_IMPUESTOS` → `PAGO_IMPUESTO`. Si hay dos cabeceras que se normalizan al mismo campo o columnas desconocidas, se rechaza el archivo en lugar de omitir datos.
- Si el Excel incluye campos adicionales del ejemplo de bases no previstos en los **42 campos del contrato** (por ejemplo, teléfonos específicos), se debe revisar y ampliar el contrato/tabla mediante un cambio controlado antes de importarlos; no se ignoran columnas desconocidas.
- El PDF se descarga en tamaño carta con logotipo oficial, información del cliente si se seleccionó una oferta, condiciones, amortización y campos de firma; las fechas no disponibles se dejan vacías. El PDF usa resultados del backend, sin recalcular importes.
- Registrar la clave pública **adicional de pruebas** del paquete ZIP 1.2 mediante scripts/registrar-clave-tlv-12.cjs antes de importarlo. El script conserva todas las claves previas y genera backup de la confianza.

## Despliegue de cambios TLV del Hub (noviembre de 2026)
- **Codigo**: `apps/portal-api/src/admin/admin.service.ts` invoca la rutina SQL preaprobada para OFERTAS_TLV en la transaccion de alta o actualizacion. El contrato de paquetes sigue rechazando SQL arbitrario.
- **SQL**: la 010 crea el procedimiento fijo y resuelve dependencias de modulos TLV ya existentes. No aplicarla con npm db:migrate sobre bases corporativas: usar la revision DBA con servidor y base explicitados.
- **Python**: antes de activar una carga, comprobar `python -m pip show pyodbc` y `python -c "import pyodbc; print(pyodbc.drivers())"`; ODBC Driver 18 para SQL Server debe estar instalado.
- **Pruebas**: `npm.cmd run build`, `npm.cmd run docs:check`, `python -m py_compile apps/portal-api/scripts/tlv-import.py`, `python -m unittest discover -s apps/portal-api/scripts/tests -p 'test_*.py' -v`; probar primero previsualización de Excel con 33/36/42 columnas y una carga autorizada en base de pruebas.
- **Produccion**: nunca activar los registros de `TaskFlow` por el solo hecho de actualizar el codigo; el DBA debe revisar migraciones y permisos, aprobar respaldos y ventana de mantenimiento.
