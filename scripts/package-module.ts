import {build} from 'esbuild';
import {createHash,sign,createPublicKey} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {zipSync,strToU8} from 'fflate';
import {inspectFullPackage} from '../apps/portal-api/src/modules/archive.js';
export async function buildModule(source:string,keyFile:string,destination:string){
 const output=await build({entryPoints:[source+'/backend/main.ts'],bundle:true,write:false,format:'esm',platform:'node',target:'node26',minify:true});
 const files:Record<string,Uint8Array>={'frontend/index.html':readFileSync(source+'/frontend/index.html'),'backend/main.mjs':output.outputFiles[0].contents,'backend/queries.json':readFileSync(source+'/backend/queries.json'),'migrations/001.json':readFileSync(source+'/migrations/001.json')};
 const manifest={...JSON.parse(readFileSync(source+'/manifest.json','utf8')),files:Object.fromEntries(Object.entries(files).map(([name,bytes])=>[name,createHash('sha256').update(bytes).digest('hex')]))};
 const key=readFileSync(keyFile);files['manifest.json']=strToU8(JSON.stringify(manifest,null,2));files['signature.txt']=strToU8(sign(null,files['manifest.json'],key).toString('base64'));
 const archive=zipSync(files,{mtime:new Date('2026-01-01T00:00:00Z')});
 const report=inspectFullPackage(Buffer.from(archive).toString('base64'),{[manifest.publisher]:String(createPublicKey(key).export({type:'spki',format:'pem'}))});
 mkdirSync(dirname(destination),{recursive:true});writeFileSync(destination,archive);
 console.log(JSON.stringify({file:destination,bytes:report.size,sha256:report.sha256,files:Object.keys(files)}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [source,key,out]=process.argv.slice(2);if(!source||!key||!out)throw Error('Uso: modules:pack -- carpeta-fuente clave-privada.pem destino.zip');await buildModule(source,key,out);
}
