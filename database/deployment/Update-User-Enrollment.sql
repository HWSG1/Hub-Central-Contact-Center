-- Alta de usuarios desde el portal. LOCAL: ejecutar TODO en SSMS (F5), con API detenida.
-- Requiere migraciones 001,002,003. No crea usuarios ni modifica contrasenas existentes.
SET NOCOUNT ON;
IF COALESCE(CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')),N'')<>N'JanOda_PC_00' OR COALESCE(CONVERT(nvarchar(128),SERVERPROPERTY('InstanceName')),N'')<>N'SQLEXPRESS01' THROW 51500,'Solo permitido en JanOda_PC_00\SQLEXPRESS01.',1;
IF @@TRANCOUNT<>0 THROW 51504,'Ejecutar fuera de una transaccion existente.',1;
IF DB_ID(N'ContactCenterHub_Dev') IS NULL THROW 51505,'La base local no existe.',1;
EXEC sys.sp_executesql N'USE [ContactCenterHub_Dev]; SET XACT_ABORT ON;
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int; EXEC @lock=sys.sp_getapplock @Resource=''hub_migrate'',@LockMode=''Exclusive'',@LockOwner=''Transaction'',@LockTimeout=10000;
 IF @lock<0 THROW 51501,''No se obtuvo bloqueo de migracion.'',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name=''001_core.sql'' AND sha256=''f70e4d57c4cd3b7956f4c5d6566862da16cb93c74ea6ae801cf3f0772af294f4'') THROW 51502,''Falta migracion previa o su hash no coincide.'',1;
IF NOT EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name=''002_local_mfa.sql'' AND sha256=''c9be5a90540e9485a98ff7c0a175dcfc9780b564e8e3e077a94b3822afd97137'') THROW 51502,''Falta migracion previa o su hash no coincide.'',1;
IF NOT EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name=''003_security_administration.sql'' AND sha256=''b47946a7a1243a9daa49f792d0ce6045b3a110b31bd571329a0f3a783e3ca17c'') THROW 51502,''Falta migracion previa o su hash no coincide.'',1;
 IF EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name=''004_user_enrollment.sql'' AND sha256<>''56ad82ae573efcac1148b011b7651c4bda7eb217b13826f3c4c9186b253aed9c'') THROW 51503,''Migracion registrada con otro hash.'',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name=''004_user_enrollment.sql'') BEGIN
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
 INSERT dbo.hub_migrations(name,sha256) VALUES(''004_user_enrollment.sql'',''56ad82ae573efcac1148b011b7651c4bda7eb217b13826f3c4c9186b253aed9c''); END;
 COMMIT;
 SELECT name,sha256,applied_at FROM dbo.hub_migrations WHERE name=''004_user_enrollment.sql'';
END TRY BEGIN CATCH IF @@TRANCOUNT>0 ROLLBACK; THROW; END CATCH;';
