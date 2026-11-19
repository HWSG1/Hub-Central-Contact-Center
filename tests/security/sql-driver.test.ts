import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

for(const auth of ['sql','windows'])test(`SQL_AUTH=${auth} uses matching pool and request drivers`,()=>{
 const source=`
 import 'reflect-metadata';
 import assert from 'node:assert/strict';
 const driver=(await import(${JSON.stringify(auth==='sql'?'mssql':'mssql/msnodesqlv8.js')})).default;
 driver.ConnectionPool.prototype.connect=async function(){return this;};
 const {Database}=await import('./apps/portal-api/src/database.ts');
 const pool=await new Database().connect();
 assert.ok(pool instanceof driver.ConnectionPool);
 assert.ok(pool.request() instanceof driver.Request, 'Request driver must match the pool');
 assert.equal(pool.config.options.encrypt,true);
 assert.equal(pool.config.options.trustServerCertificate,false);
 `;
 const result=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',source],{encoding:'utf8',env:{...process.env,NODE_ENV:'test',APP_ORIGIN:'http://localhost:4200',SQL_SERVER:'example',SQL_DATABASE:'Example',SQL_AUTH:auth,SQL_USER:'test',SQL_PASSWORD:'test',SQL_TRUST_SERVER_CERTIFICATE:'false',LOCAL_AUTH_ENABLED:'false',MFA_ENCRYPTION_KEY:'',OIDC_ISSUER:''}});
 assert.equal(result.status,0,result.stderr);
});
