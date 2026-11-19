import {Component,inject,signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {FormBuilder,ReactiveFormsModule,Validators} from '@angular/forms';
import {RouterLink} from '@angular/router';
import {firstValueFrom} from 'rxjs';
import {adminError} from './admin/models';
@Component({imports:[ReactiveFormsModule,RouterLink],templateUrl:'./activate.html'})
export class Activate {
 private http=inject(HttpClient);busy=signal(false);error=signal('');setup=signal<{username:string;manualKey:string}|null>(null);done=signal(false);
 token=inject(FormBuilder).nonNullable.group({token:['',[Validators.required,Validators.pattern(/^[A-Za-z0-9_-]{43}$/)]]});
 form=inject(FormBuilder).nonNullable.group({password:['',[Validators.required,Validators.minLength(15),Validators.maxLength(128)]],confirmation:['',Validators.required],otp:['',[Validators.required,Validators.pattern(/^\d{6}$/)]]});
 async begin(){if(this.token.invalid||this.busy())return;this.busy.set(true);this.error.set('');try{this.setup.set(await firstValueFrom(this.http.post<{username:string;manualKey:string}>('/api/auth/activation/begin',this.token.getRawValue())));}catch(e){this.error.set(adminError(e));}finally{this.busy.set(false);}}
 async complete(){if(this.form.invalid||this.busy())return;const v=this.form.getRawValue();if(v.password!==v.confirmation){this.error.set('Las contraseñas no coinciden.');return;}this.busy.set(true);this.error.set('');try{await firstValueFrom(this.http.post('/api/auth/activation/complete',{token:this.token.controls.token.value,password:v.password,otp:v.otp}));this.form.reset();this.token.reset();this.setup.set(null);this.done.set(true);}catch(e){this.error.set(adminError(e));this.form.controls.otp.reset();}finally{this.busy.set(false);}}
 reset(){this.setup.set(null);this.form.reset();this.token.reset();this.error.set('');}
}
