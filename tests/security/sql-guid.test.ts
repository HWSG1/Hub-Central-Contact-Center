import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ValidationPipe} from '@nestjs/common';
import {ParseSqlGuidPipe} from '../../apps/portal-api/src/security/sql-guid.js';
process.env['APP_ORIGIN']='http://localhost:4200';process.env['SQL_SERVER']='localhost';process.env['SQL_DATABASE']='ContactCenterHub_Test';
const {CreateUserDto,RolesDto}=await import('../../apps/portal-api/src/admin/admin.controller.js');
// SQL GUID with version/variant bits outside the RFC UUID restrictions.
const guid='00112233-4455-ef67-0123-456789abcdef';
const malformed=['', 'PLATFORM_ADMIN',guid+'\n',guid+' ',guid+'suffix','{'+guid+'}',guid.replaceAll('-',''),guid.replace('0011','zzzz'),null,{},123];
const pipe=new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true});
function validate(method:string,body:unknown){const type=method==='createUser'?CreateUserDto:RolesDto;return pipe.transform(body,{type:'body',metatype:type});}
test('administrative path GUIDs accept SQL GUID and RFC UUID without altering identity',()=>{
 const p=new ParseSqlGuidPipe();for(const value of [guid,guid.toUpperCase(),'550e8400-e29b-41d4-a716-446655440000'])assert.equal(p.transform(value),value);
 for(const value of malformed)assert.throws(()=>p.transform(value));
});
test('actual create-user and role-assignment DTOs accept SQL GUIDs',async()=>{
 for(const method of ['createUser','assignments']){
  const body=method==='createUser'?{username:'second.user',name:'Segundo usuario',reason:'Prueba de acceso',roles:[guid]}:{reason:'Prueba de acceso',version:1,roles:[guid]};
  assert.deepEqual((await validate(method,body)).roles,[guid]);
  assert.deepEqual((await validate(method,{...body,roles:[]})).roles,[]);
 }
});
test('actual role DTOs reject malformed, duplicate, oversized and non-array roles',async()=>{
 for(const method of ['createUser','assignments']){
  const base=method==='createUser'?{username:'second.user',name:'Segundo usuario',reason:'Prueba de acceso'}:{reason:'Prueba de acceso',version:1};
  for(const roles of [...malformed.map(id=>[id]),[guid,guid],Array(101).fill(guid),guid,null,{}])await assert.rejects(validate(method,{...base,roles}));
 }
});
