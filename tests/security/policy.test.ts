import { test } from 'node:test';
import assert from 'node:assert/strict';
import { active,live,opaque,digest,same } from '../../apps/portal-api/src/security/policy.js';
const now=new Date('2026-11-17T12:00:00Z');
test('sesión: límites de inactividad, absoluta y revocación',()=>{const base={created_at:now,last_seen_at:now,revoked_at:null};assert(live(base,now));assert(!live({...base,last_seen_at:new Date(+now-900000)},now));assert(!live({...base,created_at:new Date(+now-43200000)},now));assert(!live({...base,revoked_at:now},now));});
test('usuario deshabilitado o expirado no accede',()=>{assert(active({enabled:true,expires_at:null},now));assert(!active({enabled:false,expires_at:null},now));assert(!active({enabled:true,expires_at:now},now));});
test('tokens opacos: entropía, hash y comparación CSRF',()=>{const a=opaque(),b=opaque();assert.equal(a.length,43);assert.notEqual(a,b);assert.equal(digest(a).length,64);assert(!digest(a).includes(a));assert(same(a,a));assert(!same(a,b));assert(!same(undefined,a));assert(!same(a+'x',a));});
