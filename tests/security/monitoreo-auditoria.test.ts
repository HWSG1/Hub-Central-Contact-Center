import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('monitor preview audit supplies required correlation id from authenticated request',()=>{
 const api=readFileSync('apps/portal-api/src/admin/monitoreo-bases.controller.ts','utf8');
 assert.match(api,/INSERT core\.audit_events\(user_id,action,result,correlation_id,resource_type,details\)/);
 assert.match(api,/correlation:req\.correlation/);
 assert.match(api,/EXEC core\.monitoreo_tc_importar @usuario=@usuario,@correlation=@correlation/);
 assert.match(api,/EXEC core\.monitoreo_tc_guardar_codigo @usuario=@actor,@correlation=@correlation/);
});
test('migration 014 repairs audit requirements without deleting data or resetting history',()=>{
 const sql=readFileSync('database/migrations/014_monitoreo_tc_auditoria.sql','utf8');
 assert.match(sql,/ALTER PROCEDURE core\.monitoreo_tc_importar/);
 assert.match(sql,/ALTER PROCEDURE core\.monitoreo_tc_guardar_codigo/);
 assert.match(sql,/INSERT core\.audit_events\(user_id,action,result,correlation_id,resource_type,resource_id,details\)/);
 assert.match(sql,/@correlation,'monitoreo_codigo',NULL/);
 assert.match(sql,/@correlation,'monitoreo_tc',@carga/);
 assert.doesNotMatch(sql,/DROP\s+TABLE|TRUNCATE\s+TABLE/i);
});
