import { Component,inject,signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Auth } from './auth';
import { adminError } from './admin/models';
interface ModuleRow {code:string;id:string;name:string;version:string;state:string;enabled:boolean;}
interface Descriptor {format?:string;route:string;name:string;id:string;version:string;permission:string;description:string;}
@Component({imports:[FormsModule,RouterLink],templateUrl:'./modules.html',styleUrls:['./module-management.css']})
export class Modules {
 private http=inject(HttpClient);private auth=inject(Auth);available=signal<Descriptor[]>([]);selected=signal<Descriptor|null>(null);rows=signal<ModuleRow[]>([]);loading=signal(false);busy=signal(false);error=signal('');notice=signal('');reason='';details=signal(false);configuration=signal(false);pending=signal<'publish'|'disable'|null>(null);
 constructor(){void this.load();}
 has(p:string){return this.auth.user()?.permissions.includes(p)??false;}
 installed(code:string){return this.rows().find(row=>row.code===code);}
 inspect(module:Descriptor,kind:'detail'|'configuration'){const same=this.selected()?.id===module.id;this.selected.set(module);this.pending.set(null);if(kind==='detail'){this.details.set(!same||!this.details());this.configuration.set(false);}else{this.configuration.set(!same||!this.configuration());this.details.set(false);}}
 availability(module:Descriptor){this.selected.set(module);this.details.set(false);this.configuration.set(false);this.pending.set(this.installed(module.id)?.enabled?'disable':'publish');this.reason='';}
 validReason(){return this.reason.trim().length>=5;}
 stateName(s:string){return ({VALIDATED:'Sin publicar',PUBLISHED:'Publicado',DISABLED:'Deshabilitado'} as Record<string,string>)[s]??s;}
 async load(){if(!this.has('CORE.MODULES.READ')){this.error.set('No tienes permiso para consultar módulos.');return;}this.loading.set(true);try{const data=await firstValueFrom(this.http.get<{available:Descriptor;modules:Descriptor[];installed:ModuleRow[]}>('/api/admin/modules'));this.available.set((data.modules??[data.available]).filter(module=>data.installed.some(row=>row.code===module.id)));this.rows.set(data.installed);}catch(e){this.error.set(adminError(e));}finally{this.loading.set(false);}}
 async change(action:'publish'|'disable'){if(this.busy()||!this.validReason())return;this.busy.set(true);this.error.set('');this.notice.set('');try{await firstValueFrom(this.http.post('/api/admin/modules',{action,code:this.selected()?.id,reason:this.reason.trim()}));this.reason='';await this.load();this.pending.set(null);this.notice.set('Estado actualizado y cambio auditado.');}catch(e){this.error.set(adminError(e));}finally{this.busy.set(false);}}
}
