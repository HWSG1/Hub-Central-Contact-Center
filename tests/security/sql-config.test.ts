import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('SQL certificate trust requires an explicit valid true; defaults to false',()=>{
 for(const value of [undefined,'false','true','yes','']){
  const env={...process.env,NODE_ENV:'test',APP_ORIGIN:'http://localhost:4200',SQL_SERVER:'example',SQL_DATABASE:'Example',SQL_AUTH:'sql',SQL_USER:'test',SQL_PASSWORD:'test',LOCAL_AUTH_ENABLED:'false',MFA_ENCRYPTION_KEY:'',OIDC_ISSUER:''};
  delete env['SQL_TRUST_SERVER_CERTIFICATE'];
  if(value!==undefined)env['SQL_TRUST_SERVER_CERTIFICATE']=value;
  const result=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',"import {config} from './apps/portal-api/src/config.ts'; console.log(config.SQL_TRUST_SERVER_CERTIFICATE);"],{env,encoding:'utf8'});
  if(value==='yes'||value==='')assert.notEqual(result.status,0);
  else {assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),value??'false');}
 }
});
