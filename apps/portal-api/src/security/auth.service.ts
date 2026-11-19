import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Database } from '../database.js';
import { active,digest,opaque } from './policy.js';
import { config } from '../config.js';
import argon2 from 'argon2';
import { acceptedCounter,unseal,passwordProblem } from './local-mfa.js';
export interface User {id:string;display_name:string;enabled:boolean;expires_at:Date|null;require_mfa:boolean;must_change_password:boolean;}
@Injectable()
export class AuthService {
 private dummy=argon2.hash(opaque(),{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 constructor(private readonly db:Database){}
 async audit(action:string,result:string,userId:string|null,correlation:string){await this.db.query('INSERT core.audit_events(action,result,user_id,correlation_id) VALUES(@action,@result,@userId,@correlation)',{action,result,userId,correlation});}
 async local(username:string,password:string,correlation:string,otp='',newPassword?:string):Promise<{requiresPasswordChange:true}|{token:string;csrf:string}>{
 if(config.LOCAL_AUTH_ENABLED!=='true')throw new UnauthorizedException('No fue posible autenticar');
 const user=(await this.db.query<User&{password_hash:string;locked_until:Date|null;mfa_secret_cipher:string|null;mfa_last_counter:number|null}>(
 'SELECT u.*, c.password_hash,c.locked_until,c.mfa_secret_cipher,c.mfa_last_counter FROM core.users u JOIN core.local_credentials c ON c.user_id=u.id WHERE c.login=@username',{username})).recordset[0];
 const valid=await argon2.verify(user?.password_hash??await this.dummy,password).catch(()=>false);
 let counter:number|null=null;
 if(user&&valid&&user.require_mfa&&user.mfa_secret_cipher){try{counter=acceptedCounter(unseal(user.mfa_secret_cipher,user.id,config.MFA_ENCRYPTION_KEY),otp,user.mfa_last_counter===null?null:Number(user.mfa_last_counter));}catch{counter=null;}}
 if(!user||!valid||!active(user)||(user.require_mfa&&counter===null)||(user.locked_until&&new Date(user.locked_until)>new Date())){
 if(user)await this.db.query('UPDATE core.local_credentials SET failed_attempts=failed_attempts+1,locked_until=CASE WHEN failed_attempts>=4 THEN DATEADD(minute,15,SYSUTCDATETIME()) ELSE locked_until END WHERE user_id=@id',{id:user.id});
 await this.audit('AUTH.LOGIN','DENIED',user?.id??null,correlation);throw new UnauthorizedException('No fue posible autenticar');}
 if(user.must_change_password&&!newPassword)return {requiresPasswordChange:true};
 let replacement:string|null=null;
 if(user.must_change_password){if(!newPassword||passwordProblem(newPassword,username)||newPassword===password)throw new UnauthorizedException('La nueva contraseña no cumple la política o coincide con la inicial');replacement=await argon2.hash(newPassword,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});}
 const token=opaque(),csrf=opaque();
 const result=await this.db.query<{accepted:number}>(`SET XACT_ABORT ON; BEGIN TRANSACTION;
 UPDATE c WITH(UPDLOCK) SET mfa_last_counter=COALESCE(@counter,c.mfa_last_counter),password_hash=COALESCE(@replacement,c.password_hash),failed_attempts=0,locked_until=NULL
 FROM core.local_credentials c JOIN core.users u WITH(UPDLOCK,HOLDLOCK) ON u.id=c.user_id
 WHERE c.user_id=@id AND c.password_hash=@oldHash AND u.enabled=1 AND (u.expires_at IS NULL OR u.expires_at>SYSUTCDATETIME())
 AND (c.locked_until IS NULL OR c.locked_until<=SYSUTCDATETIME())
 AND (u.must_change_password=0 OR @replacement IS NOT NULL)
 AND (u.require_mfa=0 OR (@counter IS NOT NULL AND c.mfa_secret_cipher=@cipher AND (c.mfa_last_counter IS NULL OR c.mfa_last_counter<@counter)));
 IF @@ROWCOUNT<>1 BEGIN ROLLBACK TRANSACTION; SELECT 0 AS accepted; RETURN; END;
 IF @replacement IS NOT NULL BEGIN
 UPDATE core.users SET must_change_password=0 WHERE id=@id;
 UPDATE core.sessions SET revoked_at=SYSUTCDATETIME() WHERE user_id=@id AND revoked_at IS NULL;
 INSERT core.audit_events(action,result,user_id,correlation_id) VALUES('AUTH.PASSWORD_CHANGE','SUCCESS',@id,@correlation);
 END;
 INSERT core.audit_events(action,result,user_id,correlation_id) VALUES('AUTH.LOGIN','SUCCESS',@id,@correlation);
 INSERT core.sessions(token_hash,user_id,csrf_token) VALUES(@hash,@id,@csrf);
 COMMIT TRANSACTION; SELECT 1 AS accepted;`,{id:user.id,counter,replacement,oldHash:user.password_hash,cipher:user.mfa_secret_cipher??null,hash:digest(token),csrf,correlation});
 if(result.recordset[0]?.accepted!==1){await this.audit('AUTH.LOGIN','DENIED',user.id,correlation);throw new UnauthorizedException('No fue posible autenticar');}
 return {token,csrf};
 }
 async corporate(issuer:string,subject:string,mfa:boolean,correlation:string){
 const result=await this.db.query<User>('SELECT u.* FROM core.users u JOIN core.user_identities i ON i.user_id=u.id WHERE i.issuer=@issuer AND i.subject=@subject',{issuer,subject});
 const user=result.recordset[0];if(!user||!active(user)||(user.require_mfa&&!mfa)){await this.audit('AUTH.OIDC','DENIED',user?.id??null,correlation);throw new UnauthorizedException('No fue posible autenticar');}return this.issue(user,correlation);
 }
 private async issue(user:User,correlation:string){const token=opaque(),csrf=opaque();
 await this.db.query(`SET XACT_ABORT ON; BEGIN TRANSACTION; INSERT core.audit_events(action,result,user_id,correlation_id) VALUES('AUTH.LOGIN','SUCCESS',@id,@correlation); INSERT core.sessions(token_hash,user_id,csrf_token) VALUES(@hash,@id,@csrf); COMMIT;`,{id:user.id,hash:digest(token),csrf,correlation});return {token,csrf};}
}
