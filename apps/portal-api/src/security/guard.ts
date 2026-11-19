import { CanActivate,ExecutionContext,Injectable,SetMetadata,UnauthorizedException,ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Database } from '../database.js';
import { AuthService,User } from './auth.service.js';
import { active,digest,live,same } from './policy.js';
import { config } from '../config.js';
export const Public=()=>SetMetadata('public',true);
export const Permission=(p:string)=>SetMetadata('permission',p);
export interface SessionRequest extends Request {user:User;sessionHash:string;csrf:string;correlation:string;permissions:string[];}
@Injectable()
export class SessionGuard implements CanActivate {
 constructor(private reflector:Reflector,private db:Database,private auth:AuthService){}
 async canActivate(context:ExecutionContext){
 if(this.reflector.getAllAndOverride<boolean>('public',[context.getHandler(),context.getClass()]))return true;
 const req=context.switchToHttp().getRequest<SessionRequest>();const token=req.cookies?.['hub_session'];
 if(typeof token!=='string'||token.length!==43)throw new UnauthorizedException();
 const hash=digest(token);const row=(await this.db.query<User&{csrf_token:string;created_at:Date;last_seen_at:Date;revoked_at:Date|null}>('SELECT u.id,u.display_name,u.enabled,u.expires_at,u.require_mfa,u.must_change_password,s.csrf_token,s.created_at,s.last_seen_at,s.revoked_at FROM core.sessions s JOIN core.users u ON u.id=s.user_id WHERE s.token_hash=@hash',{hash})).recordset[0];
 if(!row||!active(row)||row.must_change_password||!live(row))throw new UnauthorizedException();
 const permissions=(await this.db.query<{code:string}>('SELECT DISTINCT p.code FROM core.permissions p JOIN core.role_permissions rp ON rp.permission_id=p.id JOIN core.roles role ON role.id=rp.role_id AND role.enabled=1 JOIN core.user_roles ur ON ur.role_id=rp.role_id WHERE ur.user_id=@id',{id:row.id})).recordset.map(p=>p.code);
 const required=this.reflector.getAllAndOverride<string>('permission',[context.getHandler(),context.getClass()]);
 if((required&&!permissions.includes(required))||(!['GET','HEAD','OPTIONS'].includes(req.method)&&(req.get('origin')!==config.APP_ORIGIN||!same(req.get('x-csrf-token'),row.csrf_token)))){await this.auth.audit('ACCESS.DENIED','DENIED',row.id,req.correlation);throw new ForbiddenException();}
 const touched=await this.db.query('UPDATE core.sessions SET last_seen_at=SYSUTCDATETIME() WHERE token_hash=@hash AND revoked_at IS NULL',{hash});if(touched.rowsAffected[0]!==1)throw new UnauthorizedException();
 req.user=row;req.sessionHash=hash;req.csrf=row.csrf_token;req.permissions=permissions;return true;
 }
}
