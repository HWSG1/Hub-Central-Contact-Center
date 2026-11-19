import { hidden } from './lib/terminal.js';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { randomBytes,randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { createInterface } from 'node:readline/promises';
import argon2 from 'argon2';
import { acceptedCounter,newMfaSecret,passwordProblem,seal,keyFrom } from '../apps/portal-api/src/security/local-mfa.js';
import { localAdminSql } from './lib/local-admin-sql.js';
async function ask(label:string){const io=createInterface({input:process.stdin,output:process.stdout});try{return(await io.question(label)).trim();}finally{io.close();}}
async function main(){
 if(process.env['NODE_ENV']!=='development'||process.env['SQL_DATABASE']!=='ContactCenterHub_Dev')throw Error('Este asistente es exclusivamente para desarrollo local (NODE_ENV=development, SQL_DATABASE=ContactCenterHub_Dev).');
 console.log('Alta inicial local. No conecta a SQL ni crea un usuario hasta ejecutar el SQL generado en SSMS.');
 const username=await ask('Usuario que usarás en el login: '),name=await ask('Nombre para mostrar: ');
 if(!/^[a-zA-Z0-9@._-]{3,128}$/.test(username)||!name||name.length>120)throw Error('Usuario o nombre inválidos.');
 const password=await hidden('Contraseña inicial (15–128 caracteres; no se muestra): ');const problem=passwordProblem(password,username);if(problem)throw Error(problem);
 if(password!==await hidden('Repite la contraseña inicial: '))throw Error('Las contraseñas no coinciden.');
 const id=randomUUID(),secret=newMfaSecret();
 console.log('En tu aplicación autenticadora agrega una cuenta mediante CLAVE MANUAL.');
 console.log('Nombre: Contact Center Hub / '+username+' | Tipo: basado en tiempo, 6 dígitos, 30 segundos.');
 console.log('Clave privada de configuración (no compartir): '+secret);
 const code=await hidden('Código actual de 6 dígitos para confirmar la vinculación: '),counter=acceptedCounter(secret,code,null);
 if(counter===null)throw Error('Código inválido. No se generó el alta. Repite el asistente y verifica la hora del teléfono.');
 const envPath=resolve('.env');let env=await readFile(envPath,'utf8');let key=parseEnv(env)['MFA_ENCRYPTION_KEY']??'';if(process.env['MFA_ENCRYPTION_KEY']&&process.env['MFA_ENCRYPTION_KEY']!==key)throw Error('La clave MFA del entorno y .env difieren. Revise la configuración antes de continuar.');
 if(!key){key=randomBytes(32).toString('hex');if(/^MFA_ENCRYPTION_KEY=.*$/m.test(env))env=env.replace(/^MFA_ENCRYPTION_KEY=.*$/m,'MFA_ENCRYPTION_KEY='+key);else env+='\nMFA_ENCRYPTION_KEY='+key+'\n';}
 keyFrom(key);
 if(/^LOCAL_AUTH_ENABLED=.*$/m.test(env))env=env.replace(/^LOCAL_AUTH_ENABLED=.*$/m,'LOCAL_AUTH_ENABLED=true');else env+='\nLOCAL_AUTH_ENABLED=true\n';
 const hash=await argon2.hash(password,{type:argon2.argon2id,memoryCost:65536,timeCost:3,parallelism:1});
 const sql=localAdminSql({machine:hostname(),id,username,name,passwordHash:hash,cipher:seal(secret,id,key),counter,correlation:randomUUID(),coreMigration:await readFile('database/migrations/001_core.sql','utf8'),mfaMigration:await readFile('database/migrations/002_local_mfa.sql','utf8')});
 await mkdir('.local',{recursive:true});
 const sqlPath=resolve('.local','alta-admin-'+id+'.sql');await writeFile(sqlPath,'\ufeff'+sql,{mode:0o600,flag:'wx'});await writeFile(envPath,env,{mode:0o600});
 console.log('Abre en SSMS y ejecuta completo: '+sqlPath);
 console.log('Conserva .env de forma privada: contiene la clave MFA. No la reemplaces tras crear la cuenta.');
 console.log('Reinicia API. Entra con el usuario elegido, contraseña inicial y un NUEVO código. Luego cambia la contraseña inicial.');
 console.log('Si pierdes el autenticador, no existe recuperación automática en esta entrega; necesitarás un procedimiento administrativo auditado.');
}
main().catch((error:unknown)=>{console.error('No se completó el alta local; no se modificó SQL.');console.error(error instanceof Error?error.message:'Error de configuración');process.exitCode=1;});
