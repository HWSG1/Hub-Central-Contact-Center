import {Body,Controller,Get,Param,Post,Req,ForbiddenException,BadRequestException,ServiceUnavailableException} from '@nestjs/common';
import {Database} from '../database.js';
import type {SessionRequest} from '../security/guard.js';
import {inspectFullPackage} from './archive.js';
import {executeBackend} from './runner.js';
import {compileQuery,compileInsert} from './query.js';
@Controller('extensions')
export class PackageRuntimeController {
 constructor(private db:Database){}
 private async authorize(req:SessionRequest,code:string){
  if(!/^[A-Z][A-Z0-9_]{2,39}$/.test(code)||!req.permissions.includes(code+'.USE'))throw new ForbiddenException();
  const row=(await this.db.query<{archive:Buffer;artifact_sha256:string}>(`SELECT p.archive,v.artifact_sha256 FROM core.modules m JOIN core.module_versions v ON v.module_id=m.id JOIN core.module_packages p ON p.version_id=v.id JOIN core.module_installations i ON i.version_id=v.id JOIN core.application_catalog a ON a.module_id=m.id WHERE m.code=@code AND m.enabled=1 AND a.published=1 AND i.state='PUBLISHED' AND a.required_permission=@permission AND NOT EXISTS(SELECT 1 FROM core.user_scopes WHERE user_id=@user) AND EXISTS(SELECT 1 FROM core.users u JOIN core.sessions s ON s.user_id=u.id WHERE u.id=@user AND u.enabled=1 AND u.must_change_password=0 AND (u.expires_at IS NULL OR u.expires_at>SYSUTCDATETIME()) AND s.token_hash=@session AND s.revoked_at IS NULL AND s.last_seen_at>DATEADD(minute,-15,SYSUTCDATETIME()) AND s.created_at>DATEADD(hour,-8,SYSUTCDATETIME())) AND EXISTS(SELECT 1 FROM core.permissions p JOIN core.role_permissions rp ON rp.permission_id=p.id JOIN core.roles r ON r.id=rp.role_id AND r.enabled=1 JOIN core.user_roles ur ON ur.role_id=r.id WHERE ur.user_id=@user AND p.code=@permission)`,{code,permission:code+'.USE',user:req.user.id,session:req.sessionHash})).recordset[0];
  if(!row)throw new ForbiddenException('El módulo no está publicado o su alcance no está autorizado.');
  const pkg=inspectFullPackage(row.archive.toString('base64'));
  if(pkg.manifest.id!==code||pkg.sha256!==row.artifact_sha256)throw new ForbiddenException('Paquete alterado.');
  return pkg;
 }
 @Get(':code/ui') async ui(@Req() req:SessionRequest,@Param('code') code:string){
  const pkg=await this.authorize(req,code);return {name:pkg.manifest.name,html:Buffer.from(pkg.files['frontend/index.html']).toString('utf8')};
 }
 @Post(':code/run') async run(@Req() req:SessionRequest,@Param('code') code:string,@Body() body:unknown){
  const pkg=await this.authorize(req,code);
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['operation','input'].includes(k)))throw new BadRequestException();
  const {operation,input}=body as {operation:string;input:unknown};
  if(!pkg.manifest.operations.includes(operation)||JSON.stringify(input??null).length>16384)throw new BadRequestException('Operación inválida.');
  try{
   const result=await executeBackend(pkg.files['backend/main.mjs'],operation,input,async(name,params,mode)=>{
    // Recheck authorization before every brokered operation. Identity comes from the server session.
    await this.authorize(req,code);
    const query=mode==='write'?compileInsert(code,pkg.queries,name,params,req.user.id):compileQuery(code,pkg.queries,name,params,req.user.id);
    return (await this.db.query(query.sql,query.params)).recordset;
   });
   await this.authorize(req,code);
   await this.db.query("INSERT core.audit_events(user_id,action,result,correlation_id,resource_type,details) VALUES(@actor,'MODULE.EXECUTE','SUCCESS',@correlation,'module',@details)",{actor:req.user.id,correlation:req.correlation,details:JSON.stringify({code,operation})});return {result};
  }catch{throw new ServiceUnavailableException('No se pudo ejecutar el módulo. Revisa sus parámetros y la configuración del ejecutor.');}
 }
}
