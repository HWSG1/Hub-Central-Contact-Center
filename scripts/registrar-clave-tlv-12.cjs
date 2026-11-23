'use strict';
/* Registrar exclusivamente la clave pública de prueba TLV 1.2, preservando las existentes. */
const fs=require('node:fs'),path=require('node:path');
const p=path.resolve(process.cwd(),'.local/module-publishers.json');
const publisher='contact_center_development';
const publicKey='-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA/RVXa6XH0DvvC68A1XCfNcw1Otu+7sEIDbKQo4FxyF8=\n-----END PUBLIC KEY-----\n';
if(!fs.existsSync(p)){console.error('Falta .local/module-publishers.json. No se creó ninguna clave de confianza.');process.exit(1);}
try{
 const trust=JSON.parse(fs.readFileSync(p,'utf8'));
 const prev=trust[publisher];
 if(!prev){throw Error('No está registrada la clave original del editor. Se requiere registrar primero al editor autorizado.');}
 const keys=Array.isArray(prev)?prev.slice():[prev];
 if(keys.some(k=>typeof k!=='string'))throw Error('Formato de confianza inválido.');
 if(!keys.includes(publicKey)){
  if(keys.length>=5)throw Error('El editor ya tiene cinco claves registradas: revisar la rotación antes de añadir otra.');
  keys.push(publicKey);
 }
 const backup=p+'.bak-tlv-1.2';
 if(!fs.existsSync(backup))fs.copyFileSync(p,backup,fs.constants.COPYFILE_EXCL);
 trust[publisher]=keys;
 fs.writeFileSync(p,JSON.stringify(trust,null,2)+'\n','utf8');
 console.log('Clave TLV 1.2 registrada; las claves anteriores permanecen autorizadas.');
 console.log('Respaldo de configuración:',backup);
}catch(e){console.error('No se completó el registro:',e.message);process.exit(1);}
