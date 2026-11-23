import { inject,Injectable,signal } from '@angular/core';
import { HttpClient,HttpInterceptorFn } from '@angular/common/http';
import { CanActivateFn,Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
export interface Identity {id:string;name:string;roles:string[];permissions:string[];csrf:string;}
@Injectable({providedIn:'root'}) export class Auth {
 private http=inject(HttpClient);user=signal<Identity|null>(null);
 async refresh(){try{this.user.set(await firstValueFrom(this.http.get<Identity>('/api/auth/me')));return true;}catch{this.user.set(null);return false;}}
 async login(username:string,password:string,otp:string,newPassword?:string){const result=await firstValueFrom(this.http.post<{requiresPasswordChange?:boolean}>('/api/auth/login',{username,password,...(otp?{otp}:{}),...(newPassword?{newPassword}:{})}));if(result.requiresPasswordChange)return false;if(!await this.refresh())throw Error('No fue posible autenticar');return true;}
 async logout(){await firstValueFrom(this.http.post('/api/auth/logout',{}));this.user.set(null);}
}
export const sessionInterceptor:HttpInterceptorFn=(req,next)=>{const auth=inject(Auth);if(req.url.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(req.method)&&auth.user())req=req.clone({setHeaders:{'X-CSRF-Token':auth.user()!.csrf}});return next(req);};
export const authenticated:CanActivateFn=async()=>{const auth=inject(Auth),router=inject(Router);return await auth.refresh()||router.createUrlTree(['/login']);};
