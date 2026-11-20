import { Component,inject,signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Auth } from './auth';
import { adminError } from './admin/models';
interface ModuleRow {id:string;name:string;version:string;state:string;enabled:boolean;}
interface Descriptor {name:string;id:string;version:string;permission:string;description:string;}
@Component({imports:[FormsModule,RouterLink],template:`
 <div class="page-kicker">ADMINISTRACIÓN</div><h1>Centro de módulos</h1>
 <p class="muted">Importa y publica los módulos incluidos en esta versión del Hub.</p>
 @if(error()){<p role="alert" class="error-message">{{error()}}</p>}
 @if(notice()){<p role="status">{{notice()}}</p>}
 @if(loading()){<p role="status">Consultando módulos…</p>}
 @if(available();as module){
 <section class="module-card"><span class="tag">MÓDULO DE PRUEBA · {{module.version}}</span><h2>{{module.name}}</h2><p>{{module.description}}</p>
 <p>Permiso de uso: <strong>{{module.permission}}</strong></p>
 <p>La campaña y el tarifario se reproducen del Excel de referencia; deben validarse antes de su uso operativo.</p>
 @if(rows().length){@for(row of rows();track row.id){<p>Estado: <strong>{{stateName(row.state)}}</strong></p>
 @if(row.enabled&&has('CORTA_CUOTAS.USE')){<a routerLink="/modules/corta-cuotas">Abrir calculadora →</a>}}}
 @else{<p>Este módulo todavía no está instalado.</p>}
 @if(has('CORE.MODULES.MANAGE')){
 <div class="module-actions"><a routerLink="/modules/import">Importar paquete ZIP →</a><button type="button" (click)="download()">Descargar manifiesto de prueba</button></div>
 <label>Motivo del cambio<textarea [(ngModel)]="reason" maxlength="500" rows="2" placeholder="Describe por qué realizas esta operación"></textarea></label>
 @if(!rows().length){
 <label>Importar manifiesto JSON<input type="file" accept=".json,application/json" (change)="select($event)" [disabled]="busy()"></label>
 @if(fileName()){<p>Archivo seleccionado: {{fileName()}}</p>}
 <button type="button" (click)="change('install')" [disabled]="busy()||!manifest()||!validReason()">Importar módulo</button>
 }@else{<div class="module-actions">@if(rows()[0].enabled){<button type="button" (click)="change('disable')" [disabled]="busy()||!validReason()">Deshabilitar módulo</button>}@else{<button type="button" (click)="change('publish')" [disabled]="busy()||!validReason()">Publicar módulo</button>}</div>}
 <p class="muted">Requiere haber iniciado sesión con MFA en los últimos 15 minutos. Publicar lo hace visible a los usuarios con permiso de uso.</p>
 }@else{<p>Tu cuenta puede consultar módulos, pero no instalarlos ni publicarlos.</p>}
 </section>
 <section class="module-card"><h2>Acceso de usuarios</h2><p>En Roles y permisos, asigna <strong>CORTA_CUOTAS.USE</strong> al rol operativo. Luego asigna ese rol al usuario. No requiere permisos CORE.*.</p><p>Esta entrega importa descriptores de módulos incluidos. Los paquetes externos con código requieren revisión e incorporación al despliegue.</p></section>
 }`,styles:[`:host{display:block;min-width:0}.module-card{background:var(--surface,#fff);border:1px solid var(--border,#dfe3eb);border-radius:18px;padding:clamp(18px,3vw,32px);margin:24px 0;overflow-wrap:anywhere}label{display:grid;gap:8px;margin:20px 0}textarea,input{max-width:100%;min-height:44px;font:inherit;padding:10px;border:1px solid #99a3b3;border-radius:8px;background:transparent;color:inherit}button{min-height:44px;padding:10px 18px;font:inherit;border-radius:8px;border:1px solid #aeb5c2;cursor:pointer}button:disabled{opacity:.5;cursor:default}.module-actions{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}p{line-height:1.6}`]})
export class Modules {
 private http=inject(HttpClient);private auth=inject(Auth);available=signal<Descriptor|null>(null);rows=signal<ModuleRow[]>([]);loading=signal(false);busy=signal(false);error=signal('');notice=signal('');manifest=signal('');fileName=signal('');reason='';
 constructor(){void this.load();}
 has(p:string){return this.auth.user()?.permissions.includes(p)??false;}
 validReason(){return this.reason.trim().length>=5;}
 stateName(s:string){return ({VALIDATED:'Instalado, pendiente de publicación',PUBLISHED:'Publicado',DISABLED:'Deshabilitado'} as Record<string,string>)[s]??s;}
 async load(){if(!this.has('CORE.MODULES.READ')){this.error.set('No tienes permiso para consultar módulos.');return;}this.loading.set(true);try{const data=await firstValueFrom(this.http.get<{available:Descriptor;installed:ModuleRow[]}>('/api/admin/modules'));this.available.set(data.available);this.rows.set(data.installed);}catch(e){this.error.set(adminError(e));}finally{this.loading.set(false);}}
 download(){const url=URL.createObjectURL(new Blob([JSON.stringify(this.available(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='corta-cuotas-1.0.0.hub.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async select(event:Event){this.manifest.set('');this.fileName.set('');this.error.set('');const file=(event.target as HTMLInputElement).files?.[0];if(!file)return;if(file.size>8192){this.error.set('El manifiesto debe ser JSON de hasta 8 KB.');return;}try{const text=await file.text();JSON.parse(text);this.manifest.set(text);this.fileName.set(file.name);}catch{this.error.set('No se pudo leer un manifiesto JSON válido.');}}
 async change(action:'install'|'publish'|'disable'){if(this.busy()||!this.validReason())return;this.busy.set(true);this.error.set('');this.notice.set('');try{await firstValueFrom(this.http.post('/api/admin/modules',{action,reason:this.reason.trim(),...(action==='install'?{manifest:this.manifest()}:{})}));this.reason='';this.manifest.set('');this.fileName.set('');await this.load();this.notice.set(action==='install'?'Módulo instalado. Indica el motivo y publícalo para habilitar su uso.':'Estado actualizado y cambio auditado.');}catch(e){this.error.set(adminError(e));}finally{this.busy.set(false);}}
}
