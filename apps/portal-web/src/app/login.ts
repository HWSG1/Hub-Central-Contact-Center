import { Component,inject,signal } from '@angular/core';
import { FormBuilder,ReactiveFormsModule,Validators } from '@angular/forms';
import { HttpClient,HttpErrorResponse } from '@angular/common/http';
import { Router,ActivatedRoute } from '@angular/router';
import { Auth } from './auth';
import { Particles } from './particles';
@Component({selector:'hub-login',imports:[ReactiveFormsModule,Particles],templateUrl:'./login.html'})
export class Login {
 private auth=inject(Auth);private router=inject(Router);private http=inject(HttpClient);
 providers=signal({local:false,corporate:false});loading=signal(true);busy=signal(false);show=signal(false);changeRequired=signal(false);error=signal(inject(ActivatedRoute).snapshot.queryParamMap.has('error')?'No fue posible autenticar. Contacta a tu administrador.':'');
 form=inject(FormBuilder).nonNullable.group({username:['',[Validators.required,Validators.maxLength(128)]],password:['',[Validators.required,Validators.maxLength(256)]],otp:['',[Validators.pattern(/^\d{6}$/)]],newPassword:[''],confirmation:['']});
 constructor(){this.http.get<{local:boolean;corporate:boolean}>('/api/auth/providers').subscribe({next:p=>{this.providers.set(p);this.loading.set(false);},error:()=>{this.loading.set(false);this.error.set('No podemos conectar con el servicio. Inténtalo nuevamente.');}});}
 async submit(){if(this.form.invalid||this.busy())return;const value=this.form.getRawValue();if(this.changeRequired()&&(value.newPassword.length<15||value.newPassword.length>128||value.newPassword!==value.confirmation||value.newPassword===value.password)){this.error.set('Usa una contraseña distinta de 15 a 128 caracteres y confírmala.');return;}this.busy.set(true);this.error.set('');try{const complete=await this.auth.login(value.username,value.password,value.otp,this.changeRequired()?value.newPassword:undefined);if(!complete){this.changeRequired.set(true);return;}this.form.reset();await this.router.navigateByUrl('/');}catch(error:unknown){const status=error instanceof HttpErrorResponse?error.status:undefined;this.error.set(status===0||status!==undefined&&status>=500?'El servicio de acceso no está disponible. No se pudo completar la validación. Contacta al administrador o intenta más tarde.':status===429?'Se alcanzó el límite de intentos. Espera antes de volver a intentar.':'No fue posible autenticar. Revisa tus credenciales y usa un código vigente. Si estás cambiando la contraseña, evita incluir tu usuario o frases comunes.');this.form.controls.otp.reset();}finally{this.busy.set(false);}}
}
