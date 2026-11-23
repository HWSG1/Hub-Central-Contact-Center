import {Component,ElementRef,ViewChild,inject,signal} from '@angular/core';
import {DatePipe} from '@angular/common';
import {HttpClient,HttpErrorResponse} from '@angular/common/http';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {Auth} from '../auth';

type HistoryRow={carga_id:string;archivo:string;esperados:number;insertados:number;rechazados:number;estado:string;modalidad:string;periodo:string|null;responsable:string;usuario_hub:string|null;creado_en:string;activado_en:string|null;error_resumen:string|null};
type History={history:HistoryRow[];activos:number;inactivos:number};
type Outcome={ok:boolean;file:string;sha256:string;valid:number;rejected:number;details:string;activated:boolean};

@Component({imports:[RouterLink,DatePipe],template:`
<nav class="breadcrumb" aria-label="Ubicación"><a routerLink="/modules">Centro de módulos</a><span>/</span><strong>Administrar bases TLV</strong></nav>
<header class="page-heading"><div><p class="eyebrow">TELEVENTAS · ADMINISTRACIÓN</p><h1>Administrar bases de ofertas</h1><p class="subtitle">Carga mensual de Excel o CSV con validación, activación atómica e historial de auditoría.</p></div><a routerLink="/modules" class="admin-secondary">Volver a módulos</a></header>
@if(error()){<p class="error-message" role="alert">{{error()}}</p>}
@if(notice()){<p class="admin-notice" role="status">{{notice()}}</p>}
<section class="admin-panel tlv-import-card">
 <div class="admin-card-title"><div><h2>Nueva base de Televentas</h2><p class="admin-help">Selecciona el consolidado de 33 columnas. La nueva carga sustituirá toda la base activa; la anterior se conserva inactiva para auditoría.</p></div></div>
 <div class="tlv-file-row">
  <strong id="tlv-file-label">Archivo Excel (.xlsx) o CSV (.csv)</strong>
  <div class="tlv-file-picker">
   <label class="tlv-upload-button" for="tlv-file" [class.tlv-upload-disabled]="busy()" role="button" tabindex="0" (keydown.enter)="openFilePicker()" (keydown.space)="$event.preventDefault();openFilePicker()">
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/></svg>
    Seleccionar Excel o CSV
   </label>
   <input #filePicker class="tlv-hidden-file" id="tlv-file" type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-labelledby="tlv-file-label" [disabled]="busy()" (change)="select($event)">
   <span class="tlv-file-choice">{{file()?.name||'Ningún archivo seleccionado'}}</span>
  </div>
  <small class="tlv-upload-hint">Primero selecciona tu archivo. Después pulsa «Previsualizar archivo»; si la validación es correcta, aparecerá «Activar nueva base».</small>
 </div>
 @if(file()){<p class="muted">Archivo seleccionado: <strong>{{file()!.name}}</strong> · {{(file()!.size/1048576).toFixed(2)}} MB</p>}
 <div class="admin-policy"><strong>Seguridad de la operación:</strong> primero se valida el archivo sin modificar SQL Server. Solo al confirmar se insertan los nuevos registros inactivos y, una vez completos, se activa el nuevo lote y se inactiva el anterior. Cada operación registra usuario, fecha y resultado.</div>
 <div class="admin-actions"><button type="button" class="admin-primary" (click)="previsualizar()" [disabled]="!file()||busy()">{{busy()?'Procesando archivo…':'1. Previsualizar archivo'}}</button></div>
 @if(preview();as p){
  <section class="tlv-preview" aria-label="Resultado de previsualización">
   <h3>Resultado de la previsualización</h3>
   <div class="tlv-import-stats"><div><strong>{{p.valid}}</strong><span>Registros válidos</span></div><div><strong>{{p.rejected}}</strong><span>Rechazados</span></div><div><strong>{{p.file}}</strong><span>Archivo verificado</span></div></div>
   <details><summary>Ver resumen por tipo de base</summary><pre>{{p.details}}</pre></details>
   @if(p.valid>0&&p.rejected===0){
    <div class="tlv-confirm"><p><strong>Confirmar cambio de base:</strong> escribe <code>CAMBIAR_BASE</code> para reemplazar los registros activos.</p>
     <label for="tlv-confirmation">Confirmación</label><input id="tlv-confirmation" autocomplete="off" placeholder="CAMBIAR_BASE" [value]="confirmation()" (input)="confirmation.set($any($event.target).value)" [disabled]="busy()">
     <button type="button" class="admin-primary" (click)="activar()" [disabled]="confirmation()!=='CAMBIAR_BASE'||busy()">{{busy()?'Cargando y activando…':'2. Activar nueva base'}}</button>
    </div>
   }
  </section>
 }
</section>
<section class="admin-panel tlv-history" aria-label="Historial de cargas">
 <div class="admin-card-title"><div><h2>Control e historial de bases</h2><p class="admin-help">Últimas 25 cargas, registradas en SQL Server.</p></div><button type="button" class="admin-secondary" (click)="load()" [disabled]="busy()">Actualizar</button></div>
 @if(history();as h){
 <div class="tlv-import-stats"><div><strong>{{h.activos||0}}</strong><span>Registros activos</span></div><div><strong>{{h.inactivos||0}}</strong><span>Registros históricos inactivos</span></div><div><strong>{{h.history.length}}</strong><span>Cargas recientes</span></div></div>
 <div class="security-table-wrap" role="region" tabindex="0" aria-label="Historial TLV"><table class="security-table"><thead><tr><th>Fecha</th><th>Archivo</th><th>Usuario</th><th>Estado</th><th>Registros</th></tr></thead><tbody>
 @for(item of h.history;track item.carga_id){<tr><td>{{item.creado_en|date:'dd/MM/yyyy HH:mm':'-0600'}}</td><td><strong>{{item.archivo}}</strong><small>{{item.periodo||'Sin período único'}}</small></td><td>{{item.responsable}}</td><td><span class="admin-status" [class.off]="item.estado!=='ACTIVADA'">{{item.estado}}</span></td><td>{{item.insertados}} / {{item.esperados}}</td></tr>}
 @empty{<tr><td colspan="5">Todavía no hay cargas registradas en la bitácora.</td></tr>}
 </tbody></table></div>
 }@else{<p class="admin-help">Cargando historial de bases…</p>}
</section>
`,styles:[`
:host{display:block}.tlv-import-card,.tlv-history{margin-top:1rem}.tlv-file-row{display:flex;flex-direction:column;gap:.5rem;margin:1rem 0}.tlv-file-row strong{font-weight:700}.tlv-file-picker{display:flex;align-items:center;flex-wrap:wrap;gap:12px}.tlv-file-row .tlv-upload-button{display:inline-flex;align-items:center;justify-content:center;gap:9px;background:#da282d;color:#fff;border-radius:9px;padding:11px 17px;font-weight:700;font-size:.91rem;cursor:pointer;min-height:44px;box-shadow:0 2px 6px #da282d14}.tlv-upload-button:hover{background:#bf2025}.tlv-upload-button:focus-visible{outline:3px solid #f0696e;outline-offset:3px}.tlv-upload-disabled{opacity:.5;cursor:not-allowed}.tlv-file-choice{font-size:.86rem;color:var(--sub);overflow-wrap:anywhere}.tlv-upload-hint{font-size:.77rem;color:var(--sub);line-height:1.5}.tlv-hidden-file{position:absolute!important;width:1px!important;height:1px!important;margin:-1px!important;padding:0!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}.tlv-import-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr));gap:.75rem;margin:1.25rem 0}.tlv-import-stats>div{border:1px solid var(--border);border-radius:.75rem;padding:1rem;background:var(--bg);display:flex;flex-direction:column;gap:.3rem;overflow-wrap:anywhere}.tlv-import-stats strong{font-size:1.18rem}.tlv-import-stats span{font-size:.77rem;color:var(--sub)}.tlv-preview{border-top:1px solid var(--border);margin-top:1.4rem;padding-top:1.2rem}.tlv-preview details{margin-top:.75rem}.tlv-preview pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:16rem;overflow-y:auto;font-size:.75rem;line-height:1.5;padding:.75rem;background:var(--bg)}.tlv-confirm{margin-top:1.25rem;padding:1rem;border:1px solid var(--border);border-radius:.75rem}.tlv-confirm p{margin-bottom:.6rem}.tlv-confirm label{display:block;font-weight:700;margin:0 0 .5rem}.tlv-confirm input{display:block;padding:.6rem;max-width:20rem;width:100%;margin-bottom:.8rem;border:1px solid var(--border);border-radius:.5rem}.tlv-import-card .admin-policy{margin:1rem 0}.tlv-history td strong,.tlv-history td small{display:block}@media(max-width:640px){.tlv-import-stats{grid-template-columns:1fr}}
`]})
export class TlvBases {
 @ViewChild('filePicker') filePicker?:ElementRef<HTMLInputElement>;
 openFilePicker(){if(!this.busy())this.filePicker?.nativeElement.click();}
 private http=inject(HttpClient);
 auth=inject(Auth);
 file=signal<File|null>(null);preview=signal<Outcome|null>(null);history=signal<History|null>(null);
 busy=signal(false);error=signal('');notice=signal('');confirmation=signal('');
 constructor(){void this.load();}
 select(event:Event){const files=(event.target as HTMLInputElement).files;this.file.set(files&&files.length?files[0]:null);this.preview.set(null);this.confirmation.set('');this.error.set('');}
 private message(error:unknown){if(error instanceof HttpErrorResponse){const msg=error.error?.message;if(Array.isArray(msg))return msg.join('; ');if(typeof msg==='string')return msg;}return 'No se completó la operación. Revisa la sesión, el backend y la configuración SQL.';}
 async load(){try{this.history.set(await firstValueFrom(this.http.get<History>('/api/admin/ofertas-tlv/bases/history')));}catch(e){this.error.set(this.message(e));}}
 private async send(action:'preview'|'activate'){
  const file=this.file();if(!file||this.busy())return;
  if(!['.xlsx','.csv'].some(extension=>file.name.toLowerCase().endsWith(extension))){this.error.set('Solo se permiten archivos .xlsx o .csv.');return;}
  if(file.size>30*1048576){this.error.set('El archivo supera el límite de 30 MB.');return;}
  this.busy.set(true);this.error.set('');this.notice.set('');
  try{
   const headers:Record<string,string>={'Content-Type':'application/octet-stream','X-TLV-File-Name':file.name};
   if(action==='activate')headers['X-TLV-Confirm']='CAMBIAR_BASE';
   const data=await firstValueFrom(this.http.post<Outcome>('/api/admin/ofertas-tlv/bases/'+action,file,{headers}));
   if(action==='preview'){this.preview.set(data);this.notice.set('Previsualización completada sin modificar SQL Server.');}
   else {this.file.set(null);this.preview.set(null);this.confirmation.set('');this.notice.set('La nueva base quedó activada. La anterior permanece en el historial inactivo.');await this.load();}
  }catch(e){this.error.set(this.message(e));}
  finally{this.busy.set(false);}
 }
 previsualizar(){void this.send('preview');}
 activar(){if(this.confirmation()!=='CAMBIAR_BASE'||!this.preview()||this.preview()!.rejected!==0)return;void this.send('activate');}
}