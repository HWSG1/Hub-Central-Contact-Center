import { bootstrapApplication } from '@angular/platform-browser';
import { Component } from '@angular/core';
import { provideRouter,RouterOutlet } from '@angular/router';
import { provideHttpClient,withInterceptors } from '@angular/common/http';
import { routes } from './app/routes';
import { sessionInterceptor } from './app/auth';
@Component({selector:'hub-root',imports:[RouterOutlet],template:'<router-outlet />'}) class App {}
bootstrapApplication(App,{providers:[provideRouter(routes),provideHttpClient(withInterceptors([sessionInterceptor]))]}).catch(()=>console.error('No se pudo iniciar el portal'));
