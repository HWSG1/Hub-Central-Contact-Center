import { unzipSync, strFromU8 } from 'fflate';
import { createHash } from 'node:crypto';
import { validateDescriptor } from './registry.js';

// v1 carries a descriptor only. Never extract files or execute uploaded code.
export function inspectPackage(base64:string){
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)||base64.length>10924)throw new Error('ZIP inválido o mayor de 8 KB.');
 const bytes=Buffer.from(base64,'base64');
 if(bytes.length>8192||bytes.toString('base64')!==base64)throw new Error('ZIP inválido.');
 let count=0;
 const files=unzipSync(bytes,{filter:file=>{
  count++;
  if(count!==1||file.name!=='manifest.json'||file.originalSize>8192||![0,8].includes(file.compression))throw new Error('El ZIP debe contener únicamente manifest.json de hasta 8 KB.');
  return true;
 }});
 if(count!==1||!files['manifest.json'])throw new Error('Falta manifest.json.');
 const manifest=validateDescriptor(JSON.parse(strFromU8(files['manifest.json'])));
 return {manifest,sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length,files:['manifest.json']};
}
