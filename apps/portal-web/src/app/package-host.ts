import {Component,ElementRef,ViewChild,inject,signal,OnDestroy} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {DomSanitizer,SafeHtml} from '@angular/platform-browser';
import {HttpClient,HttpErrorResponse} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';
import {adminError} from './admin/models';
@Component({imports:[RouterLink],template:`<header><a routerLink="/">Mis aplicaciones</a><h1>{{name()}}</h1></header>@if(error()){<p role="alert">{{error()}}</p>}@if(html()){<iframe #frame title="Herramienta instalada" sandbox="allow-scripts allow-downloads allow-forms" referrerpolicy="no-referrer" [srcdoc]="html()"></iframe>}`,styles:[`:host{display:block}header{margin-bottom:12px}h1{font-size:1.4rem;margin:8px 0}iframe{display:block;width:100%;height:calc(100dvh - 210px);min-height:540px;border:0;border-radius:12px;background:white}`]})
export class PackageHost implements OnDestroy {
 private http=inject(HttpClient);private route=inject(ActivatedRoute);private sanitizer=inject(DomSanitizer);
 @ViewChild('frame') frame?:ElementRef<HTMLIFrameElement>;
 name=signal('Cargando módulo…');error=signal('');html=signal<SafeHtml|null>(null);private active=0;private alive=true;
 private code=this.route.snapshot.paramMap.get('code')??'';
 private listener=(event:MessageEvent)=>{void this.message(event);};
 constructor(){window.addEventListener('message',this.listener);void this.load();}
 private async load(){try{const result=await firstValueFrom(this.http.get<{name:string;html:string}>('/api/extensions/'+encodeURIComponent(this.code)+'/ui'));if(!this.alive)return;this.name.set(result.name);const policy=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'">`;this.html.set(this.sanitizer.bypassSecurityTrustHtml(policy+result.html));}catch(e){this.error.set(adminError(e));}}
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
