import {computed,inject,Injectable,signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';

export interface CatalogEntry {
 id:string;
 code:string;
 name:string;
 description:string;
 route:string;
 is_favorite:boolean;
}

@Injectable({providedIn:'root'})
export class CatalogState {
 private http=inject(HttpClient);
 readonly entries=signal<CatalogEntry[]>([]);
 readonly favorites=computed(()=>this.entries().filter(e=>e.is_favorite));
 readonly loading=signal(true);
 readonly loaded=signal(false);
 readonly error=signal('');
 private pending=signal<Set<string>>(new Set<string>());
 private inflight:Promise<void>|null=null;

 busy(id:string){return this.pending().has(id);}

 load(force=false):Promise<void>{
  if(this.inflight)return this.inflight;
  if(this.loaded()&&!force)return Promise.resolve();
  this.loading.set(true);this.error.set('');
  this.inflight=firstValueFrom(this.http.get<CatalogEntry[]>('/api/catalog')).then(rows=>{
   this.entries.set(rows);
   this.loaded.set(true);
  }).catch(()=>{
   this.entries.set([]);
   this.loaded.set(false);
   this.error.set('No se pudo consultar el catálogo de aplicaciones.');
  }).finally(()=>{
   this.loading.set(false);
   this.inflight=null;
  });
  return this.inflight;
 }

 async setFavorite(entry:CatalogEntry):Promise<void>{
  if(this.pending().has(entry.id))return;
  const next=!entry.is_favorite;
  this.pending.update(current=>new Set([...current,entry.id]));
  this.error.set('');
  try{
   await firstValueFrom(this.http.put('/api/catalog/'+encodeURIComponent(entry.id)+'/favorite',{favorite:next}));
   this.entries.update(rows=>rows.map(e=>e.id===entry.id?{...e,is_favorite:next}:e));
  }catch{
   this.error.set('No se pudo guardar el acceso rápido. Intenta nuevamente.');
  }finally{
   this.pending.update(current=>{const updated=new Set(current);updated.delete(entry.id);return updated;});
  }
 }

 clear(){
  this.entries.set([]);this.loaded.set(false);this.loading.set(true);this.error.set('');
  this.pending.set(new Set<string>());
 }
}
