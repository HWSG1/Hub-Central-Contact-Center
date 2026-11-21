> Ofertas TLV ya dispone de [ZIP independiente](12-paquetes-independientes.md): tabla nueva mod_ofertas_tlv.base_tlv y permiso OFERTAS_TLV.USE. Este capítulo conserva el diccionario de columnas y el historial de la versión integrada.

# Buscador de ofertas: carga consolidada TLV

## Contrato vigente desde 007

La tabla para la carga del Excel es **ofertas.base_tlv**. Conserva las 33 columnas de `CONSOLIDADO_BASES.xlsx` / `Consulta1` con los mismos nombres. Cada fila es independiente: no hay unicidad por cliente, cuenta ni base. Las columnas adicionales `id`, `activo` y `cargado_en` tienen valores automáticos. Nueve columnas opcionales complementan los campos de la hoja `campos` del archivo de ejemplos; no se inventan valores si no se cargan.

- [Plantilla de las 33 columnas](../business-modules/ofertas/plantilla-tlv.csv).
- [Diccionario de tipos SQL y campos adicionales](../business-modules/ofertas/campos-tlv.csv).

Aplicar el consolidado hasta **007** antes de usar esta versión de la API. Para una instalación nueva, esta actualización registra el instalador; la tabla TLV se crea cuando se confirma **Instalar módulo** en el asistente. Cargar o analizar el ZIP no altera SQL. Si OFERTAS ya estaba instalado, 007 crea la tabla TLV vacía durante la actualización, sin desinstalar el módulo ni borrar la tabla anterior. Si la tabla TLV existe inesperadamente sin la migración, el proceso se detiene para revisión; no la reemplaza.

## Cómo alimentar la tabla

Desde SSMS o tu proceso ETL, seleccionar `ofertas.base_tlv` como tabla destino **existente** y mapear las columnas por nombre. No usar la opción de reemplazar/eliminar tabla. Excluir `id`, `activo`, `cargado_en` del mapeo para usar sus valores automáticos. El acceso de carga debe ser distinto al usuario web, que solo consulta. No se importan automáticamente estos archivos adjuntos ni se incluyen datos de clientes en el repositorio.

Conservar DNI, códigos IBS/CRM, cuentas, orden CRM y cotización como texto; no convertir a número ni perder ceros iniciales. Convertir vacíos y texto `[NULL]` a NULL. Importar `MES_BASE` y `FECHA_COMPRA` como fechas reales (yyyy-MM-dd), no como el número serial mostrado por Excel internamente. Montos decimal(19,4), tasas decimal(9,4) expresadas como porcentaje (40 = 40%), plazo y cantidad TC enteros. No deduplicar por identidad, cuenta o base. Cargas repetidas agregan filas nuevas: controlar los lotes en el proceso de carga.

La tabla no presupone vencimiento: `MES_BASE` es el período de la base, no una fecha de expiración. La consulta incluye registros con `activo=1`; para retirar una oferta de la búsqueda, el proceso de carga puede ponerlo en 0.

## Detalle por producto y base

Se aplica la matriz `campos` de EJEMPLO BASES TLV: TC, aumento, upgrade, Extra, Intra, Corta Cuotas, adicionales, activaciones TC/TD, HRE, DBA y empresarial. Se conserva TIPO_BASE original. Los nombres alternativos se documentan y se mapean al consolidado: COD_CLIENTE_IBS → CODIGO_CLIENTE, IDENTIDAD → DNI, PRODUCTO → NOMBRE_TC, LIMITE_ACTUAL → LIMITE y PAGO_IMPUESTOS → PAGO_IMPUESTO. No se devuelve al navegador el resto de columnas fuera del perfil de detalle.

Los campos TC_INGRESADA, TIPO_FINANCIAMIENTO, FECHA_COMPRA, PLAZO, CUENTA_DESTINO, MONTO y COMERCIO se muestran para financiamientos solo si TIPO_BASE contiene AOL. Los cinco campos resaltados de tasa/monto Extra, Intra y CC se muestran solo con valor > 1, como indica la nota de la matriz. Un campo aplicable sin dato muestra un guion; campos de otros perfiles se omiten. Cero se conserva en los demás campos.

