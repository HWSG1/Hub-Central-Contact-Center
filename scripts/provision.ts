import 'reflect-metadata';
import { Database } from '../apps/portal-api/src/database.js';
import { config } from '../apps/portal-api/src/config.js';
import { randomUUID } from 'node:crypto';
const [issuer,subject,name]=process.argv.slice(2);
if(!issuer||!subject||!name||issuer!==config.OIDC_ISSUER)throw Error('Uso: npm run admin:provision -- issuer subject "Nombre". Debe coincidir con OIDC_ISSUER.');
const db=new Database();
try{await db.query(`SET XACT_ABORT ON; BEGIN TRANSACTION;
EXEC sp_getapplock @Resource='hub_bootstrap',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
IF EXISTS(SELECT 1 FROM core.system_settings WITH(UPDLOCK,HOLDLOCK) WHERE name='bootstrap_complete') THROW 50001,'Aprovisionamiento inicial ya completado',1;
DECLARE @id uniqueidentifier=NEWID();
INSERT core.users(id,display_name,require_mfa) VALUES(@id,@name,1);
INSERT core.user_identities(user_id,issuer,subject) VALUES(@id,@issuer,@subject);
INSERT core.user_roles(user_id,role_id) SELECT @id,id FROM core.roles WHERE code='PLATFORM_ADMIN';
INSERT core.audit_events(user_id,action,result,correlation_id) VALUES(@id,'ADMIN.PROVISION','SUCCESS',@correlation);
INSERT core.system_settings(name,value) VALUES('bootstrap_complete','true'); COMMIT;`,{issuer,subject,name,correlation:randomUUID()});console.log('Identidad corporativa inicial aprovisionada; requiere MFA del IdP.');}finally{await db.onModuleDestroy();}
