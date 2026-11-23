import {Component,computed,inject,signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';
import {RouterLink} from '@angular/router';
import {Auth} from '../auth';
import {ManagedUser,Role,adminError} from './models';

@Component({imports:[RouterLink],templateUrl:'./assignments.html'})
export class Assignments {
 auth=inject(Auth);private http=inject(HttpClient);
 users=signal<ManagedUser[]>([]);roles=signal<Role[]>([]);
 search=signal('');loading=signal(true);busy=signal(false);error=signal('');notice=signal('');
 selected=signal<ManagedUser|null>(null);chosen=signal<string[]>([]);reason=signal('');
 filtered=computed(()=>this.users().filter(u=>(u.display_name+' '+(u.login??'')).toLocaleLowerCase().includes(this.search().toLocaleLowerCase())));
 constructor(){void this.load();}
 has(p:string){return this.auth.user()?.permissions.includes(p)??false;}
 roleNames(u:ManagedUser){return u.roles.map(id=>this.roles().find(r=>r.id===id)?.name??'Rol no disponible').join(', ')||'Sin roles';}
 editable(u:ManagedUser){return this.has('CORE.USERS.ROLES_ASSIGN')&&u.id!==this.auth.user()?.id&&u.roles.every(id=>this.roles().find(r=>r.id===id)?.permissions.every(p=>this.has(p)));}
 assignable(r:Role){return r.enabled&&r.permissions.every(p=>this.has(p));}
 async load(){
  this.loading.set(true);this.error.set('');
  try{const data=await firstValueFrom(this.http.get<{users:ManagedUser[];roles:Role[]}>('/api/admin/users'));this.users.set(data.users);this.roles.set(data.roles);}
  catch(e){this.error.set(adminError(e));}finally{this.loading.set(false);}
 }
 edit(u:ManagedUser){if(!this.editable(u))return;this.selected.set(u);this.chosen.set([...u.roles]);this.reason.set('');this.error.set('');this.notice.set('');}
 toggle(roleId:string,checked:boolean){this.chosen.update(v=>checked?(v.includes(roleId)?v:[...v,roleId]):v.filter(x=>x!==roleId));}
 cancel(){this.selected.set(null);this.reason.set('');}
 async save(){
  const u=this.selected();if(!u||!this.editable(u)||this.reason().trim().length<5||this.busy())return;
  this.busy.set(true);this.error.set('');this.notice.set('');
  try{
   await firstValueFrom(this.http.put('/api/admin/users/'+u.id+'/roles',{roles:this.chosen(),version:u.security_version,reason:this.reason().trim()}));
   this.cancel();await this.load();
   this.notice.set('Asignaciones actualizadas y auditadas. Se revocaron las sesiones afectadas.');
  }catch(e){this.error.set(adminError(e));}finally{this.busy.set(false);}
 }
}
