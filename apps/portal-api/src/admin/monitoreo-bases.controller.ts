import {BadRequestException,ConflictException,Controller,ForbiddenException,Get,Headers,Post,Req,ServiceUnavailableException} from '@nestjs/common';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,basename} from 'node:path';
import {Database} from '../database.js';
import {config} from '../config.js';
import {Permission,type SessionRequest} from '../security/guard.js';

const MAX_FILE=30*1024*1024;
const SCRIPT=resolve(process.cwd(),'apps/portal-api/scripts/monitoreo-import.py');
const PYTHON=process.env.MONITOREO_PYTHON||process.env.TLV_PYTHON||'python';
let processing=false;
const previews=new Map<string,{sha:string,valid:number,expires:number}>();
type Parsed={rows:Record<string,string|null>[],valid:number,duplicated_in_file:number,ignored:number};
async function receive(req:SessionRequest){
 const chunks:Buffer[]=[];let count=0;
 for await(const chunk of req){
  const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
  count+=bytes.length;
  if(count>MAX_FILE)throw new BadRequestException('El archivo supera los 30 MB.');
  chunks.push(bytes);
 }
 if(!count)throw new BadRequestException('Selecciona un archivo Excel o CSV.');
 return Buffer.concat(chunks,count);
}
async function parse(path:string,out:string){
 return new Promise<void>((resolve,reject)=>{
  const child=spawn(PYTHON,[SCRIPT,'--input',path,'--output',out],{
   cwd:process.cwd(),shell:false,windowsHide:true,timeout:180000,
   env:{...process.env,PYTHONIOENCODING:'utf-8'}
  });
  let output='';let finished=false;
  child.stdout.on('data',piece=>{if(output.length<2000)output+=String(piece).slice(0,2000);});
  child.on('error',error=>{if(!finished){finished=true;reject(error);}});
  child.on('close',(code,signal)=>{
   if(finished)return;finished=true;
   if(code===0&&!signal)return resolve();
   try{const err=JSON.parse(output) as {error?:string};reject(new BadRequestException((err.error||'Archivo inválido.').slice(0,300)));}
   catch(error){reject(error instanceof BadRequestException?error:new BadRequestException('No se pudo validar el archivo.'));}
  });
 });
}
@Controller('admin/monitoreo-tc/bases')
@Permission('CORE.MODULES.MANAGE')
export class MonitoreoBasesController {
 constructor(private readonly db:Database){}
 private async ensureReady(req:SessionRequest){
  if(!req.user.require_mfa)throw new ForbiddenException('Las cargas requieren MFA.');
  const session=(await this.db.query<{created_at:Date}>(
   'SELECT created_at FROM core.sessions WHERE token_hash=@hash AND user_id=@user AND revoked_at IS NULL',
   {hash:req.sessionHash,user:req.user.id})).recordset[0];
  if(!session||Date.now()-new Date(session.created_at).getTime()>15*60*1000)
   throw new ForbiddenException('Inicia nuevamente sesión con MFA para importar bases (15 minutos).');
  const ready=(await this.db.query<{ready:number}>(`
   SELECT CASE WHEN OBJECT_ID(N'core.monitoreo_tc_importar',N'P') IS NOT NULL AND
    OBJECT_ID(N'core.monitoreo_tc_cargas',N'U') IS NOT NULL AND
    OBJECT_ID(N'mod_monitoreo_tc.alertas',N'U') IS NOT NULL THEN 1 ELSE 0 END ready`)).recordset[0];
  if(!ready?.ready)throw new ConflictException('La administración requiere instalar MONITOREO_TC y aplicar la migración 012 del Hub.');
 }
 @Get('history')
 async history(@Req() req:SessionRequest){
  await this.ensureReady(req);
  const history=(await this.db.query(`
   SELECT TOP(25) CONVERT(varchar(36),c.carga_id) AS carga_id,c.archivo,c.sha256,
    c.fecha_carga,c.registros_archivo,c.insertados,c.omitidos,c.estado,
    COALESCE(u.display_name,N'Usuario') AS responsable
   FROM core.monitoreo_tc_cargas c LEFT JOIN core.users u ON u.id=c.usuario_hub
   ORDER BY c.fecha_carga DESC,c.carga_id DESC`)).recordset;
  const totals=(await this.db.query<{registros:number}>(`
   SELECT COUNT_BIG(*) AS registros FROM mod_monitoreo_tc.alertas WHERE activo=1`)).recordset[0];
  return {history,registros:totals?.registros??0};
 }
 private async process(req:SessionRequest,name:string|undefined,commit:boolean,confirmation?:string){
  await this.ensureReady(req);
  if(commit&&confirmation!=='AGREGAR_ALERTAS')throw new BadRequestException('Confirma AGREGAR_ALERTAS.');
  const filename=basename(name||'');
  if(!/^[A-Za-z0-9_(). -]{5,120}\.(xlsx|csv)$/i.test(filename))
   throw new BadRequestException('Nombre de archivo no permitido: utiliza .xlsx o .csv.');
  if(processing)throw new ConflictException('Hay una carga en proceso.');
  processing=true;
  let directory='';
  try{
   const bytes=await receive(req);
   const sha=createHash('sha256').update(bytes).digest('hex');
   const key=req.user.id+':'+req.sessionHash;
   const token=previews.get(key);
   if(commit&&(!token||token.expires<Date.now()||token.sha!==sha))
    throw new ConflictException('Previsualiza nuevamente el mismo archivo antes de activarlo.');
   directory=await mkdtemp(join(tmpdir(),'monitoreo-tc-'));
   const input=join(directory,filename),output=join(directory,randomUUID()+'.json');
   await writeFile(input,bytes,{mode:0o600,flag:'wx'});
   bytes.fill(0);
   await parse(input,output);
   const parsed=JSON.parse(await readFile(output,'utf8')) as Parsed;
   if(!Number.isInteger(parsed.valid)||parsed.valid<1||parsed.valid>50000||!Array.isArray(parsed.rows)||parsed.rows.length!==parsed.valid)
    throw new BadRequestException('El lote no cumple los límites.');
   if(!commit){
    previews.set(key,{sha,valid:parsed.valid,expires:Date.now()+10*60*1000});
    await this.db.query(`INSERT core.audit_events(user_id,action,result,resource_type,details)
     VALUES(@user,'MONITOREO_TC.BASE.PREVIEW','SUCCESS','monitoreo_tc',@details)`,{
      user:req.user.id,details:JSON.stringify({file:filename,sha256:sha,valid:parsed.valid,
        duplicated_in_file:parsed.duplicated_in_file})});
    return {ok:true,archivo:filename,validos:parsed.valid,duplicados_archivo:parsed.duplicated_in_file,
      ignorados:parsed.ignored,activada:false};
   }
   if(token!.valid!==parsed.valid)throw new ConflictException('El archivo cambió desde la previsualización.');
   await this.ensureReady(req); // Revalidar sesión fresca después del análisis del archivo.
   const result=(await this.db.query<{carga_id:string;insertados:number;omitidos:number}>(`
    EXEC core.monitoreo_tc_importar @usuario=@usuario,@archivo=@archivo,@sha256=@sha256,
      @datos=@datos,@esperados=@esperados`,{
      usuario:req.user.id,archivo:filename,sha256:sha,datos:JSON.stringify(parsed.rows),esperados:parsed.valid
    })).recordset[0];
   previews.delete(key);
   return {ok:true,archivo:filename,validos:parsed.valid,duplicados_archivo:parsed.duplicated_in_file,
    ignorados:parsed.ignored,activada:true,...result};
  }catch(error){
   if(error instanceof BadRequestException||error instanceof ConflictException||
     error instanceof ForbiddenException)throw error;
   throw new ServiceUnavailableException('No se pudo completar la carga. Verifica SQL, formato y registros.');
  }finally{
   if(directory)await rm(directory,{recursive:true,force:true,maxRetries:4,retryDelay:100}).catch(()=>{});
   processing=false;
  }
 }
 @Post('preview')
 async preview(@Req() req:SessionRequest,@Headers('x-monitoreo-file-name') fileName?:string){
  return this.process(req,fileName,false);
 }
 @Post('activate')
 async activate(@Req() req:SessionRequest,@Headers('x-monitoreo-file-name') fileName?:string,
  @Headers('x-monitoreo-confirm') confirm?:string){
  return this.process(req,fileName,true,confirm);
 }
}
