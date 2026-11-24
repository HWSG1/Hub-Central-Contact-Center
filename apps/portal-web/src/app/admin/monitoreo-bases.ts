import {Component,inject,signal} from '@angular/core';
import {DatePipe} from '@angular/common';
import {HttpClient} from '@angular/common/http';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {Auth} from '../auth';

type Preview={ok:boolean;archivo:string;validos:number;duplicados_archivo:number;ignorados:number;activada:boolean;insertados?:number;omitidos?:number;carga_id?:string};
type HistoryRow={carga_id:string;archivo:string;fecha_carga:string;registros_archivo:number;insertados:number;omitidos:number;estado:string;responsable:string};
@Component({imports:[RouterLink,DatePipe],template:`

<header class="page-heading"><div><h1>Administrar bases de alertas</h1>
<p>Importaciones acumulativas: conservan todos los registros históricos y evitan duplicados por ID_TRX.</p></div></header>
@if(error()){<div class="error-message" role="alert">{{error()}}</div>}
@if(notice()){<p role="status" class="notice">{{notice()}}</p>}
<section class="panel">
 <h2>Agregar nueva base</h2>
 <p>Excel (.xlsx) o CSV (.csv), máximo 30 MB. La previsualización no escribe alertas en SQL Server.</p>
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
`,styles:[`
:host{display:block}.panel{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:24px;margin-top:22px}
.panel p{margin:14px 0;color:var(--sub);line-height:1.6}
label{font-weight:600;display:block;margin:16px 0 8px}
input{display:block;width:100%;max-width:540px;border:1px solid var(--border);padding:12px;border-radius:8px;background:var(--surface);color:var(--text)}
button{border:1px solid #da282d;border-radius:8px;background:#da282d;color:white;padding:12px 18px;font-weight:700;margin-top:16px}
button:disabled{opacity:.5}.stats{display:flex;gap:16px;flex-wrap:wrap;margin:18px 0}.stats>div{flex:1;min-width:150px;background:var(--bg);border-radius:9px;padding:18px}
.stats strong{display:block;font-size:24px}.stats small{color:var(--sub)}.history-head{display:flex;justify-content:space-between;align-items:center;gap:16px}
.history-head button{margin:0}.notice{border:1px solid #49a98c;padding:15px;border-radius:9px}.scroll{overflow:auto}
table{border-collapse:collapse;width:100%;font-size:14px;text-align:left}th,td{padding:12px;border-bottom:1px solid var(--border);white-space:nowrap}
`]})
export class MonitoreoBases {
 private http=inject(HttpClient);private auth=inject(Auth);
 file=signal<File|null>(null);result=signal<Preview|null>(null);history=signal<HistoryRow[]>([]);
 total=signal(0);busy=signal(false);error=signal('');notice=signal('');confirm=signal('');
 constructor(){void this.load();}
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
  }catch{this.error.set('No se pudo procesar el archivo. Revisa formato, sesión MFA y estado del importador.');}
  finally{this.busy.set(false);}
 }
 preview(){void this.send('preview');}
 activate(){if(this.confirm()==='AGREGAR_ALERTAS')void this.send('activate');}
}
