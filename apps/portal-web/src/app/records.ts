import {Component,computed,inject,signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {ActivatedRoute} from '@angular/router';
import {Auth} from './auth';

@Component({template:`
 <div class="page-kicker">GOBIERNO · PLATAFORMA</div>
 <div class="page-heading"><div><h1>{{kind==='audit'?'Auditoría':'Registro de módulos'}}</h1><p>Consulta los eventos registrados por el Hub.</p></div></div>
 @if(error()){<p role="alert" class="error-message">{{error()}}</p>}
 @if(loading()){<p role="status">Consultando eventos…</p>}
 @else{
  <div class="section-heading"><h2>Eventos registrados</h2><label class="search"><input aria-label="Filtrar eventos" placeholder="Buscar acción, usuario o recurso…" [value]="search()" (input)="search.set($any($event.target).value)"></label></div>
  @if(!filtered().length){<div class="empty-state">No hay registros que coincidan con tu búsqueda.</div>}
  @else{
   <section class="admin-panel security-panel"><div class="security-table-wrap" tabindex="0" role="region" aria-label="Eventos de auditoría">
    <table class="security-table"><thead><tr>@for(c of columns();track c){<th>{{header(c)}}</th>}</tr></thead>
    <tbody>@for(row of filtered();track $index){<tr>@for(c of columns();track c){<td class="audit-cell"><span [title]="value(row[c])">{{value(row[c])}}</span></td>}</tr>}</tbody>
    </table>
   </div></section>
  }
 }
`})
export class Records {
 private route=inject(ActivatedRoute);
 kind=this.route.snapshot.data['kind'] as string;
 rows=signal<Record<string,unknown>[]>([]);
 search=signal('');
 error=signal('');loading=signal(true);
 columns=computed(()=>Object.keys(this.rows()[0]??{}));
 filtered=computed(()=>this.rows().filter(row=>Object.values(row).some(v=>this.value(v).toLocaleLowerCase().includes(this.search().toLocaleLowerCase()))));
 constructor(){
  const auth=inject(Auth),http=inject(HttpClient);
  if(!auth.user()?.permissions.includes(this.route.snapshot.data['permission'])){this.error.set('No tienes permiso para consultar esta sección.');this.loading.set(false);return;}
  http.get<unknown[]>('/api/'+this.kind).subscribe({
   next:items=>{this.rows.set(items.map(x=>x!==null&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{valor:x}));this.loading.set(false);},
   error:()=>{this.error.set('No se pudo consultar esta sección.');this.loading.set(false);}
  });
 }
 header(s:string){return s.replaceAll('_',' ');}
 value(v:unknown){return v==null?'—':typeof v==='object'?JSON.stringify(v):String(v);}
}
