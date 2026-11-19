import { test } from 'node:test';
import assert from 'node:assert/strict';
import { remoteAdminSql, type RemoteAdminPlan } from '../../scripts/lib/remote-admin-sql.js';
const plan:RemoteAdminPlan={server:'HOST\\INSTANCE',database:'TaskFlow',id:'00000000-0000-0000-0000-000000000001',username:'firstadmin',name:"O'Dair",passwordHash:'hash',cipher:'encrypted',counter:123,correlation:'test',migrations:{'001_core.sql':'a'.repeat(64)}};
test('remote bootstrap is review-only, target-bound, transactional and single-use',()=>{
 const sql=remoteAdminSql(plan);
 for(const expected of ['DECLARE @Apply bit=0',"SERVERPROPERTY('ServerName')","DB_NAME()<>N'TaskFlow'",'IF @Apply=1 BEGIN','BEGIN TRANSACTION','ROLLBACK','hub_bootstrap','bootstrap_complete',"r.code='PLATFORM_ADMIN'",'enabled=1','ADMIN.REMOTE_LOCAL_PROVISION',"N'O''Dair'",'require_mfa,must_change_password','sha256='])assert.ok(sql.includes(expected),expected);
 assert.ok(!sql.includes('CREATE TABLE'));assert.ok(!sql.includes('USE ['));
});
test('remote bootstrap rejects unsafe target or manifest and invalid MFA counters',()=>{
 for(const patch of [{database:'master'},{server:''},{counter:-1},{counter:1.5},{migrations:{}},{migrations:{test:'bad'}}])assert.throws(()=>remoteAdminSql({...plan,...patch}));
});
