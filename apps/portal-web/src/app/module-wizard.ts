import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { zipSync, strToU8 } from 'fflate';
import { Auth } from './auth';
import { adminError } from './admin/models';
interface Report {manifest:{id:string;name:string;version:string;permission:string;route:string;description:string};sha256:string;size:number;files:string[];}
@Component({imports:[FormsModule,RouterLink],template:`
 <a routerLink="/modules">← Centro de módulos</a>
 <p class="page-kicker">ADMINISTRACIÓN</p><h1>Asistente de importación de módulos</h1>
 <p class="muted">Revisa el paquete, su acceso y el impacto antes de instalar y publicar.</p>
 @if(!allowed()){<p role="alert">Necesitas CORE.MODULES.MANAGE para importar módulos.</p>}
 @else{
 <ol class="steps" aria-label="Progreso de importación">@for(label of steps;track $index){<li [class.current]="step()===$index" [attr.aria-current]="step()===$index?'step':null"><span>{{$index+1}}</span>{{label}}</li>}</ol>
 @if(error()){<p class="error-message" role="alert">{{error()}}</p>}
 <section class="panel" [attr.aria-busy]="busy()">
 @switch(step()){
 @case(0){
 <h2>1. Cargar paquete modular (.ZIP)</h2>
 <p>Esta versión instala módulos cuyo código ya está incluido en el Hub. Los módulos con código nuevo necesitan el futuro servicio de despliegue.</p>
 <div class="upload"><label for="package">Selecciona un ZIP con manifest.json (máximo 8 KB)</label><input id="package" type="file" accept=".zip,application/zip" (change)="select($event)" [disabled]="busy()"><p>{{fileName()||'Ningún paquete seleccionado'}}</p><button (click)="download()" [disabled]="busy()">Descargar ZIP de Corta Cuotas</button></div>
 <label>Motivo del cambio<textarea [(ngModel)]="reason" maxlength="500" rows="2" placeholder="Describe el propósito de la instalación"></textarea></label>
 <p class="muted">Se requiere una sesión con MFA iniciada hace menos de 15 minutos.</p>
 <button class="primary" (click)="analyze()" [disabled]="busy()||!archive()||reason.trim().length<5">{{busy()?'Analizando…':'Analizar paquete'}}</button>
 }
 @case(1){<h2>2. Resultado del análisis</h2>@if(report();as r){<h3>{{r.manifest.name}} · {{r.manifest.version}}</h3><p>{{r.manifest.description}}</p><dl><dt>Código</dt><dd>{{r.manifest.id}}</dd><dt>Archivos admitidos</dt><dd>{{r.files.join(', ')}}</dd><dt>Tamaño</dt><dd>{{r.size}} bytes</dd><dt>SHA-256 del ZIP</dt><dd class="hash">{{r.sha256}}</dd></dl><p>El descriptor coincide con el registro de esta versión del Hub. El hash identifica el archivo; no es una firma digital.</p>}}
 @case(2){<h2>3. Configuración</h2><p>Corta Cuotas no requiere secretos, conexiones adicionales ni parámetros de instalación.</p><p>Ruta integrada: <strong>{{report()?.manifest?.route}}</strong></p><p>Las tasas y campañas provienen de la versión incluida y deben validarse antes de su uso operativo.</p>}
 @case(3){<h2>4. Seguridad y acceso</h2><p>Permiso necesario para usar este módulo: <strong>{{report()?.manifest?.permission}}</strong>.</p><p>Instalar no asigna permisos a usuarios ni roles. Un administrador autorizado debe asignar este permiso al rol operativo desde Roles y permisos, y asignar ese rol a las cuentas correspondientes.</p><p>Los usuarios operativos no necesitan permisos CORE.*.</p>}
 @case(4){<h2>5. Validación e impacto</h2><ul><li>Se crearán los registros del módulo, versión, instalación y catálogo en una transacción.</li><li>El módulo quedará instalado sin publicar; todavía no estará disponible para usuarios.</li><li>No se ejecutarán scripts SQL del ZIP ni se cambiarán tablas existentes.</li><li>No se modifican roles ni cuentas. Los cambios quedan auditados.</li><li>Si ya está instalado, se rechazará la operación sin duplicarlo.</li></ul><label class="check"><input type="checkbox" [(ngModel)]="confirmed"> He revisado el módulo y su impacto.</label><button class="primary" (click)="install()" [disabled]="busy()||!confirmed">{{busy()?'Instalando…':'Instalar módulo'}}</button>}
 @case(5){<h2>6. Publicación</h2>@if(published()){<p role="status">Módulo publicado. Será visible para las cuentas con permiso de uso.</p><a routerLink="/modules">Volver al centro de módulos</a>}@else{<p role="status">Instalación completada. El módulo está pendiente de publicación.</p><p>Puedes publicarlo ahora o hacerlo después desde el centro de módulos.</p><button class="primary" (click)="publish()" [disabled]="busy()">{{busy()?'Publicando…':'Publicar módulo'}}</button><a routerLink="/modules">Publicar después</a>}}
 }
 @if(step()>0&&step()<5){<div class="actions"><button (click)="back()" [disabled]="busy()">Anterior</button>@if(step()<4){<button class="primary" (click)="next()" [disabled]="busy()">Continuar</button>}</div>}
 </section>
 }
 `,styles:[`:host{display:block;min-width:0}h1{margin:12px 0}h2{margin-top:0}.steps{display:flex;flex-wrap:wrap;gap:12px;list-style:none;padding:20px;margin:24px 0;background:var(--surface);border:1px solid var(--border,#dfe3eb);border-radius:16px}.steps li{display:flex;gap:8px;align-items:center;padding:8px;border-radius:8px;flex:1;min-width:145px}.steps span{display:grid;place-items:center;min-width:28px;height:28px;border:1px solid;border-radius:50%}.current{color:#fff;background:#da282d}.panel{background:var(--surface);padding:clamp(18px,3vw,32px);border:1px solid var(--border,#dfe3eb);border-radius:18px}.upload{border:2px dashed #b5bfcd;border-radius:14px;padding:24px;margin:24px 0}label{display:grid;gap:10px;margin:16px 0}input,textarea{font:inherit;max-width:100%;box-sizing:border-box}textarea{padding:12px;background:transparent;color:inherit;border:1px solid #99a3b3;border-radius:8px}input[type=file]{width:100%}button{font:inherit;min-height:44px;padding:10px 18px;border:1px solid #aeb5c2;border-radius:8px;cursor:pointer}button:disabled{opacity:.5;cursor:default}.primary{background:#da282d;color:#fff;border-color:#da282d}.actions{display:flex;gap:12px;margin-top:24px;flex-wrap:wrap}.check{display:flex;align-items:center}.check input{width:22px;height:22px}p,li{line-height:1.65}dd{margin:4px 0 16px;overflow-wrap:anywhere}dt{font-weight:600}.hash{font-family:monospace}a{display:inline-block;margin:12px 16px 12px 0}`]})
