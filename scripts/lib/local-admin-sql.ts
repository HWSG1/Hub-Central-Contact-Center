import { createHash } from 'node:crypto';
export const literal=(value:string)=>"N'"+value.replaceAll("'","''")+"'";
export interface AdminPlan {machine:string;id:string;username:string;name:string;passwordHash:string;cipher:string;counter:number;correlation:string;coreMigration:string;mfaMigration:string;}
export function localAdminSql(p:AdminPlan){
 if(!Number.isSafeInteger(p.counter)||p.counter<0)throw Error('Contador MFA inválido');
 const coreHash=createHash('sha256').update(p.coreMigration).digest('hex'),mfaHash=createHash('sha256').update(p.mfaMigration).digest('hex');
 const inner=`USE [ContactCenterHub_Dev]; SET XACT_ABORT ON;
 BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @lock int;
 EXEC @lock=sys.sp_getapplock @Resource='hub_migrate',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
 IF @lock<0 THROW 51100,'No se obtuvo bloqueo de migraciones.',1;
 EXEC @lock=sys.sp_getapplock @Resource='hub_bootstrap',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
 IF @lock<0 THROW 51101,'No se obtuvo bloqueo de inicializacion.',1;
 IF OBJECT_ID('dbo.hub_migrations') IS NULL THROW 51102,'Ejecute primero Install-Local.sql.',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name='001_core.sql' AND sha256='${coreHash}') THROW 51103,'La migracion inicial no coincide.',1;
 IF EXISTS(SELECT 1 FROM core.system_settings WHERE name='bootstrap_complete') OR EXISTS(SELECT 1 FROM core.user_roles ur JOIN core.roles r ON r.id=ur.role_id WHERE r.code='PLATFORM_ADMIN') THROW 51104,'Ya existe una inicializacion o administrador. No se permite repetir el alta inicial.',1;
 IF NOT EXISTS(SELECT 1 FROM core.roles WHERE code='PLATFORM_ADMIN') THROW 51105,'Falta el rol inicial.',1;
 IF EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name='002_local_mfa.sql' AND sha256<>'${mfaHash}') THROW 51106,'La migracion MFA no coincide.',1;
 IF NOT EXISTS(SELECT 1 FROM dbo.hub_migrations WHERE name='002_local_mfa.sql') BEGIN
 ${p.mfaMigration.split(/^GO\s*$/mi).filter(s=>s.trim()).map(s=>'EXEC sys.sp_executesql '+literal(s)+';').join('\n')}
 INSERT dbo.hub_migrations(name,sha256) VALUES('002_local_mfa.sql','${mfaHash}');
 END;
 EXEC sys.sp_executesql ${literal(`INSERT core.users(id,display_name,require_mfa,must_change_password) VALUES(@id,@name,1,1);
 INSERT core.local_credentials(user_id,login,password_hash,mfa_secret_cipher,mfa_last_counter) VALUES(@id,@username,@hash,@cipher,@counter);
 INSERT core.user_roles(user_id,role_id) SELECT @id,id FROM core.roles WHERE code='PLATFORM_ADMIN';
 INSERT core.audit_events(user_id,action,result,correlation_id) VALUES(@id,'ADMIN.LOCAL_PROVISION','SUCCESS',@correlation);
 INSERT core.system_settings(name,value) VALUES('bootstrap_complete','true');`)},
 N'@id uniqueidentifier,@name nvarchar(120),@username nvarchar(128),@hash varchar(512),@cipher nvarchar(512),@counter bigint,@correlation varchar(64)',
 @id=${literal(p.id)},@name=${literal(p.name)},@username=${literal(p.username)},@hash=${literal(p.passwordHash)},@cipher=${literal(p.cipher)},@counter=${p.counter},@correlation=${literal(p.correlation)};
 COMMIT; PRINT N'ADMINISTRADOR LOCAL CREADO. Reinicie la API y use contraseña inicial + un nuevo código MFA. Se exigirá cambio de contraseña.';
 END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK; THROW; END CATCH;`;
 return `-- PRIVADO: alta inicial local. No publicar ni enviar por correo. Ejecutar completo en SSMS.
 SET NOCOUNT ON;
 IF COALESCE(CONVERT(nvarchar(128),SERVERPROPERTY('MachineName')),N'')<>${literal(p.machine)} OR COALESCE(CONVERT(nvarchar(128),SERVERPROPERTY('InstanceName')),N'')<>N'SQLEXPRESS01' THROW 51110,'Servidor local incorrecto.',1;
 IF @@TRANCOUNT<>0 THROW 51111,'Ejecutar fuera de una transaccion existente.',1;
 IF DB_ID('ContactCenterHub_Dev') IS NULL THROW 51112,'Ejecute primero Install-Local.sql.',1;
 EXEC sys.sp_executesql ${literal(inner)};
`;
}
