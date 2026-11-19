import {Component,computed,inject,signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {FormBuilder,ReactiveFormsModule,Validators} from '@angular/forms';
import {firstValueFrom} from 'rxjs';
import {Auth} from '../auth';
import {ManagedUser,Role,adminError} from './models';
@Component({imports:[ReactiveFormsModule],templateUrl:'./users.html'})
export class Users {
 auth=inject(Auth);private http=inject(HttpClient);users=signal<ManagedUser[]>([]);roles=signal<Role[]>([]);search=signal('');loading=signal(true);busy=signal(false);error=signal('');notice=signal('');selected=signal<ManagedUser|null>(null);mode=signal<'roles'|'status'|'invite'>('roles');chosen=signal<string[]>([]);
 creating=signal(false);invitation=signal<{username?:string;activationCode:string}|null>(null);activationUrl=window.location.origin+'/activate';
 createForm=inject(FormBuilder).nonNullable.group({username:['',[Validators.required,Validators.pattern(/^[a-zA-Z0-9][a-zA-Z0-9@._-]{2,127}$/)]],name:['',[Validators.required,Validators.maxLength(120)]],reason:['',[Validators.required,Validators.minLength(5),Validators.maxLength(500)]]});
 newUser(){this.selected.set(null);this.creating.set(true);this.chosen.set([]);this.createForm.reset();this.invitation.set(null);this.error.set('');this.notice.set('');}
 async create(){if(this.createForm.invalid||this.busy())return;this.busy.set(true);this.error.set('');try{const v=this.createForm.getRawValue();const result=await firstValueFrom(this.http.post<{username:string;activationCode:string}>('/api/admin/users',{username:v.username.trim(),name:v.name.trim(),reason:v.reason.trim(),roles:this.chosen()}));this.creating.set(false);this.createForm.reset();this.invitation.set(result);await this.load();this.notice.set('Cuenta creada. Entrega el código de activación al usuario por un canal privado.');}catch(e){this.error.set(adminError(e));}finally{this.busy.set(false);}}
 form=inject(FormBuilder).nonNullable.group({enabled:[true],reason:['',[Validators.required,Validators.minLength(5),Validators.maxLength(500)]]});
 filtered=computed(()=>this.users().filter(u=>(u.display_name+' '+(u.login??'')).toLowerCase().includes(this.search().toLowerCase())));
 constructor(){void this.load();}has(p:string){return this.auth.user()?.permissions.includes(p)??false;}
 roleNames(u:ManagedUser){return u.roles.map(id=>this.roles().find(r=>r.id===id)?.name??'Rol no disponible').join(', ')||'Sin roles';}
 editable(u:ManagedUser){return u.id!==this.auth.user()?.id&&u.roles.every(id=>this.roles().find(r=>r.id===id)?.permissions.every(p=>this.has(p)));}
 assignable(r:Role){return r.enabled&&r.permissions.every(p=>this.has(p));}
 async load(){this.loading.set(true);this.error.set('');try{const v=await firstValueFrom(this.http.get<{users:ManagedUser[];roles:Role[]}>('/api/admin/users'));this.users.set(v.users);this.roles.set(v.roles);}catch(e){this.error.set(adminError(e));}finally{this.loading.set(false);}}
 edit(u:ManagedUser,mode:'roles'|'status'|'invite'){this.creating.set(false);this.invitation.set(null);this.selected.set(u);this.mode.set(mode);this.chosen.set([...u.roles]);this.form.reset({enabled:u.enabled,reason:''});this.error.set('');this.notice.set('');}
 toggle(id:string,checked:boolean){this.chosen.update(v=>checked?[...v,id]:v.filter(x=>x!==id));}
 async save(){const u=this.selected();if(!u||this.form.invalid||this.busy())return;this.busy.set(true);this.error.set('');try{const v=this.form.getRawValue(),base={version:u.security_version,reason:v.reason.trim()};const response=await firstValueFrom(this.mode()==='invite'?this.http.post<{activationCode:string}>('/api/admin/users/'+u.id+'/invitation',base):this.mode()==='roles'?this.http.put('/api/admin/users/'+u.id+'/roles',{...base,roles:this.chosen()}):this.http.patch('/api/admin/users/'+u.id+'/status',{...base,enabled:v.enabled}));if(this.mode()==='invite')this.invitation.set({username:u.login??undefined,activationCode:(response as {activationCode:string}).activationCode});this.selected.set(null);await this.load();this.notice.set(this.mode()==='invite'?'Código renovado. El código anterior ya no funciona.':'Acceso actualizado. El cambio se auditó y las sesiones del usuario se revocaron.');}catch(e){this.error.set(adminError(e));}finally{this.busy.set(false);}}
}
