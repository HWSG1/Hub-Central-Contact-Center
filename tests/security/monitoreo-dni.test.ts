import test from 'node:test';
import assert from 'node:assert/strict';
import {compileQuery} from '../../apps/portal-api/src/modules/query.js';
import type {Queries} from '../../apps/portal-api/src/modules/contracts.js';

const queries:Queries={
 buscar_dni:{table:'alertas',columns:['id','dni','fecha_evento'],filters:[{column:'dni',param:'value',type:'text'}],active:true,page:true},
 buscar_cuenta:{table:'alertas',columns:['id','cuenta'],filters:[{column:'cuenta',param:'value',type:'text'}],active:true,page:true}
};
test('Monitoreo searches zero-padded and unpadded DNI without mutating input',()=>{
 const p=compileQuery('MONITOREO_TC',queries,'buscar_dni',{value:'0715198901262',page:0});
 assert.equal(p.params.p0,'0715198901262');
 assert.equal(p.params.p0Normalized,'715198901262');
 assert.equal(p.params.p0Padded,'0715198901262');
 assert.match(p.sql,/\[dni\]=@p0Normalized/);
 const fromExcel=compileQuery('MONITOREO_TC',queries,'buscar_dni',{value:'0801000000123',page:0});
 assert.equal(fromExcel.params.p0,'0801000000123');
 assert.equal(fromExcel.params.p0Normalized,'801000000123');
 assert.equal(fromExcel.params.p0Padded,'0801000000123');
 const reverse=compileQuery('MONITOREO_TC',queries,'buscar_dni',{value:'715198901262',page:0});
 assert.equal(reverse.params.p0Padded,'0715198901262');
});
test('Account search never strips leading zeros',()=>{
 const p=compileQuery('MONITOREO_TC',queries,'buscar_cuenta',{value:'0012345678901',page:0});
 assert.equal(p.params.p0,'0012345678901');
 assert.equal(p.params.p0Normalized,undefined);
 assert.doesNotMatch(p.sql,/p0Normalized/);
});

test('Monitoreo never exposes the internal blocking rule in alert query results',()=>{
 const cases:Queries={
  buscar_dni:{table:'alertas',columns:['id','dni','regla','regla_id','respuesta_codigo'],filters:[{column:'dni',param:'value',type:'text'}],active:true,page:true},
  buscar_cuenta:{table:'alertas',columns:['id','cuenta','regla','regla_id','respuesta_codigo'],filters:[{column:'cuenta',param:'value',type:'text'}],active:true,page:true}
 };
 for(const name of ['buscar_dni','buscar_cuenta']){
  const result=compileQuery('MONITOREO_TC',cases,name,{value:'0801198507538',page:0});
  const projection=result.sql.split(' FROM ')[0];
  assert.doesNotMatch(projection,/\[regla(?:_id)?\]/i);
  assert.match(projection,/\[respuesta_codigo\]/);
 }
 const otherModule=compileQuery('ANOTHER_MODULE',cases,'buscar_cuenta',{value:'0801198507538',page:0});
 assert.match(otherModule.sql.split(' FROM ')[0],/\[regla\]/);
});
