-- CONTACT CENTER HUB - INSTALACION / ACTUALIZACION DEL ESQUEMA
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
DECLARE @Sql nvarchar(max)=N'USE '+QUOTENAME(@DatabaseName)+N';'+N'SET XACT_ABORT ON;
DECLARE @Manifest table(name varchar(200) PRIMARY KEY,sha256 char(64) NOT NULL);
INSERT @Manifest(name,sha256) VALUES (N''001_core.sql'',N''f70e4d57c4cd3b7956f4c5d6566862da16cb93c74ea6ae801cf3f0772af294f4''),
(N''002_local_mfa.sql'',N''c9be5a90540e9485a98ff7c0a175dcfc9780b564e8e3e077a94b3822afd97137''),
(N''003_security_administration.sql'',N''b47946a7a1243a9daa49f792d0ce6045b3a110b31bd571329a0f3a783e3ca17c''),
(N''004_user_enrollment.sql'',N''56ad82ae573efcac1148b011b7651c4bda7eb217b13826f3c4c9186b253aed9c'');
-- Base dedicada: no aceptar tablas ajenas al Hub.
IF EXISTS(SELECT 1 FROM sys.tables WHERE is_ms_shipped=0 AND NOT(schema_id=SCHEMA_ID(N''core'') OR (schema_id=SCHEMA_ID(N''dbo'') AND name=N''hub_migrations'')))
 THROW 51710,''Existen tablas ajenas al Hub. Usar una base dedicada.'',1;
IF SCHEMA_ID(N''core'') IS NOT NULL AND OBJECT_ID(N''dbo.hub_migrations'',N''U'') IS NULL
 THROW 51711,''Existe core sin historial de migraciones. Revisar con el DBA.'',1;
DECLARE @Applied table(name varchar(200),sha256 char(64));
IF OBJECT_ID(N''dbo.hub_migrations'',N''U'') IS NOT NULL
 INSERT @Applied EXEC sys.sp_executesql N''SELECT name,sha256 FROM dbo.hub_migrations;'';
IF EXISTS(SELECT 1 FROM @Applied a LEFT JOIN @Manifest m ON m.name=a.name WHERE m.name IS NULL OR m.sha256<>a.sha256)
 THROW 51712,''El historial contiene una migracion desconocida o con otro hash. No continuar.'',1;
IF EXISTS(SELECT 1 FROM @Applied a JOIN @Manifest m ON m.name<a.name WHERE NOT EXISTS(SELECT 1 FROM @Applied b WHERE b.name=m.name))
 THROW 51713,''El historial no es consecutivo. Revisar con el DBA.'',1;
IF @Apply=0
 BEGIN
 SELECT CONVERT(nvarchar(128),SERVERPROPERTY(''ServerName'')) AS servidor,DB_NAME() AS base_objetivo,N''SOLO REVISION: no se aplicaron cambios'' AS resultado;
 SELECT m.name AS migracion,m.sha256,CASE WHEN a.name IS NULL THEN N''PENDIENTE'' ELSE N''APLICADA'' END AS estado FROM @Manifest m LEFT JOIN @Applied a ON a.name=m.name ORDER BY m.name;
 RETURN;
 END;
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sys.sp_getapplock @Resource=N''hub_migrate'',@LockMode=N''Exclusive'',@LockOwner=N''Transaction'',@LockTimeout=10000;
 IF @lock<0 THROW 51714,''No se pudo bloquear el historial de migraciones.'',1;
 IF OBJECT_ID(N''dbo.hub_migrations'',N''U'') IS NULL
  CREATE TABLE dbo.hub_migrations(name varchar(200) PRIMARY KEY,sha256 char(64) NOT NULL,applied_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
 -- Volver a validar bajo el bloqueo: otra instalacion puede haber finalizado.
 IF EXISTS(SELECT 1 FROM dbo.hub_migrations a LEFT JOIN @Manifest m ON m.name=a.name WHERE m.name IS NULL OR m.sha256<>a.sha256)
  THROW 51712,''El historial contiene una migracion desconocida o con otro hash. No continuar.'',1;
 IF EXISTS(SELECT 1 FROM dbo.hub_migrations a JOIN @Manifest m ON m.name<a.name WHERE NOT EXISTS(SELECT 1 FROM dbo.hub_migrations b WHERE b.name=m.name))
  THROW 51713,''El historial no es consecutivo. Revisar con el DBA.'',1;

 IF NOT EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name=N''001_core.sql'')
 BEGIN
 EXEC sys.sp_executesql N''CREATE SCHEMA core;
