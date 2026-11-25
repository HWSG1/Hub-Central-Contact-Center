import {Component,ElementRef,ViewChild,inject,signal,OnDestroy} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {Auth} from './auth';
import {DomSanitizer,SafeHtml} from '@angular/platform-browser';
import {HttpClient,HttpErrorResponse} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';
import {adminError} from './admin/models';
/** Ajustes de presentación para el ZIP MONITOREO_TC firmado, sin modificar su contenido almacenado. */
function presentMonitoreo(html:string){
 let result=html;
 // La transacción conserva su ID en SQL; la tabla muestra únicamente fecha y hora.
 result=result.replace('<th>Fecha / ID evento</th>','<th>Fecha y hora</th>');
 result=result.replace("(row.fecha_hora_origen||row.fecha_evento||'')+' · '+(row.id_trx||'')","String(row.fecha_hora_origen||row.fecha_evento||'').replace('T',' ').slice(0,19)");
 // El visor conserva las llamadas y la firma del ZIP; solo indica visualmente una búsqueda pendiente.
 result=result.replace(
  "loading=true;$('buscar').disabled=true;$('estado').textContent='Consultando registros…';",
  "loading=true;$('buscar').disabled=true;$('buscar').setAttribute('aria-busy','true');$('buscar').innerHTML='<span class=mon-search-spinner aria-hidden=true></span> Buscando…';$('estado').textContent='Consultando registros…';"
 );
 result=result.replace(
  "finally{loading=false;$('buscar').disabled=false}",
  "finally{loading=false;$('buscar').disabled=false;$('buscar').removeAttribute('aria-busy');$('buscar').textContent='Buscar'}"
 );
 result=result.replace('</head>','<style>.mon-search-spinner{display:inline-block;width:15px;height:15px;border:2px solid #fff7;border-top-color:#fff;border-radius:50%;vertical-align:-3px;margin-right:7px;animation:mon-search-spin .75s linear infinite}@keyframes mon-search-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.mon-search-spinner{animation:none;border-style:dotted}}</style></head>');

 // Eliminar el recuadro inferior de alcance y conservar el estado accesible de la consulta.
 result=result.replace(/<section class="panel"><div class="warning">[\s\S]*?<p id="estado" role="status" class="muted" style="margin-top:12px"><\/p><\/section>/,
  '<p id="estado" role="status" class="muted" style="margin:8px 20px"></p>');
 return result;
}
@Component({imports:[RouterLink],template:`@if(canManageBases()){<nav class="module-admin-actions"><a routerLink="/admin/monitoreo-tc/bases">Administrar bases de Monitoreo TC</a></nav>}@if(error()){<p role="alert">{{error()}}</p>}@if(html()){<iframe #frame title="Herramienta instalada" [class.monitoreo-frame]="code==='MONITOREO_TC'" sandbox="allow-scripts allow-downloads allow-forms" referrerpolicy="no-referrer" [srcdoc]="html()"></iframe>}`,styles:[`:host{display:block;position:relative}.module-admin-actions{position:absolute;right:24px;top:6px;z-index:1;display:flex;justify-content:flex-end;margin:0}.module-admin-actions a{display:inline-flex;align-items:center;padding:9px 14px;border:1px solid #da282d;border-radius:8px;color:#da282d;font-weight:700}iframe{display:block;width:100%;height:calc(100dvh - 160px);min-height:540px;border:0;border-radius:12px;background:white}iframe.monitoreo-frame{height:calc(100dvh - 88px);min-height:0}`]})
export class PackageHost implements OnDestroy {
 private http=inject(HttpClient);private auth=inject(Auth);private route=inject(ActivatedRoute);private sanitizer=inject(DomSanitizer);
 @ViewChild('frame') frame?:ElementRef<HTMLIFrameElement>;
 error=signal('');html=signal<SafeHtml|null>(null);private active=0;private alive=true;
 readonly code=this.route.snapshot.paramMap.get('code')??'';
 canManageBases(){return this.code==='MONITOREO_TC'&&!!this.auth.user()?.permissions.includes('CORE.MODULES.MANAGE');}
 private listener=(event:MessageEvent)=>{void this.message(event);};
 constructor(){window.addEventListener('message',this.listener);void this.load();}
 private async load(){try{const result=await firstValueFrom(this.http.get<{name:string;html:string}>('/api/extensions/'+encodeURIComponent(this.code)+'/ui'));if(!this.alive)return;const policy=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'">`;const content=this.code==='MONITOREO_TC'?presentMonitoreo(result.html).replace('</head>',`<style>html{scrollbar-gutter:stable;overflow-y:auto;scrollbar-width:thin}body{padding:4px 14px 12px 6px!important;max-width:100%;box-sizing:border-box}.wrap{max-width:none!important;margin:0!important}.panel{margin-top:10px!important}h1{padding-right:320px}@media(max-width:760px){h1{padding-right:0}}</style></head>`):result.html;this.html.set(this.sanitizer.bypassSecurityTrustHtml(policy+content));}catch(e){this.error.set(adminError(e));}}
 private async message(event:MessageEvent){
  const target=this.frame?.nativeElement.contentWindow;
  if(!this.alive||!target||event.source!==target||event.origin!=='null')return;
  const data=event.data;if(!data||data.type!=='hub:request'||!Number.isSafeInteger(data.id)||typeof data.operation!=='string')return;
  if(this.active>=4){target.postMessage({type:'hub:response',id:data.id,error:'Demasiadas solicitudes.'},'*');return;}
  this.active++;
  try{if(JSON.stringify(data.input??null).length>16384)throw Error();const response=await firstValueFrom(this.http.post<{result:unknown}>('/api/extensions/'+encodeURIComponent(this.code)+'/run',{operation:data.operation,input:data.input}));if(this.alive)target.postMessage({type:'hub:response',id:data.id,result:response.result},'*');}catch(error){
    const permitted=['El certificado debe contener exactamente 9 dígitos.','Tipo de venta inválido.','Tipo de desembolso inválido.','Fecha de desembolso inválida.','El certificado ya está registrado.','Período inválido.','Página inválida.','Campos no admitidos.','Filtro inválido.'];
    const message=error instanceof HttpErrorResponse&&error.status===400&&this.code==='TV_DESEMBOLSOS'&&typeof error.error?.message==='string'&&permitted.includes(error.error.message)?error.error.message:'No se pudo completar la operación. Revisa los datos y tu sesión.';
    if(this.alive)target.postMessage({type:'hub:response',id:data.id,error:message},'*');
   }finally{this.active--;}
 }
 ngOnDestroy(){this.alive=false;window.removeEventListener('message',this.listener);}
}
