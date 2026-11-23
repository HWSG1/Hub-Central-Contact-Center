import {Component,computed,inject,signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';
import {ActivatedRoute,RouterLink} from '@angular/router';
import {Auth} from '../auth';
import {Role,adminError} from './models';

@Component({imports:[RouterLink],templateUrl:'./permissions.html'})
export class Permissions {
 private http=inject(HttpClient);
 private route=inject(ActivatedRoute);
 auth=inject(Auth);
 roles=signal<Role[]>([]);
 permissions=signal<string[]>([]);
 ownRoles=signal<string[]>([]);
 selectedId=signal('');
 chosen=signal<string[]>([]);
 search=signal('');
 reason=signal('');
 loading=signal(true);
 busy=signal(false);
 error=signal('');
 notice=signal('');
 role=computed(()=>this.roles().find(r=>r.id===this.selectedId())??null);
 visiblePermissions=computed(()=>this.permissions().filter(p=>p.toLocaleLowerCase().includes(this.search().toLocaleLowerCase())));
 constructor(){void this.load();}
 has(code:string){return this.auth.user()?.permissions.includes(code)??false;}
 editable(role:Role){return this.has('CORE.PERMISSIONS.ASSIGN')&&!this.ownRoles().includes(role.id)&&role.permissions.every(p=>this.has(p));}
 moduleName(code:string){return code.startsWith('CORE.')?'Núcleo del Hub':code.split('.')[0].replaceAll('_',' ');}
 select(id:string){this.selectedId.set(id);this.chosen.set([...(this.roles().find(r=>r.id===id)?.permissions??[])]);this.reason.set('');}
 toggle(code:string,checked:boolean){if(!this.has(code))return;this.chosen.update(v=>checked?(v.includes(code)?v:[...v,code]):v.filter(x=>x!==code));}
 async load(){
  this.loading.set(true);this.error.set('');
  try{
   const data=await firstValueFrom(this.http.get<{roles:Role[];permissions:string[];ownRoleIds:string[]}>('/api/admin/roles'));
   this.roles.set(data.roles);this.permissions.set(data.permissions);this.ownRoles.set(data.ownRoleIds);
   const requested=this.route.snapshot.queryParamMap.get('role');
   const id=this.roles().find(r=>r.id===(requested??this.selectedId()))?.id??this.roles()[0]?.id??'';
   this.select(id);
  }catch(e){this.error.set(adminError(e));}finally{this.loading.set(false);}
 }
 async save(){
  const role=this.role();if(!role||!this.editable(role)||this.reason().trim().length<5||this.busy())return;
  this.busy.set(true);this.error.set('');this.notice.set('');
  try{
   await firstValueFrom(this.http.put('/api/admin/roles/'+role.id+'/permissions',{
    permissions:this.chosen(),version:role.version,reason:this.reason().trim()
   }));
   await this.load();this.notice.set('Matriz actualizada. El cambio se auditó y se revocaron las sesiones afectadas.');
  }catch(e){this.error.set(adminError(e));}finally{this.busy.set(false);}
 }
}
