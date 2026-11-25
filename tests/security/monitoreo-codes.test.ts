import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {querySchema} from '../../apps/portal-api/src/modules/contracts.js';
import {compileInsert,compileQuery} from '../../apps/portal-api/src/modules/query.js';

const declarations=querySchema.parse({
 registrar_codigo:{kind:'insert',table:'codigos_respuesta',columns:['codigo','descripcion','accion'],actorColumn:'registrado_por',uniqueBy:'codigo'},
 buscar_dni:{table:'alertas',columns:['id','id_trx','fecha_evento','fecha_hora_origen'],filters:[{column:'dni',param:'value',type:'text'}],active:true,page:true}
});
test('Monitoreo response-code bootstrap never recreates disabled catalog codes',()=>{
 const q=compileInsert('MONITOREO_TC',declarations,'registrar_codigo',
  {codigo:'5C',descripcion:'Pendiente',accion:'D'},'server-user');
 assert.match(q.sql,/NOT EXISTS/);
 assert.doesNotMatch(q.sql,/AND \[activo\]=1/);
 assert.equal(q.params.actor,'server-user');
});
test('Monitoreo historical results ordered by event date regardless of import batch',()=>{
 const q=compileQuery('MONITOREO_TC',declarations,'buscar_dni',{value:'0801199900000',page:0});
 assert.match(q.sql,/ORDER BY \[fecha_evento\] DESC,\[fecha_hora_origen\] DESC,\[id\] DESC/);
 assert.doesNotMatch(q.sql,/carga_id/);
});
test('Catalog administration migration audits edits and deactivates without DELETE',()=>{
 const sql=readFileSync('database/migrations/013_monitoreo_tc_codigos.sql','utf8');
 assert.match(sql,/MONITOREO_TC\.CODE\./);
 assert.match(sql,/SET activo=0/);
 assert.doesNotMatch(sql,/DELETE\s+FROM\s+mod_monitoreo_tc/i);
});
