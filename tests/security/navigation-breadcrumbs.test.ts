import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {breadcrumbsForPath} from '../../apps/portal-web/src/app/breadcrumbs.js';

const sidebarCases:[string,string[]][]=[
 ['/', ['Aplicaciones']],
 ['/modules',['Plataforma','Centro de módulos']],
 ['/audit',['Plataforma','Auditoría']],
 ['/admin/users',['Seguridad','Usuarios']],
 ['/admin/roles',['Seguridad','Roles']],
 ['/admin/permissions',['Seguridad','Permisos']],
 ['/admin/assignments',['Seguridad','Asignaciones']]
];

test('Each sidebar navigation page has specific breadcrumbs in the top bar',()=>{
 for(const [path,labels] of sidebarCases)
  assert.deepEqual(breadcrumbsForPath(path).map(x=>x.label),labels,path);
});

test('Nested pages preserve their navigation hierarchy and clickable parents',()=>{
 assert.deepEqual(breadcrumbsForPath('/modules/import'),[
  {label:'Plataforma'},{label:'Centro de módulos',route:'/modules'},{label:'Importar módulo'}
 ]);
 assert.deepEqual(breadcrumbsForPath('/admin/ofertas-tlv/bases'),[
  {label:'Plataforma'},{label:'Centro de módulos',route:'/modules'},{label:'Administrar bases TLV'}
 ]);
 assert.deepEqual(breadcrumbsForPath('/admin/monitoreo-tc/bases'),[
  {label:'Monitoreo TC',route:'/extensions/MONITOREO_TC'},{label:'Administrar bases'}
 ]);
 assert.deepEqual(breadcrumbsForPath('/extensions/MONITOREO_TC','Consulta de alertas de Monitoreo TC'),[
  {label:'Consulta de alertas de Monitoreo TC'}
 ]);
 assert.deepEqual(breadcrumbsForPath('/admin/users?tab=active').map(x=>x.label),['Seguridad','Usuarios']);
});

test('Content pages no longer render duplicated navigation breadcrumbs',()=>{
 for(const file of [
  'apps/portal-web/src/app/modules.html',
  'apps/portal-web/src/app/module-wizard.ts',
  'apps/portal-web/src/app/admin/tlv-bases.ts'
 ]){
  const source=readFileSync(file,'utf8');
  assert.doesNotMatch(source,/<nav class="breadcrumb"/,file);
 }
});
