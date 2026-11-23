import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {zipSync,strToU8} from 'fflate';
import {inspectFullPackage} from '../../apps/portal-api/src/modules/archive.js';
import {executeBackend} from '../../apps/portal-api/src/modules/runner.js';
import {compileQuery} from '../../apps/portal-api/src/modules/query.js';
import {validateContracts,manifestSchema,migrationSchema,querySchema} from '../../apps/portal-api/src/modules/contracts.js';
const key=generateKeyPairSync('ed25519'),trust={test:String(key.publicKey.export({type:'spki',format:'pem'}))};
function fixture(){
 const files:Record<string,Uint8Array>={'frontend/index.html':strToU8('<h1>Test</h1>'),'backend/main.mjs':strToU8('export const handle=()=>({ok:true})'),'backend/queries.json':strToU8(JSON.stringify({find:{table:'offers',columns:['id','DNI'],filters:[{column:'DNI',param:'value',type:'text'}],active:true,page:true}})),'migrations/001.json':strToU8(JSON.stringify({tables:[{name:'offers',columns:[{name:'DNI',type:'varchar(40)',nullable:true}],indexes:[['DNI']]}]}))};
 const manifest={format:'hub-package-v2',id:'TEST_MOD',name:'Test module',description:'Test',version:'1.0.0',hostApi:1,publisher:'test',permission:'TEST_MOD.USE',operations:['health','find'],files:Object.fromEntries(Object.entries(files).map(([name,b])=>[name,createHash('sha256').update(b).digest('hex')]))};
 files['manifest.json']=strToU8(JSON.stringify(manifest));files['signature.txt']=strToU8(sign(null,files['manifest.json'],key.privateKey).toString('base64'));
 return {files,manifest,zip:()=>Buffer.from(zipSync(files)).toString('base64')};
}
test('full package contains and authenticates code, interface, queries and table definitions',()=>{const f=fixture(),p=inspectFullPackage(f.zip(),trust);assert.equal(p.manifest.route,'/extensions/TEST_MOD');assert.equal(Object.keys(p.files).length,6);assert.equal(p.migration.tables[0].name,'offers');});
test('trusted publisher key rotation validates old and new Ed25519 keys without replacing old trust',()=>{
 const alternate=generateKeyPairSync('ed25519');
 const publicNew=String(alternate.publicKey.export({type:'spki',format:'pem'}));
 const f=fixture();
 const rotated={test:[trust.test,publicNew]};
 assert.equal(inspectFullPackage(f.zip(),rotated).manifest.id,'TEST_MOD');
 assert.throws(()=>inspectFullPackage(f.zip(),{test:[publicNew]}),/Firma inválida/);
});
test('tampered component, changed manifest, unknown publisher and extra paths are rejected',()=>{for(const change of [(f:ReturnType<typeof fixture>)=>f.files['backend/main.mjs']=strToU8('evil'),(f:ReturnType<typeof fixture>)=>f.files['manifest.json']=strToU8(JSON.stringify({...f.manifest,id:'CORE'})),(f:ReturnType<typeof fixture>)=>f.files['../outside']=strToU8('bad')]){const f=fixture();change(f);assert.throws(()=>inspectFullPackage(f.zip(),trust));}assert.throws(()=>inspectFullPackage(fixture().zip(),{}));});
test('query broker rejects extra parameters and preserves identifiers without raw SQL interpolation',()=>{const p=inspectFullPackage(fixture().zip(),trust);const q=compileQuery(p.manifest.id,p.queries,'find',{value:'00001',page:1});assert(q.sql.includes('[mod_test_mod].[offers]'));assert(!q.sql.includes('00001'));assert.equal(q.params.p0,'00001');assert.equal(q.params.offset,50);for(const params of [{value:'%25',page:0},{value:'1',page:-1},{value:'1',page:0,sql:'DROP'}])assert.throws(()=>compileQuery(p.manifest.id,p.queries,'find',params));assert.throws(()=>compileQuery(p.manifest.id,p.queries,'toString',{}));});
test('contract cannot declare another module permission or read core tables',()=>{const p=inspectFullPackage(fixture().zip(),trust);assert.throws(()=>validateContracts({...p.manifest,permission:'CORE.USERS.READ'},p.migration,p.queries));assert.throws(()=>validateContracts(p.manifest,p.migration,{find:{...p.queries.find,table:'users'}}));assert.throws(()=>migrationSchema.parse({tables:[{name:'x]; DROP TABLE core.users',columns:[],indexes:[]}]}));});
const node=process.env.MODULE_NODE??(existsSync('C:/Program Files/nodejs/node.exe')?'C:/Program Files/nodejs/node.exe':process.execPath);
test('real worker executes packaged backend and broker RPC without Hub imports',async()=>{const source=strToU8('export async function handle(op,input,api){return {rows:await api.query("find",input),value:2+3};}');const result=await executeBackend(source,'find',{value:'001'},async(name,params)=>{assert.equal(name,'find');assert.deepEqual(params,{value:'001'});return [{id:'1'}];},node);assert.deepEqual(result,{rows:[{id:'1'}],value:5});});
test('real worker denies network, filesystem outside package, subprocesses and inherited secrets',async()=>{
 const source=strToU8(`import fs from 'node:fs/promises';import net from 'node:net';import {spawnSync} from 'node:child_process';export async function handle(){const result={};try{await fs.readFile('C:/Windows/win.ini');result.fs='allowed';}catch(e){result.fs=e.code;}try{result.net=await new Promise(resolve=>{const socket=net.connect(9,'127.0.0.1');socket.on('error',e=>resolve(e.code));socket.on('connect',()=>{socket.destroy();resolve('allowed');});});}catch(e){result.net=e.code;}try{const child=spawnSync('cmd.exe');result.child=child.error?.code??'allowed';}catch(e){result.child=e.code;}try{result.secret=process.env.SQL_PASSWORD??'absent';}catch{result.secret='denied';}return result;}`);
 const result=await executeBackend(source,'health',{},async()=>[],node) as Record<string,string>;assert.equal(result.fs,'ERR_ACCESS_DENIED');assert.equal(result.net,'ERR_ACCESS_DENIED');assert.equal(result.child,'ERR_ACCESS_DENIED');assert(['absent','denied'].includes(result.secret));
});
test('worker terminates errors and refuses queries not declared by host',async()=>{await assert.rejects(executeBackend(strToU8('export const handle=()=>{throw Error("fail")}'),'health',{},async()=>[],node));await assert.rejects(executeBackend(strToU8('export const handle=(op,i,api)=>api.query("core.users",{})'),'search',{},async()=>{throw Error('denied');},node));});

// Regression: returning a result must not race Windows process cwd cleanup.
test('worker closes before removing its temporary working directory on repeated executions',async()=>{
 const source=strToU8('export const handle=()=>({folder:process.cwd(),ok:true});');
 for(let i=0;i<12;i++){
  const result=await executeBackend(source,'health',{},async()=>[],node) as {folder:string;ok:boolean};
  assert.equal(result.ok,true);assert.equal(existsSync(result.folder),false,result.folder);
 }
});