INTRA/EXTRA AOL usa TIPO_FINANCIAMIENTO para distinguir el producto. Si no lo indica, presenta los campos de financiamientos y una acción de simulación por monto disponible. No transforma un cliente con varias ofertas en una sola. BASE ACTIVACIÓN (también el acento dañado del archivo) corresponde a activaciones TC; ACTIVACIÓN TD a TD; IMPUESTOS NOV se considera empresarial. Una base desconocida muestra datos generales y no obtiene un simulador por suposición.

La tabla anterior `ofertas.ofertas_cliente` continúa consultándose por compatibilidad; no debe usarse para nuevas cargas TLV. Las filas de ambas tablas conservan identificadores distintos y paginación estable.

## Verificación de esta entrega

109 pruebas aprobadas; compilación API y Angular correcta. Sintaxis de 007 y del consolidado validada con parser SQL Server 2022. Se cubren matriz, AOL, umbral > 1, nulos/ceros, las 33 columnas y aislamiento de detalles. No se aplicaron migraciones ni se cargaron datos reales en SQL en esta entrega; pendiente prueba integral con la instancia disponible.

---

## Instalación y referencia del formato anterior

El siguiente diccionario pertenece a la tabla anterior; para los Excel TLV usar el contrato anterior de este capítulo y `plantilla-tlv.csv`.

### Módulo OFERTAS

Módulo **OFERTAS 1.0.0**, ruta `/modules/ofertas`, permiso **OFERTAS.USE**.
Referencia funcional: `buscador_integral_de_ofertas_y_calculadoras.html` suministrado por el usuario. Sin datos de demostración, usuarios ficticios ni envío ficticio de correo.

## Instalar

1. Actualizar código, instalar dependencias y compilar: `npm.cmd ci` y `npm.cmd run build`.
2. Detener la API y aplicar una sola vez la actualización **007** mediante [el SQL consolidado](sql/Instalar-Actualizar-Hub.sql). Completar el servidor y la base en una copia privada, revisar con `@Apply=0` y aplicar con `@Apply=1`. Se conservan las migraciones existentes. No ejecutar migraciones individuales ni volver a crear administradores.
3. Iniciar la API y el frontend actualizados. Para módulos nuevos la actualización prepara el instalador y difiere la creación hasta la instalación; si ya estaba instalado, la actualización 007 agrega la tabla TLV.
4. Como administrador, entrar en **Centro de módulos → Importar módulo (.ZIP)**. Seleccionar el ZIP entregado `business-modules/ofertas/ofertas-1.0.0.zip`.
5. Seleccionar ese ZIP, indicar el motivo y completar el asistente. Al pulsar **Instalar módulo**, la API ejecuta el procedimiento fijo `core.install_ofertas_v1`, que crea **ofertas.base_tlv** y la tabla de compatibilidad vacías con sus índices.
6. La creación de la tabla, el registro del módulo y su auditoría forman una transacción. Si falla, se revierten juntos. Una tabla ya existente no se modifica, vacía ni adopta silenciosamente.
7. Publicar el módulo. Asignar **OFERTAS.USE** al rol operativo y ese rol a los usuarios. No necesitan permisos `CORE.*`. La migración concede el permiso al rol PLATFORM_ADMIN existente; la instalación no cambia roles.
8. Cargar la información en la tabla y abrir **Inicio y aplicaciones → Buscador de ofertas y calculadoras**.

La cuenta web solo recibe SELECT sobre el esquema de ofertas y EXECUTE sobre ese procedimiento sin parámetros. El procedimiento usa un usuario SQL sin login, propietario únicamente del esquema `ofertas`, con CREATE TABLE. La API no recibe CREATE TABLE/ALTER general y no ejecuta SQL del ZIP. La identidad que aplique las migraciones debe tener autorización para crear ese usuario, esquema y procedimiento.

