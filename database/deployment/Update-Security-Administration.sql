-- Actualizacion LOCAL: roles, permisos, usuarios y auditoria. Ejecutar completo en SSMS (F5).
-- Detener API antes y reiniciarla despues. No recrea cuentas ni modifica contrasenas/MFA.
SET NOCOUNT ON;
IF COALESCE(CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')),N'')<>N'JanOda_PC_00' OR COALESCE(CONVERT(nvarchar(128),SERVERPROPERTY('InstanceName')),N'')<>N'SQLEXPRESS01' THROW 51300,'Solo permitido en JanOda_PC_00\SQLEXPRESS01.',1;
IF @@TRANCOUNT<>0 THROW 51304,'Ejecutar fuera de una transaccion existente.',1;
IF DB_ID(N'ContactCenterHub_Dev') IS NULL THROW 51305,'La base local no existe.',1;
EXEC sys.sp_executesql N'USE [ContactCenterHub_Dev];
SET XACT_ABORT ON;
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sys.sp_getapplock @Resource=''hub_migrate'',@LockMode=''Exclusive'',@LockOwner=''Transaction'',@LockTimeout=10000;
 IF @lock<0 THROW 51301,''No se obtuvo bloqueo de migracion.'',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name=''001_core.sql'' AND sha256=''f70e4d57c4cd3b7956f4c5d6566862da16cb93c74ea6ae801cf3f0772af294f4'') THROW 51302,''Falta migracion previa o su hash no coincide.'',1;
IF NOT EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name=''002_local_mfa.sql'' AND sha256=''c9be5a90540e9485a98ff7c0a175dcfc9780b564e8e3e077a94b3822afd97137'') THROW 51302,''Falta migracion previa o su hash no coincide.'',1;
 IF EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name=''003_security_administration.sql'' AND sha256<>''b47946a7a1243a9daa49f792d0ce6045b3a110b31bd571329a0f3a783e3ca17c'') THROW 51303,''Migracion registrada con otro hash.'',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name=''003_security_administration.sql'')
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
 INSERT dbo.hub_migrations(name,sha256) VALUES(''003_security_administration.sql'',''b47946a7a1243a9daa49f792d0ce6045b3a110b31bd571329a0f3a783e3ca17c'');
 END;
 COMMIT;
 SELECT name,sha256,applied_at FROM dbo.hub_migrations WHERE name=''003_security_administration.sql'';
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK;
 THROW;
END CATCH;';