export class ModuleWizard {
 private http=inject(HttpClient);private auth=inject(Auth);
 steps=['Cargar paquete','Analizar módulo','Configuración','Seguridad','Validación e impacto','Publicación'];
 step=signal(0);busy=signal(false);error=signal('');archive=signal('');fileName=signal('');report=signal<Report|null>(null);published=signal(false);reason='';confirmed=false;
 allowed(){return this.auth.user()?.permissions.includes('CORE.MODULES.MANAGE')??false;}
 async select(event:Event){this.archive.set('');this.report.set(null);this.error.set('');this.fileName.set('');const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;if(file.size>8192){this.error.set('El ZIP no puede superar 8 KB.');return;}try{const bytes=new Uint8Array(await file.arrayBuffer());this.archive.set(btoa(String.fromCharCode(...bytes)));this.fileName.set(file.name);}catch{this.error.set('No se pudo leer el archivo.');}}
 async download(){await this.run(async()=>{const data=await firstValueFrom(this.http.get<{available:unknown}>('/api/admin/modules'));const bytes=zipSync({'manifest.json':strToU8(JSON.stringify(data.available,null,2))});const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/zip'}));const a=document.createElement('a');a.href=url;a.download='corta-cuotas-1.0.0.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});}
 async analyze(){await this.run(async()=>{this.report.set(await firstValueFrom(this.http.post<Report>('/api/admin/modules/analyze',{archive:this.archive(),reason:this.reason.trim()})));this.step.set(1);});}
 next(){this.step.update(s=>Math.min(4,s+1));}back(){this.step.update(s=>Math.max(0,s-1));this.confirmed=false;}
 async install(){if(!this.confirmed)return;await this.run(async()=>{await firstValueFrom(this.http.post('/api/admin/modules/install-package',{archive:this.archive(),reason:this.reason.trim()}));this.archive.set('');this.step.set(5);});}
 async publish(){await this.run(async()=>{await firstValueFrom(this.http.post('/api/admin/modules',{action:'publish',reason:this.reason.trim()}));this.published.set(true);});}
 private async run(action:()=>Promise<void>){if(this.busy())return;this.busy.set(true);this.error.set('');try{await action();}catch(e){this.error.set(adminError(e));}finally{this.busy.set(false);}}
}