Deshabilitar el módulo bloquea sus APIs y lo retira del catálogo; conserva los datos. Publicarlo otra vez no crea ni reemplaza la tabla. Este instalador es específico de OFERTAS; no despliega código arbitrario ni instala otros paquetes externos.

## Modelo y carga de datos

**Una fila representa una oferta de una base para un cliente/cuenta.** Un cliente puede tener varias filas en una misma base y en bases diferentes. DNI, IBS y cuenta tienen índices no únicos. `id` es la única clave primaria y SQL lo genera automáticamente.

La carga la realiza el operador con una identidad SQL autorizada, mediante su proceso de importación o ETL. No usar la cuenta del runtime web para cargas. El módulo no incluye carga masiva desde la interfaz.

| Columna | Tipo | Uso |
|---|---|---|
| id | bigint IDENTITY | Automático; omitir al cargar |
| base_origen | nvarchar(120) | Obligatorio. Nombre de campaña o base; puede repetirse |
| producto | varchar(20) | Obligatorio. EXTRA, INTRA, CORTA_CUOTAS, PREAPROBADAS, TC_TITULAR o AUMENTO_LIMITE |
| nombre_cliente | nvarchar(200) | Obligatorio |
| oferta | nvarchar(2000) | Obligatorio. Descripción de la oferta |
| dni | varchar(32) | Texto; conservar ceros iniciales |
| codigo_cliente | varchar(32) | Código IBS como texto |
| cuenta | varchar(32) | Identificador de cuenta como texto; no almacenar CVV ni PIN |
| codigo_oferta, lote | nvarchar(100) | Opcionales; trazabilidad de origen |
| monto_oferta | decimal(18,2) | Opcional, no negativo, en lempiras |
| tasa_anual, tasa_minima, tasa_maxima | decimal(7,4) | Opcionales, entre 0 y 100. Cargar 22 para 22%, no 0.22 |
| agencia | nvarchar(150) | Opcional |
| telefono1, telefono2, telefono3 | nvarchar(30) | Opcionales; texto |
| direccion | nvarchar(500) | Opcional |
| tipo_tarjeta | nvarchar(100) | Opcional |
| limite_usd, limite_lps, limite_actual, nuevo_limite | decimal(18,2) | Opcionales, no negativos; límite actual/nuevo en lempiras |
| vigente_desde, vigente_hasta | date | Opcionales; formato YYYY-MM-DD, límites inclusivos |
| activo | bit | Predeterminado 1. Cargar 0 para ocultar una oferta |
| cargado_en | datetime2 | Automático, UTC |

Debe existir al menos uno entre DNI, IBS y cuenta. Omitir valores opcionales o usar NULL; no usar textos como N/A en columnas numéricas. No cargar símbolos monetarios, porcentajes ni separadores de miles en decimales. Limpiar espacios en identificadores antes de importar.

Plantilla de encabezados: [plantilla-ofertas.csv](../business-modules/ofertas/plantilla-ofertas.csv). No incluye registros ficticios. Configurar las columnas de identificación como **texto** al preparar una hoja de cálculo; no convertirlas a número. Mapear las columnas al importar, ya que `id` y `cargado_en` se generan en SQL.

Una carga repetida crea nuevas filas: no hay deduplicación automática porque se admiten múltiples ofertas. Usar `codigo_oferta` y `lote` para controlar cargas en el proceso ETL. Definir cómo desactivar el lote anterior antes de cargar una actualización. No reemplazar ni truncar la tabla desde el instalador.

## Consulta y permisos

Seleccionar DNI, Código IBS o Cuenta TC e ingresar el identificador completo. La coincidencia es exacta y conserva ceros iniciales; no mezcla tipos de identificación ni busca por nombre. Retorna todas las bases coincidentes en páginas de 50 ofertas, ordenadas por `id`. Se muestran únicamente registros activos y dentro de vigencia, evaluada por fecha UTC de SQL Server.

