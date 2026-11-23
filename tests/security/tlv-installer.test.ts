import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

// Pruebas sin acceso a red ni a SQL Server: guardas de seguridad y coherencia
// del paquete y de la migracion. NO sustituyen las pruebas de integracion SQL.
const root=process.cwd();
const read=(path:string)=>readFileSync(resolve(root,path),'utf8');
const require=createRequire(resolve(root,'package.json'));
const builder=require(resolve(root,'scripts/build-install-sql.cjs')) as {
 readMigrations:()=>Array<{name:string;hash:string;source:string}>;
 render:(migrations:Array<{name:string;hash:string;source:string}>)=>string;
};
const migration=()=>read('database/migrations/010_tlv_auditoria_installer.sql');

test('TLV 010: checksum, orden y SQL consolidado no tienen desalineaciones',()=>{
 const migrations=builder.readMigrations();
 assert.equal(migrations.at(-1)?.name,'010_tlv_auditoria_installer.sql');
 assert.equal(builder.render(migrations),read('manual-instalacion/sql/Instalar-Actualizar-Hub.sql'));
});

test('TLV 010: la instalacion es fija, transaccional e idempotente para nuevas tablas',()=>{
 const sql=migration();
 assert.match(sql,/CREATE PROCEDURE core\.prepare_tlv_auditoria_v1\s+WITH EXECUTE AS OWNER/i);
 assert.match(sql,/IF @@TRANCOUNT=0 THROW 52100/i);
 assert.match(sql,/code='OFERTAS_TLV'/);
 assert.match(sql,/principal_id=DATABASE_PRINCIPAL_ID\(N'hub_package_owner'\)/);
 for(const table of ['cargas','carga_eventos','carga_errores'])
  assert.ok(sql.includes("OBJECT_ID(N'mod_ofertas_tlv."+table+"',N'U') IS NULL"),table);
 for(const col of ['carga_id','archivo_fila'])
  assert.ok(sql.includes("COL_LENGTH('mod_ofertas_tlv.base_tlv','"+col+"') IS NULL"),col);
 for(const proc of ['activar_carga','restaurar_carga'])
  assert.ok(sql.includes("OBJECT_ID(N'mod_ofertas_tlv."+proc+"',N'P') IS NULL"),proc);
 assert.doesNotMatch(sql,/\bDROP\s+(?:TABLE|SCHEMA|PROCEDURE)\b/i);
 assert.doesNotMatch(sql,/\bTRUNCATE\s+TABLE\b/i);
 assert.ok(!sql.includes('GRANT EXECUTE ON OBJECT::mod_ofertas_tlv.restaurar_carga'));
});

test('TLV 010: la API explica migracion faltante y ejecuta instalacion controlada',()=>{
 const service=read('apps/portal-api/src/admin/admin.service.ts');
 assert.match(service,/Falta la actualizaci[oó]n 010 del Hub/);
 assert.ok(service.includes("if(manifest.id==='OFERTAS_TLV')"));
 assert.ok(service.includes("await q('EXEC core.prepare_tlv_auditoria_v1;')"));
 const contracts=read('apps/portal-api/src/modules/contracts.ts');
 assert.ok(contracts.includes('migrationSchema'));
 assert.ok(contracts.includes('.strict()'));
 assert.doesNotMatch(contracts,/sqlStatement|arbitrarySql|rawSql/);
});

test('TLV import: SQL_AUTH=sql utiliza credenciales solo del entorno y permite Windows',()=>{
 const script=read('apps/portal-api/scripts/tlv-import.py');
 assert.ok(script.includes("os.environ.get('SQL_AUTH'"));
 assert.ok(script.includes("os.environ.get('SQL_USER'"));
 assert.ok(script.includes("os.environ.get('SQL_PASSWORD'"));
 assert.ok(script.includes("value.replace('}', '}}')"));
 assert.ok(script.includes("Trusted_Connection=Yes;"));
 assert.doesNotMatch(script,/ap\.add_argument\('--(?:password|usuario-sql|sql-password)'/);
 const controller=read('apps/portal-api/src/admin/tlv-bases.controller.ts');
 assert.ok(controller.includes("config.SQL_PORT"));
 assert.ok(!controller.includes("'--sql-password'"));
});

test('TLV 010: una instalacion existente recibe estructuras al aplicar la migracion',()=>{
 const sql=migration();
 assert.match(sql,/IF EXISTS\s*\(SELECT 1 FROM core\.modules WHERE code='OFERTAS_TLV'\)\s*EXEC core\.prepare_tlv_auditoria_v1;/i);
 assert.match(sql,/GRANT EXECUTE ON OBJECT::core\.prepare_tlv_auditoria_v1 TO hub_runtime;/i);
});
