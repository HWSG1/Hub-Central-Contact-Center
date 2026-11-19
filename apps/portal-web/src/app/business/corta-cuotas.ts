import { Component,inject,signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { adminError } from '../admin/models';
interface Result {amount:number;months:number;campaign:boolean;preferential:boolean;nominalInterest:number;commissionPercent:number;commission:number;monthlyPrincipal:number;firstPayment:number;total:number;}
@Component({imports:[FormsModule,DecimalPipe,RouterLink],template:`
 <a routerLink="/">← Mis aplicaciones</a><div class="page-kicker">SIMULADOR DE PRUEBA</div><h1>Corta Cuotas</h1><p class="intro">Calcula la comisión única, la cuota mensual de capital y el primer pago.</p>
 @if(error()){<p class="error-message" role="alert">{{error()}}</p>}
 @if(loading()){<p role="status">Comprobando disponibilidad…</p>}
 @if(ready()){
 <div class="calculator-grid"><section class="calculator-card"><h2>Datos de la compra</h2>
 <form #form="ngForm" (ngSubmit)="calculate()">
 <label for="amount">Monto de la compra (L)</label><input id="amount" name="amount" type="number" inputmode="decimal" min="0.01" max="500000" step="0.01" required [(ngModel)]="amount" (ngModelChange)="clear()"><small>Mayor que cero, hasta L 500,000.00.</small>
 <label for="months">Plazo</label><select id="months" name="months" [(ngModel)]="months" (ngModelChange)="clear()">@for(m of terms;track m){<option [ngValue]="m">{{m}} meses</option>}</select>
 <label class="check"><input type="checkbox" name="campaign" [(ngModel)]="campaign" (ngModelChange)="clear()"> Simular campaña navideña</label>
 <p class="note">El Excel indica del 15 al 31 de diciembre, sin año. Esta opción simula la campaña; no confirma su vigencia.</p>
 <button type="submit" [disabled]="busy()||form.invalid">{{busy()?'Calculando…':'Calcular cuotas'}}</button>
 </form></section>
 <section class="calculator-card results" aria-live="polite"><h2>Resultado de la simulación</h2>
 @if(result();as r){<span class="condition">{{r.preferential?'Comisión preferencial':'Tarifa regular'}}</span>
 <p>Compra de <strong>L {{r.amount|number:'1.2-2'}}</strong> a {{r.months}} meses.</p>
 <dl><div><dt>Interés nominal</dt><dd>0.00%</dd></div><div><dt>Comisión aplicable</dt><dd>{{r.commissionPercent}}%</dd></div><div><dt>Comisión por desembolso</dt><dd>L {{r.commission|number:'1.2-2'}}</dd></div><div><dt>Cuota mensual de capital</dt><dd>L {{r.monthlyPrincipal|number:'1.2-2'}}</dd></div><div class="highlight"><dt>Primer estado de cuenta</dt><dd>L {{r.firstPayment|number:'1.2-2'}}</dd></div><div><dt>Total general a pagar</dt><dd>L {{r.total|number:'1.2-2'}}</dd></div></dl>
 <p class="note">La comisión se agrega a la primera cuota. Se muestran dos decimales; los cálculos conservan la precisión del Excel. No genera un plan de cobro ni distribuye ajustes de redondeo.</p>
 }@else{<div class="placeholder">Ingresa los datos y selecciona Calcular cuotas.</div>}
 </section></div>
 <section class="calculator-card"><h2>Tarifario de referencia</h2><div class="table-wrap"><table><caption>Fuente: Calculadora_Corta_Cuotas.xlsx · interés nominal 0%</caption><thead><tr><th>Plazo</th><th>Regular</th><th>Campaña*</th></tr></thead><tbody>@for(rate of rates();track rate.months){<tr><td>{{rate.months}} meses</td><td>{{rate.regular}}%</td><td>{{rate.campaign}}%</td></tr>}</tbody></table></div><p>* Compra mayor a L10,000; reducción únicamente para 6 y 12 meses. Validar condiciones vigentes antes de uso operativo.</p><p class="note">Según el archivo: aplica únicamente Extra e Intra. Tarjeta activa, al día y sin sobregiro. Cancelación anticipada sin penalización. El simulador no verifica estas condiciones.</p></section>
 }`,styles:[`:host{display:block;min-width:0}.page-kicker{margin-top:24px}.intro{font-size:1.05rem}.calculator-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:24px;margin:28px 0}.calculator-card{background:var(--surface,#fff);border:1px solid var(--border,#dfe3eb);border-radius:18px;padding:clamp(18px,3vw,30px);min-width:0}h2{margin-top:0;font-size:1.35rem}label:not(.check){display:block;margin:22px 0 8px;font-weight:600}input:not([type=checkbox]),select{width:100%;box-sizing:border-box;min-height:48px;border:1px solid #939dab;border-radius:9px;padding:10px;font:inherit;background:transparent;color:inherit}.check{display:flex;gap:10px;align-items:center;margin:22px 0 10px}.check input{width:20px;height:20px;flex-shrink:0}small,.note{font-size:.9rem;line-height:1.6}.note{opacity:.8}button{width:100%;min-height:48px;border:0;border-radius:9px;background:#d9212b;color:white;font:inherit;font-weight:600;cursor:pointer}button:disabled{opacity:.5}.condition{display:inline-block;border:1px solid #d9212b;border-radius:20px;padding:6px 12px;font-size:.9rem}dl>div{display:flex;justify-content:space-between;gap:16px;padding:16px 0;border-bottom:1px solid #dce0e7}dd{margin:0;text-align:right;font-weight:650;white-space:nowrap}.highlight{color:#ce1929}.placeholder{min-height:220px;display:grid;place-content:center;color:#68758b;text-align:center}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{padding:14px;text-align:left;border-bottom:1px solid #dce0e7}caption{text-align:left;padding:10px 0;font-size:.9rem}@media(max-width:850px){.calculator-grid{grid-template-columns:1fr}}@media(max-width:400px){dl>div{flex-direction:column;gap:6px}dd{text-align:left}}`]})
export class CortaCuotas {
 private http=inject(HttpClient);amount:number|null=null;months=12;campaign=false;terms=[3,6,9,12,18,24];result=signal<Result|null>(null);rates=signal<{months:number;regular:number;campaign:number}[]>([]);loading=signal(true);ready=signal(false);busy=signal(false);error=signal('');
 constructor(){void this.load();}
 async load(){try{const data=await firstValueFrom(this.http.get<{rates:{months:number;regular:number;campaign:number}[]}>('/api/business/corta-cuotas'));this.rates.set(data.rates);this.ready.set(true);}catch(e){this.error.set(adminError(e));}finally{this.loading.set(false);}}
 clear(){this.result.set(null);}
 async calculate(){if(this.busy())return;this.busy.set(true);this.result.set(null);this.error.set('');try{this.result.set(await firstValueFrom(this.http.post<Result>('/api/business/corta-cuotas/calculate',{amount:this.amount,months:this.months,campaign:this.campaign})));}catch(e){this.error.set(adminError(e));}finally{this.busy.set(false);}}
}
