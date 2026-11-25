import {Component,computed,inject,signal} from '@angular/core';
import {DatePipe} from '@angular/common';
import {HttpClient,HttpErrorResponse} from '@angular/common/http';
import {downloadMonitoreoTemplate} from './monitoreo-template';
import {firstValueFrom} from 'rxjs';
import {Auth} from '../auth';

type Preview={ok:boolean;archivo:string;validos:number;duplicados_archivo:number;ignorados:number;activada:boolean;insertados?:number;omitidos?:number;carga_id?:string};
type CodeRow={codigo:string;descripcion:string;accion:string;activo:boolean};
type HistoryRow={carga_id:string;archivo:string;fecha_carga:string;registros_archivo:number;insertados:number;omitidos:number;estado:string;responsable:string};
@Component({imports:[DatePipe],template:`

<header class="page-heading"><div><h1>Administrar bases de alertas</h1>
<p>Importaciones acumulativas: conservan todos los registros históricos y evitan duplicados por ID_TRX.</p></div></header>
@if(error()){<div class="error-message" role="alert">{{error()}}</div>}
@if(notice()){<p role="status" class="notice">{{notice()}}</p>}
<section class="panel">
 <h2>Agregar nueva base</h2>
 <p>Excel (.xlsx) o CSV (.csv), máximo 30 MB. La previsualización no escribe alertas en SQL Server.</p>
 <button type="button" class="secondary" (click)="downloadTemplate()">Descargar plantilla Excel (.xlsx)</button>
 <p>La plantilla contiene los nombres exactos de las columnas y una hoja de instrucciones. No incluya números completos de tarjeta.</p>
 <label for="file">Archivo de Monitoreo</label>
 <input id="file" type="file" accept=".xlsx,.csv" (change)="choose($event)" [disabled]="busy()">
 @if(file()){<p><strong>{{file()!.name}}</strong> · {{(file()!.size/1048576).toFixed(2)}} MB</p>}
 <div class="actions"><button (click)="preview()" [disabled]="!file()||busy()">{{busy()?'Procesando…':'1. Previsualizar'}}</button></div>
 @if(result();as p){
 <div class="stats"><div><strong>{{p.validos}}</strong><small>Transacciones únicas del archivo</small></div>
 <div><strong>{{p.duplicados_archivo}}</strong><small>Duplicadas en el archivo</small></div>
 <div><strong>{{p.ignorados}}</strong><small>Filas vacías</small></div></div>
 @if(!p.activada){
  <p>La carga conservará las alertas anteriores. Los ID_TRX existentes en SQL Server se omitirán automáticamente.</p>
  <label for="confirm">Para agregar esta base escribe <code>AGREGAR_ALERTAS</code></label>
  <input id="confirm" autocomplete="off" [value]="confirm()" (input)="confirm.set($any($event.target).value)" [disabled]="busy()">
  <button (click)="activate()" [disabled]="busy()||confirm()!=='AGREGAR_ALERTAS'">2. Agregar registros nuevos</button>
 }@else{<p><strong>Agregados:</strong> {{p.insertados}} · <strong>Ya existentes:</strong> {{p.omitidos}}</p>}
 }
</section>
<section class="panel">
 <div class="history-head"><h2>Historial de importaciones</h2><button (click)="load()" [disabled]="busy()">Actualizar</button></div>
 <p>Registros históricos activos: <strong>{{total()}}</strong>. Las búsquedas consultan todo el histórico y priorizan los eventos recientes.</p>
 <div class="scroll"><table><thead><tr><th>Fecha</th><th>Archivo</th><th>Responsable</th><th>Estado</th><th>Agregados</th><th>Omitidos</th></tr></thead><tbody>
 @for(c of history();track c.carga_id){<tr><td>{{c.fecha_carga|date:'dd/MM/yyyy HH:mm':'-0600'}}</td><td>{{c.archivo}}</td><td>{{c.responsable}}</td><td>{{c.estado}}</td><td>{{c.insertados}}</td><td>{{c.omitidos}}</td></tr>}
 @empty{<tr><td colspan="6">Sin importaciones registradas.</td></tr>}
 </tbody></table></div>
</section>
<section class="panel" aria-label="Catálogo de códigos de respuesta">
 <div class="history-head"><h2>Administrar códigos de respuesta</h2><button class="secondary" (click)="loadCodes()" [disabled]="busy()">Actualizar catálogo</button></div>
 <p>Agrega nuevas equivalencias, modifica descripciones o desactiva códigos. Los cambios quedan auditados y se reflejan en las consultas del operador.</p>
 @if(codeError()){<p role="alert" class="error-message">{{codeError()}}</p>}
 @if(codeNotice()){<p role="status" class="notice">{{codeNotice()}}</p>}
 <div class="code-form">
  <div><label for="code">Código</label><input id="code" maxlength="10" [disabled]="!!editing()||busy()" [value]="code()" (input)="code.set($any($event.target).value.toUpperCase())" placeholder="Ej. 5C"></div>
  <div><label for="description">Descripción</label><input id="description" maxlength="300" [disabled]="busy()" [value]="description()" (input)="description.set($any($event.target).value)" placeholder="Descripción oficial"></div>
  <div><label for="action">Acción</label><select id="action" [disabled]="busy()" [value]="action()" (change)="action.set($any($event.target).value)"><option value="D">D · Declinar</option><option value="A">A · Aprobar</option></select></div>
 </div>
 <div class="actions">
  <button (click)="saveCode()" [disabled]="busy()||!validCode()">{{editing()?'Guardar modificación':'Agregar código'}}</button>
  @if(editing()){<button class="secondary" (click)="resetCode()" [disabled]="busy()">Cancelar edición</button>}
 </div>
 <div class="code-search"><div><label for="search-codes">Buscar código o descripción</label><input id="search-codes" type="search" placeholder="Ej. 51, fondos insuficientes" [value]="codeSearch()" (input)="setCodeSearch($any($event.target).value)"></div><p role="status">{{filteredCodes().length}} código(s) encontrado(s)</p></div>
 <div class="scroll"><table><thead><tr><th>Código</th><th>Descripción</th><th>Acción</th><th>Estado</th><th>Administración</th></tr></thead><tbody>
 @for(item of pagedCodes();track item.codigo){<tr>
  <td><code>{{item.codigo}}</code></td><td>{{item.descripcion}}</td>
  <td>{{item.accion==='A'?'Aprobar':'Declinar'}}</td><td>{{item.activo?'Activo':'Desactivado'}}</td>
  <td>
   <button class="secondary small-btn" (click)="editCode(item)" [disabled]="busy()">Editar</button>
   @if(item.activo){
    @if(pendingDelete()===item.codigo){<button class="danger small-btn" (click)="deactivate(item.codigo)" [disabled]="busy()">Confirmar desactivación</button><button class="secondary small-btn" (click)="pendingDelete.set(null)" [disabled]="busy()">Cancelar</button>}
    @else{<button class="secondary small-btn" (click)="pendingDelete.set(item.codigo)" [disabled]="busy()">Desactivar</button>}
   }@else{<button class="secondary small-btn" (click)="reactivate(item)" [disabled]="busy()">Reactivar</button>}
  </td></tr>}
 @empty{<tr><td colspan="5">No hay códigos que coincidan con la búsqueda.</td></tr>}
 </tbody></table></div>
 <nav class="code-pagination" aria-label="Paginación de códigos de respuesta"><button class="secondary" (click)="codePage.set(codePage()-1)" [disabled]="codePage()<=0">Anterior</button><span>Página {{codePage()+1}} de {{totalCodePages()}}</span><button class="secondary" (click)="codePage.set(codePage()+1)" [disabled]="codePage()+1>=totalCodePages()">Siguiente</button></nav>
</section>
`,styles:[`
:host{display:block}.panel{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:24px;margin-top:22px}
.panel p{margin:14px 0;color:var(--sub);line-height:1.6}
label{font-weight:600;display:block;margin:16px 0 8px}
input{display:block;width:100%;max-width:540px;border:1px solid var(--border);padding:12px;border-radius:8px;background:var(--surface);color:var(--text)}
button{border:1px solid #da282d;border-radius:8px;background:#da282d;color:white;padding:12px 18px;font-weight:700;margin-top:16px}
button.secondary{background:transparent;color:var(--text);border-color:var(--border)}button.danger{background:#a91e24;border-color:#a91e24}.small-btn{margin:2px;padding:8px;font-size:12px}.code-form{display:grid;grid-template-columns:minmax(100px,1fr) minmax(250px,3fr) minmax(130px,1fr);gap:12px;align-items:end}.code-form input,.code-form select{width:100%}@media(max-width:800px){.code-form{grid-template-columns:1fr}}button:disabled{opacity:.5}.stats{display:flex;gap:16px;flex-wrap:wrap;margin:18px 0}.stats>div{flex:1;min-width:150px;background:var(--bg);border-radius:9px;padding:18px}
.stats strong{display:block;font-size:24px}.stats small{color:var(--sub)}.history-head{display:flex;justify-content:space-between;align-items:center;gap:16px}
.history-head button{margin:0}.code-search{display:flex;gap:16px;align-items:end;justify-content:space-between;margin:16px 0}.code-search>div{flex:1}.code-search input{max-width:480px}.code-search p{margin:0 0 10px}.code-pagination{display:flex;gap:14px;align-items:center;justify-content:flex-end;margin-top:8px}.code-pagination button{margin-top:0}@media(max-width:600px){.code-search{display:block}}.notice{border:1px solid #49a98c;padding:15px;border-radius:9px}.scroll{overflow:auto}
table{border-collapse:collapse;width:100%;font-size:14px;text-align:left}th,td{padding:12px;border-bottom:1px solid var(--border);white-space:nowrap}
`]})
export class MonitoreoBases {
 private http=inject(HttpClient);private auth=inject(Auth);
 file=signal<File|null>(null);result=signal<Preview|null>(null);history=signal<HistoryRow[]>([]);
 total=signal(0);busy=signal(false);error=signal('');notice=signal('');confirm=signal('');
 codeSearch=signal('');codePage=signal(0);readonly codePageSize=12;
 filteredCodes=computed(()=>{const term=this.codeSearch().trim().toLocaleLowerCase('es');return this.codes().filter(row=>!term||row.codigo.toLocaleLowerCase('es').includes(term)||row.descripcion.toLocaleLowerCase('es').includes(term));});
 totalCodePages=computed(()=>Math.max(1,Math.ceil(this.filteredCodes().length/this.codePageSize)));
 pagedCodes=computed(()=>this.filteredCodes().slice(this.codePage()*this.codePageSize,(this.codePage()+1)*this.codePageSize));
 setCodeSearch(term:string){this.codeSearch.set(term);this.codePage.set(0);}
 codes=signal<CodeRow[]>([]);codeError=signal('');codeNotice=signal('');code=signal('');description=signal('');action=signal('D');editing=signal<string|null>(null);pendingDelete=signal<string|null>(null);
 constructor(){void this.load();void this.loadCodes();}
 downloadTemplate(){downloadMonitoreoTemplate();}
 private describeError(error:unknown){if(!(error instanceof HttpErrorResponse))return 'No se pudo completar la solicitud.';
  if(error.status===401||error.status===403)return 'La sesión no tiene autorización o MFA reciente. Inicia sesión nuevamente.';
  if(error.status===409)return 'No se puede continuar: verifica que la migración esté aplicada y que la previsualización sea reciente.';
  if(error.status===413)return 'El archivo excede el tamaño permitido.';
  const m=error.error?.message;const message=typeof m==='string'?m:'';
  if(error.status===400&&/^(Fila \\d+:|Faltan columnas requeridas|El archivo |El Excel |Fecha |No se pudo validar|Solo se permite |Nombre de archivo |Archivo inválido)/.test(message))return message.slice(0,300);
  return 'La solicitud no se completó (HTTP '+error.status+'). Revisa la sesión, el formato y los registros del servidor.';
 }
 async loadCodes(){this.codeError.set('');try{const data=await firstValueFrom(this.http.get<{codes:CodeRow[]}>('/api/admin/monitoreo-tc/bases/codes'));this.codes.set(data.codes);this.codePage.set(Math.min(this.codePage(),Math.max(0,Math.ceil(this.filteredCodes().length/this.codePageSize)-1)));}catch(e){this.codeError.set(this.describeError(e));}}
 validCode(){return /^[A-Z0-9]{1,10}$/.test(this.code())&&this.description().trim().length>0&&this.description().trim().length<=300&&['A','D'].includes(this.action());}
 resetCode(){this.editing.set(null);this.code.set('');this.description.set('');this.action.set('D');this.pendingDelete.set(null);}
 editCode(row:CodeRow){this.editing.set(row.codigo);this.code.set(row.codigo);this.description.set(row.descripcion);this.action.set(row.accion);this.pendingDelete.set(null);}
 reactivate(row:CodeRow){this.resetCode();this.code.set(row.codigo);this.description.set(row.descripcion);this.action.set(row.accion);this.codeNotice.set('Para reactivar, confirma el formulario mediante Agregar código.');}
 async changeCode(operation:'CREAR'|'EDITAR'|'DESACTIVAR',code:string,description?:string,action?:string){if(this.busy())return;this.busy.set(true);this.codeError.set('');this.codeNotice.set('');try{await firstValueFrom(this.http.post('/api/admin/monitoreo-tc/bases/codes/change',{operation,code,description,action}));this.codeNotice.set('Catálogo actualizado y cambio auditado.');this.resetCode();await this.loadCodes();}catch(e){this.codeError.set(this.describeError(e));}finally{this.busy.set(false);}}
 saveCode(){if(this.validCode())void this.changeCode(this.editing()?'EDITAR':'CREAR',this.code(),this.description().trim(),this.action());}
 deactivate(code:string){if(this.pendingDelete()===code)void this.changeCode('DESACTIVAR',code);}
 choose(event:Event){const input=event.target as HTMLInputElement;this.file.set(input.files?.[0]??null);this.result.set(null);this.confirm.set('');this.error.set('');}
 async load(){try{const data=await firstValueFrom(this.http.get<{history:HistoryRow[];registros:number}>('/api/admin/monitoreo-tc/bases/history'));this.history.set(data.history);this.total.set(data.registros);}catch{this.error.set('No fue posible consultar las bases. Confirma la migración 012 y los permisos de administración.');}}
 private async send(action:'preview'|'activate'){
  const file=this.file();if(!file||this.busy())return;
  if(!this.auth.user()?.permissions.includes('CORE.MODULES.MANAGE')){this.error.set('No tienes permiso de administración.');return;}
  if(file.size>30*1024*1024){this.error.set('Archivo demasiado grande.');return;}
  this.busy.set(true);this.error.set('');this.notice.set('');
  try{
   const body=await file.arrayBuffer();
   const headers:Record<string,string>={'Content-Type':'application/octet-stream',
    'X-Monitoreo-File-Name':file.name};
   if(action==='activate')headers['X-Monitoreo-Confirm']='AGREGAR_ALERTAS';
   const out=await firstValueFrom(this.http.post<Preview>('/api/admin/monitoreo-tc/bases/'+action,body,{headers}));
   this.result.set(out);
   if(out.activada){this.notice.set('Carga registrada. Se agregaron '+out.insertados+' alertas nuevas; '+out.omitidos+' ya existían.');await this.load();}
  }catch(e){this.error.set(this.describeError(e));}
  finally{this.busy.set(false);}
 }
 preview(){void this.send('preview');}
 activate(){if(this.confirm()==='AGREGAR_ALERTAS')void this.send('activate');}
}
