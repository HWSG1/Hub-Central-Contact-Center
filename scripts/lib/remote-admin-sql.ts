import { literal } from './local-admin-sql.js';

export interface RemoteAdminPlan {
 server:string; database:string; id:string; username:string; name:string;
 passwordHash:string; cipher:string; counter:number; correlation:string;
 migrations:Record<string,string>;
}
export function remoteAdminSql(p:RemoteAdminPlan){
 if(!p.server.trim()||!p.database.trim()||p.server.length>128||p.database.length>128)throw Error('Servidor y base son obligatorios (máximo 128 caracteres).');
 if(['master','model','msdb','tempdb'].includes(p.database.toLowerCase()))throw Error('No se permite una base de sistema.');
 if(!Number.isSafeInteger(p.counter)||p.counter<0)throw Error('Contador MFA inválido.');
 if(!Object.keys(p.migrations).length||Object.values(p.migrations).some(h=>! /^[a-f0-9]{64}$/.test(h)))throw Error('Manifiesto de migraciones inválido.');
 const checks=Object.entries(p.migrations).map(([name,hash])=>`IF NOT EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name=${literal(name)} AND sha256=${literal(hash)}) THROW 51203,'Falta una migracion requerida o su hash no coincide.',1;`).join('\n');
 return `-- PRIVADO: primer administrador del portal. No publicar. Ejecutar completo en SSMS.
-- No crea tablas ni modifica la configuración de la API. Revisión por defecto.
SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @Apply bit=0; -- Cambiar a 1 para crear la cuenta tras revisar servidor y base.
IF COALESCE(CONVERT(nvarchar(128),SERVERPROPERTY('ServerName')),N'')<>${literal(p.server)} THROW 51200,'Servidor incorrecto.',1;
IF DB_NAME()<>${literal(p.database)} THROW 51201,'Seleccione la base objetivo en SSMS antes de ejecutar.',1;
IF @@TRANCOUNT<>0 THROW 51202,'Ejecutar fuera de una transaccion existente.',1;
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sys.sp_getapplock @Resource='hub_migrate',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
 IF @lock<0 THROW 51204,'No se obtuvo bloqueo de migraciones.',1;
 EXEC @lock=sys.sp_getapplock @Resource='hub_bootstrap',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
 IF @lock<0 THROW 51205,'No se obtuvo bloqueo de inicializacion.',1;
 ${checks}
 IF EXISTS(SELECT 1 FROM core.system_settings WHERE name='bootstrap_complete') OR EXISTS(SELECT 1 FROM core.user_roles ur JOIN core.roles r ON r.id=ur.role_id WHERE r.code='PLATFORM_ADMIN') THROW 51206,'Ya existe inicializacion o administrador. Use la administracion del portal; no repita el alta.',1;
 IF NOT EXISTS(SELECT 1 FROM core.roles WHERE code='PLATFORM_ADMIN' AND enabled=1) THROW 51207,'Falta el rol administrador activo.',1;
 IF EXISTS(SELECT 1 FROM core.local_credentials WHERE login=${literal(p.username)}) THROW 51208,'El login ya existe.',1;
 IF @Apply=1 BEGIN
  INSERT core.users(id,display_name,require_mfa,must_change_password) VALUES(${literal(p.id)},${literal(p.name)},1,1);
  INSERT core.local_credentials(user_id,login,password_hash,mfa_secret_cipher,mfa_last_counter) VALUES(${literal(p.id)},${literal(p.username)},${literal(p.passwordHash)},${literal(p.cipher)},${p.counter});
  INSERT core.user_roles(user_id,role_id) SELECT ${literal(p.id)},id FROM core.roles WHERE code='PLATFORM_ADMIN';
  INSERT core.audit_events(user_id,action,result,correlation_id) VALUES(${literal(p.id)},'ADMIN.REMOTE_LOCAL_PROVISION','SUCCESS',${literal(p.correlation)});
  INSERT core.system_settings(name,value) VALUES('bootstrap_complete','true');
 END;
 COMMIT;
 SELECT DB_NAME() AS base_objetivo,${literal(p.username)} AS usuario,CASE WHEN @Apply=1 THEN N'Administrador creado: contraseña inicial y NUEVO código MFA; cambio de contraseña obligatorio.' ELSE N'SOLO REVISION: no se creó la cuenta. Cambie @Apply a 1 para aplicar.' END AS resultado;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK;
 THROW;
END CATCH;
`;
}
