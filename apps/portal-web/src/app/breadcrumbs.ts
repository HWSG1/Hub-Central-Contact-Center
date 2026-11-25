/** Ruta centralizada para el encabezado del Hub. Una sola ubicación visible por página. */
export interface BreadcrumbItem { label:string; route?:string; }

const sidebarPages:Record<string,{section:'Plataforma'|'Seguridad';label:string}>={
 '/modules':{section:'Plataforma',label:'Centro de módulos'},
 '/audit':{section:'Plataforma',label:'Auditoría'},
 '/admin/users':{section:'Seguridad',label:'Usuarios'},
 '/admin/roles':{section:'Seguridad',label:'Roles'},
 '/admin/permissions':{section:'Seguridad',label:'Permisos'},
 '/admin/assignments':{section:'Seguridad',label:'Asignaciones'}
};

/** No incluye «Inicio»: la barra superior lo muestra una sola vez. */
export function breadcrumbsForPath(url:string,extensionName?:string):BreadcrumbItem[]{
 const path=url.split('?')[0].split('#')[0].replace(/\/$/,'')||'/';
 if(path==='/')return [{label:'Aplicaciones'}];
 const sidebar=sidebarPages[path];
 if(sidebar)return [{label:sidebar.section},{label:sidebar.label}];
 if(path==='/modules/import')return [
  {label:'Plataforma'},{label:'Centro de módulos',route:'/modules'},{label:'Importar módulo'}
 ];
 if(path==='/admin/ofertas-tlv/bases')return [
  {label:'Plataforma'},{label:'Centro de módulos',route:'/modules'},{label:'Administrar bases TLV'}
 ];
 if(path==='/admin/monitoreo-tc/bases')return [
  {label:'Monitoreo TC',route:'/extensions/MONITOREO_TC'},{label:'Administrar bases'}
 ];
 if(path==='/modules/ofertas')return [{label:'Aplicaciones',route:'/'},{label:'Buscador de ofertas'}];
 if(path==='/modules/corta-cuotas')return [{label:'Aplicaciones',route:'/'},{label:'Corta Cuotas'}];
 if(path.startsWith('/extensions/')){
  const code=decodeURIComponent(path.slice('/extensions/'.length));
  return [{label:extensionName||code}];
 }
 if(path.startsWith('/admin/'))return [{label:'Seguridad'},{label:'Administración'}];
 return [{label:'Página no disponible'}];
}
