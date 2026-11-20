import { inspectPackage } from '../business/package.js';
import { config } from '../config.js';
import { builtin,builtinHash,descriptor,validateDescriptor } from '../business/registry.js';
import { BadRequestException } from '@nestjs/common';
import { opaque,digest } from '../security/policy.js';
import { newMfaSecret,seal } from '../security/local-mfa.js';
import { Injectable,ForbiddenException,ConflictException,NotFoundException,UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type sql from 'mssql';
import { Database } from '../database.js';
import type { SessionRequest } from '../security/guard.js';
import { live,active } from '../security/policy.js';
import { effective,rolePolicy,roleRecipientsPolicy,userPolicy,preserveAdministrator,PolicyDenied,type SecurityState,type Role,type ManagedUser } from './policy.js';
type Query=<T=Record<string,unknown>>(text:string,params?:Record<string,unknown>)=>Promise<sql.IResult<T>>;
export interface RoleInput {code?:string;name:string;description:string;enabled:boolean;version?:number;reason:string;}
@Injectable()
export class AdminService {
 constructor(private db:Database){}
 async package(req:SessionRequest,input:{archive:string;reason:string},install=false){
  let report;try{report=inspectPackage(input.archive);}catch{throw new BadRequestException('Paquete rechazado: usa el ZIP de módulo incluido, con manifest.json sin archivos adicionales (máximo 8 KB). Los paquetes con código nuevo requieren un instalador todavía no disponible.');}
  if(install)return this.manageModule(req,{action:'install',manifest:JSON.stringify(report.manifest),reason:input.reason});
  await this.mutate(req,'CORE.MODULES.MANAGE','MODULE.ANALYZE','module',randomUUID(),input.reason,async()=>({before:null,after:{sha256:report.sha256,code:report.manifest.id,version:report.manifest.version}}));
  return report;
 }
 async moduleList(req:SessionRequest){
  await this.unscoped(this.db.query.bind(this.db),req.user.id);
  const installed=(await this.db.query(`SELECT m.id,m.code,m.name,m.enabled,v.version,i.state,i.id AS installation_id FROM core.modules m JOIN core.module_versions v ON v.module_id=m.id JOIN core.module_installations i ON i.version_id=v.id WHERE m.code=@code ORDER BY i.created_at DESC`,{code:builtin.id})).recordset;
  return {available:descriptor,installed};
 }
 async manageModule(req:SessionRequest,input:{action:'install'|'publish'|'disable';manifest?:string;reason:string}){
  if(input.action==='install'){try{validateDescriptor(JSON.parse(input.manifest??''));}catch{throw new BadRequestException('El manifiesto no corresponde a un módulo incluido en esta versión del Hub.');}}
  const id=randomUUID();
  return this.mutate(req,'CORE.MODULES.MANAGE','MODULE.'+input.action.toUpperCase(),'module',id,input.reason,async(q)=>{
   const current=(await q<{id:string;installation_id:string;state:string}>(`SELECT m.id,i.id AS installation_id,i.state FROM core.modules m JOIN core.module_versions v ON v.module_id=m.id JOIN core.module_installations i ON i.version_id=v.id WHERE m.code=@code AND v.version=@version`,{code:builtin.id,version:builtin.version})).recordset[0];
   if(input.action==='install'){
    if(current||(await q('SELECT id FROM core.modules WHERE code=@code',{code:builtin.id})).recordset.length)throw new ConflictException('El módulo ya está instalado. Recarga la lista.');
    const versionId=randomUUID(),installationId=randomUUID();
    await q('INSERT core.modules(id,code,name,enabled) VALUES(@id,@code,@name,0)',{id,code:builtin.id,name:builtin.name});
    await q('INSERT core.module_versions(id,module_id,version,manifest,artifact_sha256) VALUES(@id,@module,@version,@manifest,@hash)',{id:versionId,module:id,version:builtin.version,manifest:JSON.stringify(descriptor),hash:builtinHash});
    await q("INSERT core.module_installations(id,version_id,requested_by,state) VALUES(@id,@version,@actor,'VALIDATED')",{id:installationId,version:versionId,actor:req.user.id});
    await q('INSERT core.application_catalog(module_id,name,description,route,required_permission,published) VALUES(@module,@name,@description,@route,@permission,0)',{module:id,name:builtin.name,description:builtin.description,route:builtin.route,permission:builtin.permission});
    return {before:null,after:{moduleId:id,code:builtin.id,version:builtin.version,state:'VALIDATED',source:'builtin'}};
   }
   if(!current)throw new NotFoundException('Primero importa el manifiesto del módulo.');
   const enabled=input.action==='publish';
   if(enabled?!['VALIDATED','DISABLED'].includes(current.state):current.state!=='PUBLISHED')throw new ConflictException('El estado cambió o la operación ya se realizó. Recarga la lista.');
   await q('UPDATE core.modules SET enabled=@enabled WHERE id=@id',{enabled,id:current.id});
   await q('UPDATE core.application_catalog SET published=@enabled WHERE module_id=@id',{enabled,id:current.id});
   await q('UPDATE core.module_installations SET state=@state WHERE id=@id',{state:enabled?'PUBLISHED':'DISABLED',id:current.installation_id});
   return {resourceId:current.id,before:current,after:{moduleId:current.id,code:builtin.id,state:enabled?'PUBLISHED':'DISABLED'}};
  });
 }
 private async snapshot(q:Query):Promise<SecurityState>{
 const roles=(await q<Omit<Role,'permissions'>>('SELECT id,code,name,description,enabled,version FROM core.roles ORDER BY name')).recordset;
 const permissions=(await q<{id:string;code:string}>('SELECT id,code FROM core.permissions ORDER BY code')).recordset;
 const rp=(await q<{role_id:string;code:string}>('SELECT rp.role_id,p.code FROM core.role_permissions rp JOIN core.permissions p ON p.id=rp.permission_id')).recordset;
 const users=(await q<Omit<ManagedUser,'roles'>>('SELECT u.id,u.display_name,u.enabled,u.expires_at,u.require_mfa,u.must_change_password,u.security_version,COALESCE(c.login,i.login) AS login,CASE WHEN i.user_id IS NOT NULL AND i.consumed_at IS NULL THEN 1 ELSE 0 END AS activation_pending,i.expires_at AS invitation_expires_at FROM core.users u LEFT JOIN core.local_credentials c ON c.user_id=u.id LEFT JOIN core.user_invitations i ON i.user_id=u.id ORDER BY u.display_name')).recordset;
 const ur=(await q<{user_id:string;role_id:string}>('SELECT user_id,role_id FROM core.user_roles')).recordset;
 return {roles:roles.map(r=>({...r,permissions:rp.filter(p=>p.role_id===r.id).map(p=>p.code)})),permissions:permissions.map(p=>p.code),users:users.map(u=>({...u,roles:ur.filter(r=>r.user_id===u.id).map(r=>r.role_id)}))};
 }
 private async unscoped(q:Query,id:string){if((await q('SELECT TOP(1) user_id FROM core.user_scopes WHERE user_id=@id',{id})).recordset.length)throw new ForbiddenException('Esta administración global requiere una cuenta sin restricciones de alcance.');}
 async read(req:SessionRequest,kind:'roles'|'users'){const q:Query=this.db.query.bind(this.db);await this.unscoped(q,req.user.id);const s=await this.snapshot(q);return kind==='roles'?{roles:s.roles,permissions:s.permissions,ownRoleIds:s.users.find(u=>u.id===req.user.id)?.roles??[]}:{users:s.users,roles:s.roles};}
 private async mutate(req:SessionRequest,permission:string,action:string,resourceType:string,resourceId:string,reason:string,apply:(q:Query,s:SecurityState)=>Promise<{before:unknown;after:unknown;resourceId?:string}>){
 const tx=(await this.db.connect()).transaction();await tx.begin();
 const q:Query=async <T>(text:string,params:Record<string,unknown>={})=>{const request=tx.request();for(const [key,value]of Object.entries(params))request.input(key,value);return request.query<T>(text);};
 try {
 await q("DECLARE @result int; EXEC @result=sys.sp_getapplock @Resource='hub_security_admin',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000; IF @result<0 THROW 51200,'No se pudo bloquear la administración.',1;");
 const session=(await q<{created_at:Date;last_seen_at:Date;revoked_at:Date|null}>("SELECT created_at,last_seen_at,revoked_at FROM core.sessions WITH(UPDLOCK,HOLDLOCK) WHERE token_hash=@hash AND user_id=@id",{hash:req.sessionHash,id:req.user.id})).recordset[0];
 const s=await this.snapshot(q),actor=s.users.find(u=>u.id===req.user.id);
 if(!session||!live(session)||!actor||!active(actor)||actor.must_change_password)throw new UnauthorizedException();
 if(!actor.require_mfa||Date.now()-+new Date(session.created_at)>900000)throw new ForbiddenException('Para modificar seguridad, vuelve a iniciar sesión con MFA (máximo 15 minutos).');
 await this.unscoped(q,actor.id);
 if(!effective(s,actor.id).includes(permission))throw new ForbiddenException('No tienes permiso para esta acción.');
 const change=await apply(q,s);preserveAdministrator(s);
 await q('INSERT core.audit_events(user_id,action,result,correlation_id,resource_type,resource_id,details) VALUES(@actor,@action,\'SUCCESS\',@correlation,@type,@id,@details)',{actor:actor.id,action,correlation:req.correlation,type:resourceType,id:change.resourceId??resourceId,details:JSON.stringify({reason,...change})});
 await tx.commit();return {ok:true,id:change.resourceId??resourceId};
 }catch(error){await tx.rollback().catch(()=>{});if(error instanceof PolicyDenied||error instanceof ForbiddenException){await this.db.query('INSERT core.audit_events(user_id,action,result,correlation_id,resource_type,resource_id,details) VALUES(@actor,@action,\'DENIED\',@correlation,@type,@id,@details)',{actor:req.user.id,action,correlation:req.correlation,type:resourceType,id:resourceId,details:JSON.stringify({message:error.message})});if(error instanceof PolicyDenied)throw new ForbiddenException(error.message);}throw error;}
 }
 async saveRole(req:SessionRequest,id:string|undefined,input:RoleInput){const resourceId=id??randomUUID();return this.mutate(req,'CORE.ROLES.MANAGE',id?'ROLE.UPDATE':'ROLE.CREATE','role',resourceId,input.reason,async(q,s)=>{
 const old=id?s.roles.find(r=>r.id===id):undefined;if(id&&!old)throw new NotFoundException();if(old&&old.version!==input.version)throw new ConflictException('El rol cambió. Recarga antes de guardar.');
 if(!id&&s.roles.some(r=>r.code.toUpperCase()===input.code?.toUpperCase()))throw new ConflictException('El código del rol ya existe.');
 const next:Role={id:resourceId,code:old?.code??input.code!,name:input.name,description:input.description,enabled:input.enabled,version:(old?.version??0)+1,permissions:old?.permissions??[]};rolePolicy(s,req.user.id,old,next);roleRecipientsPolicy(s,req.user.id,next);
 if(old){await q('UPDATE core.roles SET name=@name,description=@description,enabled=@enabled,version=version+1 WHERE id=@id',{id:resourceId,name:next.name,description:next.description,enabled:next.enabled});s.roles=s.roles.map(r=>r.id===resourceId?next:r);if(old.enabled!==next.enabled)await q('UPDATE core.sessions SET revoked_at=SYSUTCDATETIME() WHERE user_id IN(SELECT user_id FROM core.user_roles WHERE role_id=@id) AND revoked_at IS NULL',{id:resourceId});}
 else{await q('INSERT core.roles(id,code,name,description,enabled) VALUES(@id,@code,@name,@description,@enabled)',{id:resourceId,code:next.code,name:next.name,description:next.description,enabled:next.enabled});s.roles.push(next);}
 return {before:old??null,after:next};});}
 async permissions(req:SessionRequest,id:string,codes:string[],version:number,reason:string){return this.mutate(req,'CORE.PERMISSIONS.ASSIGN','ROLE.PERMISSIONS','role',id,reason,async(q,s)=>{const old=s.roles.find(r=>r.id===id);if(!old)throw new NotFoundException();if(old.version!==version)throw new ConflictException('El rol cambió. Recarga antes de guardar.');if(codes.some(c=>!s.permissions.includes(c)))throw new ForbiddenException('Permiso no registrado.');const next={...old,permissions:codes,version:old.version+1};rolePolicy(s,req.user.id,old,next);roleRecipientsPolicy(s,req.user.id,next);
 const after={...s,roles:s.roles.map(r=>r.id===id?next:r)};
 
 await q('DELETE core.role_permissions WHERE role_id=@id',{id});for(const code of codes)await q('INSERT core.role_permissions(role_id,permission_id) SELECT @id,id FROM core.permissions WHERE code=@code',{id,code});await q('UPDATE core.roles SET version=version+1 WHERE id=@id',{id});await q('UPDATE core.sessions SET revoked_at=SYSUTCDATETIME() WHERE user_id IN(SELECT user_id FROM core.user_roles WHERE role_id=@id) AND revoked_at IS NULL',{id});s.roles=after.roles;return {before:old,after:next};});}
 async user(req:SessionRequest,id:string,version:number,reason:string,change:{enabled?:boolean;roles?:string[]}){const permission=change.roles?'CORE.USERS.ROLES_ASSIGN':change.enabled?'CORE.USERS.UPDATE':'CORE.USERS.DISABLE';return this.mutate(req,permission,change.roles?'USER.ROLES':'USER.STATUS','user',id,reason,async(q,s)=>{const old=s.users.find(u=>u.id===id);if(!old)throw new NotFoundException();if(old.security_version!==version)throw new ConflictException('El usuario cambió. Recarga antes de guardar.');const next={...old,...change,security_version:old.security_version+1};userPolicy(s,req.user.id,old,next);
 if(change.roles){await q('DELETE core.user_roles WHERE user_id=@id',{id});for(const role of change.roles)await q('INSERT core.user_roles(user_id,role_id) VALUES(@id,@role)',{id,role});}
 await q('UPDATE core.users SET enabled=@enabled,security_version=security_version+1 WHERE id=@id',{id,enabled:next.enabled});await q('UPDATE core.sessions SET revoked_at=SYSUTCDATETIME() WHERE user_id=@id AND revoked_at IS NULL',{id});s.users=s.users.map(u=>u.id===id?next:u);return {before:old,after:next};});}

 async createUser(req:SessionRequest,input:{username:string;name:string;roles:string[];reason:string}){
 if(config.LOCAL_AUTH_ENABLED!=='true')throw new ForbiddenException('El acceso local no está habilitado.');
 const id=randomUUID(),token=opaque(),cipher=seal(newMfaSecret(),id,config.MFA_ENCRYPTION_KEY);
 await this.mutate(req,'CORE.USERS.CREATE','USER.CREATE','user',id,input.reason,async(q,s)=>{
 if(input.roles.length&&!effective(s,req.user.id).includes('CORE.USERS.ROLES_ASSIGN'))throw new ForbiddenException('No tienes permiso para asignar roles.');
 if((await q('SELECT login FROM core.local_credentials WHERE login=@login UNION ALL SELECT login FROM core.user_invitations WHERE login=@login',{login:input.username})).recordset.length)throw new ConflictException('El usuario ya existe.');
 const next:ManagedUser={id,display_name:input.name,enabled:true,expires_at:null,require_mfa:true,must_change_password:true,security_version:1,roles:input.roles,login:input.username};
 const base={...next,roles:[]};const pending={...s,users:[...s.users,base]};userPolicy(pending,req.user.id,base,next);
 await q('INSERT core.users(id,display_name,enabled,require_mfa,must_change_password) VALUES(@id,@name,1,1,1)',{id,name:input.name});
 for(const role of input.roles)await q('INSERT core.user_roles(user_id,role_id) VALUES(@id,@role)',{id,role});
 await q('INSERT core.user_invitations(user_id,login,token_hash,mfa_secret_cipher,expires_at) VALUES(@id,@login,@hash,@cipher,DATEADD(hour,24,SYSUTCDATETIME()))',{id,login:input.username,hash:digest(token),cipher});
 s.users.push(next);return {before:null,after:{...next,activation_pending:true}};
 });return {id,username:input.username,activationCode:token,expiresInHours:24};
 }
 async renewInvitation(req:SessionRequest,id:string,version:number,reason:string){
 const token=opaque(),cipher=seal(newMfaSecret(),id,config.MFA_ENCRYPTION_KEY);
 await this.mutate(req,'CORE.USERS.CREATE','USER.INVITATION_RENEW','user',id,reason,async(q,s)=>{
 const user=s.users.find(u=>u.id===id);if(!user)throw new NotFoundException();if(user.security_version!==version)throw new ConflictException('El usuario cambió. Recarga antes de continuar.');userPolicy(s,req.user.id,user,user);
 const result=await q('UPDATE i SET token_hash=@hash,mfa_secret_cipher=@cipher,expires_at=DATEADD(hour,24,SYSUTCDATETIME()),attempts=0 FROM core.user_invitations i JOIN core.users u ON u.id=i.user_id WHERE i.user_id=@id AND i.consumed_at IS NULL AND u.enabled=1 AND NOT EXISTS(SELECT 1 FROM core.local_credentials c WHERE c.user_id=i.user_id); SELECT @@ROWCOUNT AS changed',{id,hash:digest(token),cipher});
 if(result.recordset[0]?.['changed']!==1)throw new ConflictException('La cuenta ya fue activada o está deshabilitada.');
 await q('UPDATE core.users SET security_version=security_version+1 WHERE id=@id',{id});
 return {before:{activation_pending:true},after:{activation_pending:true,invitationRenewed:true}};
 });return {id,activationCode:token,expiresInHours:24};
 }
}
