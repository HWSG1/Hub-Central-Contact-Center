import {generateKeyPairSync,createPublicKey} from 'node:crypto';
import {mkdirSync,existsSync,readFileSync,writeFileSync} from 'node:fs';
mkdirSync('.local/module-keys',{recursive:true});
const path='.local/module-keys/development-private.pem';
if(!existsSync(path)){const pair=generateKeyPairSync('ed25519');writeFileSync(path,pair.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600,flag:'wx'});}
const publicKey=String(createPublicKey(readFileSync(path)).export({type:'spki',format:'pem'}));
const trustPath='.local/module-publishers.json';const trust=existsSync(trustPath)?JSON.parse(readFileSync(trustPath,'utf8')):{};
const current=trust.contact_center_development;
const keys=Array.isArray(current)?current:(current?[current]:[]);
if(keys.length&&!keys.includes(publicKey))throw Error('El editor tiene otras claves de confianza. No se reemplazan: registre una rotación aprobada antes de usar otra clave.');
if(!keys.length)trust.contact_center_development=publicKey;writeFileSync(trustPath,JSON.stringify(trust,null,2)+'\n');
mkdirSync('business-modules/packages',{recursive:true});
writeFileSync('business-modules/packages/development-publisher-public.json',JSON.stringify({contact_center_development:publicKey},null,2)+'\n');
console.log('Editor local preparado. La clave privada permanece en .local/module-keys; no copiarla al servidor ni subirla a Git.');