Cada fila muestra base, producto, cliente/cuenta, monto, tasas y oferta; Detalle agrega datos de contacto y campos específicos. Los datos cargados pueden ser sensibles: `OFERTAS.USE` autoriza a consultar todas las ofertas vigentes del módulo. Las cuentas con `core.user_scopes` se rechazan hasta implementar el filtro de alcance específico; no se ignoran esas restricciones.

Las búsquedas son POST para no incluir DNI/cuenta en la URL. Consultas parametrizadas, columna de búsqueda de lista cerrada, sesión y CSRF del Hub, módulo habilitado y publicado. La auditoría registra usuario, acción, tipo de búsqueda, página y cantidad, pero no copia DNI/cuenta, nombres o contactos. Si falla la auditoría, no se devuelve la consulta.

## Simuladores

La simulación sirve para comparar escenarios; no aprueba crédito ni valida elegibilidad. No se cambia la calculadora Corta Cuotas anterior, basada en Excel: este módulo reproduce el modelo configurable del nuevo mockup.

- **EXTRA:** plazos 6, 9, 12, 18, 24, 36, 48 y 60; interés nominal anual dividido entre 12. SSD de 2% y comisión de 2.5% con interés, mostrados como cargos iniciales separados de las cuotas. Al 0%, solo 6/9/12 meses, con comisión 7/10/12%. El mockup usaba un valor de respaldo para otros plazos al 0%; aquí se rechazan para no inventar un tarifario.
- **INTRA:** plazos 6, 12, 18, 24, 36 y 48; planes tasa/comisión 18/1.5, 22/3.5, 25/1, 25/3.5, 30/3.5, 35/2.5 y 40/2.5. La comisión se agrega a la primera cuota. La API deriva tasa y comisión del plan seleccionado.
- **CORTA CUOTAS:** plazos 3, 6, 9 y 12; tasa anual y comisión configurables; comisión en primera cuota o financiada. La financiada se agrega al capital antes de calcular cuotas.
- Validación: monto positivo, máximo L10,000,000 y dos decimales; tasa 0–100%, comisión configurable 0–50%. Son límites técnicos del simulador, no límites comerciales aprobados.
- Cuota nivelada; intereses y capital redondeados a centavos por período; última cuota ajustada para cerrar saldo. La proyección muestra cuota, capital, interés, comisión y saldo. Total con cargos incluye la suma de cuotas y cargos iniciales sin duplicar la comisión financiada.
- **Simular** copia los datos disponibles de la oferta al formulario. Para INTRA se propone el primer plan con tasa coincidente (o el plan predeterminado si no coincide); el operador debe confirmar plan y comisión. Los valores pueden editarse para escenarios y no alteran la oferta cargada.
- Exportar CSV descarga todas las cuotas, sin nombres ni identificadores de cliente. Imprimir usa la impresión del navegador. No se envía correo ni se muestra una confirmación de envío ficticia.

Las tasas, el SSD, el tratamiento de cargos y la política de redondeo necesitan validación funcional antes del uso operativo.

## Verificación de esta entrega

Pruebas automatizadas de cálculos, pagos/redondeo, múltiples ofertas, paginación, parámetros, permisos, publicación y auditoría; pruebas del servicio instalador con adaptador SQL simulado. Sintaxis de 006 y del consolidado validada con el parser SQL Server 2022. La instancia SQL local no respondió en esta sesión: no se aplicó 006 ni se confirmó la ejecución real del procedimiento. Completar esa prueba en el entorno disponible antes de producción.

El Centro de módulos muestra únicamente los módulos instalados. Los paquetes se entregan como archivos ZIP; el asistente ya no los genera ni ofrece un selector de ejemplos. El ZIP actual contiene el manifiesto validado y activa código incluido en la versión del Hub; requiere la preparación SQL 007. No es un paquete de código independiente.
