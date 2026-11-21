import { z } from 'zod';
export const terms={EXTRA:[6,9,12,18,24,36,48,60],INTRA:[6,12,18,24,36,48],CORTA_CUOTAS:[3,6,9,12]};
export const intraPlans={'18_1.5':[18,1.5],'22_3.5':[22,3.5],'25_1.0':[25,1],'25_3.5':[25,3.5],'30_3.5':[30,3.5],'35_2.5':[35,2.5],'40_2.5':[40,2.5]} as const;
const schema=z.object({product:z.enum(['EXTRA','INTRA','CORTA_CUOTAS']),amount:z.number().positive().max(10000000).multipleOf(.01),months:z.number().int(),annualRate:z.number().min(0).max(100),intraPlan:z.enum(['18_1.5','22_3.5','25_1.0','25_3.5','30_3.5','35_2.5','40_2.5']),commissionPercent:z.number().min(0).max(50),commissionMode:z.enum(['FIRST','FINANCED'])}).strict();
const cents=(n:number)=>Math.round((n+Number.EPSILON)*100);
export function calculateOffers(value:unknown){
 const input=schema.parse(value);
 if(!terms[input.product].includes(input.months))throw new Error('Plazo no admitido.');
 let rate=input.annualRate,percent=input.commissionPercent,upfront=0,first=false,ssd=0;
 if(input.product==='EXTRA'){
  if(rate===0&&!([6,9,12].includes(input.months)))throw new Error('EXTRA al 0% solo admite 6, 9 o 12 meses.');
  percent=rate===0?({6:7,9:10,12:12}[input.months]??0):2.5;
  ssd=cents(input.amount*.02);
 }else if(input.product==='INTRA'){[rate,percent]=intraPlans[input.intraPlan];first=true;}
 else first=input.commissionMode==='FIRST';
 const commission=cents(input.amount*percent/100);
 let balance=cents(input.amount);
 if(input.product==='CORTA_CUOTAS'&&!first)balance+=commission;
 if(input.product==='EXTRA')upfront=commission+ssd;
 const financed=balance,monthly=rate/1200;
 const regular=monthly===0?Math.round(balance/input.months):Math.round(balance*monthly/(1-Math.pow(1+monthly,-input.months)));
 const schedule=[];let interestTotal=0,totalPayments=0;
 for(let month=1;month<=input.months;month++){
  const interest=Math.round(balance*monthly);
  const principal=month===input.months?balance:Math.min(balance,Math.max(0,regular-interest));
  balance-=principal;const extra=month===1&&first?commission:0;
  const payment=principal+interest+extra;interestTotal+=interest;totalPayments+=payment;
  schedule.push({month,payment:payment/100,principal:principal/100,interest:interest/100,commission:extra/100,balance:balance/100});
 }
 return {product:input.product,amount:input.amount,months:input.months,annualRate:rate,monthlyRate:rate/12,commissionPercent:percent,commission:commission/100,ssd:ssd/100,financed:financed/100,regularPayment:regular/100,firstPayment:schedule[0].payment,interestTotal:interestTotal/100,totalPayments:totalPayments/100,upfront:upfront/100,totalCost:(totalPayments+upfront)/100,schedule};
}