'';
EXEC sys.sp_executesql N''
SET XACT_ABORT ON;
CREATE TABLE core.users(id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,display_name nvarchar(120) NOT NULL,enabled bit NOT NULL DEFAULT 1,expires_at datetime2 NULL,require_mfa bit NOT NULL DEFAULT 1,must_change_password bit NOT NULL DEFAULT 0,created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
CREATE TABLE core.user_identities(id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,user_id uniqueidentifier NOT NULL REFERENCES core.users(id),issuer nvarchar(300) COLLATE Latin1_General_100_BIN2 NOT NULL,subject nvarchar(200) COLLATE Latin1_General_100_BIN2 NOT NULL,CONSTRAINT uq_identity UNIQUE(issuer,subject));
CREATE TABLE core.local_credentials(user_id uniqueidentifier PRIMARY KEY REFERENCES core.users(id),login nvarchar(128) NOT NULL UNIQUE,password_hash varchar(512) NOT NULL,failed_attempts int NOT NULL DEFAULT 0,locked_until datetime2 NULL);
CREATE TABLE core.roles(id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,code varchar(100) NOT NULL UNIQUE,name nvarchar(120) NOT NULL);
CREATE TABLE core.permissions(id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,code varchar(150) NOT NULL UNIQUE);
CREATE TABLE core.user_roles(user_id uniqueidentifier NOT NULL REFERENCES core.users(id),role_id uniqueidentifier NOT NULL REFERENCES core.roles(id),PRIMARY KEY(user_id,role_id));
CREATE TABLE core.role_permissions(role_id uniqueidentifier NOT NULL REFERENCES core.roles(id),permission_id uniqueidentifier NOT NULL REFERENCES core.permissions(id),PRIMARY KEY(role_id,permission_id));
CREATE TABLE core.user_scopes(user_id uniqueidentifier NOT NULL REFERENCES core.users(id),scope_type varchar(40) NOT NULL,scope_id nvarchar(100) NOT NULL,PRIMARY KEY(user_id,scope_type,scope_id));
CREATE TABLE core.sessions(token_hash char(64) PRIMARY KEY,user_id uniqueidentifier NOT NULL REFERENCES core.users(id),csrf_token varchar(64) NOT NULL,created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),last_seen_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),revoked_at datetime2 NULL);
CREATE INDEX ix_sessions_user ON core.sessions(user_id);
CREATE TABLE core.oidc_transactions(state_hash char(64) PRIMARY KEY,binding_hash char(64) NOT NULL,verifier varchar(128) NOT NULL,nonce varchar(128) NOT NULL,created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
CREATE TABLE core.modules(id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,code varchar(80) NOT NULL UNIQUE,name nvarchar(150) NOT NULL,enabled bit NOT NULL DEFAULT 0);
CREATE TABLE core.module_versions(id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,module_id uniqueidentifier NOT NULL REFERENCES core.modules(id),version varchar(40) NOT NULL,manifest nvarchar(max) NOT NULL CHECK(ISJSON(manifest)=1),artifact_sha256 char(64) NOT NULL,created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),UNIQUE(module_id,version));
CREATE TABLE core.module_installations(id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,version_id uniqueidentifier NOT NULL REFERENCES core.module_versions(id),requested_by uniqueidentifier NOT NULL REFERENCES core.users(id),approved_by uniqueidentifier NULL REFERENCES core.users(id),state varchar(30) NOT NULL CHECK(state IN (''''QUARANTINE'''',''''VALIDATED'''',''''REJECTED'''',''''APPROVED'''',''''DEPLOYED'''',''''PUBLISHED'''',''''DISABLED'''')),created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),CHECK(approved_by IS NULL OR approved_by<>requested_by));
CREATE TABLE core.application_catalog(id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,module_id uniqueidentifier NOT NULL REFERENCES core.modules(id),name nvarchar(150) NOT NULL,description nvarchar(500) NOT NULL,route varchar(200) NOT NULL,required_permission varchar(150) NOT NULL REFERENCES core.permissions(code),published bit NOT NULL DEFAULT 0);
CREATE TABLE core.user_favorites(user_id uniqueidentifier NOT NULL REFERENCES core.users(id),application_id uniqueidentifier NOT NULL REFERENCES core.application_catalog(id),PRIMARY KEY(user_id,application_id));
CREATE TABLE core.audit_events(id bigint IDENTITY PRIMARY KEY,created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),user_id uniqueidentifier NULL REFERENCES core.users(id),action varchar(100) NOT NULL,result varchar(30) NOT NULL,correlation_id varchar(64) NOT NULL);
CREATE INDEX ix_audit_created ON core.audit_events(created_at DESC);
CREATE TABLE core.system_settings(name varchar(100) PRIMARY KEY,value nvarchar(max) NOT NULL);
CREATE TABLE core.notifications(id uniqueidentifier NOT NULL DEFAULT NEWSEQUENTIALID() PRIMARY KEY,user_id uniqueidentifier NOT NULL REFERENCES core.users(id),message nvarchar(500) NOT NULL,created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),read_at datetime2 NULL);
CREATE ROLE hub_runtime;
GRANT SELECT ON SCHEMA::core TO hub_runtime;
GRANT INSERT ON core.audit_events TO hub_runtime;
DENY UPDATE,DELETE ON core.audit_events TO hub_runtime;
GRANT INSERT,UPDATE,DELETE ON core.sessions TO hub_runtime;
GRANT INSERT,DELETE ON core.oidc_transactions TO hub_runtime;
GRANT UPDATE(failed_attempts,locked_until) ON core.local_credentials TO hub_runtime;
INSERT core.permissions(code) VALUES(''''CORE.MODULES.READ''''),(''''CORE.AUDIT.READ''''),(''''CORE.USERS.READ''''),(''''CORE.ROLES.READ'''');
INSERT core.roles(code,name) VALUES(''''PLATFORM_ADMIN'''',N''''Administrador de plataforma''''),(''''AUDITOR'''',N''''Auditor''''),(''''READER'''',N''''Usuario de consulta'''');
INSERT core.role_permissions(role_id,permission_id) SELECT r.id,p.id FROM core.roles r CROSS JOIN core.permissions p WHERE r.code=''''PLATFORM_ADMIN'''';
INSERT core.role_permissions(role_id,permission_id) SELECT r.id,p.id FROM core.roles r CROSS JOIN core.permissions p WHERE r.code=''''AUDITOR'''' AND p.code=''''CORE.AUDIT.READ'''';
'';
 INSERT dbo.hub_migrations(name,sha256) VALUES(N''001_core.sql'',N''f70e4d57c4cd3b7956f4c5d6566862da16cb93c74ea6ae801cf3f0772af294f4'');
 END;

 IF NOT EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name=N''002_local_mfa.sql'')
 BEGIN
 EXEC sys.sp_executesql N''SET XACT_ABORT ON;
ALTER TABLE core.local_credentials ADD mfa_secret_cipher nvarchar(512) NULL,mfa_last_counter bigint NULL;
GRANT UPDATE(password_hash,mfa_last_counter) ON core.local_credentials TO hub_runtime;
GRANT UPDATE(must_change_password) ON core.users TO hub_runtime;
'';
 INSERT dbo.hub_migrations(name,sha256) VALUES(N''002_local_mfa.sql'',N''c9be5a90540e9485a98ff7c0a175dcfc9780b564e8e3e077a94b3822afd97137'');
 END;

 IF NOT EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name=N''003_security_administration.sql'')
 BEGIN
 EXEC sys.sp_executesql N''SET XACT_ABORT ON;
ALTER TABLE core.roles ADD enabled bit NOT NULL CONSTRAINT df_roles_enabled DEFAULT 1,description nvarchar(500) NOT NULL CONSTRAINT df_roles_description DEFAULT N'''''''',version int NOT NULL CONSTRAINT df_roles_version DEFAULT 1;
ALTER TABLE core.users ADD security_version int NOT NULL CONSTRAINT df_users_security_version DEFAULT 1;
ALTER TABLE core.audit_events ADD resource_type varchar(30) NULL,resource_id uniqueidentifier NULL,details nvarchar(max) NULL CONSTRAINT ck_audit_details CHECK(details IS NULL OR ISJSON(details)=1);
INSERT core.permissions(code) VALUES(''''CORE.ROLES.MANAGE''''),(''''CORE.PERMISSIONS.ASSIGN''''),(''''CORE.USERS.UPDATE''''),(''''CORE.USERS.DISABLE''''),(''''CORE.USERS.ROLES_ASSIGN'''');
-- Explicit migration grant to the seeded platform administrator role. Runtime uses permissions, never the role name.
INSERT core.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM core.roles r CROSS JOIN core.permissions p
WHERE r.code=''''PLATFORM_ADMIN'''' AND p.code IN (''''CORE.ROLES.MANAGE'''',''''CORE.PERMISSIONS.ASSIGN'''',''''CORE.USERS.UPDATE'''',''''CORE.USERS.DISABLE'''',''''CORE.USERS.ROLES_ASSIGN'''');
GRANT INSERT ON core.roles TO hub_runtime;
GRANT UPDATE(name,description,enabled,version) ON core.roles TO hub_runtime;
GRANT INSERT,DELETE ON core.role_permissions TO hub_runtime;
GRANT INSERT,DELETE ON core.user_roles TO hub_runtime;
GRANT UPDATE(enabled,security_version) ON core.users TO hub_runtime;
CREATE INDEX ix_user_roles_role ON core.user_roles(role_id,user_id);
CREATE INDEX ix_role_permissions_permission ON core.role_permissions(permission_id,role_id);
'';
 INSERT dbo.hub_migrations(name,sha256) VALUES(N''003_security_administration.sql'',N''b47946a7a1243a9daa49f792d0ce6045b3a110b31bd571329a0f3a783e3ca17c'');
 END;

 IF NOT EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name=N''004_user_enrollment.sql'')
 BEGIN
 EXEC sys.sp_executesql N''SET XACT_ABORT ON;
CREATE TABLE core.user_invitations(
 user_id uniqueidentifier NOT NULL PRIMARY KEY REFERENCES core.users(id),
 login nvarchar(128) NOT NULL UNIQUE,
 token_hash char(64) NOT NULL UNIQUE,
 mfa_secret_cipher varchar(512) NOT NULL,
 expires_at datetime2 NOT NULL,
 consumed_at datetime2 NULL,
 attempts int NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5)
);
INSERT core.permissions(code) VALUES(''''CORE.USERS.CREATE'''');
INSERT core.role_permissions(role_id,permission_id)
 SELECT r.id,p.id FROM core.roles r CROSS JOIN core.permissions p WHERE r.code=''''PLATFORM_ADMIN'''' AND p.code=''''CORE.USERS.CREATE'''';
GRANT INSERT ON core.users TO hub_runtime;
GRANT INSERT ON core.local_credentials TO hub_runtime;
GRANT SELECT,INSERT,UPDATE ON core.user_invitations TO hub_runtime;
'';
 INSERT dbo.hub_migrations(name,sha256) VALUES(N''004_user_enrollment.sql'',N''56ad82ae573efcac1148b011b7651c4bda7eb217b13826f3c4c9186b253aed9c'');
 END;
 COMMIT;
 SELECT name,sha256,applied_at FROM dbo.hub_migrations ORDER BY name;
 SELECT s.name AS esquema,t.name AS tabla FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name=N''core'' ORDER BY t.name;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK;
 THROW;
END CATCH;';
EXEC sys.sp_executesql @Sql,N'@Apply bit',@Apply=@Apply;
