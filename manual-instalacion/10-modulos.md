# 10 · Módulos incluidos y calculadora Corta Cuotas

## Alcance de esta entrega
El Centro de módulos permite importar un descriptor JSON de un módulo revisado e incluido en la compilación del Hub, instalar su registro deshabilitado, publicarlo y deshabilitarlo. No ejecuta código subido, scripts SQL ni ZIP. El único descriptor admitido inicialmente es CORTA_CUOTAS 1.0.0. Se compara íntegramente con el registro del backend; campos adicionales, rutas, permisos, versiones y huellas distintos se rechazan. La huella identifica el descriptor, no es una firma digital ni verifica un paquete externo. El formato acotado hub-builtin-v1 es independiente del contrato futuro de paquetes externos de packages/module-sdk.

## Actualizar una instalación existente
1. Actualizar el código y ejecutar `npm.cmd run build`.
2. Abrir en SSMS el único instalador operativo [Instalar-Actualizar-Hub.sql](sql/Instalar-Actualizar-Hub.sql). En una copia privada completar servidor y base aprobados; ejecutar primero con Apply=0 y luego con Apply=1. Se conserva el historial 001–004 y solo se aplica 005_builtin_modules.sql si está pendiente. No ejecutar otra vez admin:local ni admin:remote.
3. Reiniciar API y frontend (o desplegar dist/web en IIS), y volver a iniciar sesión con el administrador. La migración concede CORE.MODULES.MANAGE y CORTA_CUOTAS.USE al rol PLATFORM_ADMIN existente. No crea cuentas, no cambia MFA, no instala ni publica automáticamente la calculadora.

## Importar y publicar desde el portal
1. Entrar a **Centro de módulos**. Requiere CORE.MODULES.READ.
2. Descargar el manifiesto de prueba desde la pantalla, o usar [el descriptor distribuido](../business-modules/corta-cuotas/corta-cuotas-1.0.0.hub.json).
3. Seleccionar el JSON, escribir un motivo de al menos 5 caracteres y pulsar **Importar módulo**. Estado inicial: instalado, pendiente de publicación.
4. Escribir el motivo y pulsar **Publicar módulo**. Aparecerá en Inicio y aplicaciones para usuarios con permiso de uso.
5. Para retirarlo, escribir un motivo y pulsar **Deshabilitar módulo**. Desaparece del catálogo y su API rechaza cálculos, incluso accediendo directamente a la URL. Puede publicarse nuevamente sin duplicar la instalación.

Importar/publicar/deshabilitar requiere CORE.MODULES.MANAGE, cuenta sin restricciones de alcance y sesión iniciada con MFA hace menos de 15 minutos. La autorización se vuelve a comprobar dentro de la transacción compartida con administración de seguridad. El registro, cambio de estado y auditoría se confirman juntos o se revierten. Importar no concede roles ni permisos. Para este módulo ya compilado no se aplica aprobación por un segundo usuario; requested_by registra al instalador y approved_by permanece NULL. La aprobación doble, firmas y pipeline para código externo no están implementados.

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
