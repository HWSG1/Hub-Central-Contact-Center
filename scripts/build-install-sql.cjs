const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const target = 'manual-instalacion/sql/Instalar-Actualizar-Hub.sql';
const literal = value => "N'" + value.replaceAll("'", "''") + "'";
function readMigrations(base = root) {
  const folder = path.join(base, 'database/migrations');
  const checksums = JSON.parse(fs.readFileSync(path.join(folder, 'checksums.json'), 'utf8'));
  const names = fs.readdirSync(folder).filter(n => /^\d+.*\.sql$/.test(n)).sort();
  if (!names.length || JSON.stringify(names) !== JSON.stringify(Object.keys(checksums).sort())) throw Error('El manifiesto de hashes no coincide con las migraciones. Registrar nuevas migraciones sin alterar las aplicadas.');
  if (names.some((name, i) => !/^\d{3}_/.test(name) || Number(name.slice(0, 3)) !== i + 1)) throw Error('Las migraciones deben ser consecutivas: 001, 002, ...');
  return names.map(name => {
    const source = fs.readFileSync(path.join(folder, name), 'utf8');
    const hash = crypto.createHash('sha256').update(source).digest('hex');
    if (source.includes('\r')) throw Error(name + ': usar finales LF; no modificar hashes para corregir conversiones CRLF.');
    if (hash !== checksums[name]) throw Error(name + ': contenido cambiado respecto al hash registrado. No editar migraciones aplicadas.');
    return { name, source, hash };
  });
}
function render(migrations) {
  const manifest = migrations.map(m => '(' + literal(m.name) + ',' + literal(m.hash) + ')').join(',\n');
  const changes = migrations.map(m => `
 IF NOT EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name=${literal(m.name)})
 BEGIN
 ${m.source.split(/^GO\s*$/mi).filter(s => s.trim()).map(s => 'EXEC sys.sp_executesql ' + literal(s) + ';').join('\n')}
 INSERT dbo.hub_migrations(name,sha256) VALUES(${literal(m.name)},${literal(m.hash)});
 END;`).join('\n');
  const body = `SET XACT_ABORT ON;
DECLARE @Manifest table(name varchar(200) PRIMARY KEY,sha256 char(64) NOT NULL);
INSERT @Manifest(name,sha256) VALUES ${manifest};
-- Base dedicada: no aceptar tablas ajenas al Hub.
IF EXISTS(SELECT 1 FROM sys.tables WHERE is_ms_shipped=0 AND NOT(schema_id=SCHEMA_ID(N'core') OR (schema_id=SCHEMA_ID(N'ofertas') AND name IN(N'ofertas_cliente',N'base_tlv') AND OBJECT_ID(N'core.install_ofertas_v1',N'P') IS NOT NULL) OR (SCHEMA_NAME(schema_id) LIKE N'mod[_]%' AND SCHEMA_ID(SCHEMA_NAME(schema_id)) IN(SELECT schema_id FROM sys.schemas WHERE principal_id=DATABASE_PRINCIPAL_ID(N'hub_package_owner')) AND OBJECT_ID(N'core.create_package_storage',N'P') IS NOT NULL) OR (schema_id=SCHEMA_ID(N'dbo') AND name=N'hub_migrations')))
 THROW 51710,'Existen tablas ajenas al Hub. Usar una base dedicada.',1;
IF SCHEMA_ID(N'core') IS NOT NULL AND OBJECT_ID(N'dbo.hub_migrations',N'U') IS NULL
 THROW 51711,'Existe core sin historial de migraciones. Revisar con el DBA.',1;
DECLARE @Applied table(name varchar(200),sha256 char(64));
IF OBJECT_ID(N'dbo.hub_migrations',N'U') IS NOT NULL
 INSERT @Applied EXEC sys.sp_executesql N'SELECT name,sha256 FROM dbo.hub_migrations;';
IF EXISTS(SELECT 1 FROM @Applied a LEFT JOIN @Manifest m ON m.name=a.name WHERE m.name IS NULL OR m.sha256<>a.sha256)
 THROW 51712,'El historial contiene una migracion desconocida o con otro hash. No continuar.',1;
IF EXISTS(SELECT 1 FROM @Applied a JOIN @Manifest m ON m.name<a.name WHERE NOT EXISTS(SELECT 1 FROM @Applied b WHERE b.name=m.name))
 THROW 51713,'El historial no es consecutivo. Revisar con el DBA.',1;
IF @Apply=0
 BEGIN
 SELECT CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')) AS servidor,DB_NAME() AS base_objetivo,N'SOLO REVISION: no se aplicaron cambios' AS resultado;
 SELECT m.name AS migracion,m.sha256,CASE WHEN a.name IS NULL THEN N'PENDIENTE' ELSE N'APLICADA' END AS estado FROM @Manifest m LEFT JOIN @Applied a ON a.name=m.name ORDER BY m.name;
 RETURN;
 END;
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sys.sp_getapplock @Resource=N'hub_migrate',@LockMode=N'Exclusive',@LockOwner=N'Transaction',@LockTimeout=10000;
 IF @lock<0 THROW 51714,'No se pudo bloquear el historial de migraciones.',1;
 IF OBJECT_ID(N'dbo.hub_migrations',N'U') IS NULL
  CREATE TABLE dbo.hub_migrations(name varchar(200) PRIMARY KEY,sha256 char(64) NOT NULL,applied_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
 -- Volver a validar bajo el bloqueo: otra instalacion puede haber finalizado.
 IF EXISTS(SELECT 1 FROM dbo.hub_migrations a LEFT JOIN @Manifest m ON m.name=a.name WHERE m.name IS NULL OR m.sha256<>a.sha256)
  THROW 51712,'El historial contiene una migracion desconocida o con otro hash. No continuar.',1;
 IF EXISTS(SELECT 1 FROM dbo.hub_migrations a JOIN @Manifest m ON m.name<a.name WHERE NOT EXISTS(SELECT 1 FROM dbo.hub_migrations b WHERE b.name=m.name))
  THROW 51713,'El historial no es consecutivo. Revisar con el DBA.',1;
${changes}
 COMMIT;
 SELECT name,sha256,applied_at FROM dbo.hub_migrations ORDER BY name;
 SELECT s.name AS esquema,t.name AS tabla FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name=N'core' ORDER BY t.name;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK;
 THROW;
END CATCH;`;
  return `-- CONTACT CENTER HUB - INSTALACION / ACTUALIZACION DEL ESQUEMA
-- Generado por npm run docs:build desde database/migrations. No editar el cuerpo.
-- Completar SOLO estos parametros en la copia que ejecutara el DBA.
-- Base dedicada existente; no crea bases, logins, cuentas del portal ni contrasenas.
-- Ejecutar TODO en SSMS, sin SQLCMD. @Apply=0 no escribe ni valida todos los permisos.
-- Detener API antes de aplicar. Revisar y probar cambios antes de produccion.
SET NOCOUNT ON;
DECLARE @ExpectedServer nvarchar(128) = NULL; -- Valor exacto de SERVERPROPERTY('ServerName').
DECLARE @DatabaseName sysname = NULL;          -- Ejemplo: N'ContactCenterHub_Dev'.
DECLARE @Apply bit = 0;                        -- 0 revisar; 1 aplicar pendientes.
IF @ExpectedServer IS NULL OR LTRIM(RTRIM(@ExpectedServer))=N''
 THROW 51700,'Defina @ExpectedServer con el servidor e instancia esperados.',1;
IF COALESCE(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'') COLLATE Latin1_General_100_CI_AS <> @ExpectedServer COLLATE Latin1_General_100_CI_AS
 THROW 51701,'Servidor/instancia distintos del destino esperado.',1;
IF @DatabaseName IS NULL OR LTRIM(RTRIM(@DatabaseName))=N''
 THROW 51702,'Defina @DatabaseName entre comillas simples.',1;
IF DB_ID(@DatabaseName) IS NULL OR DB_ID(@DatabaseName)<=4
 THROW 51703,'La base dedicada no existe o es una base del sistema.',1;
IF NOT EXISTS(SELECT 1 FROM sys.databases WHERE name=@DatabaseName AND state=0 AND is_read_only=0)
 THROW 51704,'La base no esta ONLINE o es de solo lectura.',1;
IF @@TRANCOUNT<>0 THROW 51705,'Ejecutar fuera de una transaccion existente.',1;
DECLARE @Sql nvarchar(max)=N'USE '+QUOTENAME(@DatabaseName)+N';'+${literal(body)};
EXEC sys.sp_executesql @Sql,N'@Apply bit',@Apply=@Apply;
`;
}
function main() {
  const generated = render(readMigrations());
  const output = path.join(root, target);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== generated) throw Error('SQL consolidado desactualizado. Ejecutar npm run docs:build y revisar el manual.');
    const required = ['README.md','01-requisitos.md','02-instalacion-pc.md','03-configuracion.md','04-base-datos.md','05-acceso-usuarios.md','06-despliegue-operacion.md','07-solucion-problemas.md','08-historial.md','09-mantenimiento-manual.md'];
    for (const name of required) if (!fs.existsSync(path.join(root, 'manual-instalacion', name))) throw Error('Falta manual: ' + name);
    console.log('Manual presente; SQL consolidado y hashes vigentes. No se conecto a SQL.');
  } else {
    fs.mkdirSync(path.dirname(output), {recursive:true});
    fs.writeFileSync(output, generated);
    console.log('Generado ' + target + '. No se conecto a SQL.');
  }
}
module.exports = {readMigrations, render};
if (require.main === module) {try {main();} catch (e) {console.error(e.message);process.exitCode=1;}}
