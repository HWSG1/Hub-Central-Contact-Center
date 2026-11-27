import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {resolveDevPorts,angularEnvironment}=require('../../scripts/dev-ports.cjs');

test('Development ports default to web 4200 and API 3000',()=>{
 assert.deepEqual(resolveDevPorts({}),{frontend:4200,backend:3000});
});
test('FRONTEND_PORT and BACKEND_PORT are independent of inherited PORT',()=>{
 assert.deepEqual(resolveDevPorts({FRONTEND_PORT:'4300',BACKEND_PORT:'3100',PORT:'9999'}),{frontend:4300,backend:3100});
 assert.deepEqual(resolveDevPorts({PORT:'3050'}),{frontend:4200,backend:3050});
});
test('Angular never receives the conflicting generic PORT variable',()=>{
 const original={PORT:'3000',BACKEND_PORT:'3000',FRONTEND_PORT:'4200',EXAMPLE:'ok'};
 const clean=angularEnvironment(original);
 assert.equal(clean.PORT,undefined);
 assert.equal(clean.FRONTEND_PORT,'4200');
 assert.equal(clean.BACKEND_PORT,'3000');
 assert.equal(clean.EXAMPLE,'ok');
 assert.equal(original.PORT,'3000');
});
test('Reject invalid or conflicting ports',()=>{
 assert.throws(()=>resolveDevPorts({FRONTEND_PORT:'abc'}),/FRONTEND_PORT/);
 assert.throws(()=>resolveDevPorts({BACKEND_PORT:'0'}),/BACKEND_PORT/);
 assert.throws(()=>resolveDevPorts({FRONTEND_PORT:'3000',BACKEND_PORT:'3000'}),/diferentes/);
});
