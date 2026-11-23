import type {Queries} from './contracts.js';
export function compileQuery(code:string,queries:Queries,name:string,value:unknown,actor?:string){
 const query=Object.hasOwn(queries,name)?queries[name]:undefined;
 if(!query||('kind' in query&&query.kind==='insert')||!value||typeof value!=='object'||Array.isArray(value))throw Error('Consulta inválida.');
 const input=value as Record<string,unknown>;
 const allowed=[...query.filters.map(f=>f.param),...(query.page?['page']:[]),...(query.scope?['period']:[])];
 if(Object.keys(input).some(k=>!allowed.includes(k)))throw Error('Parámetros no admitidos.');
 const params:Record<string,unknown>={};const filters:string[]=[];
 query.filters.forEach((filter,index)=>{const data=input[filter.param];if(typeof data!=='string'||(filter.type==='id'?!/^[1-9][0-9]{0,17}$/.test(data):!/^[0-9A-Za-z-]{1,40}$/.test(data)))throw Error('Identificador inválido.');const key='p'+index;params[key]=data;filters.push(`[${filter.column}]=CONVERT(${filter.type==='id'?'bigint':'varchar(40)'},@${key})`);});
 if(query.active)filters.push('[activo]=1');
 if(query.scope==='actor_month'){
  if(!actor||typeof input.period!=='string'||!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(input.period))throw Error('Período inválido.');
  params.actor=actor;params.period=input.period+'-01';
  filters.push('['+query.actorColumn+']=@actor');
  filters.push('['+query.dateColumn+']>=CONVERT(date,@period,23)');
  filters.push('['+query.dateColumn+']<DATEADD(month,1,CONVERT(date,@period,23))');
 }
 let page=0;if(query.page){if(!Number.isInteger(input.page)||Number(input.page)<0||Number(input.page)>10000)throw Error('Página inválida.');page=Number(input.page);}params.offset=page*50;
 // Names originate solely from the signed, schema-validated declaration.
 const columns=query.columns.map(c=>c.toLowerCase()==='id'?`CONVERT(varchar(20),[${c}]) AS [${c}]`:`[${c}]`).join(',');
 return {sql:`SELECT ${columns} FROM [mod_${code.toLowerCase()}].[${query.table}]${filters.length?' WHERE '+filters.join(' AND '):''} ORDER BY [id] OFFSET @offset ROWS FETCH NEXT ${query.page?51:1} ROWS ONLY`,params};
}

export function compileInsert(code:string,queries:Queries,name:string,value:unknown,actor:string){
 const query=Object.hasOwn(queries,name)?queries[name]:undefined;
 if(!query||!('kind' in query)||query.kind!=='insert'||!value||typeof value!=='object'||Array.isArray(value)||!actor)throw Error('Operación de registro inválida.');
 const input=value as Record<string,unknown>;
 if(Object.keys(input).length!==query.columns.length||Object.keys(input).some(k=>!query.columns.includes(k)))throw Error('Columnas no admitidas.');
 const params:Record<string,unknown>={actor};const insertColumns:string[]=[];const values:string[]=[];
 for(let i=0;i<query.columns.length;i++){
  const c=query.columns[i];const val=input[c];
  if(typeof val!=='string'||val.length===0||val.length>300||/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]/.test(val))throw Error('Valor no admitido.');
  params['p'+i]=val;insertColumns.push('['+c+']');values.push('@p'+i);
 }
 const uniqueIndex=query.columns.indexOf(query.uniqueBy);
 const table='[mod_'+code.toLowerCase()+'].['+query.table+']';
 const sql='INSERT INTO '+table+' ('+[...insertColumns,'['+query.actorColumn+']'].join(',')+') OUTPUT INSERTED.id SELECT '+[...values,'@actor'].join(',')+
 ' WHERE NOT EXISTS (SELECT 1 FROM '+table+' WITH (UPDLOCK,HOLDLOCK) WHERE ['+query.uniqueBy+']=@p'+uniqueIndex+' AND [activo]=1)';
 return {sql,params};
}
