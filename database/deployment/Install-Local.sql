-- Contact Center Hub: instalacion LOCAL para SSMS.
-- Abrir conectado a JanOda_PC_00\SQLEXPRESS01 y ejecutar TODO el archivo (F5).
-- Sin modo SQLCMD, sin Node.js. No crea usuarios de acceso ni contrasenas.
-- Si falla la migracion, se revierte su transaccion; una base recien creada puede quedar vacia.
-- No editar: generado desde database/migrations/001_core.sql, SHA256 f70e4d57c4cd3b7956f4c5d6566862da16cb93c74ea6ae801cf3f0772af294f4
SET NOCOUNT ON;
IF COALESCE(CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')),N'')<>N'JanOda_PC_00'
 OR COALESCE(CONVERT(nvarchar(128),SERVERPROPERTY('InstanceName')),N'')<>N'SQLEXPRESS01'
 THROW 51000,'Este archivo es exclusivamente para JanOda_PC_00\SQLEXPRESS01 local.',1;
IF @@TRANCOUNT<>0 THROW 51005,'Ejecutar fuera de una transaccion existente.',1;
IF DB_ID(N'ContactCenterHub_Dev') IS NULL
 EXEC(N'CREATE DATABASE [ContactCenterHub_Dev]');
EXEC sys.sp_executesql N'USE [ContactCenterHub_Dev];
SET XACT_ABORT ON;
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock_result int;
 EXEC @lock_result=sys.sp_getapplock @Resource=N''hub_migrate'',@LockMode=N''Exclusive'',@LockOwner=N''Transaction'',@LockTimeout=10000;
 IF @lock_result<0 THROW 51001,''No se pudo obtener el bloqueo de migracion.'',1;
 IF OBJECT_ID(N''dbo.hub_migrations'',N''U'') IS NULL
  CREATE TABLE dbo.hub_migrations(name varchar(200) PRIMARY KEY,sha256 char(64) NOT NULL,applied_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
 DECLARE @previous char(64);
 SELECT @previous=sha256 FROM dbo.hub_migrations WHERE name=''001_core.sql'';
 IF @previous IS NOT NULL AND @previous<>''f70e4d57c4cd3b7956f4c5d6566862da16cb93c74ea6ae801cf3f0772af294f4''
  THROW 51002,''La migracion registrada no coincide. Revisar antes de continuar.'',1;
 IF @previous IS NULL
 BEGIN
  IF SCHEMA_ID(N''core'') IS NOT NULL
   THROW 51003,''Existe core sin una migracion registrada. No se modifico su estructura; revisar instalacion previa.'',1;
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
  INSERT dbo.hub_migrations(name,sha256) VALUES(''001_core.sql'',''f70e4d57c4cd3b7956f4c5d6566862da16cb93c74ea6ae801cf3f0772af294f4'');
 END;
 IF OBJECT_ID(N''core.users'',N''U'') IS NULL THROW 51004,''Falta la tabla core.users.'',1;
 IF OBJECT_ID(N''core.user_identities'',N''U'') IS NULL THROW 51004,''Falta la tabla core.user_identities.'',1;
 IF OBJECT_ID(N''core.local_credentials'',N''U'') IS NULL THROW 51004,''Falta la tabla core.local_credentials.'',1;
 IF OBJECT_ID(N''core.roles'',N''U'') IS NULL THROW 51004,''Falta la tabla core.roles.'',1;
 IF OBJECT_ID(N''core.permissions'',N''U'') IS NULL THROW 51004,''Falta la tabla core.permissions.'',1;
 IF OBJECT_ID(N''core.user_roles'',N''U'') IS NULL THROW 51004,''Falta la tabla core.user_roles.'',1;
 IF OBJECT_ID(N''core.role_permissions'',N''U'') IS NULL THROW 51004,''Falta la tabla core.role_permissions.'',1;
 IF OBJECT_ID(N''core.user_scopes'',N''U'') IS NULL THROW 51004,''Falta la tabla core.user_scopes.'',1;
 IF OBJECT_ID(N''core.sessions'',N''U'') IS NULL THROW 51004,''Falta la tabla core.sessions.'',1;
 IF OBJECT_ID(N''core.oidc_transactions'',N''U'') IS NULL THROW 51004,''Falta la tabla core.oidc_transactions.'',1;
 IF OBJECT_ID(N''core.modules'',N''U'') IS NULL THROW 51004,''Falta la tabla core.modules.'',1;
 IF OBJECT_ID(N''core.module_versions'',N''U'') IS NULL THROW 51004,''Falta la tabla core.module_versions.'',1;
 IF OBJECT_ID(N''core.module_installations'',N''U'') IS NULL THROW 51004,''Falta la tabla core.module_installations.'',1;
 IF OBJECT_ID(N''core.application_catalog'',N''U'') IS NULL THROW 51004,''Falta la tabla core.application_catalog.'',1;
 IF OBJECT_ID(N''core.user_favorites'',N''U'') IS NULL THROW 51004,''Falta la tabla core.user_favorites.'',1;
 IF OBJECT_ID(N''core.audit_events'',N''U'') IS NULL THROW 51004,''Falta la tabla core.audit_events.'',1;
 IF OBJECT_ID(N''core.system_settings'',N''U'') IS NULL THROW 51004,''Falta la tabla core.system_settings.'',1;
 IF OBJECT_ID(N''core.notifications'',N''U'') IS NULL THROW 51004,''Falta la tabla core.notifications.'',1;
 COMMIT TRANSACTION;
 PRINT N''INSTALACION LOCAL COMPLETADA: ContactCenterHub_Dev'';
 SELECT DB_NAME() AS database_name, COUNT(*) AS core_tables FROM sys.tables WHERE schema_id=SCHEMA_ID(N''core'');
 SELECT name,sha256,applied_at FROM dbo.hub_migrations ORDER BY applied_at;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 THROW;
END CATCH;';
