import {Component,computed,inject,signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {FormBuilder,ReactiveFormsModule,Validators} from '@angular/forms';
import {firstValueFrom} from 'rxjs';
import {Auth} from '../auth';
import {Role,adminError} from './models';
@Component({imports:[ReactiveFormsModule],templateUrl:'./roles.html'})
export class Roles {
 auth=inject(Auth);private http=inject(HttpClient);private fb=inject(FormBuilder);
 roles=signal<Role[]>([]);permissions=signal<string[]>([]);ownRoles=signal<string[]>([]);search=signal('');filterPermissions=signal('');loading=signal(true);busy=signal(false);error=signal('');notice=signal('');mode=signal<'role'|'permissions'|null>(null);selected=signal<Role|null>(null);chosen=signal<string[]>([]);
 filtered=computed(()=>this.roles().filter(r=>(r.name+' '+r.code).toLowerCase().includes(this.search().toLowerCase())));
 visiblePermissions=computed(()=>this.permissions().filter(p=>p.toLowerCase().includes(this.filterPermissions().toLowerCase())));
 form=this.fb.nonNullable.group({code:['',[Validators.required,Validators.pattern(/^[A-Z][A-Z0-9_]{2,99}$/)]],name:['',[Validators.required,Validators.maxLength(120)]],description:['',[Validators.maxLength(500)]],enabled:[true],reason:['',[Validators.required,Validators.minLength(5),Validators.maxLength(500)]]});
 permissionForm=this.fb.nonNullable.group({reason:['',[Validators.required,Validators.minLength(5),Validators.maxLength(500)]]});
 constructor(){void this.load();}
 has(p:string){return this.auth.user()?.permissions.includes(p)??false;}
 editable(r:Role){return !this.ownRoles().includes(r.id)&&r.permissions.every(p=>this.has(p));}
 async load(){this.loading.set(true);this.error.set('');try{const data=await firstValueFrom(this.http.get<{roles:Role[];permissions:string[];ownRoleIds:string[]}>('/api/admin/roles'));this.roles.set(data.roles);this.permissions.set(data.permissions);this.ownRoles.set(data.ownRoleIds);}catch(e){this.error.set(adminError(e));}finally{this.loading.set(false);}}
 edit(role:Role|null){this.selected.set(role);this.mode.set('role');this.error.set('');this.notice.set('');this.form.reset({code:role?.code??'',name:role?.name??'',description:role?.description??'',enabled:role?.enabled??true,reason:''});}
 matrix(role:Role){this.selected.set(role);this.mode.set('permissions');this.chosen.set([...role.permissions]);this.permissionForm.reset();this.filterPermissions.set('');this.error.set('');this.notice.set('');}
 toggle(code:string,checked:boolean){this.chosen.update(list=>checked?[...list,code]:list.filter(p=>p!==code));}
 async save(){if(this.busy()||this.form.invalid)return;this.busy.set(true);this.error.set('');const role=this.selected(),v=this.form.getRawValue();try{const body={name:v.name.trim(),description:v.description.trim(),enabled:v.enabled,reason:v.reason.trim()};await firstValueFrom(role?this.http.patch('/api/admin/roles/'+role.id,{...body,version:role.version}):this.http.post('/api/admin/roles',{...body,code:v.code}));this.mode.set(null);await this.load();this.notice.set('Rol guardado. El cambio quedó registrado en auditoría.');}catch(e){this.error.set(adminError(e));}finally{this.busy.set(false);}}
 async savePermissions(){const role=this.selected();if(!role||this.permissionForm.invalid||this.busy())return;this.busy.set(true);this.error.set('');try{await firstValueFrom(this.http.put('/api/admin/roles/'+role.id+'/permissions',{permissions:this.chosen(),version:role.version,reason:this.permissionForm.getRawValue().reason.trim()}));this.mode.set(null);await this.load();this.notice.set('Permisos guardados. Las sesiones afectadas se revocaron.');}catch(e){this.error.set(adminError(e));}finally{this.busy.set(false);}}
}
