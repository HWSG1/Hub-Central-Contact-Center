import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

const html=readFileSync('business-modules/ofertas-package/frontend/index.html','utf8');
const script=html.split('<script>')[1]?.split('</script>')[0]??'';

test('La versión Ofertas TLV 1.3.4 mantiene JavaScript sintácticamente válido',()=>{
 assert.match(html,/id="search-trigger"/);
 assert.match(html,/offer-search-spinner/);
 assert.match(html,/Buscando…/);
 assert.match(html,/function resetCustomerContext\(\)/);
 assert.match(html,/titleY=418;headTop=392;/);
 assert.match(html,/if\(all.length<=17\)/);
 assert.doesNotThrow(()=>new Function(script));
});

test('El PDF nombra el archivo con DNI completo, cliente, fecha y hora',()=>{
 const {ctx}=fixture();
 runInContext("selectedOffer={dni:'801198507538',nombre_cliente:'María José Pérez / Gómez'};lastSearch={field:'dni',value:'0801198507538'}",ctx);
 const filename=runInContext('pdfDownloadName()',ctx) as string;
 assert.match(filename,/^0801198507538_Maria_Jose_Perez_Gomez_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.pdf$/);
 assert.doesNotMatch(filename,/[<>:"\/\\|?*]/);
});

test('Una búsqueda nueva limpia detalle, simulación y proyección anteriores',()=>{
 const {ctx,element}=fixture();
 runInContext("config={terms:{EXTRA:[6,12,24],INTRA:[6,18],CORTA_CUOTAS:[6,12]},intraPlans:{}};selectedOffer={dni:'123'};result={schedule:[{month:1}]};",ctx);
 element('detail').hidden=false;
 element('schedule').hidden=false;
 element('selected').hidden=false;
 element('fields').children.push('dato anterior');
 runInContext('resetCustomerContext()',ctx);
 assert.equal(runInContext('selectedOffer===null',ctx),true);
 assert.equal(runInContext('result===null',ctx),true);
 assert.equal(element('detail').hidden,true);
 assert.equal(element('schedule').hidden,true);
 assert.equal(element('selected').hidden,true);
 assert.equal(element('fields').children.length,0);
 assert.equal(element('product').value,'EXTRA');
 assert.equal(element('export-pdf').hidden,true);
 assert.equal(element('export-excel').hidden,true);
 assert.equal(element('export-csv').hidden,true);
});

test('Spinner de búsqueda se activa y desactiva de forma accesible',()=>{
 const {ctx,element}=fixture();
 runInContext('setSearchLoading(true)',ctx);
 assert.equal(element('search-trigger').attrs['aria-busy'],'true');
 assert.match(element('search-trigger').innerHTML,/Buscando…/);
 runInContext('setSearchLoading(false)',ctx);
 assert.equal(element('search-trigger').attrs['aria-busy'],undefined);
 assert.equal(element('search-trigger').textContent,'Buscar');
});

function fixture(){
 const nodes=new Map<string,any>();
 function element(id:string):any{
  if(!nodes.has(id)){
   const value={
    id,value:'',textContent:'',innerHTML:'',hidden:false,children:[] as any[],attrs:{} as Record<string,string>,
    replaceChildren(...items:any[]){this.children=items;},
    append(...items:any[]){this.children.push(...items);},
    setAttribute(key:string,v:string){this.attrs[key]=v;},
    removeAttribute(key:string){delete this.attrs[key];},
    reset(){},scrollIntoView(){}
   };
   nodes.set(id,value);
  }
  return nodes.get(id);
 }
 const ctx=createContext({
  document:{getElementById:element,createElement:(tag:string)=>element('tmp:'+tag+':'+nodes.size),querySelectorAll:()=>[]},
  parent:{postMessage:()=>{}},addEventListener:()=>{},setTimeout:()=>1,clearTimeout:()=>{},console
 });
 runInContext(script,ctx);
 return {ctx,element};
}
