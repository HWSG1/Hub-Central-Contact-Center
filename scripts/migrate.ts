import 'reflect-metadata';
import { readdir,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Database } from '../apps/portal-api/src/database.js';
const db=new Database();
try{const pool=await db.connect();await pool.request().query("IF OBJECT_ID('dbo.hub_migrations') IS NULL CREATE TABLE dbo.hub_migrations(name varchar(200) PRIMARY KEY,sha256 char(64) NOT NULL,applied_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME())");
for(const file of (await readdir('database/migrations')).filter(f=>/^\d+.*\.sql$/.test(f)).sort()){
 const source=await readFile('database/migrations/'+file,'utf8'),hash=createHash('sha256').update(source).digest('hex');
 const transaction=pool.transaction();await transaction.begin();
 try {await transaction.request().query("EXEC sp_getapplock @Resource='hub_migrate',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000");
 const old=(await transaction.request().input('name',file).query('SELECT sha256 FROM dbo.hub_migrations WHERE name=@name')).recordset[0];
 if(old){if(old.sha256!==hash)throw Error('Migración aplicada modificada');await transaction.commit();continue;}
 for(const batch of source.split(/^GO\s*$/mi).filter(x=>x.trim()))await transaction.request().batch(batch);
 await transaction.request().input('name',file).input('hash',hash).query('INSERT dbo.hub_migrations(name,sha256) VALUES(@name,@hash)');await transaction.commit();console.log('Aplicada '+file);
 }catch(e){await transaction.rollback().catch(()=>{});throw e;}
}}finally{await db.onModuleDestroy();}
