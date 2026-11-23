import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {profileOf,tlvDetail,tlvSummary} from '../../apps/portal-api/src/business/offers-tlv.js';
import {tlvColumns} from '../../apps/portal-api/src/business/offers-fields.js';
test('all consolidated headers exist as typed columns in deferred TLV installer',()=>{
 const headers=readFileSync('business-modules/ofertas/plantilla-tlv.csv','utf8').trim().split(',');assert.equal(headers.length,33);
 const sql=readFileSync('database/migrations/007_offers_tlv.sql','utf8');for(const field of headers){assert(tlvColumns.includes(field as any));assert(sql.includes(`[${field}] `));}
 assert(sql.indexOf('CREATE PROCEDURE')<sql.indexOf('CREATE TABLE ofertas.base_tlv'));assert(sql.includes("WITH EXECUTE AS 'hub_offers_installer'"));assert(!sql.includes('GRANT CREATE TABLE TO hub_runtime'));assert(!/\bDROP\b|\bTRUNCATE\b/.test(sql));assert(sql.includes("IF EXISTS(SELECT 1 FROM core.modules WHERE code='OFERTAS')"));
});
test('observed bases resolve to explicit profiles including malformed accent and AOL',()=>{
 const pairs={'BASE TC TITULAR':'TC','EXTRAFINANCIAMIENTO':'EXTRA','INTRAFINANCIAMIENTO':'INTRA','BASE UPGRADE':'UPGRADE','BASE ADICIONALES':'ADICIONALES','BASE HRE':'HRE','CORTA CUOTA':'CORTA_CUOTAS','BASE ACTIVACI�N':'ACTIVACION_TC','BASE DBA':'DBA','BASE AUMENTOS':'AUMENTO','BASE IMPULSO EMPRESARIAL Y ALIADAS':'EMPRESARIAL','INTRA/EXTRA AOL':'FINANCIAMIENTOS','CORTA CUOTA AOL':'CORTA_CUOTAS','IMPUESTOS NOV':'EMPRESARIAL','ACTIVACIÓN TD':'ACTIVACION_TD'};
 for(const [TIPO_BASE,profile]of Object.entries(pairs))assert.equal(profileOf({TIPO_BASE}),profile);
 assert.equal(profileOf({TIPO_BASE:'INTRA/EXTRA AOL',TIPO_FINANCIAMIENTO:'Intrafinanciamiento'}),'INTRA');assert.equal(profileOf({TIPO_BASE:'Otra campaña'}),'GENERAL');
});
test('detail follows product field matrix and does not disclose unrelated fields',()=>{
 const row={TIPO_BASE:'BASE TC TITULAR',DNI:'00001',LIMITE:1800,MONTO:9999,CODIGO_CLIENTE:'00002',MAIL:'[NULL]',CUENTA:'999',TASA_EXTRA:40,MONTO_OFERTA_EXTRA:99999,ID_AREA:'private'};
 const result=tlvDetail(row);const values=Object.fromEntries(result.fields.map(f=>[f.key,f.value]));assert.equal(values.DNI,'00001');assert.equal(values.LIMITE,1800);assert(!('MONTO' in values));assert.equal(result.fields.find(f=>f.key==='LIMITE')?.label,'MONTO');assert.equal(values.MAIL,null);assert(!('CUENTA' in values));assert(!('TASA_EXTRA' in values));assert(!('ID_AREA' in values));
});
test('AOL-only details are hidden for ordinary financing and present for AOL',()=>{
 for(const TIPO_BASE of ['EXTRAFINANCIAMIENTO','INTRAFINANCIAMIENTO','CORTA CUOTA']){
  const row={TIPO_BASE,MONTO:500,COMERCIO:'Example',FECHA_COMPRA:new Date('2026-11-01T00:00:00Z')};
  assert(!tlvDetail(row).fields.some(f=>f.key==='COMERCIO'));
  const aol=tlvDetail({...row,TIPO_BASE:TIPO_BASE+' AOL'});assert(aol.fields.some(f=>f.key==='COMERCIO'&&f.value==='Example'));assert(aol.fields.some(f=>f.key==='FECHA_COMPRA'&&f.value==='2026-11-01'));
 }
});
test('highlighted financing amounts/rates require greater than one, preserving zero elsewhere',()=>{
 for(const value of [null,0,1,'[NULL]'])assert(!tlvDetail({TIPO_BASE:'EXTRAFINANCIAMIENTO',TASA_EXTRA:value,MONTO_OFERTA_EXTRA:value}).fields.some(f=>f.key==='TASA_EXTRA'||f.key==='MONTO_OFERTA_EXTRA'));
 const r=tlvDetail({TIPO_BASE:'EXTRAFINANCIAMIENTO',TASA_EXTRA:2,MONTO_OFERTA_EXTRA:1.01,LIMITE:0});assert(r.fields.some(f=>f.key==='LIMITE'&&f.value===0));assert(r.fields.some(f=>f.key==='TASA_EXTRA'));
});
test('summary keeps distinct row identities and offers for same client and base',()=>{
 const row={TIPO_BASE:'EXTRAFINANCIAMIENTO',CODIGO_CLIENTE:'0001',CUENTA:'0002',MONTO_OFERTA_EXTRA:3000,TASA_EXTRA:40,MONTO_OFERTA_INTRA:7000};
 assert.notEqual(tlvSummary({...row,id:'1'}).id,tlvSummary({...row,id:'2'}).id);assert.equal(tlvSummary(row).codigo_cliente,'0001');assert.deepEqual(tlvSummary(row).simulations,[{product:'EXTRA',amount:3000,rate:40}]);
 const aol=tlvSummary({...row,TIPO_BASE:'INTRA/EXTRA AOL'});assert.equal(aol.simulations.length,2);assert.equal(tlvSummary({...row,TIPO_BASE:'BASE TC TITULAR'}).simulations.length,0);
});
