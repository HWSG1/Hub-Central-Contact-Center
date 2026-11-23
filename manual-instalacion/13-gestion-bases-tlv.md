# Administración de bases TLV — Hub + Ofertas 1.2

## Alcance
La actualización de **módulo ZIP 1.2.0** incorpora el PDF con el diseño de amortización autorizado y los iconos de PDF, Excel y CSV. La administración de bases no funciona dentro del iframe: es una pantalla **nativa del Hub**, accesible desde Centro de módulos → Buscador de ofertas TLV → Configuración (engranaje) → **Administrar bases TLV**.

## Requisitos
- Actualizar la rama feat/hub-seguridad-ui-referencia-responsive, compilar la API y el frontend y reiniciar ambos.
- SQL Server con las tablas y procedimientos del kit de auditoría TLV ya ejecutado y respaldado: mod_ofertas_tlv.base_tlv.carga_id, mod_ofertas_tlv.cargas, carga_eventos, carga_errores y activar_carga.
- En el **servidor donde se ejecuta la API**: Python 3 y paquete pyodbc, además de ODBC Driver 18 (o cambiar con autorización en el importador).
- La cuenta Windows que ejecuta la API debe poder insertar lotes inactivos y ejecutar el procedimiento SQL de activación. La API no almacena contraseñas de SQL.
- Si el servidor SQL de Windows para el importador difiere del SQL_SERVER de Node, definir TLV_IMPORT_SQL_SERVER en .env con el nombre exacto que funciona con pyodbc. Opcional TLV_PYTHON con ruta a python.exe.
- Solo cuentas con CORE.MODULES.MANAGE, MFA obligatorio y sesión iniciada hace menos de 15 minutos pueden ver el panel, previsualizar o cargar. Es un permiso administrativo; no concederlo a los operadores.

## Uso
1. Seleccionar un archivo **.xlsx o .csv** (33 columnas oficiales, límite 30 MB; XLSX hoja Consulta1).
2. **Previsualizar**: no modifica SQL, recorre todas las filas, comprueba columnas, tipos, ceros iniciales, fechas Excel y conteos por TIPO_BASE.
3. Verificar totales y rechazados = 0. La comprobación dura 10 minutos y está ligada a la misma sesión y SHA-256 del archivo.
4. Escribir **CAMBIAR_BASE** y activar. El backend vuelve a validar los registros y los carga inicialmente con activo=0; solo cuando termina activa el lote nuevo e inactiva el anterior en transacción.
5. Consultar historial: carga, responsable, fecha, esperado/insertado/rechazado, activos/inactivos. Los eventos también se auditan en core.audit_events.
6. Si hay errores, no ejecutar múltiples cargas a ciegas; consultar la bitácora y usar el procedimiento de restauración con autorización DBA.

## Advertencias
- No ejecutamos cargas reales ni verificamos permisos del servicio Windows desde ChatGPT. Se requiere una prueba end-to-end en el entorno local/preproducción.
- El proceso HTTP de importación puede tardar minutos. Para producción de alto tráfico se recomienda ejecutar los lotes como trabajos con cola y sondeo de estado.
- Los registros históricos permanecen físicamente en SQL Server. Definir política de retención, capacidad, respaldos y restauración.
- CSV: UTF-8 y cabeceras exactamente iguales al Excel; .xlsx admite fechas seriadas Excel 1900/1904.
- El PDF se descarga en tamaño carta con logotipo oficial, información del cliente si se seleccionó una oferta, condiciones, amortización y campos de firma; las fechas no disponibles se dejan vacías. El PDF usa resultados del backend, sin recalcular importes.
- Registrar la clave pública **adicional de pruebas** del paquete ZIP 1.2 mediante scripts/registrar-clave-tlv-12.cjs antes de importarlo. El script conserva todas las claves previas y genera backup de la confianza.
