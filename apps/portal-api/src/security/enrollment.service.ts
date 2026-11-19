import {Injectable,UnauthorizedException,BadRequestException} from '@nestjs/common';
import argon2 from 'argon2';
import {Database} from '../database.js';
import {config} from '../config.js';
import {digest} from './policy.js';
import {unseal,acceptedCounter,passwordProblem} from './local-mfa.js';
interface Invitation {user_id:string;login:string;mfa_secret_cipher:string;}
@Injectable()
export class EnrollmentService {
 constructor(private db:Database){}
 private async invitation(token:string){
 if(config.LOCAL_AUTH_ENABLED!=='true')throw new UnauthorizedException('Activación no disponible.');
 const row=(await this.db.query<Invitation>(`SELECT i.user_id,i.login,i.mfa_secret_cipher FROM core.user_invitations i JOIN core.users u ON u.id=i.user_id WHERE i.token_hash=@hash AND i.consumed_at IS NULL AND i.expires_at>SYSUTCDATETIME() AND i.attempts<5 AND u.enabled=1 AND u.must_change_password=1 AND (u.expires_at IS NULL OR u.expires_at>SYSUTCDATETIME()) AND NOT EXISTS(SELECT 1 FROM core.local_credentials c WHERE c.user_id=i.user_id)`,{hash:digest(token)})).recordset[0];
 if(!row)throw new UnauthorizedException('Código inválido, vencido o cuenta no disponible.');return row;
 }
 async begin(token:string){const row=await this.invitation(token);return {username:row.login,manualKey:unseal(row.mfa_secret_cipher,row.user_id,config.MFA_ENCRYPTION_KEY)};}
 async complete(token:string,password:string,otp:string,correlation:string){
 const row=await this.invitation(token),problem=passwordProblem(password,row.login);if(problem)throw new BadRequestException(problem);
 const counter=acceptedCounter(unseal(row.mfa_secret_cipher,row.user_id,config.MFA_ENCRYPTION_KEY),otp,null);
 if(counter===null){await this.db.query(`SET XACT_ABORT ON; BEGIN TRANSACTION;
 UPDATE core.user_invitations SET attempts=attempts+1 WHERE token_hash=@hash AND consumed_at IS NULL AND attempts<5;
 INSERT core.audit_events(user_id,action,result,correlation_id) VALUES(@id,'USER.ACTIVATE','DENIED',@correlation); COMMIT;`,{hash:digest(token),id:row.user_id,correlation});throw new UnauthorizedException('El código del autenticador no es válido.');}
 const passwordHash=await argon2.hash(password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 const result=await this.db.query<{accepted:number}>(`SET XACT_ABORT ON; BEGIN TRANSACTION;
 DECLARE @lock int; EXEC @lock=sys.sp_getapplock @Resource='hub_security_admin',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
 IF @lock<0 BEGIN ROLLBACK; THROW 51400,'No se pudo bloquear la activacion.',1; END;
 UPDATE i WITH(UPDLOCK) SET consumed_at=SYSUTCDATETIME(),mfa_secret_cipher=''
 FROM core.user_invitations i JOIN core.users u WITH(UPDLOCK,HOLDLOCK) ON u.id=i.user_id
 WHERE i.user_id=@id AND i.token_hash=@hash AND i.mfa_secret_cipher=@cipher AND i.consumed_at IS NULL AND i.expires_at>SYSUTCDATETIME() AND i.attempts<5 AND u.enabled=1 AND u.must_change_password=1 AND (u.expires_at IS NULL OR u.expires_at>SYSUTCDATETIME()) AND NOT EXISTS(SELECT 1 FROM core.local_credentials c WHERE c.user_id=i.user_id);
 IF @@ROWCOUNT<>1 BEGIN ROLLBACK; SELECT 0 AS accepted; RETURN; END;
 INSERT core.local_credentials(user_id,login,password_hash,mfa_secret_cipher,mfa_last_counter) VALUES(@id,@login,@passwordHash,@cipher,@counter);
 UPDATE core.users SET must_change_password=0,security_version=security_version+1 WHERE id=@id;
 INSERT core.audit_events(user_id,action,result,correlation_id,resource_type,resource_id,details) VALUES(@id,'USER.ACTIVATE','SUCCESS',@correlation,'user',@id,N'{}');
 COMMIT; SELECT 1 AS accepted;`,{id:row.user_id,login:row.login,hash:digest(token),cipher:row.mfa_secret_cipher,passwordHash,counter,correlation});
 if(result.recordset[0]?.accepted!==1)throw new UnauthorizedException('La activación ya no está disponible.');return {ok:true};
 }
}
