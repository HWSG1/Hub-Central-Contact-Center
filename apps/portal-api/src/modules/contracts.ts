import {z} from 'zod';
export const ident=z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,47}$/);
export const column=z.object({name:ident,type:z.enum(['varchar(40)','nvarchar(300)','nvarchar(2000)','decimal(19,4)','decimal(9,4)','int','bigint','date','bit']),nullable:z.boolean()}).strict();
export const migrationSchema=z.object({tables:z.array(z.object({name:ident,columns:z.array(column).min(1).max(100),indexes:z.array(z.array(ident).min(1).max(4)).max(5)}).strict()).min(1).max(10)}).strict();
const readQuery=z.object({table:ident,columns:z.array(ident).min(1).max(100),filters:z.array(z.object({column:ident,param:ident,type:z.enum(['text','id'])}).strict()).max(5),active:z.boolean(),page:z.boolean(),scope:z.literal('actor_month').optional(),actorColumn:ident.optional(),dateColumn:ident.optional()}).strict();
const insertQuery=z.object({kind:z.literal('insert'),table:ident,columns:z.array(ident).min(1).max(20),actorColumn:ident,uniqueBy:ident}).strict();
export const querySchema=z.record(ident,z.union([readQuery,insertQuery]));
export const manifestSchema=z.object({format:z.literal('hub-package-v2'),id:z.string().regex(/^[A-Z][A-Z0-9_]{2,39}$/),name:z.string().min(1).max(150),description:z.string().max(500),version:z.string().regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}$/),hostApi:z.literal(1),publisher:ident,permission:z.string().regex(/^[A-Z][A-Z0-9_]{2,39}\.USE$/),files:z.record(z.string(),z.string().regex(/^[a-f0-9]{64}$/)),operations:z.array(ident).min(1).max(20)}).strict();
export type PackageManifest=z.infer<typeof manifestSchema>;
export type Migration=z.infer<typeof migrationSchema>;
export type Queries=z.infer<typeof querySchema>;
export function validateContracts(manifest:PackageManifest,migration:Migration,queries:Queries){
 if(manifest.id.startsWith('CORE')||!manifest.operations.includes('health'))throw Error('Código reservado o falta operación health.');
 if(manifest.permission!==manifest.id+'.USE')throw Error('El permiso debe pertenecer al módulo.');
 if(new Set(manifest.operations).size!==manifest.operations.length)throw Error('Operaciones duplicadas.');
 const tables=new Map<string,Set<string>>();
 for(const table of migration.tables){const key=table.name.toLowerCase();if(tables.has(key))throw Error('Tabla duplicada.');const names=table.columns.map(c=>c.name.toLowerCase());if(new Set(names).size!==names.length||names.some(n=>['id','activo','cargado_en'].includes(n)))throw Error('Columna duplicada o reservada.');const fields=new Set([...names,'id','activo','cargado_en']);tables.set(key,fields);for(const index of table.indexes)if(index.some(c=>!fields.has(c.toLowerCase())))throw Error('Índice inválido.');}
 for(const query of Object.values(queries)){
 const fields=tables.get(query.table.toLowerCase());if(!fields)throw Error('Consulta fuera del esquema declarado.');
 if('kind' in query&&query.kind==='insert'){
  if([...query.columns,query.actorColumn,query.uniqueBy].some(c=>!fields.has(c.toLowerCase()))||!query.columns.includes(query.uniqueBy)||query.columns.includes(query.actorColumn)||new Set(query.columns.map(c=>c.toLowerCase())).size!==query.columns.length)throw Error('Inserción fuera del esquema declarado.');
 }else{
  if([...query.columns,...query.filters.map(f=>f.column),...(query.scope?[query.actorColumn??'',query.dateColumn??'']:[])].some(c=>!fields.has(c.toLowerCase())))throw Error('Consulta fuera del esquema declarado.');
  if(new Set(query.filters.map(f=>f.param)).size!==query.filters.length||query.filters.some(f=>f.param==='period'||f.param==='page'))throw Error('Parámetro duplicado o reservado.');
  if(query.scope&&(!query.page||query.filters.length||!query.actorColumn||!query.dateColumn))throw Error('Consulta de operador inválida.');
 }
}
}
