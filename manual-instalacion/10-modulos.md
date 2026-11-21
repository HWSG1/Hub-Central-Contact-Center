> Para paquetes completos nuevos, usar [el instalador v2](12-paquetes-independientes.md). Las limitaciones de manifiesto únicamente que siguen corresponden al formato antiguo v1.

# 10 · Módulos incluidos y calculadora Corta Cuotas

## Alcance de esta entrega
El Centro de módulos permite importar un descriptor JSON de un módulo revisado e incluido en la compilación del Hub, instalar su registro deshabilitado, publicarlo y deshabilitarlo. No ejecuta código ni SQL suministrados en ZIP. Admite CORTA_CUOTAS 1.0.0 y OFERTAS 1.0.0; OFERTAS crea su tabla mediante un procedimiento fijo registrado por la migración 006. Ver [Buscador de ofertas](11-buscador-ofertas.md). Se compara íntegramente con el registro del backend; campos adicionales, rutas, permisos, versiones y huellas distintos se rechazan. La huella identifica el descriptor, no es una firma digital ni verifica un paquete externo. El formato acotado hub-builtin-v1 es independiente del contrato futuro de paquetes externos de packages/module-sdk.

## Actualizar una instalación existente
1. Actualizar el código y ejecutar `npm.cmd run build`.
2. Abrir en SSMS el único instalador operativo [Instalar-Actualizar-Hub.sql](sql/Instalar-Actualizar-Hub.sql). En una copia privada completar servidor y base aprobados; ejecutar primero con Apply=0 y luego con Apply=1. Se conserva el historial existente y se aplican solo migraciones pendientes hasta 006. No ejecutar otra vez admin:local ni admin:remote.
3. Reiniciar API y frontend (o desplegar dist/web en IIS), y volver a iniciar sesión con el administrador. La migración concede CORE.MODULES.MANAGE y CORTA_CUOTAS.USE al rol PLATFORM_ADMIN existente. No crea cuentas, no cambia MFA, no instala ni publica automáticamente la calculadora.

## Importar y publicar desde el portal
1. Entrar a **Centro de módulos**. Requiere CORE.MODULES.READ.
2. Abrir Importar módulo (.ZIP), seleccionar el paquete incluido y descargarlo. El [descriptor Corta Cuotas](../business-modules/corta-cuotas/corta-cuotas-1.0.0.hub.json) se conserva como referencia.
3. Seleccionar el ZIP, escribir un motivo de al menos 5 caracteres y completar el análisis y la instalación del asistente. Estado inicial: instalado, pendiente de publicación.
4. Escribir el motivo y pulsar **Publicar módulo**. Aparecerá en Inicio y aplicaciones para usuarios con permiso de uso.
5. Para retirarlo, escribir un motivo y pulsar **Deshabilitar módulo**. Desaparece del catálogo y su API rechaza cálculos, incluso accediendo directamente a la URL. Puede publicarse nuevamente sin duplicar la instalación.

Importar/publicar/deshabilitar requiere CORE.MODULES.MANAGE, cuenta sin restricciones de alcance y sesión vigente y cuenta con MFA. La autorización se vuelve a comprobar dentro de la transacción compartida con administración de seguridad. El registro, cambio de estado y auditoría se confirman juntos o se revierten. Importar no concede roles ni permisos. Para este módulo ya compilado no se aplica aprobación por un segundo usuario; requested_by registra al instalador y approved_by permanece NULL. La aprobación doble, firmas y pipeline para código externo no están implementados.

## Rol de usuarios operativos
En Roles y permisos asignar **CORTA_CUOTAS.USE** al rol operativo, y luego asignar ese rol al usuario. No requiere CORE.*. El administrador que asigne el permiso debe poseerlo y respetar las restricciones habituales de autoridad y de modificación de su propio rol. Las cuentas con user_scopes se deniegan para este simulador hasta definir una asociación explícita de alcances; no se leen ni modifican datos de clientes.

