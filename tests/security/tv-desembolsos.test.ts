import test from 'node:test';
import assert from 'node:assert/strict';
import {querySchema,migrationSchema,manifestSchema,validateContracts} from '../../apps/portal-api/src/modules/contracts.js';
import {compileInsert,compileQuery} from '../../apps/portal-api/src/modules/query.js';
const manifest=manifestSchema.parse({format:'hub-package-v2',id:'TV_DESEMBOLSOS',name:'Desembolsos',description:'',version:'1.0.0',hostApi:1,publisher:'contact_center_development',permission:'TV_DESEMBOLSOS.USE',files:{},operations:['health','save','history']});
const migration=migrationSchema.parse({tables:[{name:'certificados',columns:[
{name:'certificado',type:'varchar(40)',nullable:false},{name:'tipo_venta',type:'nvarchar(300)',nullable:false},{name:'tipo_desembolso',type:'nvarchar(300)',nullable:false},{name:'fecha_desembolso',type:'date',nullable:false},{name:'registrado_por',type:'nvarchar(300)',nullable:false}],indexes:[['certificado'],['registrado_por','fecha_desembolso']]}]});
const queries=querySchema.parse({guardar:{kind:'insert',table:'certificados',columns:['certificado','tipo_venta','tipo_desembolso','fecha_desembolso'],actorColumn:'registrado_por',uniqueBy:'certificado'},historial:{table:'certificados',columns:['id','certificado','tipo_venta','tipo_desembolso','fecha_desembolso'],filters:[],active:true,page:true,scope:'actor_month',actorColumn:'registrado_por',dateColumn:'fecha_desembolso'}});
test('TV declarations are valid',()=>assert.doesNotThrow(()=>validateContracts(manifest,migration,queries)));
test('insert binds server identity and uses an atomic duplicate guard',()=>{
 const q=compileInsert('TV_DESEMBOLSOS',queries,'guardar',{certificado:'012345678',tipo_venta:'EXTRA',tipo_desembolso:'CUENTA',fecha_desembolso:'2026-11-23'},'server-user-1');
 assert.equal(q.params.actor,'server-user-1');assert.equal(q.params.p0,'012345678');
 assert.match(q.sql,/INSERT INTO \[mod_tv_desembolsos\]\.\[certificados\]/);
 assert.match(q.sql,/WITH \(UPDLOCK,HOLDLOCK\)/);
 assert.doesNotMatch(q.sql,/server-user-1/);
});
test('insert rejects actor and undeclared columns from worker input',()=>{
 const input={certificado:'012345678',tipo_venta:'EXTRA',tipo_desembolso:'CUENTA',fecha_desembolso:'2026-11-23',registrado_por:'attacker'};
 assert.throws(()=>compileInsert('TV_DESEMBOLSOS',queries,'guardar',input,'real-user'));
 assert.throws(()=>compileInsert('TV_DESEMBOLSOS',queries,'historial',{},'real-user'));
});
test('history is always scoped by real actor and calendar month',()=>{
 const q=compileQuery('TV_DESEMBOLSOS',queries,'historial',{period:'2026-11',page:0},'operator-guid');
 assert.match(q.sql,/\[registrado_por\]=@actor/);
 assert.match(q.sql,/DATEADD\(month,1,CONVERT\(date,@period,23\)\)/);
 assert.equal(q.params.actor,'operator-guid');assert.equal(q.params.period,'2026-11-01');
 assert.throws(()=>compileQuery('TV_DESEMBOLSOS',queries,'historial',{period:'2026-13',page:0},'operator-guid'));
 assert.throws(()=>compileQuery('TV_DESEMBOLSOS',queries,'historial',{period:'2026-11',page:0,actor:'other'},'operator-guid'));
 assert.throws(()=>compileQuery('TV_DESEMBOLSOS',queries,'historial',{period:'2026-11',page:0}));
});
test('old read-only contract remains compatible',()=>{
 const old=querySchema.parse({search:{table:'certificados',columns:['id'],filters:[{column:'certificado',param:'value',type:'text'}],active:true,page:true}});
 assert.match(compileQuery('TV_DESEMBOLSOS',old,'search',{value:'012345678',page:0}).sql,/WHERE \[certificado\]/);
});
