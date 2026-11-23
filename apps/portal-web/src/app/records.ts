import {Component,inject,signal} from '@angular/core';
import {DatePipe} from '@angular/common';
import {HttpClient,HttpParams} from '@angular/common/http';
import {ActivatedRoute} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {Auth} from './auth';

interface AuditRow {
 id:number;created_at:string;actor:string;usuario:string|null;
 action:string;result:string;resource_type:string|null;
 resource_id:string|null;details:string|null;correlation_id:string;
}
interface AuditPage {rows:AuditRow[];page:number;pageSize:number;total:number;snapshotId:number;hasMore:boolean;}

@Component({imports:[DatePipe],template:`
<div class="page-kicker">GOBIERNO · PLATAFORMA</div>
<div class="page-heading"><div><h1>Auditoría</h1><p>Consulta los eventos registrados por el Hub. Las fechas se interpretan en horario de Honduras (UTC−06).</p></div></div>
<div class="admin-panel audit-filter-panel">
 <form (submit)="apply($event)">
  <div class="audit-filter-grid">
   <label>Desde<input aria-label="Fecha desde" type="date" [value]="dateFrom()" (change)="dateFrom.set($any($event.target).value)"></label>
   <label>Hasta<input aria-label="Fecha hasta" type="date" [value]="dateTo()" (change)="dateTo.set($any($event.target).value)"></label>
   <label>Usuario<input aria-label="Filtrar usuario" placeholder="Nombre o login" maxlength="120" [value]="actor()" (input)="actor.set($any($event.target).value)"></label>
   <label>Acción<input aria-label="Filtrar acción" placeholder="Ej. ROLE.UPDATE" maxlength="100" [value]="action()" (input)="action.set($any($event.target).value)"></label>
   <label>Resultado<select aria-label="Filtrar resultado" [value]="result()" (change)="result.set($any($event.target).value)">
    <option value="">Todos</option><option value="SUCCESS">Exitoso</option><option value="DENIED">Denegado</option><option value="FAILED">Fallido</option><option value="ERROR">Error</option>
   </select></label>
   <label>Buscar<input aria-label="Buscar en auditoría" maxlength="100" placeholder="Acción o recurso" [value]="search()" (input)="search.set($any($event.target).value)"></label>
  </div>
  <div class="audit-filter-actions">
   <button class="admin-primary" type="submit" [disabled]="loading()">Aplicar filtros</button>
   <button class="admin-secondary" type="button" [disabled]="loading()" (click)="clear()">Limpiar</button>
   <label class="audit-page-size">Registros por página
    <select [value]="pageSize()" (change)="changePageSize($any($event.target).value)" [disabled]="loading()">
     <option value="25">25</option><option value="50">50</option><option value="100">100</option>
    </select>
   </label>
  </div>
 </form>
</div>
@if(error()){<p class="error-message" role="alert">{{error()}}</p>}
@if(loading()){<p role="status">Consultando eventos…</p>}@else{
 <div class="audit-pager-info" aria-live="polite">
  <strong>{{total()}}</strong> registros coincidentes
  <span>Mostrando {{total()===0?0:(page()-1)*pageSize()+1}}–{{Math.min(page()*pageSize(),total())}}</span>
 </div>
 @if(rows().length===0){<div class="empty-state">No se encontraron eventos para los filtros indicados.</div>}@else{
 <section class="admin-panel security-panel">
  <div class="security-table-wrap" role="region" aria-label="Eventos de auditoría" tabindex="0">
   <table class="security-table audit-table">
    <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Resultado</th><th>Recurso</th><th>Detalle</th></tr></thead>
    <tbody>@for(row of rows();track row.id){
     <tr>
      <td>{{row.created_at | date:'dd/MM/yyyy HH:mm:ss':'-0600'}}</td>
      <td><strong>{{row.actor}}</strong><small>{{row.usuario||'—'}}</small></td>
      <td><code>{{row.action}}</code></td>
      <td><span class="audit-result" [class.denied]="row.result!=='SUCCESS'">{{row.result}}</span></td>
      <td><span>{{row.resource_type||'—'}}</span><small>{{row.resource_id||'—'}}</small></td>
      <td>@if(row.details){<details class="audit-event-details"><summary>Ver detalle</summary><code>{{row.details}}</code></details>}@else{—}</td>
     </tr>
    }</tbody>
   </table>
  </div>
 </section>
 }
 <div class="audit-pagination">
  <span>Página {{page()}}</span>
  <div class="audit-page-buttons">
   <button type="button" class="admin-secondary" [disabled]="page()<=1" (click)="previous()">Anterior</button>
   <button type="button" class="admin-secondary" [disabled]="!hasMore()" (click)="next()">Siguiente</button>
  </div>
 </div>
}
`})
export class Records {
 private route=inject(ActivatedRoute);
 private auth=inject(Auth);
 private http=inject(HttpClient);
 readonly Math=Math;
 readonly kind=this.route.snapshot.data['kind'] as string;
 readonly rows=signal<AuditRow[]>([]);
 readonly page=signal(1);
 readonly pageSize=signal(25);
 readonly total=signal(0);
 readonly hasMore=signal(false);
 readonly snapshotId=signal<number|null>(null);
 readonly dateFrom=signal('');
 readonly dateTo=signal('');
 readonly search=signal('');
 readonly actor=signal('');
 readonly action=signal('');
 readonly result=signal('');
 readonly error=signal('');
 readonly loading=signal(true);
 private requestNumber=0;

