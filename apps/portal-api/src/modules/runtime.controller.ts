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
  const row=(await this.db.query<{archive:Buffer;artifact_sha256:string}>(`SELECT p.archive,v.artifact_sha256 FROM core.modules m JOIN core.module_versions v ON v.module_id=m.id JOIN core.module_packages p ON p.version_id=v.id JOIN core.module_installations i ON i.version_id=v.id JOIN core.application_catalog a ON a.module_id=m.id WHERE m.code=@code AND m.enabled=1 AND a.published=1 AND i.state='PUBLISHED' AND a.required_permission=@permission AND NOT EXISTS(SELECT 1 FROM core.user_scopes WHERE user_id=@user) AND EXISTS(SELECT 1 FROM core.users u JOIN core.sessions s ON s.user_id=u.id WHERE u.id=@user AND u.enabled=1 AND u.must_change_password=0 AND (u.expires_at IS NULL OR u.expires_at>SYSUTCDATETIME()) AND s.token_hash=@session AND s.revoked_at IS NULL AND s.last_seen_at>DATEADD(minute,-15,SYSUTCDATETIME()) AND s.created_at>DATEADD(hour,-12,SYSUTCDATETIME())) AND EXISTS(SELECT 1 FROM core.permissions p JOIN core.role_permissions rp ON rp.permission_id=p.id JOIN core.roles r ON r.id=rp.role_id AND r.enabled=1 JOIN core.user_roles ur ON ur.role_id=r.id WHERE ur.user_id=@user AND p.code=@permission)`,{code,permission:code+'.USE',user:req.user.id,session:req.sessionHash})).recordset[0];
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
   // Código de respuesta administrado en SQL tiene prioridad sobre el catálogo estático del ZIP.
   // Si la ampliación 013 aún no existe, conservar compatibilidad con el paquete firmado anterior.
   if(code==='MONITOREO_TC'&&operation==='buscar'&&result&&typeof result==='object'&&
      Array.isArray((result as {registros?:unknown}).registros)){
     try{
       const data=(result as {registros:Record<string,unknown>[]});
       const rows=(await this.db.query<{codigo:string;descripcion:string;accion:string}>(`
         SELECT codigo,descripcion,accion FROM mod_monitoreo_tc.codigos_respuesta
         WHERE activo=1`)).recordset;
       const codes=new Map(rows.map(row=>[row.codigo.toUpperCase(),row]));
       data.registros=data.registros.map(row=>{
          const raw=String(row.respuesta_codigo??'').trim().toUpperCase();
          const normalized=/^[0-9]$/.test(raw)?'0'+raw:raw;
          const item=codes.get(normalized);
          return {...row,descripcion_respuesta:item?.descripcion??'Código sin descripción registrada',
            accion_respuesta:item?.accion??null};
       });
     }catch{ /* Una instalación anterior puede carecer de permiso SELECT. */ }
   }
   await this.authorize(req,code);
   await this.db.query("INSERT core.audit_events(user_id,action,result,correlation_id,resource_type,details) VALUES(@actor,'MODULE.EXECUTE','SUCCESS',@correlation,'module',@details)",{actor:req.user.id,correlation:req.correlation,details:JSON.stringify({code,operation})});return {result};
  }catch(error){
   const safe=['El certificado debe contener exactamente 9 dígitos.','Tipo de venta inválido.','Tipo de desembolso inválido.','Fecha de desembolso inválida.','El certificado ya está registrado.','Período inválido.','Página inválida.','Campos no admitidos.','Filtro inválido.'];
   if(error instanceof Error&&safe.includes(error.message))throw new BadRequestException(error.message);
   throw new ServiceUnavailableException('No se pudo ejecutar el módulo. Revisa sus parámetros y la configuración del ejecutor.');
  }
 }
}
