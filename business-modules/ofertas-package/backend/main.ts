import {calculateOffers,terms,intraPlans} from './calculator.js';
import {tlvSummary,tlvDetail} from './tlv.js';
type Api={query:(name:string,params:Record<string,unknown>)=>Promise<Record<string,unknown>[]>};
export async function handle(operation:string,input:unknown,api:Api){
 if(operation==='health')return {ok:true};
 if(operation==='status')return {terms,intraPlans};
 if(operation==='calculate')return calculateOffers(input);
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Entrada inválida.');
 const data=input as Record<string,unknown>;
 if(operation==='search'){
  if(!['dni','codigo_cliente','cuenta'].includes(String(data.field))||Object.keys(data).some(k=>!['field','value','page'].includes(k)))throw Error('Búsqueda inválida.');
  const rows=await api.query('search_'+data.field,{value:data.value,page:data.page});return {rows:rows.slice(0,50).map(tlvSummary),hasMore:rows.length>50};
 }
 if(operation==='detail'){
  if(typeof data.id!=='string'||Object.keys(data).some(k=>k!=='id'))throw Error('Identificador inválido.');
  const row=(await api.query('detail',{id:data.id.replace(/^tlv:/,'')}))[0];if(!row)throw Error('Oferta no disponible.');return {...tlvSummary(row),...tlvDetail(row)};
 }
 throw Error('Operación no admitida.');
}
