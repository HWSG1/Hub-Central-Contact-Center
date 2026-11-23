import {Component,ElementRef,ViewChild,inject,signal,OnDestroy} from '@angular/core';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {DomSanitizer,SafeHtml} from '@angular/platform-browser';
import {HttpClient} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';
import {adminError} from './admin/models';
const resizeBridge = `<style>html,body{overflow-y:hidden!important}</style><script>(()=>{let queued=false;const send=()=>{const b=document.body;if(!b)return;const m=getComputedStyle(b);const margins=(parseFloat(m.marginTop)||0)+(parseFloat(m.marginBottom)||0);const height=Math.ceil(Math.max(b.scrollHeight,b.getBoundingClientRect().height)+margins);if(height>0)parent.postMessage({type:'hub:resize',height},'*');};const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;send();});};if(typeof ResizeObserver!=='undefined')new ResizeObserver(schedule).observe(document.body);addEventListener('load',schedule);addEventListener('resize',schedule);schedule();})();</script>`;
@Component({imports:[RouterLink],template:`<header><a routerLink="/">Mis aplicaciones</a><h1>{{name()}}</h1></header>@if(error()){<p role="alert">{{error()}}</p>}@if(html()){<iframe #frame title="Herramienta instalada" sandbox="allow-scripts allow-downloads allow-forms" referrerpolicy="no-referrer" [srcdoc]="html()" [style.height.px]="frameHeight()"></iframe>}`,styles:[`:host{display:block;width:100%;min-width:0}header{margin-bottom:8px}h1{font-size:1.4rem;margin:6px 0}iframe{display:block;width:100%;height:540px;min-height:0;overflow:hidden;border:0;border-radius:12px;background:white}`]})
export class PackageHost implements OnDestroy {
 private http=inject(HttpClient);private route=inject(ActivatedRoute);private sanitizer=inject(DomSanitizer);
 @ViewChild('frame') frame?:ElementRef<HTMLIFrameElement>;
 name=signal('Cargando módulo…');error=signal('');html=signal<SafeHtml|null>(null);frameHeight=signal(540);private active=0;private alive=true;
 private code=this.route.snapshot.paramMap.get('code')??'';
 private listener=(event:MessageEvent)=>{void this.message(event);};
 constructor(){window.addEventListener('message',this.listener);void this.load();}
 private async load(){try{const result=await firstValueFrom(this.http.get<{name:string;html:string}>('/api/extensions/'+encodeURIComponent(this.code)+'/ui'));if(!this.alive)return;this.name.set(result.name);const policy=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'">`;const html=/<\/body\s*>/i.test(result.html)?result.html.replace(/<\/body\s*>/i,resizeBridge+'</body>'):result.html+resizeBridge;this.html.set(this.sanitizer.bypassSecurityTrustHtml(policy+html));}catch(e){this.error.set(adminError(e));}}
 private async message(event:MessageEvent){
  const target=this.frame?.nativeElement.contentWindow;
  if(!this.alive||!target||event.source!==target||event.origin!=='null')return;
  const data=event.data;if(data?.type==='hub:resize'){const height=data.height;if(typeof height==='number'&&Number.isFinite(height)&&height>=1&&height<=20000)this.frameHeight.set(Math.ceil(height));return;}if(!data||data.type!=='hub:request'||!Number.isSafeInteger(data.id)||typeof data.operation!=='string')return;
  if(this.active>=4){target.postMessage({type:'hub:response',id:data.id,error:'Demasiadas solicitudes.'},'*');return;}
  this.active++;
  try{if(JSON.stringify(data.input??null).length>16384)throw Error();const response=await firstValueFrom(this.http.post<{result:unknown}>('/api/extensions/'+encodeURIComponent(this.code)+'/run',{operation:data.operation,input:data.input}));if(this.alive)target.postMessage({type:'hub:response',id:data.id,result:response.result},'*');}catch{if(this.alive)target.postMessage({type:'hub:response',id:data.id,error:'No se pudo completar la operación. Revisa los datos y tu sesión.'},'*');}finally{this.active--;}
 }
 ngOnDestroy(){this.alive=false;window.removeEventListener('message',this.listener);}
}
