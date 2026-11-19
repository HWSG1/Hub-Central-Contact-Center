import { hidden } from './lib/terminal.js';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import argon2 from 'argon2';
import { acceptedCounter,newMfaSecret,passwordProblem,seal,keyFrom } from '../apps/portal-api/src/security/local-mfa.js';
import { remoteAdminSql } from './lib/remote-admin-sql.js';
async function ask(label:string){const io=createInterface({input:process.stdin,output:process.stdout});try{return(await io.question(label)).trim();}finally{io.close();}}
async function main(){
 console.log('Primer administrador en una base existente. Genera SQL privado para SSMS; no conecta a SQL ni modifica .env.');
 console.log('Use exactamente la MFA_ENCRYPTION_KEY de la API que atenderá esa base. Nunca reemplace una clave existente.');
 const server=await ask('Servidor\\Instancia (valor de SERVERPROPERTY(\'ServerName\')): ');
 const database=await ask('Base de datos destino: ');
 const key=await hidden('MFA_ENCRYPTION_KEY de la API destino (64 caracteres hex, no se muestra): ');keyFrom(key);
 const username=await ask('Usuario del portal: '),name=await ask('Nombre para mostrar: ');
 if(!/^[a-zA-Z0-9@._-]{3,128}$/.test(username)||!name||name.length>120)throw Error('Usuario o nombre inválidos.');
 const password=await hidden('Contraseña inicial (15–128 caracteres): ');const problem=passwordProblem(password,username);if(problem)throw Error(problem);
 if(password!==await hidden('Repite la contraseña inicial: '))throw Error('Las contraseñas no coinciden.');
 const id=randomUUID(),secret=newMfaSecret();
 console.log('Agrega en el autenticador: Contact Center Hub / '+username+' / '+database+'. Basado en tiempo, 6 dígitos, 30 segundos.');
 console.log('Clave manual PRIVADA (no compartir): '+secret);
 const counter=acceptedCounter(secret,await hidden('Código actual de 6 dígitos: '),null);
 if(counter===null)throw Error('Código inválido. Repita el asistente y registre la nueva clave.');
 const migrations=JSON.parse(await readFile('database/migrations/checksums.json','utf8')) as Record<string,string>;
 const sql=remoteAdminSql({server,database,id,username,name,passwordHash:await argon2.hash(password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1}),cipher:seal(secret,id,key),counter,correlation:randomUUID(),migrations});
 await mkdir('.local',{recursive:true});const path=resolve('.local','alta-admin-remoto-'+id+'.sql');
 await writeFile(path,'\ufeff'+sql,{mode:0o600,flag:'wx'});
 console.log('SQL privado: '+path);
 console.log('Seleccione la base destino en SSMS. Ejecute primero con @Apply=0; revise y cambie a 1 para crear la cuenta.');
 console.log('La API destino debe tener LOCAL_AUTH_ENABLED=true y la misma MFA_ENCRYPTION_KEY. Reiníciela tras configurar.');
 console.log('Ingrese con usuario, contraseña y un NUEVO código de 6 dígitos; complete el cambio de contraseña.');
}
main().catch((error:unknown)=>{console.error('No se completó el alta; no se modificó SQL ni .env.');console.error(error instanceof Error?error.message:'Error de configuración');process.exitCode=1;});
