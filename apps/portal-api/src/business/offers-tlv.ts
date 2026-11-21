import { detailRules,tlvColumns,dateColumns } from './offers-fields.js';
type Row=Record<string,unknown>;
type Profile=keyof typeof detailRules;
type Rule={key:string;label:string;aol?:boolean;greaterThanOne?:boolean};
const normalize=(value:unknown)=>String(value??'').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const present=(value:unknown)=>value!==null&&value!==undefined&&String(value).trim()!==''&&normalize(value)!=='[NULL]';
export function profileOf(row:Row):Profile|'FINANCIAMIENTOS'|'GENERAL'{
 const base=normalize(row.TIPO_BASE),kind=normalize(row.TIPO_FINANCIAMIENTO);
 if(base.includes('AOL')&&base.includes('INTRA/EXTRA'))return kind.includes('INTRA')?'INTRA':kind.includes('EXTRA')?'EXTRA':'FINANCIAMIENTOS';
 if(base.includes('CORTA CUOTA'))return 'CORTA_CUOTAS';
 if(base.includes('EXTRAFINANCIAMIENTO'))return 'EXTRA';
 if(base.includes('INTRAFINANCIAMIENTO'))return 'INTRA';
 if(base.includes('EMPRESARIAL')||base.includes('ALIADAS')||base.startsWith('IMPUESTOS'))return 'EMPRESARIAL';
 if(base.includes('UPGRADE'))return 'UPGRADE';
 if(base.includes('AUMENTO'))return 'AUMENTO';
 if(base.includes('ADICIONAL'))return 'ADICIONALES';
 if(base.includes('HRE'))return 'HRE';
 if(base.includes('DBA'))return 'DBA';
 if(base.includes('ACTIVACI'))return /\bTD\b/.test(base)?'ACTIVACION_TD':'ACTIVACION_TC';
 if(base.includes('TC TITULAR'))return 'TC';
 return 'GENERAL';
}
function valueOf(row:Row,key:string){const value=row[key];if(!present(value))return null;if((dateColumns as readonly string[]).includes(key))return value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10);return value;}
export function tlvDetail(row:Row){
 const profile=profileOf(row),aol=normalize(row.TIPO_BASE).includes('AOL');
 const rules:readonly Rule[]=profile==='GENERAL'?['TIPO_BASE','DNI','CODIGO_CLIENTE','COD_CLIENTE_CRM','CUENTA','NOMBRE_CLIENTE','MES_BASE'].map(key=>({key,label:key.replaceAll('_',' ')})):profile==='FINANCIAMIENTOS'?[...detailRules.EXTRA,...detailRules.INTRA,...detailRules.CORTA_CUOTAS]:detailRules[profile];
 const seen=new Set<string>();const fields=[];
 for(const rule of rules){if(seen.has(rule.key)||rule.aol&&!aol)continue;seen.add(rule.key);const value=valueOf(row,rule.key);if(rule.greaterThanOne&&!(Number(value)>1))continue;fields.push({key:rule.key,label:rule.label,value});}
 return {profile,fields};
}
export function tlvSummary(row:Row){
 const profile=profileOf(row);
 const simulations:Array<{product:'EXTRA'|'INTRA'|'CORTA_CUOTAS';amount:number;rate:number|null}>=[];
 for(const [product,amountKey,rateKey] of [['EXTRA','MONTO_OFERTA_EXTRA','TASA_EXTRA'],['INTRA','MONTO_OFERTA_INTRA','TASA_INTRA'],['CORTA_CUOTAS','MONTO_OFERTA_CC','']] as const){
  if((profile===product||profile==='FINANCIAMIENTOS')&&Number(row[amountKey])>1)simulations.push({product,amount:Number(row[amountKey]),rate:rateKey&&present(row[rateKey])?Number(row[rateKey]):null});
 }
 return {id:'tlv:'+String(row.id),base_origen:String(row.TIPO_BASE??''),producto:profile,nombre_cliente:row.NOMBRE_CLIENTE??'',dni:row.DNI??null,codigo_cliente:row.CODIGO_CLIENTE??null,cuenta:row.CUENTA??null,monto_oferta:simulations[0]?.amount??null,tasa_anual:simulations[0]?.rate??null,tasa_minima:null,tasa_maxima:null,oferta:String(row.NOMBRE_TC??''),simulations};
}
// Closed column lists; no client-provided SQL identifiers or expressions.
export const tlvDetailSelect=tlvColumns.map(column=>`[${column}]`).join(',');
export const tlvSummarySelect=['TIPO_BASE','DNI','CODIGO_CLIENTE','CUENTA','NOMBRE_CLIENTE','NOMBRE_TC','TIPO_FINANCIAMIENTO','MONTO_OFERTA_EXTRA','MONTO_OFERTA_INTRA','MONTO_OFERTA_CC','TASA_EXTRA','TASA_INTRA'].map(column=>`[${column}]`).join(',');
