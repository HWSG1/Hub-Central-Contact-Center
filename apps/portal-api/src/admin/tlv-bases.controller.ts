import {BadRequestException,ConflictException,Controller,ForbiddenException,Get,Headers,Post,Req,ServiceUnavailableException} from '@nestjs/common';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,basename,extname} from 'node:path';
import {Database} from '../database.js';
import {config} from '../config.js';
import {Permission,type SessionRequest} from '../security/guard.js';

const MAX_FILE=30*1024*1024;
const SCRIPT=resolve(process.cwd(),'apps/portal-api/scripts/tlv-import.py');
const PYTHON=process.env.TLV_PYTHON||'python';
let uploading=false;
const prevalidated=new Map<string,{sha256:string;until:number;valid:number}>();

async function binaryFile(req:SessionRequest){
 const chunks:Buffer[]=[];let length=0;
 for await(const chunk of req){
  const piece=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
  length+=piece.length;
  if(length>MAX_FILE)throw new BadRequestException('El archivo supera el límite de 30 MB.');
  chunks.push(piece);
 }
 if(!length)throw new BadRequestException('Selecciona un archivo Excel o CSV.');
 return Buffer.concat(chunks,length);
}
function subprocess(args:string[],timeoutMs:number){
 return new Promise<{code:number;output:string}>((resolvePromise,reject)=>{
  const child=spawn(PYTHON,[SCRIPT,...args],{
   cwd:process.cwd(),shell:false,windowsHide:true,
   env:{...process.env,PYTHONIOENCODING:'utf-8'},
   timeout:timeoutMs
  });
  const output:string[]=[];let chars=0;let ended=false;
  const append=(part:Buffer)=>{chars+=part.length;if(chars<=22000)output.push(part.toString('utf8'));};
  child.stdout.on('data',append);child.stderr.on('data',append);
  child.on('error',error=>{if(!ended){ended=true;reject(error);}});
  child.on('close',(code,signal)=>{if(!ended){ended=true;resolvePromise({code:code??2,output:output.join('').slice(0,22000)+(signal?'\nProceso interrumpido: '+signal:'')});}});
 });
}
function extractCounts(text:string){
 const m=text.match(/Registros válidos:\s*(\d+)\s*\|\s*Rechazados:\s*(\d+)/);
 return {valid:Number(m?.[1]??0),rejected:Number(m?.[2]??0)};
}
@Controller('admin/ofertas-tlv/bases')
@Permission('CORE.MODULES.MANAGE')
export class TlvBasesController {
 constructor(private readonly db:Database){}
 private async ensureReady(req:SessionRequest){
  if(!req.user.require_mfa)throw new ForbiddenException('Las cargas requieren una cuenta con MFA.');
  const session=(await this.db.query<{created_at:Date}>(
   'SELECT created_at FROM core.sessions WHERE token_hash=@hash AND user_id=@user AND revoked_at IS NULL',
   {hash:req.sessionHash,user:req.user.id})).recordset[0];
  if(!session||Date.now()-new Date(session.created_at).getTime()>15*60*1000)
   throw new ForbiddenException('Vuelve a iniciar sesión con MFA para administrar bases (15 minutos).');
  const tables=(await this.db.query<{ready:number}>(
   "SELECT CASE WHEN OBJECT_ID(N'mod_ofertas_tlv.cargas',N'U') IS NOT NULL AND COL_LENGTH(N'mod_ofertas_tlv.base_tlv',N'carga_id') IS NOT NULL THEN 1 ELSE 0 END AS ready"
  )).recordset[0];
  if(!tables?.ready)throw new ConflictException('Ejecuta primero el SQL de auditoría de bases TLV, con respaldo y autorización DBA.');
 }
 private async audit(req:SessionRequest,action:string,result:'SUCCESS'|'FAILURE',details:object){
  await this.db.query("INSERT core.audit_events(user_id,action,result,correlation_id,resource_type,details) VALUES(@user,@action,@result,@correlation,'tlv_base',@details)",
   {user:req.user.id,action,result,correlation:req.correlation,details:JSON.stringify(details)});
 }
 @Get('history')
 async history(@Req() req:SessionRequest){
  await this.ensureReady(req);
  const rows=await this.db.query(`
   SELECT TOP(25) c.carga_id,c.archivo,c.modalidad,c.tipo_base,c.periodo,
    c.esperados,c.insertados,c.rechazados,c.estado,c.creado_en,c.activado_en,
    c.usuario_hub,c.usuario_bd,COALESCE(u.display_name,c.usuario_bd) AS responsable,
    c.error_resumen
   FROM mod_ofertas_tlv.cargas c LEFT JOIN core.users u ON u.id=c.usuario_hub
   ORDER BY c.creado_en DESC`,{});
  const counts=await this.db.query<{activos:number;inactivos:number}>(`
   SELECT SUM(CASE WHEN activo=1 THEN CONVERT(bigint,1) ELSE CONVERT(bigint,0) END) AS activos,
          SUM(CASE WHEN activo=0 THEN CONVERT(bigint,1) ELSE CONVERT(bigint,0) END) AS inactivos
   FROM mod_ofertas_tlv.base_tlv`);
  return {history:rows.recordset,...counts.recordset[0]};
 }
 private async handle(req:SessionRequest,rawName:string|undefined,commit:boolean){
  await this.ensureReady(req);
  const name=basename(String(rawName||'CONSOLIDADO_BASES.xlsx'));
  if(!/^[a-zA-Z0-9_(). \-]{1,120}\.(xlsx|csv)$/i.test(name))
   throw new BadRequestException('El nombre debe corresponder a un archivo .xlsx o .csv válido.');
  if(uploading)throw new ConflictException('Ya existe una carga en proceso. Intenta nuevamente cuando termine.');
  uploading=true;
  let bytes:Buffer;
  try{
   bytes=await binaryFile(req);
   if(extname(name).toLowerCase()==='.xlsx'&&!(bytes[0]===0x50&&bytes[1]===0x4b))
    throw new BadRequestException('El archivo Excel no es un XLSX válido.');
  }catch(error){uploading=false;throw error;}
  let directory='';
  const hash=createHash('sha256').update(bytes).digest('hex');
  const identity=req.user.id+':'+req.sessionHash;
  if(commit){
   const preview=prevalidated.get(identity);
   if(!preview||preview.until<Date.now()||preview.sha256!==hash||!preview.valid){
    uploading=false;
    throw new ConflictException('Previsualiza nuevamente este mismo archivo antes de activar la base.');
   }
   prevalidated.delete(identity);
  }
  try{
   directory=await mkdtemp(join(tmpdir(),'tlv-import-'));
   const path=join(directory,name);
   await writeFile(path,bytes,{flag:'wx',mode:0o600});
   bytes.fill(0); // No mantener copias innecesarias de datos personales.
   await stat(SCRIPT).catch(()=>{throw new ServiceUnavailableException('Falta el importador TLV del servidor. Actualiza la API desde GitHub.');});
   const args=['--archivo',path,'--hoja','Consulta1'];
   if(!commit)args.push('--previsualizar');
   else args.push('--servidor',process.env.TLV_IMPORT_SQL_SERVER||config.SQL_SERVER,
      '--puerto',String(config.SQL_PORT),
      '--base',config.SQL_DATABASE,'--modo','reemplazo-total','--confirmar','CAMBIAR_BASE',
      '--usuario-hub',req.user.id);
   if(commit&&config.NODE_ENV!=='production'&&config.SQL_TRUST_SERVER_CERTIFICATE==='true')
    args.push('--certificado-desarrollo');
   const response=await subprocess(args,commit?15*60*1000:3*60*1000);
   const counts=extractCounts(response.output);
   await this.audit(req,commit?'TLV.BASE.ACTIVATE':'TLV.BASE.PREVIEW',response.code===0?'SUCCESS':'FAILURE',
    {file:name,sha256:hash,valid:counts.valid,rejected:counts.rejected,exitCode:response.code});
   if(response.code===0&&!commit)prevalidated.set(identity,{sha256:hash,until:Date.now()+10*60*1000,valid:counts.valid});
   if(response.code!==0)throw new BadRequestException('Archivo rechazado o fallo la carga. '+response.output.slice(-1400));
   return {ok:true,file:name,sha256:hash,...counts,details:response.output.slice(0,6500),activated:commit};
  }catch(error){
   if(error instanceof BadRequestException||error instanceof ConflictException||error instanceof ForbiddenException||error instanceof ServiceUnavailableException)throw error;
   throw new ServiceUnavailableException(error instanceof Error?error.message:'No se pudo ejecutar el importador TLV.');
  }finally{
   if(directory)await rm(directory,{recursive:true,force:true,maxRetries:5,retryDelay:150}).catch(()=>{});
   uploading=false;
  }
 }
 @Post('preview')
 async preview(@Req() req:SessionRequest,@Headers('x-tlv-file-name') fileName?:string){
  return this.handle(req,fileName,false);
 }
 @Post('activate')
 async activate(@Req() req:SessionRequest,@Headers('x-tlv-file-name') fileName?:string,@Headers('x-tlv-confirm') confirm?:string){
  if(confirm!=='CAMBIAR_BASE')throw new BadRequestException('Confirma explícitamente CAMBIAR_BASE.');
  return this.handle(req,fileName,true);
 }
}