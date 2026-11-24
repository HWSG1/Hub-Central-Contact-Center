import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {live} from '../../apps/portal-api/src/security/policy.js';

test('the session lasts at most 12 hours while idle timeout remains 15 minutes',()=>{
 const now=new Date('2026-11-24T12:00:00Z');
 assert(live({created_at:new Date(+now-12*3600000+1000),last_seen_at:now,revoked_at:null},now));
 assert(!live({created_at:new Date(+now-12*3600000),last_seen_at:now,revoked_at:null},now));
 assert(!live({created_at:now,last_seen_at:new Date(+now-15*60000),revoked_at:null},now));
});
test('session cookie and module SQL validity use 12h, not 8h',()=>{
 const auth=readFileSync('apps/portal-api/src/security/auth.controller.ts','utf8');
 const runtime=readFileSync('apps/portal-api/src/modules/runtime.controller.ts','utf8');
 assert.equal((auth.match(/maxAge:43200000/g)??[]).length,2);
 assert.match(runtime,/s\.created_at>DATEADD\(hour,-12,SYSUTCDATETIME\(\)\)/);
});
test('base management reauthentication is required after 8h',()=>{
 for(const path of ['apps/portal-api/src/admin/tlv-bases.controller.ts','apps/portal-api/src/admin/monitoreo-bases.controller.ts']){
  const source=readFileSync(path,'utf8');
  assert.match(source,/8\*60\*60\*1000/);
  assert.doesNotMatch(source,/getTime\(\)>15\*60\*1000/);
 }
 const admin=readFileSync('apps/portal-api/src/admin/admin.service.ts','utf8');
 assert.match(admin,/permission!=='CORE\.MODULES\.MANAGE'&&Date\.now\(\)-\+new Date\(session\.created_at\)>900000/);
});
