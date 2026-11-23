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
(N''004_user_enrollment.sql'',N''56ad82ae573efcac1148b011b7651c4bda7eb217b13826f3c4c9186b253aed9c''),
(N''005_builtin_modules.sql'',N''12a33ff64cb78659c3baa671a90578841c861e0579e75e5cc87c9792db9713f3''),
(N''006_offers_installer.sql'',N''0fef9559a49898f5eea85c2658640064efe157ef11da7c429af2bfed473c6641''),
(N''007_offers_tlv.sql'',N''8f5c30df2db7ace900cd2b7956af96c6b414ef747b1957d47df24afb51e77cac''),
(N''008_independent_modules.sql'',N''38d7a9d369bb2eefd1ba78a4213ca55a604c19d9da1127f46dd733765e6514ae''),
(N''009_favorites_runtime.sql'',N''c8619df4927e25ccc7772de967f85d559f0d307bb304c48f290c434e3ad109a3''),
(N''010_tlv_auditoria_installer.sql'',N''45d9f0dad28777dfbb8a81c1c24533a54a3aba2c0a5b3518494928e807332f7b'');
-- Base dedicada: no aceptar tablas ajenas al Hub.
IF EXISTS(SELECT 1 FROM sys.tables WHERE is_ms_shipped=0 AND NOT(schema_id=SCHEMA_ID(N''core'') OR (schema_id=SCHEMA_ID(N''ofertas'') AND name IN(N''ofertas_cliente'',N''base_tlv'') AND OBJECT_ID(N''core.install_ofertas_v1'',N''P'') IS NOT NULL) OR (SCHEMA_NAME(schema_id) LIKE N''mod[_]%'' AND SCHEMA_ID(SCHEMA_NAME(schema_id)) IN(SELECT schema_id FROM sys.schemas WHERE principal_id=DATABASE_PRINCIPAL_ID(N''hub_package_owner'')) AND OBJECT_ID(N''core.create_package_storage'',N''P'') IS NOT NULL) OR (schema_id=SCHEMA_ID(N''dbo'') AND name=N''hub_migrations'')))
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

 IF NOT EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name=N''005_builtin_modules.sql'')
 BEGIN
 EXEC sys.sp_executesql N''SET XACT_ABORT ON;
INSERT core.permissions(code) VALUES(''''CORE.MODULES.MANAGE''''),(''''CORTA_CUOTAS.USE'''');
-- Explicit installer grant; importing a descriptor never grants permissions.
INSERT core.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM core.roles r CROSS JOIN core.permissions p
WHERE r.code=''''PLATFORM_ADMIN'''' AND p.code IN (''''CORE.MODULES.MANAGE'''',''''CORTA_CUOTAS.USE'''');
GRANT INSERT ON core.modules TO hub_runtime;
GRANT UPDATE(enabled) ON core.modules TO hub_runtime;
GRANT INSERT ON core.module_versions TO hub_runtime;
GRANT INSERT ON core.module_installations TO hub_runtime;
GRANT UPDATE(state) ON core.module_installations TO hub_runtime;
GRANT INSERT ON core.application_catalog TO hub_runtime;
GRANT UPDATE(published) ON core.application_catalog TO hub_runtime;
'';
 INSERT dbo.hub_migrations(name,sha256) VALUES(N''005_builtin_modules.sql'',N''12a33ff64cb78659c3baa671a90578841c861e0579e75e5cc87c9792db9713f3'');
 END;

 IF NOT EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name=N''006_offers_installer.sql'')
 BEGIN
 EXEC sys.sp_executesql N''SET XACT_ABORT ON;
