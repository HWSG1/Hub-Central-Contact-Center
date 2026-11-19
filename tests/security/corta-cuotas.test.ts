import 'reflect-metadata';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePurchase } from '../../apps/portal-api/src/business/corta-cuotas.js';
import { descriptor,validateDescriptor } from '../../apps/portal-api/src/business/registry.js';
process.env['APP_ORIGIN']='http://localhost:4200';process.env['SQL_SERVER']='localhost';process.env['SQL_DATABASE']='ContactCenterHub_Test';
const {BusinessController}=await import('../../apps/portal-api/src/business/business.controller.js');

test('matches cached Excel example C6:C17: 18000, 12 months, no campaign',()=>{
 const r=calculatePurchase({amount:18000,months:12,campaign:false});
 assert.equal(r.commissionPercent,12);assert.equal(r.commission,2160);assert.equal(r.monthlyPrincipal,1500);assert.equal(r.firstPayment,3660);assert.equal(r.total,20160);assert.equal(r.nominalInterest,0);
});
test('all six terms match regular and promotional workbook tariff',()=>{
 const terms=[3,6,9,12,18,24],regular=[6,9,10,12,18,20],promo=[6,4,10,8,18,20];
 terms.forEach((months,i)=>{assert.equal(calculatePurchase({amount:18000,months,campaign:false}).commissionPercent,regular[i]);assert.equal(calculatePurchase({amount:18000,months,campaign:true}).commissionPercent,promo[i]);});
});
test('promotion is strictly above 10000 and maximum is inclusive',()=>{
 assert.equal(calculatePurchase({amount:10000,months:6,campaign:true}).commissionPercent,9);
 assert.equal(calculatePurchase({amount:10000.01,months:6,campaign:true}).commissionPercent,4);
 assert.equal(calculatePurchase({amount:500000,months:24,campaign:false}).total,600000);
 assert.equal(calculatePurchase({amount:0.01,months:3,campaign:false}).amount,0.01);
});
test('invalid input never produces a misleading zero result',()=>{
 for(const patch of [{amount:0},{amount:-1},{amount:500000.01},{amount:NaN},{amount:Infinity},{amount:100.001},{months:0},{months:5},{campaign:'false'},{amount:'18000'},{extra:1}])assert.throws(()=>calculatePurchase({amount:18000,months:12,campaign:false,...patch}));
});
test('fractional monthly principal is not prematurely rounded',()=>{
 const r=calculatePurchase({amount:10000,months:3,campaign:false});assert.equal(r.monthlyPrincipal,10000/3);assert.equal(r.firstPayment,10000/3+600);assert.equal(r.total,10600);
});
test('descriptor requires exact included module, version, route, permission and hash',()=>{
 assert.deepEqual(validateDescriptor(descriptor),descriptor);
 for(const patch of [{id:'OTHER'},{version:'9.0.0'},{permission:'CORE.USERS.CREATE'},{descriptorSha256:'0'.repeat(64)},{script:'evil'},{route:'https://outside.example'}])assert.throws(()=>validateDescriptor({...descriptor,...patch}));
});
test('calculator APIs require use permission and reject disabled or unauthorized scope',async()=>{
 assert.equal(Reflect.getMetadata('permission',BusinessController),'CORTA_CUOTAS.USE');
 let called='';const db={query:async(sql:string)=>{called=sql;return {recordset:[]};}};
 const controller=new BusinessController(db as any),req={user:{id:'test'}} as any;
 await assert.rejects(controller.status(req),{status:403});
 await assert.rejects(controller.calculate(req,{amount:18000,months:12,campaign:false}),{status:403});
 for(const rule of ['m.enabled=1','a.published=1','core.user_scopes',"i.state='PUBLISHED'"])assert(called.includes(rule));
});
