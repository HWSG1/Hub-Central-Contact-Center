import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {workerSource} from './worker.js';
import {createInterface} from 'node:readline';
let running=0;
export async function executeBackend(source:Uint8Array,operation:string,input:unknown,query:(name:string,params:unknown,mode?:'read'|'write')=>Promise<unknown>,node=process.env.MODULE_NODE??process.execPath){
 if(running>=4)throw Error('El ejecutor está ocupado. Intenta nuevamente.');
 running++;let folder='';
 try{
  folder=await mkdtemp(join(tmpdir(),'hub-module-'));const backend=join(folder,'main.mjs');await writeFile(backend,source);
  const runner=join(folder,'worker.mjs');await writeFile(runner,workerSource);
  return await new Promise<unknown>((accept,reject)=>{
   // Node >=26: without allow-net, all network access is denied. No inherited .env.
   const child=spawn(node,['--permission','--allow-fs-read='+folder,'--allow-fs-read='+runner,'--max-old-space-size=64',runner,backend],{env:{SystemRoot:process.env.SystemRoot??'',TEMP:folder,TMP:folder},cwd:folder,windowsHide:true,stdio:['pipe','pipe','pipe']});
   let ended=false,bytes=0,count=0;let outcome:{error?:Error;result?:unknown}|undefined;const ids=new Set<number>();
   // On Windows the process retains its working directory until it has closed.
   // Do not settle this promise (and enter cleanup) just after sending kill.
   const finish=(error?:Error,result?:unknown)=>{if(ended)return;ended=true;outcome={error,result};clearTimeout(timeout);child.kill();};
   const timeout=setTimeout(()=>finish(Error('Tiempo del módulo agotado.')),10000);
   const lines=createInterface({input:child.stdout});
   child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>2*1024*1024)finish(Error('Respuesta excesiva.'));});
   child.stderr.on('data',chunk=>{bytes+=chunk.length;if(bytes>2*1024*1024)finish(Error('Salida excesiva.'));});
   lines.on('line',async line=>{if(ended)return;try{const message=JSON.parse(line);if(message.type==='result'){finish(undefined,message.result);return;}if(!['query','write'].includes(message.type)||++count>8||!Number.isSafeInteger(message.id)||ids.has(message.id)||typeof message.name!=='string')throw Error('Protocolo inválido.');ids.add(message.id);const result=await query(message.name,message.params,message.type==='write'?'write':'read');if(!ended)child.stdin.write(JSON.stringify({id:message.id,result})+'\n');}catch{finish(Error('No se pudo ejecutar el módulo.'));}});
   child.on('error',()=>finish(Error('Configura MODULE_NODE con Node.js 26 o superior.')));
   child.on('close',()=>{
    clearTimeout(timeout);ended=true;lines.close();
    if(!outcome)outcome={error:Error('El servicio del módulo terminó sin respuesta.')};
    outcome.error?reject(outcome.error):accept(outcome.result);
   });
   child.stdin.on('error',()=>finish(Error('El ejecutor no está disponible.')));
   child.stdin.write(JSON.stringify({operation,input})+'\n');
  });
 }finally{
  running--;
  if(folder){const actual=await realpath(folder);const parent=await realpath(tmpdir());if(dirname(actual)===parent&&basename(actual)===basename(folder))await rm(actual,{recursive:true,force:true,maxRetries:6,retryDelay:100});}
 }
}