-- A dedicated database principal can create objects only in the offers schema.
-- The web identity gets EXECUTE on the fixed installer, never CREATE TABLE.
CREATE USER hub_offers_installer WITHOUT LOGIN;
'';
EXEC sys.sp_executesql N''
CREATE SCHEMA ofertas AUTHORIZATION hub_offers_installer;
'';
EXEC sys.sp_executesql N''
GRANT CREATE TABLE TO hub_offers_installer;
GRANT SELECT ON SCHEMA::ofertas TO hub_runtime;
INSERT core.permissions(code) VALUES(''''OFERTAS.USE'''');
INSERT core.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM core.roles r CROSS JOIN core.permissions p
WHERE r.code=''''PLATFORM_ADMIN'''' AND p.code=''''OFERTAS.USE'''';
'';
EXEC sys.sp_executesql N''
CREATE PROCEDURE core.install_ofertas_v1
WITH EXECUTE AS ''''hub_offers_installer''''
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 -- Called within the same transaction as module registration and its audit.
 IF @@TRANCOUNT=0 THROW 51800,''''La instalacion requiere una transaccion.'''',1;
 IF OBJECT_ID(N''''ofertas.ofertas_cliente'''') IS NOT NULL
  THROW 51801,''''La tabla de ofertas ya existe. No se modifica ni reemplaza.'''',1;
 CREATE TABLE ofertas.ofertas_cliente(
  id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ofertas_cliente PRIMARY KEY,
  base_origen nvarchar(120) NOT NULL,
  producto varchar(20) NOT NULL,
  codigo_oferta nvarchar(100) NULL,
  lote nvarchar(100) NULL,
  dni varchar(32) NULL,
  codigo_cliente varchar(32) NULL,
  cuenta varchar(32) NULL,
  nombre_cliente nvarchar(200) NOT NULL,
  agencia nvarchar(150) NULL,
  telefono1 nvarchar(30) NULL,
  telefono2 nvarchar(30) NULL,
  telefono3 nvarchar(30) NULL,
  direccion nvarchar(500) NULL,
  monto_oferta decimal(18,2) NULL,
  tasa_anual decimal(7,4) NULL,
  tasa_minima decimal(7,4) NULL,
  tasa_maxima decimal(7,4) NULL,
  oferta nvarchar(2000) NOT NULL,
  tipo_tarjeta nvarchar(100) NULL,
  limite_usd decimal(18,2) NULL,
  limite_lps decimal(18,2) NULL,
  limite_actual decimal(18,2) NULL,
  nuevo_limite decimal(18,2) NULL,
  vigente_desde date NULL,
  vigente_hasta date NULL,
  activo bit NOT NULL CONSTRAINT DF_ofertas_activo DEFAULT 1,
  cargado_en datetime2 NOT NULL CONSTRAINT DF_ofertas_cargado DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_ofertas_producto CHECK(producto IN(''''PREAPROBADAS'''',''''TC_TITULAR'''',''''AUMENTO_LIMITE'''',''''EXTRA'''',''''INTRA'''',''''CORTA_CUOTAS'''')),
  CONSTRAINT CK_ofertas_identidad CHECK(NULLIF(LTRIM(RTRIM(dni)),'''''''') IS NOT NULL OR NULLIF(LTRIM(RTRIM(codigo_cliente)),'''''''') IS NOT NULL OR NULLIF(LTRIM(RTRIM(cuenta)),'''''''') IS NOT NULL),
  CONSTRAINT CK_ofertas_nombre CHECK(LEN(LTRIM(RTRIM(nombre_cliente)))>0 AND LEN(LTRIM(RTRIM(base_origen)))>0 AND LEN(LTRIM(RTRIM(oferta)))>0),
  CONSTRAINT CK_ofertas_montos CHECK((monto_oferta IS NULL OR monto_oferta>=0) AND (limite_usd IS NULL OR limite_usd>=0) AND (limite_lps IS NULL OR limite_lps>=0) AND (limite_actual IS NULL OR limite_actual>=0) AND (nuevo_limite IS NULL OR nuevo_limite>=0)),
  CONSTRAINT CK_ofertas_tasas CHECK((tasa_anual IS NULL OR tasa_anual BETWEEN 0 AND 100) AND (tasa_minima IS NULL OR tasa_minima BETWEEN 0 AND 100) AND (tasa_maxima IS NULL OR tasa_maxima BETWEEN 0 AND 100) AND (tasa_minima IS NULL OR tasa_maxima IS NULL OR tasa_minima<=tasa_maxima)),
  CONSTRAINT CK_ofertas_vigencia CHECK(vigente_desde IS NULL OR vigente_hasta IS NULL OR vigente_desde<=vigente_hasta)
 );
 -- Deliberately non-unique: a customer/account can have many offers in any base.
 CREATE INDEX IX_ofertas_dni ON ofertas.ofertas_cliente(dni,activo,id);
 CREATE INDEX IX_ofertas_cliente ON ofertas.ofertas_cliente(codigo_cliente,activo,id);
 CREATE INDEX IX_ofertas_cuenta ON ofertas.ofertas_cliente(cuenta,activo,id);
END;
'';
EXEC sys.sp_executesql N''
GRANT EXECUTE ON core.install_ofertas_v1 TO hub_runtime;
'';
 INSERT dbo.hub_migrations(name,sha256) VALUES(N''006_offers_installer.sql'',N''0fef9559a49898f5eea85c2658640064efe157ef11da7c429af2bfed473c6641'');
 END;

 IF NOT EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name=N''007_offers_tlv.sql'')
 BEGIN
 EXEC sys.sp_executesql N''-- Additive TLV contract. Prior migrations and existing offers remain unchanged.
CREATE PROCEDURE core.install_ofertas_tlv_v1
WITH EXECUTE AS ''''hub_offers_installer''''
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 IF @@TRANCOUNT=0 THROW 51800,''''La instalacion requiere una transaccion.'''',1;
 IF OBJECT_ID(N''''ofertas.base_tlv'''') IS NOT NULL
  THROW 51801,''''La tabla TLV ya existe. No se modifica ni reemplaza.'''',1;
 CREATE TABLE ofertas.base_tlv(
  id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_base_tlv PRIMARY KEY,
  [TIPO_BASE] nvarchar(300) NULL,
  [DNI] varchar(40) NULL,
  [CODIGO_CLIENTE] varchar(40) NULL,
  [COD_CLIENTE_CRM] varchar(40) NULL,
  [CUENTA] varchar(40) NULL,
  [NUMERO_ADICIONALES_QUE_APLICA] nvarchar(300) NULL,
  [NOMBRE_TC] nvarchar(300) NULL,
  [METAL] nvarchar(300) NULL,
  [HRE_ACTIVO] nvarchar(300) NULL,
  [ASISTENCIA_VIP_ACTIVO] nvarchar(300) NULL,
  [VAP_ACTIVO] nvarchar(300) NULL,
  [TASA_EXTRA] decimal(9,4) NULL,
  [MONTO_OFERTA_EXTRA] decimal(19,4) NULL,
  [TASA_INTRA] decimal(9,4) NULL,
  [MONTO_OFERTA_INTRA] decimal(19,4) NULL,
  [MONTO_OFERTA_CC] decimal(19,4) NULL,
  [RANGO_TASA_EXTRA] nvarchar(300) NULL,
  [ID_AREA] nvarchar(300) NULL,
  [MES_BASE] date NULL,
  [MAIL] nvarchar(300) NULL,
  [LIMITE] decimal(19,4) NULL,
  [FLAG_FINAL_PAGO_CONTADO] nvarchar(300) NULL,
  [FLAG_EMPLEADO] nvarchar(300) NULL,
  [ID_ORDEN_CRM] varchar(40) NULL,
  [TIPO_FINANCIAMIENTO] nvarchar(300) NULL,
  [FECHA_COMPRA] date NULL,
  [PLAZO] int NULL,
  [CUENTA_DESTINO] varchar(40) NULL,
  [MONTO] decimal(19,4) NULL,
  [COMERCIO] nvarchar(300) NULL,
  [NOMBRE_CLIENTE] nvarchar(300) NULL,
  [CATEGORIA] nvarchar(300) NULL,
  [PAGO_IMPUESTO] decimal(19,4) NULL,
  [COTIZACION] varchar(40) NULL,
  [OFERTA_CRM] varchar(40) NULL,
  [FLAG1] nvarchar(300) NULL,
  [COLOR_ACTUAL] nvarchar(300) NULL,
  [LIMITE_NUEVO_USD] decimal(19,4) NULL,
  [COLOR_NUEVO] nvarchar(300) NULL,
  [DIFERENCIA] decimal(19,4) NULL,
  [CANTIDAD_TC] int NULL,
  [TC_INGRESADA] varchar(40) NULL,
  activo bit NOT NULL CONSTRAINT DF_base_tlv_activo DEFAULT 1,
  cargado_en datetime2 NOT NULL CONSTRAINT DF_base_tlv_cargado DEFAULT SYSUTCDATETIME()
 );
 CREATE INDEX IX_base_tlv_dni ON ofertas.base_tlv(DNI,activo,id);
 CREATE INDEX IX_base_tlv_cliente ON ofertas.base_tlv(CODIGO_CLIENTE,activo,id);
 CREATE INDEX IX_base_tlv_cuenta ON ofertas.base_tlv(CUENTA,activo,id);
END;
'';
EXEC sys.sp_executesql N''
GRANT EXECUTE ON core.install_ofertas_tlv_v1 TO hub_runtime;
'';
EXEC sys.sp_executesql N''
ALTER PROCEDURE core.install_ofertas_v1
WITH EXECUTE AS ''''hub_offers_installer''''
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 -- Called within the same transaction as module registration and its audit.
 IF @@TRANCOUNT=0 THROW 51800,''''La instalacion requiere una transaccion.'''',1;
 IF OBJECT_ID(N''''ofertas.ofertas_cliente'''') IS NOT NULL
  THROW 51801,''''La tabla de ofertas ya existe. No se modifica ni reemplaza.'''',1;
 CREATE TABLE ofertas.ofertas_cliente(
  id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ofertas_cliente PRIMARY KEY,
  base_origen nvarchar(120) NOT NULL,
  producto varchar(20) NOT NULL,
  codigo_oferta nvarchar(100) NULL,
  lote nvarchar(100) NULL,
  dni varchar(32) NULL,
  codigo_cliente varchar(32) NULL,
  cuenta varchar(32) NULL,
  nombre_cliente nvarchar(200) NOT NULL,
  agencia nvarchar(150) NULL,
  telefono1 nvarchar(30) NULL,
  telefono2 nvarchar(30) NULL,
  telefono3 nvarchar(30) NULL,
  direccion nvarchar(500) NULL,
  monto_oferta decimal(18,2) NULL,
  tasa_anual decimal(7,4) NULL,
  tasa_minima decimal(7,4) NULL,
  tasa_maxima decimal(7,4) NULL,
  oferta nvarchar(2000) NOT NULL,
  tipo_tarjeta nvarchar(100) NULL,
  limite_usd decimal(18,2) NULL,
  limite_lps decimal(18,2) NULL,
  limite_actual decimal(18,2) NULL,
  nuevo_limite decimal(18,2) NULL,
  vigente_desde date NULL,
  vigente_hasta date NULL,
  activo bit NOT NULL CONSTRAINT DF_ofertas_activo DEFAULT 1,
  cargado_en datetime2 NOT NULL CONSTRAINT DF_ofertas_cargado DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_ofertas_producto CHECK(producto IN(''''PREAPROBADAS'''',''''TC_TITULAR'''',''''AUMENTO_LIMITE'''',''''EXTRA'''',''''INTRA'''',''''CORTA_CUOTAS'''')),
  CONSTRAINT CK_ofertas_identidad CHECK(NULLIF(LTRIM(RTRIM(dni)),'''''''') IS NOT NULL OR NULLIF(LTRIM(RTRIM(codigo_cliente)),'''''''') IS NOT NULL OR NULLIF(LTRIM(RTRIM(cuenta)),'''''''') IS NOT NULL),
  CONSTRAINT CK_ofertas_nombre CHECK(LEN(LTRIM(RTRIM(nombre_cliente)))>0 AND LEN(LTRIM(RTRIM(base_origen)))>0 AND LEN(LTRIM(RTRIM(oferta)))>0),
  CONSTRAINT CK_ofertas_montos CHECK((monto_oferta IS NULL OR monto_oferta>=0) AND (limite_usd IS NULL OR limite_usd>=0) AND (limite_lps IS NULL OR limite_lps>=0) AND (limite_actual IS NULL OR limite_actual>=0) AND (nuevo_limite IS NULL OR nuevo_limite>=0)),
  CONSTRAINT CK_ofertas_tasas CHECK((tasa_anual IS NULL OR tasa_anual BETWEEN 0 AND 100) AND (tasa_minima IS NULL OR tasa_minima BETWEEN 0 AND 100) AND (tasa_maxima IS NULL OR tasa_maxima BETWEEN 0 AND 100) AND (tasa_minima IS NULL OR tasa_maxima IS NULL OR tasa_minima<=tasa_maxima)),
  CONSTRAINT CK_ofertas_vigencia CHECK(vigente_desde IS NULL OR vigente_hasta IS NULL OR vigente_desde<=vigente_hasta)
 );
 -- Deliberately non-unique: a customer/account can have many offers in any base.
 CREATE INDEX IX_ofertas_dni ON ofertas.ofertas_cliente(dni,activo,id);
 CREATE INDEX IX_ofertas_cliente ON ofertas.ofertas_cliente(codigo_cliente,activo,id);
 CREATE INDEX IX_ofertas_cuenta ON ofertas.ofertas_cliente(cuenta,activo,id);
 EXEC core.install_ofertas_tlv_v1;
END;
'';
EXEC sys.sp_executesql N''
-- Existing installations receive the new empty table during the Hub update.
-- Fresh installations defer its creation to the module installation transaction.
IF EXISTS(SELECT 1 FROM core.modules WHERE code=''''OFERTAS'''')
 EXEC core.install_ofertas_tlv_v1;
'';
 INSERT dbo.hub_migrations(name,sha256) VALUES(N''007_offers_tlv.sql'',N''8f5c30df2db7ace900cd2b7956af96c6b414ef747b1957d47df24afb51e77cac'');
 END;

 IF NOT EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name=N''008_independent_modules.sql'')
 BEGIN
 EXEC sys.sp_executesql N''CREATE USER hub_package_owner WITHOUT LOGIN;
GRANT CREATE SCHEMA,CREATE TABLE TO hub_package_owner;
CREATE TABLE core.module_packages(version_id uniqueidentifier PRIMARY KEY REFERENCES core.module_versions(id),archive varbinary(max) NOT NULL);
GRANT INSERT ON core.module_packages TO hub_runtime;
'';
EXEC sys.sp_executesql N''
CREATE PROCEDURE core.create_package_storage @code varchar(40),@definition nvarchar(max)
WITH EXECUTE AS ''''hub_package_owner''''
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 IF @@TRANCOUNT=0 THROW 51900,''''Se requiere transaccion.'''',1;
 IF @code IS NULL OR LEN(@code)<3 OR @code COLLATE Latin1_General_100_BIN2 LIKE ''''%[^A-Z0-9_]%'''' OR LEFT(@code,1) COLLATE Latin1_General_100_BIN2 NOT LIKE ''''[A-Z]''''
  THROW 51901,''''Codigo no valido.'''',1;
 IF ISJSON(@definition)<>1 OR LEN(@definition)>100000 THROW 51902,''''Definicion no valida.'''',1;
 DECLARE @schema sysname=N''''mod_''''+LOWER(@code),@ddl nvarchar(max),@table sysname,@columns nvarchar(max),@indexes nvarchar(max),@name sysname,@type nvarchar(50),@nullable bit;
 IF SCHEMA_ID(@schema) IS NOT NULL THROW 51903,''''El esquema ya existe. No se reemplaza.'''',1;
 SET @ddl=N''''CREATE SCHEMA ''''+QUOTENAME(@schema)+N'''' AUTHORIZATION hub_package_owner;'''';
 EXEC sys.sp_executesql @ddl;
 IF (SELECT COUNT(*) FROM OPENJSON(@definition,''''$.tables'''')) NOT BETWEEN 1 AND 10 THROW 51902,''''Tablas no validas.'''',1;
 DECLARE tables_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT name,columns, indexes FROM OPENJSON(@definition,''''$.tables'''') WITH(name nvarchar(48),columns nvarchar(max) AS JSON,indexes nvarchar(max) AS JSON);
 OPEN tables_cursor;FETCH NEXT FROM tables_cursor INTO @table,@columns,@indexes;
 WHILE @@FETCH_STATUS=0
 BEGIN
  IF @table IS NULL OR LEN(@table)=0 OR @table COLLATE Latin1_General_100_BIN2 LIKE ''''%[^A-Za-z0-9_]%'''' OR LEFT(@table,1) COLLATE Latin1_General_100_BIN2 NOT LIKE ''''[A-Za-z]'''' THROW 51904,''''Tabla no valida.'''',1;
  IF (SELECT COUNT(*) FROM OPENJSON(@columns)) NOT BETWEEN 1 AND 100 THROW 51904,''''Columnas no validas.'''',1;
  SET @ddl=N''''CREATE TABLE ''''+QUOTENAME(@schema)+N''''.''''+QUOTENAME(@table)+N''''([id] bigint IDENTITY(1,1) NOT NULL PRIMARY KEY,[activo] bit NOT NULL DEFAULT 1,[cargado_en] datetime2 NOT NULL DEFAULT SYSUTCDATETIME()'''';
  DECLARE columns_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT name,type,nullable FROM OPENJSON(@columns) WITH(name nvarchar(48),type nvarchar(50),nullable bit);
  OPEN columns_cursor;FETCH NEXT FROM columns_cursor INTO @name,@type,@nullable;
  WHILE @@FETCH_STATUS=0
  BEGIN
   IF @name IS NULL OR LEN(@name)=0 OR @name COLLATE Latin1_General_100_BIN2 LIKE ''''%[^A-Za-z0-9_]%'''' OR LEFT(@name,1) COLLATE Latin1_General_100_BIN2 NOT LIKE ''''[A-Za-z]'''' OR LOWER(@name) IN(''''id'''',''''activo'''',''''cargado_en'''') THROW 51905,''''Columna no valida.'''',1;
   IF @nullable IS NULL OR @type IS NULL OR @type COLLATE Latin1_General_100_BIN2 NOT IN(''''varchar(40)'''',''''nvarchar(300)'''',''''nvarchar(2000)'''',''''decimal(19,4)'''',''''decimal(9,4)'''',''''int'''',''''bigint'''',''''date'''',''''bit'''') THROW 51906,''''Tipo no valido.'''',1;
   SET @ddl+=N'''',''''+QUOTENAME(@name)+N'''' ''''+@type+CASE WHEN @nullable=1 THEN N'''' NULL'''' ELSE N'''' NOT NULL'''' END;
   FETCH NEXT FROM columns_cursor INTO @name,@type,@nullable;
  END;
  CLOSE columns_cursor;DEALLOCATE columns_cursor;
  SET @ddl+=N'''');'''';EXEC sys.sp_executesql @ddl;
  DECLARE @index nvarchar(max),@indexFields nvarchar(max),@counter int=0;
  IF (SELECT COUNT(*) FROM OPENJSON(@indexes))>5 THROW 51907,''''Demasiados indices.'''',1;
  DECLARE indexes_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT value FROM OPENJSON(@indexes);
  OPEN indexes_cursor;FETCH NEXT FROM indexes_cursor INTO @index;
  WHILE @@FETCH_STATUS=0
  BEGIN
   IF (SELECT COUNT(*) FROM OPENJSON(@index)) NOT BETWEEN 1 AND 4 OR EXISTS(SELECT 1 FROM OPENJSON(@index) WHERE LEN(value)>48 OR value COLLATE Latin1_General_100_BIN2 LIKE ''''%[^A-Za-z0-9_]%'''' OR LEN(value)=0) THROW 51907,''''Indice no valido.'''',1;
   SELECT @indexFields=STRING_AGG(CONVERT(nvarchar(max),QUOTENAME(value)),N'''','''') WITHIN GROUP(ORDER BY CONVERT(int,[key])) FROM OPENJSON(@index);
   SET @counter+=1;
   SET @ddl=N''''CREATE INDEX ''''+QUOTENAME(N''''ix_''''+CONVERT(nvarchar(10),@counter))+N'''' ON ''''+QUOTENAME(@schema)+N''''.''''+QUOTENAME(@table)+N''''(''''+@indexFields+N'''');'''';EXEC sys.sp_executesql @ddl;
   FETCH NEXT FROM indexes_cursor INTO @index;
  END;
  CLOSE indexes_cursor;DEALLOCATE indexes_cursor;
  FETCH NEXT FROM tables_cursor INTO @table,@columns,@indexes;
 END;
 CLOSE tables_cursor;DEALLOCATE tables_cursor;
 SET @ddl=N''''GRANT SELECT ON SCHEMA::''''+QUOTENAME(@schema)+N'''' TO hub_runtime;'''';EXEC sys.sp_executesql @ddl;
END;
'';
EXEC sys.sp_executesql N''
CREATE PROCEDURE core.register_package_permission @code varchar(40)
WITH EXECUTE AS OWNER
AS
BEGIN
 SET NOCOUNT ON;
 IF @@TRANCOUNT=0 OR @code IS NULL OR @code COLLATE Latin1_General_100_BIN2 LIKE ''''%[^A-Z0-9_]%'''' OR @code LIKE ''''CORE%'''' OR NOT EXISTS(SELECT 1 FROM core.modules WHERE code=@code) THROW 51908,''''Modulo no valido.'''',1;
 DECLARE @permission varchar(150)=@code+''''.USE'''';
 IF EXISTS(SELECT 1 FROM core.permissions WHERE code=@permission) THROW 51908,''''Permiso existente.'''',1;
 INSERT core.permissions(code) VALUES(@permission);
 INSERT core.role_permissions(role_id,permission_id) SELECT r.id,p.id FROM core.roles r CROSS JOIN core.permissions p WHERE r.code=''''PLATFORM_ADMIN'''' AND p.code=@permission;
END;
'';
EXEC sys.sp_executesql N''
GRANT EXECUTE ON core.create_package_storage TO hub_runtime;
GRANT EXECUTE ON core.register_package_permission TO hub_runtime;
'';
 INSERT dbo.hub_migrations(name,sha256) VALUES(N''008_independent_modules.sql'',N''38d7a9d369bb2eefd1ba78a4213ca55a604c19d9da1127f46dd733765e6514ae'');
 END;

 IF NOT EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name=N''009_favorites_runtime.sql'')
 BEGIN
 EXEC sys.sp_executesql N''-- Allow the authenticated Hub API to persist application shortcuts per user.
-- The API verifies that each application is published and authorized before writing.
GRANT INSERT, DELETE ON OBJECT::core.user_favorites TO hub_runtime;
'';
 INSERT dbo.hub_migrations(name,sha256) VALUES(N''009_favorites_runtime.sql'',N''c8619df4927e25ccc7772de967f85d559f0d307bb304c48f290c434e3ad109a3'');
 END;
 IF NOT EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name=N''010_tlv_auditoria_installer.sql'')
 BEGIN
 EXEC sys.sp_executesql N''-- 010: Instalador controlado para la auditoria del modulo OFERTAS_TLV.
-- No ejecuta SQL suministrado por ZIP y no reemplaza datos de clientes.
-- Se ejecuta en la transaccion de instalacion o en la migracion DBA autorizada.
CREATE PROCEDURE core.prepare_tlv_auditoria_v1
WITH EXECUTE AS OWNER
AS
BEGIN
 SET NOCOUNT ON;
 SET XACT_ABORT ON;
 IF @@TRANCOUNT=0 THROW 52100,''''La preparacion TLV requiere transaccion.'''',1;
 IF NOT EXISTS (SELECT 1 FROM core.modules WHERE code=''''OFERTAS_TLV'''')
    THROW 52101,''''El modulo TLV no esta registrado.'''',1;
 IF NOT EXISTS (
   SELECT 1 FROM sys.schemas
   WHERE name=N''''mod_ofertas_tlv'''' AND principal_id=DATABASE_PRINCIPAL_ID(N''''hub_package_owner'''')
 )
    THROW 52102,''''El esquema TLV no pertenece al instalador autorizado.'''',1;
 IF OBJECT_ID(N''''mod_ofertas_tlv.base_tlv'''',N''''U'''') IS NULL
    THROW 52103,''''Falta la tabla base_tlv del modulo TLV.'''',1;
 IF COL_LENGTH(''''mod_ofertas_tlv.base_tlv'''',''''carga_id'''') IS NULL
    EXEC sys.sp_executesql N''''ALTER TABLE mod_ofertas_tlv.base_tlv ADD carga_id uniqueidentifier NULL'''';
 IF COL_LENGTH(''''mod_ofertas_tlv.base_tlv'''',''''archivo_fila'''') IS NULL
    EXEC sys.sp_executesql N''''ALTER TABLE mod_ofertas_tlv.base_tlv ADD archivo_fila int NULL'''';
 IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N''''mod_ofertas_tlv.base_tlv'''') AND name=''''IX_base_tlv_carga_activo'''')
    EXEC sys.sp_executesql N''''CREATE INDEX IX_base_tlv_carga_activo ON mod_ofertas_tlv.base_tlv(carga_id,activo) INCLUDE (TIPO_BASE)'''';
 IF OBJECT_ID(N''''mod_ofertas_tlv.cargas'''',N''''U'''') IS NULL
    EXEC sys.sp_executesql N''''CREATE TABLE mod_ofertas_tlv.cargas (
  carga_id uniqueidentifier NOT NULL CONSTRAINT PK_tlv_cargas PRIMARY KEY,
  archivo nvarchar(260) NOT NULL,
  sha256 char(64) NOT NULL,
  modalidad varchar(20) NOT NULL CONSTRAINT CK_tlv_modalidad CHECK (modalidad IN (''''''''REEMPLAZO_TOTAL'''''''',''''''''REEMPLAZO_TIPO'''''''')),
  tipo_base nvarchar(300) NULL,
  periodo date NULL,
  usuario_bd sysname NOT NULL,
  usuario_hub uniqueidentifier NULL,
  esperados int NOT NULL,
  insertados int NOT NULL CONSTRAINT DF_tlv_insertados DEFAULT (0),
  rechazados int NOT NULL CONSTRAINT DF_tlv_rechazados DEFAULT (0),
  estado varchar(15) NOT NULL CONSTRAINT CK_tlv_estado CHECK (estado IN (''''''''CARGANDO'''''''',''''''''ACTIVADA'''''''',''''''''FALLIDA'''''''')),
  error_resumen nvarchar(1000) NULL,
  creado_en datetime2(3) NOT NULL CONSTRAINT DF_tlv_creado_en DEFAULT SYSUTCDATETIME(),
  activado_en datetime2(3) NULL,
  CONSTRAINT CK_tlv_tipo_modalidad CHECK (
    (modalidad=''''''''REEMPLAZO_TOTAL'''''''' AND tipo_base IS NULL) OR
    (modalidad=''''''''REEMPLAZO_TIPO'''''''' AND tipo_base IS NOT NULL)
  )
);'''';
 IF OBJECT_ID(N''''mod_ofertas_tlv.carga_eventos'''',N''''U'''') IS NULL
    EXEC sys.sp_executesql N''''CREATE TABLE mod_ofertas_tlv.carga_eventos (
 evento_id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_tlv_eventos PRIMARY KEY,
 carga_id uniqueidentifier NOT NULL,
 operacion varchar(30) NOT NULL,
 usuario_bd sysname NOT NULL,
 usuario_hub uniqueidentifier NULL,
 detalle nvarchar(1000) NULL,
 fecha_utc datetime2(3) NOT NULL CONSTRAINT DF_tlv_evento_fecha DEFAULT SYSUTCDATETIME(),
 CONSTRAINT FK_tlv_eventos_carga FOREIGN KEY(carga_id) REFERENCES mod_ofertas_tlv.cargas(carga_id)
);'''';
 IF OBJECT_ID(N''''mod_ofertas_tlv.carga_errores'''',N''''U'''') IS NULL
    EXEC sys.sp_executesql N''''CREATE TABLE mod_ofertas_tlv.carga_errores (
 error_id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_tlv_errores PRIMARY KEY,
 carga_id uniqueidentifier NOT NULL,
 fila_excel int NULL,
 columna varchar(60) NULL,
 motivo nvarchar(500) NOT NULL,
 fecha_utc datetime2(3) NOT NULL CONSTRAINT DF_tlv_error_fecha DEFAULT SYSUTCDATETIME(),
 CONSTRAINT FK_tlv_errores_carga FOREIGN KEY(carga_id) REFERENCES mod_ofertas_tlv.cargas(carga_id)
);'''';
 IF OBJECT_ID(N''''mod_ofertas_tlv.activar_carga'''',N''''P'''') IS NULL
    EXEC sys.sp_executesql N''''CREATE PROCEDURE mod_ofertas_tlv.activar_carga @carga_id uniqueidentifier
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRANSACTION;
 BEGIN TRY
  DECLARE @lock int,@modalidad varchar(20),@tipo nvarchar(300),@esperados int,@insertados bigint;
  EXEC @lock=sys.sp_getapplock @Resource=''''''''TLV_CAMBIO_BASE_VIGENTE'''''''',@LockMode=''''''''Exclusive'''''''',@LockOwner=''''''''Transaction'''''''',@LockTimeout=20000;
  IF @lock<0 THROW 52010,''''''''No se obtuvo el bloqueo de activacion.'''''''',1;
  SELECT @modalidad=modalidad,@tipo=tipo_base,@esperados=esperados FROM mod_ofertas_tlv.cargas WITH (UPDLOCK,HOLDLOCK)
   WHERE carga_id=@carga_id AND estado=''''''''CARGANDO'''''''';
  IF @modalidad IS NULL THROW 52011,''''''''La carga no existe o no esta pendiente.'''''''',1;
  SELECT @insertados=COUNT_BIG(*) FROM mod_ofertas_tlv.base_tlv WHERE carga_id=@carga_id AND activo=0;
  IF @insertados<>@esperados OR @insertados=0 THROW 52012,''''''''La cantidad cargada no coincide con la validacion.'''''''',1;
  IF @modalidad=''''''''REEMPLAZO_TIPO'''''''' AND EXISTS(
      SELECT 1 FROM mod_ofertas_tlv.base_tlv WHERE carga_id=@carga_id AND (TIPO_BASE IS NULL OR TIPO_BASE<>@tipo))
      THROW 52013,''''''''La carga contiene otro tipo de base.'''''''',1;
  IF @modalidad=''''''''REEMPLAZO_TOTAL''''''''
    UPDATE mod_ofertas_tlv.base_tlv SET activo=0 WHERE activo=1;
  ELSE
    UPDATE mod_ofertas_tlv.base_tlv SET activo=0 WHERE activo=1 AND TIPO_BASE=@tipo;
  UPDATE mod_ofertas_tlv.base_tlv SET activo=1 WHERE carga_id=@carga_id AND activo=0;
  UPDATE mod_ofertas_tlv.cargas SET estado=''''''''ACTIVADA'''''''',activado_en=SYSUTCDATETIME(),insertados=CONVERT(int,@insertados) WHERE carga_id=@carga_id;
  INSERT mod_ofertas_tlv.carga_eventos(carga_id,operacion,usuario_bd,detalle)
   VALUES(@carga_id,''''''''ACTIVAR'''''''',ORIGINAL_LOGIN(),CONCAT(''''''''Modalidad '''''''',@modalidad,''''''''; filas '''''''',@insertados));
  COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;'''';
 IF OBJECT_ID(N''''mod_ofertas_tlv.restaurar_carga'''',N''''P'''') IS NULL
    EXEC sys.sp_executesql N''''CREATE PROCEDURE mod_ofertas_tlv.restaurar_carga @carga_id uniqueidentifier
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 BEGIN TRANSACTION;
 BEGIN TRY
  DECLARE @lock int,@modalidad varchar(20),@tipo nvarchar(300);
  EXEC @lock=sys.sp_getapplock @Resource=''''''''TLV_CAMBIO_BASE_VIGENTE'''''''',@LockMode=''''''''Exclusive'''''''',@LockOwner=''''''''Transaction'''''''',@LockTimeout=20000;
  IF @lock<0 THROW 52020,''''''''No se obtuvo el bloqueo para restaurar.'''''''',1;
  SELECT @modalidad=modalidad,@tipo=tipo_base FROM mod_ofertas_tlv.cargas WITH(UPDLOCK,HOLDLOCK)
   WHERE carga_id=@carga_id AND estado=''''''''ACTIVADA'''''''';
  IF @modalidad IS NULL THROW 52021,''''''''La carga indicada no esta activada en el historial.'''''''',1;
  IF NOT EXISTS(SELECT 1 FROM mod_ofertas_tlv.base_tlv WHERE carga_id=@carga_id)
   THROW 52022,''''''''La carga seleccionada no conserva registros.'''''''',1;
  IF @modalidad=''''''''REEMPLAZO_TOTAL''''''''
    UPDATE mod_ofertas_tlv.base_tlv SET activo=0 WHERE activo=1;
  ELSE
    UPDATE mod_ofertas_tlv.base_tlv SET activo=0 WHERE activo=1 AND TIPO_BASE=@tipo;
  UPDATE mod_ofertas_tlv.base_tlv SET activo=1 WHERE carga_id=@carga_id;
  INSERT mod_ofertas_tlv.carga_eventos(carga_id,operacion,usuario_bd,detalle)
    VALUES(@carga_id,''''''''RESTAURAR'''''''',ORIGINAL_LOGIN(),''''''''Restauracion autorizada.'''''''');
  COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK TRANSACTION; THROW; END CATCH;
END;'''';
 -- Permisos minimos para la identidad SQL utilizada por la API.
 GRANT INSERT ON OBJECT::mod_ofertas_tlv.base_tlv TO hub_runtime;
 GRANT SELECT,INSERT,UPDATE ON OBJECT::mod_ofertas_tlv.cargas TO hub_runtime;
 GRANT SELECT,INSERT ON OBJECT::mod_ofertas_tlv.carga_eventos TO hub_runtime;
 GRANT SELECT,INSERT ON OBJECT::mod_ofertas_tlv.carga_errores TO hub_runtime;
 GRANT EXECUTE ON OBJECT::mod_ofertas_tlv.activar_carga TO hub_runtime;
 -- restaurar_carga NO se concede al rol de la aplicacion.
END;
'';
EXEC sys.sp_executesql N''
GRANT EXECUTE ON OBJECT::core.prepare_tlv_auditoria_v1 TO hub_runtime;
'';
EXEC sys.sp_executesql N''
-- Si TLV ya estaba instalado, completar sus dependencias durante migracion 010.
IF EXISTS (SELECT 1 FROM core.modules WHERE code=''''OFERTAS_TLV'''')
   EXEC core.prepare_tlv_auditoria_v1;
'';
 INSERT dbo.hub_migrations(name,sha256) VALUES(N''010_tlv_auditoria_installer.sql'',N''45d9f0dad28777dfbb8a81c1c24533a54a3aba2c0a5b3518494928e807332f7b'');
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