## Fórmulas y límites
Fuente: Calculadora_Corta_Cuotas.xlsx suministrado por el usuario, hojas Calculadora y Tarifario. No se ejecutan macros ni fórmulas subidas al servidor.

| Plazo | Comisión regular | Comisión campaña, compra > L10,000 |
|---|---|---|
| 3 meses | 6% | 6% |
| 6 meses | 9% | 4% |
| 9 meses | 10% | 10% |
| 12 meses | 12% | 8% |
| 18 meses | 18% | 18% |
| 24 meses | 20% | 20% |

Interés nominal: 0%. Monto mayor que cero y hasta L500,000 inclusive, con máximo dos decimales. Comisión = monto × porcentaje. Cuota de capital = monto / meses. Primer pago = cuota de capital + comisión. Total = monto + comisión. Se conservan resultados intermedios sin redondear, como el Excel; la pantalla muestra dos decimales. No representa un calendario de cobro ni ajusta centavos de la última cuota. Los montos o plazos inválidos se rechazan en vez de mostrar resultados parciales/ceros del Excel.

La campaña es una selección explícita de simulación. El archivo dice 15–31 de diciembre, sin año; no se infiere vigencia ni se activa automáticamente. Las condiciones comerciales requieren validación antes de uso operativo. El simulador no confirma elegibilidad, tarjeta al día o ausencia de sobregiro.

Caso de referencia guardado en Excel: L18,000, 12 meses, sin campaña → comisión 12% / L2,160; cuota L1,500; primer pago L3,660; total L20,160. Con campaña → comisión 8% / L1,440; primer pago L2,940; total L19,440.

## Verificación y pendientes
Pruebas automatizadas: importación alterada, ciclo de vida, duplicados, autoridad, sesión reciente, alcance, rollback de auditoría, permisos del endpoint, límites de monto y todos los plazos. Compilación API/Angular y SQL consolidado comprobados. No se ejecutó la migración ni la importación en producción; prueba visual y recorrido real con la sesión del administrador en la otra PC pendientes. El usuario debe aplicar la migración e importar/publicar allí.


## Asistente ZIP (20/11/2026)
Centro de módulos → Importar paquete ZIP abre /modules/import. Descargar el ZIP de Corta Cuotas, seleccionarlo y escribir el motivo. El asistente recorre carga, análisis del servidor, configuración, seguridad, impacto e instalación, y publicación separada. Requiere CORE.MODULES.MANAGE, cuenta sin restricciones de alcance y sesión vigente y cuenta con MFA; descargar el ejemplo también requiere CORE.MODULES.READ.

Contrato inicial: ZIP de hasta 8 KB con un único manifest.json de hasta 8 KB, descriptor hub-builtin-v1 exacto del módulo incluido. Se rechazan otros nombres, archivos adicionales y módulos desconocidos. No se extraen archivos al disco ni se ejecutan SQL, JavaScript o comandos subidos. OFERTAS ejecuta un procedimiento fijo del Hub para crear su tabla dentro de la transacción de instalación. SHA-256 identifica el ZIP, no acredita firma digital. Análisis e instalación se verifican en servidor; instalar vuelve a analizar el paquete. El análisis se audita y no instala. Instalar crea registros en una transacción y deja el módulo sin publicar; publicar es una operación independiente auditada. Los roles se asignan desde Roles y permisos con su autorización propia. No se asignan privilegios automáticamente.

Para una instalación existente, gestionar publicación/deshabilitación desde Centro de módulos; una segunda instalación devuelve conflicto, no actualiza silenciosamente. Si expira la sesión, iniciar sesión otra vez y retomar desde Centro de módulos. El asistente no conserva archivos tras recargar la página. Corta Cuotas requiere 001–005. OFERTAS requiere además 006, que prepara su instalador; la tabla se crea desde el asistente.

