import type {Queries} from './contracts.js';
export function compileQuery(code:string,queries:Queries,name:string,value:unknown){
 const query=Object.hasOwn(queries,name)?queries[name]:undefined;
 if(!query||!value||typeof value!=='object'||Array.isArray(value))throw Error('Consulta inválida.');
 const input=value as Record<string,unknown>;
 const allowed=[...query.filters.map(f=>f.param),...(query.page?['page']:[])];
 if(Object.keys(input).some(k=>!allowed.includes(k)))throw Error('Parámetros no admitidos.');
 const params:Record<string,unknown>={};const filters:string[]=[];
 query.filters.forEach((filter,index)=>{const data=input[filter.param];if(typeof data!=='string'||(filter.type==='id'?!/^[1-9][0-9]{0,17}$/.test(data):!/^[0-9A-Za-z-]{1,40}$/.test(data)))throw Error('Identificador inválido.');const key='p'+index;params[key]=data;filters.push(`[${filter.column}]=CONVERT(${filter.type==='id'?'bigint':'varchar(40)'},@${key})`);});
 if(query.active)filters.push('[activo]=1');
 let page=0;if(query.page){if(!Number.isInteger(input.page)||Number(input.page)<0||Number(input.page)>10000)throw Error('Página inválida.');page=Number(input.page);}params.offset=page*50;
 // Names originate solely from the signed, schema-validated declaration.
 const columns=query.columns.map(c=>c.toLowerCase()==='id'?`CONVERT(varchar(20),[${c}]) AS [${c}]`:`[${c}]`).join(',');
 return {sql:`SELECT ${columns} FROM [mod_${code.toLowerCase()}].[${query.table}]${filters.length?' WHERE '+filters.join(' AND '):''} ORDER BY [id] OFFSET @offset ROWS FETCH NEXT ${query.page?51:1} ROWS ONLY`,params};
}
