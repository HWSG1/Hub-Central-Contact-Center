import {BadRequestException,ConflictException,Controller,ForbiddenException,Get,Headers,Post,Body,Req,ServiceUnavailableException} from '@nestjs/common';
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
  let output='',diagnostic='',finished=false;
  child.stdout.on('data',piece=>{if(output.length<2000)output+=String(piece).slice(0,2000);});
  child.stderr.on('data',piece=>{if(diagnostic.length<4000)diagnostic+=String(piece).slice(0,4000);});
  child.on('error',error=>{
   if(finished)return;finished=true;
   console.error('[MONITOREO_TC] No se pudo iniciar Python:',(error as NodeJS.ErrnoException).code??error.name);
   reject(new ServiceUnavailableException('No se pudo iniciar el validador Python. Verifica MONITOREO_PYTHON y que el ejecutable esté disponible para la API.'));
  });
  child.on('close',(code,signal)=>{
   if(finished)return;finished=true;
   if(code===0&&!signal)return resolve();
   try{
    const err=JSON.parse(output.trim()) as {error?:string};
    if(typeof err.error==='string'&&err.error.trim())return reject(new BadRequestException(err.error.slice(0,300)));
   }catch{/* El proceso no alcanzó a emitir un error de validación controlado. */}
   const detail=diagnostic.toLowerCase();
   const pythonMissing=/python was not found|no se encontr[oó] python|no python at|not recognized as an internal|can't open file|no such file or directory/.test(detail);
   // Nunca registrar stdout, filas del Excel ni valores de clientes en la bitácora.
   console.error('[MONITOREO_TC] Validador Python terminó sin respuesta:',{
    exitCode:code,signal,pythonMissing,stderrPresent:!!diagnostic,
    stderrKind:/traceback \(most recent call last\)/i.test(diagnostic)?'python_traceback':'process_error'
   });
   reject(pythonMissing?
    new ServiceUnavailableException('El ejecutable Python o el script de importación no está disponible. Revisa MONITOREO_PYTHON y la ruta de scripts del Hub.'):
    new ServiceUnavailableException('El validador Python finalizó sin un resultado. Revisa el log del backend: MONITOREO_TC y el código de salida '+String(code)+'.'));
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
  if(!session||Date.now()-new Date(session.created_at).getTime()>8*60*60*1000)
   throw new ForbiddenException('Inicia nuevamente sesión con MFA para importar bases (8 horas).');
  const ready=(await this.db.query<{ready:number}>(`
   SELECT CASE WHEN OBJECT_ID(N'core.monitoreo_tc_importar',N'P') IS NOT NULL AND
    OBJECT_ID(N'core.monitoreo_tc_cargas',N'U') IS NOT NULL AND
    OBJECT_ID(N'mod_monitoreo_tc.alertas',N'U') IS NOT NULL THEN 1 ELSE 0 END ready`)).recordset[0];
  if(!ready?.ready)throw new ConflictException('La administración requiere instalar MONITOREO_TC y aplicar la migración 012 del Hub.');
 }
 @Get('codes')
 async codes(@Req() req:SessionRequest){
  await this.ensureReady(req);
  const ready=(await this.db.query<{ready:number}>(`SELECT CASE WHEN OBJECT_ID(N'core.monitoreo_tc_guardar_codigo',N'P') IS NOT NULL THEN 1 ELSE 0 END ready`)).recordset[0];
  if(!ready?.ready)throw new ConflictException('Aplica la migración SQL 013 para administrar códigos.');
  const rows=(await this.db.query<{codigo:string;descripcion:string;accion:string;activo:boolean}>(`
   SELECT codigo,descripcion,accion,activo FROM mod_monitoreo_tc.codigos_respuesta
    ORDER BY codigo,id`)).recordset;
  return {codes:rows};
 }
 @Post('codes/change')
 async changeCode(@Req() req:SessionRequest,
  @Body() body:unknown){
  await this.ensureReady(req);
  if(!body||typeof body!=='object'||Array.isArray(body))throw new BadRequestException('Datos inválidos.');
  const input=body as Record<string,unknown>;
  if(Object.keys(input).some(k=>!['operation','code','description','action'].includes(k)))
    throw new BadRequestException('Campos no admitidos.');
  const operation=input.operation;
  const code=input.code;
  const description=input.description;
  const action=input.action;
  if(!['CREAR','EDITAR','DESACTIVAR'].includes(String(operation))||
    typeof code!=='string'||!/^[A-Z0-9]{1,10}$/.test(code)||
    (operation!=='DESACTIVAR'&&(typeof description!=='string'||!description.trim()||
      description.trim().length>300||!/^[AD]$/.test(String(action)))))
    throw new BadRequestException('Operación, código, descripción o acción inválidos.');
  try{
   await this.db.query(
    'EXEC core.monitoreo_tc_guardar_codigo @usuario=@actor,@correlation=@correlation,@operacion=@operation,@codigo=@code,@descripcion=@description,@accion=@action',
    {actor:req.user.id,correlation:req.correlation,operation,code,description:operation==='DESACTIVAR'?null:(description as string).trim(),
      action:operation==='DESACTIVAR'?null:action});
   return {ok:true,code,operation};
  }catch{
   throw new ConflictException('No se pudo modificar el catálogo. Verifica que el código no esté repetido, su estado y la migración 013.');
  }
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
  let stage='read_file';
  try{
   const bytes=await receive(req);
   const sha=createHash('sha256').update(bytes).digest('hex');
   const key=req.user.id+':'+req.sessionHash;
   const token=previews.get(key);
   if(commit&&(!token||token.expires<Date.now()||token.sha!==sha))
    throw new ConflictException('Previsualiza nuevamente el mismo archivo antes de activarlo.');
   stage='prepare_temp';
   directory=await mkdtemp(join(tmpdir(),'monitoreo-tc-'));
   const input=join(directory,filename),output=join(directory,randomUUID()+'.json');
   await writeFile(input,bytes,{mode:0o600,flag:'wx'});
   bytes.fill(0);
   stage='validate_python';
   await parse(input,output);
   stage='read_validation';
   const parsed=JSON.parse(await readFile(output,'utf8')) as Parsed;
   if(!Number.isInteger(parsed.valid)||parsed.valid<1||parsed.valid>50000||!Array.isArray(parsed.rows)||parsed.rows.length!==parsed.valid)
    throw new BadRequestException('El lote no cumple los límites.');
   if(!commit){
    previews.set(key,{sha,valid:parsed.valid,expires:Date.now()+10*60*1000});
    stage='audit_preview';
    await this.db.query(`INSERT core.audit_events(user_id,action,result,correlation_id,resource_type,details)
     VALUES(@user,'MONITOREO_TC.BASE.PREVIEW','SUCCESS',@correlation,'monitoreo_tc',@details)`,{
      user:req.user.id,correlation:req.correlation,details:JSON.stringify({file:filename,sha256:sha,valid:parsed.valid,
        duplicated_in_file:parsed.duplicated_in_file})});
    return {ok:true,archivo:filename,validos:parsed.valid,duplicados_archivo:parsed.duplicated_in_file,
      ignorados:parsed.ignored,activada:false};
   }
   if(token!.valid!==parsed.valid)throw new ConflictException('El archivo cambió desde la previsualización.');
   await this.ensureReady(req); // Revalidar sesión fresca después del análisis del archivo.
   stage='activate_sql';
   const result=(await this.db.query<{carga_id:string;insertados:number;omitidos:number}>(`
    EXEC core.monitoreo_tc_importar @usuario=@usuario,@correlation=@correlation,@archivo=@archivo,@sha256=@sha256,
      @datos=@datos,@esperados=@esperados`,{
      usuario:req.user.id,correlation:req.correlation,archivo:filename,sha256:sha,datos:JSON.stringify(parsed.rows),esperados:parsed.valid
    })).recordset[0];
   previews.delete(key);
   return {ok:true,archivo:filename,validos:parsed.valid,duplicados_archivo:parsed.duplicated_in_file,
    ignorados:parsed.ignored,activada:true,...result};
  }catch(error){
   if(error instanceof BadRequestException||error instanceof ConflictException||
     error instanceof ForbiddenException)throw error;
   // No registrar valores, rutas ni contenidos del archivo. Solo la fase y clase del error.
   console.error('[MONITOREO_TC] Importación fallida:',{
    stage,kind:error instanceof Error?error.name:typeof error,
    sqlNumber:typeof (error as {number?:unknown})?.number==='number'?(error as {number:number}).number:undefined
   });
   if(error instanceof ServiceUnavailableException)throw error;
   throw new ServiceUnavailableException('Error durante '+stage+'. Revisa la bitácora MONITOREO_TC del backend.');
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