Para actualizar en otra PC: git pull --ff-only, npm.cmd ci, npm.cmd test y npm.cmd run build; reiniciar la API y actualizar el frontend desplegado. En desarrollo reiniciar ng serve si estaba abierto.

Pendiente para módulos con código nuevo: contrato versionado de artefactos, firmas y repositorio confiable, servicio instalador con identidad separada y permisos acotados, migraciones por módulo y bloqueo de concurrencia, despliegue frontend/API, verificación de salud y recuperación. El asistente actual es el flujo para módulos incluidos; no constituye todavía un instalador de código externo. No cargar paquetes arbitrarios esperando que se ejecuten.

### Presentación del centro y asistente
El centro muestra los módulos en una tabla con estados y acciones. Importar módulo (.ZIP) abre el asistente; Detalle muestra el permiso y la descripción. Publicar o Deshabilitar abre un formulario de motivo y confirmación. El asistente permite seleccionar o arrastrar un único ZIP; conserva las validaciones de servidor y la publicación separada. En pantallas pequeñas, los pasos se distribuyen en filas y la tabla permite desplazamiento horizontal interno.

Acciones de la tabla: Detalle abre la ficha; el engranaje muestra la configuración integrada (solo lectura); el icono de apertura accede al módulo publicado cuando se tiene permiso de uso; el escudo lleva a Roles y permisos cuando se dispone de CORE.ROLES.READ. Publicar/Deshabilitar permanece en una segunda fila y solicita motivo y confirmación. Los botones de iconos incluyen nombre accesible y ayuda al pasar el cursor.

## Qué se necesita para desarrollar un módulo
1. Definir objetivo, usuarios, campos de entrada, resultados y reglas de negocio; aportar ejemplos con resultados esperados.
2. Identidad: código único, nombre, versión, responsable y permisos (por ejemplo PRESTAMOS.USE). Precisar quién consulta, crea, modifica y administra.
3. Pantallas Angular y rutas integradas; servicios NestJS para reglas, validaciones y autorización en servidor. Reutilizar la sesión del Hub.
4. Si guarda datos: esquema propio, migraciones SQL Server versionadas, consultas parametrizadas y permisos limitados de runtime. No modificar tablas del núcleo desde el módulo.
5. Pruebas funcionales y de acceso (sin permiso, módulo deshabilitado, datos inválidos), auditoría cuando corresponda y documentación de configuración/despliegue.
6. Integración actual: incorporar frontend/API al código revisado y compilado del Hub, registrar el módulo y sus permisos, y preparar su descriptor compatible. El importador actual reconoce CORTA_CUOTAS y OFERTAS; agregar un descriptor desconocido no instala una aplicación. Los instaladores específicos se registran mediante el SQL consolidado vigente; OFERTAS crea su tabla al instalarse.

Para instalar futuros módulos con código mediante ZIP sin intervención manual aún se necesita el servicio instalador separado, contrato de paquetes, firma y verificación, migraciones controladas, despliegue, comprobación de salud y recuperación. El límite de 8 KB corresponde al descriptor actual, no a un paquete de aplicación completo.

Administración de módulos: no exige volver a iniciar sesión cada 15 minutos. Se conservan MFA de la cuenta, permisos, alcance, auditoría y caducidad normal de sesión (inactividad y duración absoluta). La administración de usuarios, roles y permisos conserva el requisito de inicio reciente.

Contrato TLV actualizado: aplicar consolidado hasta 007. OFERTAS crea ofertas.base_tlv al instalarse; consultar [el capítulo 11](11-buscador-ofertas.md) para las 33 columnas y el detalle por producto.

El Centro de módulos muestra únicamente los módulos instalados. Los paquetes se entregan como archivos ZIP; el asistente ya no los genera ni ofrece un selector de ejemplos. El ZIP actual contiene el manifiesto validado y activa código incluido en la versión del Hub; requiere la preparación SQL 007. No es un paquete de código independiente.
