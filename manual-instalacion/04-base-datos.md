# 04 · Crear y actualizar la base

## Un solo SQL operativo
Ejecutar [sql/Instalar-Actualizar-Hub.sql](sql/Instalar-Actualizar-Hub.sql) completo en SSMS, sin modo SQLCMD. Es el mismo archivo para instalación inicial y actualizaciones. No ejecutar 001, 002, 003 o 004 por separado ni combinarlo con los instaladores antiguos.

El DBA crea previamente una base dedicada con el nombre, propietario, archivos, recuperación y respaldo acordados. El script no crea bases/logins ni otorga acceso a cuentas de servicio. Contiene las migraciones consecutivas 001–009: estructura core, claves/índices, roles/permisos, catálogo, auditoría, instalación de módulos, procedimientos de soporte y el rol SQL hub_runtime. Las actualizaciones aditivas conservan las tablas y datos existentes.

## Parámetros
Para conocer la instancia a la que se conectó SSMS, ejecutar esta consulta de sólo lectura:

~~~sql
SELECT SERVERPROPERTY('ServerName') AS servidor, DB_NAME() AS base_actual;
~~~

En la copia del instalador que ejecutarás, completar al principio:

~~~sql
DECLARE @ExpectedServer nvarchar(128) = N'SERVIDOR\INSTANCIA';
DECLARE @DatabaseName sysname = N'NOMBRE_BASE';
DECLARE @Apply bit = 0;
~~~

Usar el nombre exacto de instancia que corresponde al destino aprobado. El nombre de base va entre comillas simples; no usar NOMBRE_BASE sin comillas ni [NOMBRE_BASE] como valor. La conexión puede hacerse desde otra PC: las tablas se crean en SQL, no en la PC de SSMS.

## Revisar y aplicar
1. Ejecutar TODO con @Apply=0. Muestra destino, hashes y estado APLICADA/PENDIENTE de cada migración, sin escribir. No es una simulación de ejecución ni valida todos los permisos de creación.
2. Comprobar que el destino y el historial sean los esperados. En una base nueva verás todas pendientes. En una base existente, las migraciones previas con sus mismos hashes figurarán como aplicadas y solo las nuevas aparecerán pendientes.
3. Con el cambio autorizado, API detenida y validación previa en pruebas, establecer @Apply=1 y ejecutar TODO. Las migraciones pendientes se aplican en una sola transacción. Si hay error, se revierte esa ejecución; no seguir pegando fragmentos sueltos.
4. El resultado muestra historial y tablas. Si no hay pendientes, no recrea objetos ni usuarios. No elimina datos ni marca como aplicada una migración con hash diferente.

Se detiene ante servidor distinto, base del sistema/inexistente/no escribible, tablas ajenas al Hub, historial desconocido, no consecutivo o modificado. Un historial coincidente no demuestra que nadie haya cambiado manualmente los objetos: no sustituye revisión de deriva del esquema.

## Cuenta instaladora y cuenta de aplicación
La cuenta instaladora necesita DDL y administración de permisos dentro de esa base, no sólo CREATE TABLE. El DBA debe mapear el login aprobado de la API a un usuario de base y agregarlo a hub_runtime. Este rol ya se crea mediante las migraciones. No dar db_owner o sysadmin a la API.

Crear el esquema no crea el administrador del portal. El login SQL y el usuario del portal son identidades diferentes; seguir [05](05-acceso-usuarios.md).

## Mantenimiento
El SQL se genera automáticamente desde las migraciones mediante npm.cmd run docs:build. Mantener los parámetros del archivo versionado en NULL y @Apply=0; sólo parametrizar una copia de ejecución. No subir destinos/secretos operativos nuevos al repositorio público. Para otra PC, los hashes permanecen estables porque Git conserva LF para las migraciones.

npm.cmd run db:migrate continúa existiendo para desarrolladores, pero conecta a la base indicada en .env y escribe. No usarlo para probar conectividad; usar db:check. El camino operativo recomendado en este manual es el SQL consolidado en SSMS.


## Migración 009 · Favoritos por usuario (menú «Mis aplicaciones»)

La migración `009_favorites_runtime.sql` **no crea tablas nuevas ni modifica ofertas**. La tabla `core.user_favorites` ya existía; esta actualización concede al rol limitado `hub_runtime` únicamente INSERT y DELETE sobre esa tabla. El backend solo permite fijar aplicaciones publicadas y autorizadas para el usuario autenticado.

Para aplicar en `ContactCenterHub_Dev`: respaldar la base, detener la API, abrir **una copia** de `manual-instalacion/sql/Instalar-Actualizar-Hub.sql` en SSMS, indicar `@ExpectedServer` y `@DatabaseName`, ejecutar con `@Apply=0` para revisar y luego con `@Apply=1` tras la aprobación. No ejecutar `009` por separado. Reiniciar la API y actualizar el frontend.

La auditoría paginada utiliza la tabla `core.audit_events` existente, con filtros de fechas y consultas de tamaño limitado. No requiere otra migración. Los favoritos se guardan por usuario y no cambian los roles ni permisos. No hay importación automática de los ejemplos del HTML de referencia.
