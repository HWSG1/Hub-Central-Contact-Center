import {createHash,verify,createPublicKey} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {unzipSync,strFromU8} from 'fflate';
import {manifestSchema,migrationSchema,querySchema,validateContracts} from './contracts.js';
export const MAX_PACKAGE=2*1024*1024;
export const packageFiles=['frontend/index.html','backend/main.mjs','backend/queries.json','migrations/001.json'];
export type PublisherTrust=Record<string,string|string[]>;
export function trustedPublishers():PublisherTrust{
 try{return JSON.parse(readFileSync(resolve(process.env.MODULE_TRUST_FILE??'.local/module-publishers.json'),'utf8'));}catch{throw Error('Configura los editores de confianza del instalador (module-publishers.json).');}
}
export function inspectFullPackage(archive:string,trust=trustedPublishers()){
 if(archive.length>Math.ceil(MAX_PACKAGE/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(archive))throw Error('ZIP inválido o mayor de 2 MB.');
 const bytes=Buffer.from(archive,'base64');if(bytes.length>MAX_PACKAGE||bytes.toString('base64')!==archive)throw Error('ZIP inválido.');
 const seen=new Set<string>();let total=0;
 const files=unzipSync(bytes,{filter:file=>{total+=file.originalSize;if(!['manifest.json','signature.txt',...packageFiles].includes(file.name)||seen.has(file.name)||total>4*1024*1024||file.originalSize>2*1024*1024||![0,8].includes(file.compression))throw Error('Archivo no admitido, duplicado o tamaño excesivo.');seen.add(file.name);return true;}});
 if(seen.size!==6)throw Error('Faltan componentes del paquete.');
 const manifest=manifestSchema.parse(JSON.parse(strFromU8(files['manifest.json'])));
 const trusted=trust[manifest.publisher];if(!trusted)throw Error('Editor no autorizado.');
 const keys=Array.isArray(trusted)?trusted:[trusted];
 if(!keys.length||keys.length>5||keys.some(k=>typeof k!=='string'||k.length>2048))throw Error('Configuración de claves inválida.');
 const signature=Buffer.from(strFromU8(files['signature.txt']).trim(),'base64');
 const authorized=keys.some(key=>{
  const publicKey=createPublicKey(key);
  if(publicKey.asymmetricKeyType!=='ed25519')throw Error('La clave del editor debe ser Ed25519.');
  return verify(null,files['manifest.json'],publicKey,signature);
 });
 if(!authorized)throw Error('Firma inválida.');
 if(Object.keys(manifest.files).length!==packageFiles.length)throw Error('Lista de archivos inválida.');
 for(const name of packageFiles)if(createHash('sha256').update(files[name]).digest('hex')!==manifest.files[name])throw Error('Contenido alterado: '+name);
 const migration=migrationSchema.parse(JSON.parse(strFromU8(files['migrations/001.json'])));
 const queries=querySchema.parse(JSON.parse(strFromU8(files['backend/queries.json'])));
 validateContracts(manifest,migration,queries);
 return {manifest:{...manifest,route:'/extensions/'+manifest.id},migration,queries,files,bytes,sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length};
}
