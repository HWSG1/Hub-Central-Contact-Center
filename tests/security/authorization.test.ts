import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env['APP_ORIGIN']='http://localhost:4200';process.env['SQL_SERVER']='localhost';process.env['SQL_DATABASE']='ContactCenterHub_Test';
const { SessionGuard }=await import('../../apps/portal-api/src/security/guard.js');
const { opaque }=await import('../../apps/portal-api/src/security/policy.js');
const csrf=opaque();
function fixture({cookie=opaque(),enabled=true,permission=true,method='GET',origin='http://localhost:4200',token=csrf,revoked=false,dbError=false}={}){
 const calls:string[]=[];const req:any={cookies:{hub_session:cookie},method,correlation:'test',get:(name:string)=>name==='origin'?origin:token};
 const reflector:any={getAllAndOverride:(key:string)=>key==='public'?false:'CORE.MODULES.READ'};
 const db:any={query:async(sql:string)=>{calls.push(sql);if(dbError)throw Error('database unavailable');if(sql.startsWith('SELECT u.'))return {recordset:[{id:'user',enabled,expires_at:null,created_at:new Date(),last_seen_at:new Date(),revoked_at:revoked?new Date():null,csrf_token:csrf}]};if(sql.startsWith('SELECT DISTINCT'))return {recordset:permission?[{code:'CORE.MODULES.READ'}]:[]};return {recordset:[],rowsAffected:[1]};}};
 const audit:any={audit:async()=>{calls.push('audit');}};
 const guard=new SessionGuard(reflector,db,audit);const context:any={getHandler:()=>null,getClass:()=>null,switchToHttp:()=>({getRequest:()=>req})};return {guard,context,req,calls};
}
for(const [name,options] of Object.entries({missingCookie:{cookie:''},disabledUser:{enabled:false},missingPermission:{permission:false},revokedSession:{revoked:true},forgedOrigin:{method:'POST',origin:'https://attacker.example'},wrongCsrf:{method:'POST',token:'invalid'},unavailableDatabase:{dbError:true}}))test('deniega '+name,async()=>{const f=fixture(options);await assert.rejects(()=>f.guard.canActivate(f.context));});
test('permite petición con sesión, permiso y CSRF válido',async()=>{const f=fixture({method:'POST'});assert.equal(await f.guard.canActivate(f.context),true);assert.deepEqual(f.req.permissions,['CORE.MODULES.READ']);});