 constructor(){
  if(this.kind!=='audit'||!this.auth.user()?.permissions.includes(this.route.snapshot.data['permission'])){
   this.error.set('No tienes permiso para consultar esta sección.');
   this.loading.set(false);
   return;
  }
  void this.load();
 }

 apply(e:Event){e.preventDefault();this.page.set(1);this.snapshotId.set(null);void this.load();}
 clear(){this.dateFrom.set('');this.dateTo.set('');this.search.set('');this.actor.set('');this.action.set('');this.result.set('');this.page.set(1);this.snapshotId.set(null);void this.load();}
 changePageSize(value:string){const n=Number(value);if(![25,50,100].includes(n))return;this.pageSize.set(n);this.page.set(1);this.snapshotId.set(null);void this.load();}
 next(){if(this.loading()||!this.hasMore())return;this.page.update(p=>p+1);void this.load();}
 previous(){if(this.loading()||this.page()<=1)return;this.page.update(p=>p-1);void this.load();}

 private async load(){
  if(this.kind!=='audit')return;
  const serial=++this.requestNumber;
  this.loading.set(true);this.error.set('');
  if(this.dateFrom()&&this.dateTo()&&this.dateFrom()>this.dateTo()){
   this.error.set('La fecha inicial no puede ser posterior a la final.');
   this.loading.set(false);return;
  }
  let params=new HttpParams().set('page',this.page()).set('pageSize',this.pageSize());
  for(const [name,value] of Object.entries({dateFrom:this.dateFrom(),dateTo:this.dateTo(),search:this.search().trim(),actor:this.actor().trim(),action:this.action().trim(),result:this.result()})){
   if(value)params=params.set(name,value);
  }
  if(this.snapshotId()!=null)params=params.set('snapshotId',this.snapshotId()!);
  try{
   const data=await firstValueFrom(this.http.get<AuditPage>('/api/audit',{params}));
   if(serial!==this.requestNumber)return;
   this.rows.set(data.rows);this.total.set(data.total);this.hasMore.set(data.hasMore);this.snapshotId.set(data.snapshotId);
  }catch{
   if(serial!==this.requestNumber)return;
   this.rows.set([]);this.total.set(0);this.hasMore.set(false);
   this.error.set('No se pudo consultar la auditoría. Revisa los filtros o intenta nuevamente.');
  }finally{if(serial===this.requestNumber)this.loading.set(false);}
 }
}
