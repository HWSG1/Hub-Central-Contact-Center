import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {calculateOffers,intraPlans} from '../../apps/portal-api/src/business/offers-calculator.js';
process.env.APP_ORIGIN='http://localhost:4200';process.env.SQL_SERVER='localhost';process.env.SQL_DATABASE='ContactCenterHub_Test';
const {OffersController}=await import('../../apps/portal-api/src/business/offers.controller.js');
const input={product:'CORTA_CUOTAS',amount:1200,months:6,annualRate:0,intraPlan:'22_3.5',commissionPercent:4,commissionMode:'FIRST'};
test('Corta Cuotas first-payment and financed commission produce distinct cash flows',()=>{
 const r=calculateOffers(input);assert.equal(r.firstPayment,248);assert.equal(r.regularPayment,200);assert.equal(r.totalCost,1248);assert.equal(r.schedule.at(-1)?.balance,0);
 const f=calculateOffers({...input,commissionMode:'FINANCED'});assert.equal(f.firstPayment,208);assert.equal(f.financed,1248);assert.equal(f.totalPayments,1248);assert.equal(f.schedule[0].commission,0);
});
test('Extra zero rate charges commission and SSD separately and rejects undefined tariffs',()=>{
 const r=calculateOffers({...input,product:'EXTRA',months:12});assert.equal(r.commission,144);assert.equal(r.ssd,24);assert.equal(r.regularPayment,100);assert.equal(r.totalCost,1368);assert.equal(r.upfront,168);
 assert.throws(()=>calculateOffers({...input,product:'EXTRA',months:24}));
});
test('INTRA plans enforce their own rates and commissions and close the balance',()=>{
 for(const [plan,[rate,percent]]of Object.entries(intraPlans)){const r=calculateOffers({...input,product:'INTRA',amount:10000,months:18,intraPlan:plan,annualRate:99});assert.equal(r.annualRate,rate);assert.equal(r.commission,10000*percent/100);assert.equal(r.schedule[0].commission,r.commission);assert.equal(Math.round(r.schedule.reduce((sum,row)=>sum+row.principal,0)*100),1000000);assert.equal(r.schedule.at(-1)?.balance,0);assert.equal(Math.round(r.totalPayments*100),Math.round((r.amount+r.interestTotal+r.commission)*100));}
});
test('final payment absorbs rounding and malformed calculator inputs are rejected',()=>{
 const r=calculateOffers({...input,amount:1000,commissionPercent:0,months:3});assert.deepEqual(r.schedule.map(row=>row.payment),[333.33,333.33,333.34]);
 for(const change of [{amount:0},{amount:-1},{amount:Infinity},{amount:1.001},{months:7},{annualRate:101},{commissionPercent:51},{product:'BAD'},{extra:'sql'}])assert.throws(()=>calculateOffers({...input,...change}));
});
function fixture({authorized=true,rows=[{id:'1',base_origen:'A'},{id:'2',base_origen:'A'},{id:'3',base_origen:'B'}],auditFail=false}={}){
 const calls:Array<{sql:string;params:Record<string,unknown>}>=[];
 const db={query:async(sql:string,params:Record<string,unknown>={})=>{calls.push({sql,params});if(sql.startsWith('SELECT m.id'))return {recordset:authorized?[{id:'module'}]:[]};if(sql.startsWith('INSERT core.audit_events')){if(auditFail)throw Error('Audit failed');return {recordset:[]};}return {recordset:rows};}};
 return {controller:new OffersController(db as any),req:{user:{id:'operator'},correlation:'test'} as any,calls};
}
test('search preserves multiple offers per customer and base without auditing raw identity',async()=>{
 const f=fixture();const r=await f.controller.search(f.req,{field:'dni',value:'000123',page:0});assert.equal(r.rows.length,3);assert.equal(r.hasMore,false);
 const q=f.calls[1];assert.equal(q.params.value,'000123');assert(!q.sql.includes('000123'));assert(q.sql.includes('dni=CONVERT(varchar(32),@value)'));assert(q.sql.includes('activo=1'));assert(q.sql.includes('vigente_hasta'));assert(!String(f.calls[2].params.details).includes('000123'));
});
test('search types preserve leading zeros and paginate all offers',async()=>{
 for(const field of ['dni','codigo_cliente','cuenta']){const f=fixture({rows:Array.from({length:51},(_,i)=>({id:String(i+1),base_origen:'A'}))});const r=await f.controller.search(f.req,{field,value:'00099',page:1});assert.equal(r.rows.length,50);assert(r.hasMore);assert.equal(f.calls[1].params.offset,50);assert.equal(f.calls[1].params.value,'00099');}
});
test('search rejects arbitrary columns, wildcards and extra fields',async()=>{
 for(const query of [{field:'dni;DROP TABLE core.users',value:'123',page:0},{field:'dni',value:'%',page:0},{field:'dni',value:'123',page:-1},{field:'dni',value:'123',page:0,extra:true}]){const f=fixture();await assert.rejects(f.controller.search(f.req,query),{status:400});assert.equal(f.calls.length,1);}
});
test('offers endpoints require declared permission, publication and supported scope',async()=>{
 assert.equal(Reflect.getMetadata('permission',OffersController),'OFERTAS.USE');
 for(const operation of ['status','search','detail','calculate'] as const){const f=fixture({authorized:false});await assert.rejects(f.controller[operation](f.req,input),{status:403});assert.equal(f.calls.length,1);assert(f.calls[0].sql.includes('core.user_scopes'));assert.equal(f.calls[0].params.code,'OFERTAS');}
});
test('audit failure prevents disclosure and unavailable details are not returned',async()=>{const f=fixture({auditFail:true});await assert.rejects(f.controller.search(f.req,{field:'cuenta',value:'0001',page:0}));const empty=fixture({rows:[]});await assert.rejects(empty.controller.detail(empty.req,{id:'9'}),{status:404});});
test('installer exposes fixed DDL through a separate principal and refuses existing tables',()=>{
 const sql=readFileSync('database/migrations/006_offers_installer.sql','utf8');assert(sql.includes("WITH EXECUTE AS 'hub_offers_installer'"));assert(sql.indexOf('CREATE PROCEDURE')<sql.indexOf('CREATE TABLE ofertas.ofertas_cliente'));assert(sql.includes('GRANT CREATE TABLE TO hub_offers_installer'));assert(!sql.includes('GRANT CREATE TABLE TO hub_runtime'));assert(sql.includes('GRANT EXECUTE ON core.install_ofertas_v1 TO hub_runtime'));assert(sql.includes('THROW 51801'));assert(!/\bDROP\b|\bTRUNCATE\b/.test(sql));assert(!sql.includes('CREATE UNIQUE INDEX'));
});
