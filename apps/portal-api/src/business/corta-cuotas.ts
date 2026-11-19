import { z } from 'zod';

export const purchaseSchema=z.object({amount:z.number().finite().positive().max(500000).refine(n=>Math.abs(n*100-Math.round(n*100))<0.000001,'Use como máximo dos decimales.'),months:z.union([z.literal(3),z.literal(6),z.literal(9),z.literal(12),z.literal(18),z.literal(24)]),campaign:z.boolean()}).strict();
export const rates=[{months:3,regular:6,campaign:6},{months:6,regular:9,campaign:4},{months:9,regular:10,campaign:10},{months:12,regular:12,campaign:8},{months:18,regular:18,campaign:18},{months:24,regular:20,campaign:20}];
export function calculatePurchase(input:unknown){
 const {amount,months,campaign}=purchaseSchema.parse(input);
 const rate=rates.find(r=>r.months===months)!;
 const preferential=campaign&&amount>10000&&(months===6||months===12);
 const commissionPercent=preferential?rate.campaign:rate.regular;
 // Preserve the workbook formulas without rounding intermediate results.
 const commission=amount*commissionPercent/100,monthlyPrincipal=amount/months;
 return {amount,months,campaign,preferential,nominalInterest:0,commissionPercent,commission,monthlyPrincipal,firstPayment:monthlyPrincipal+commission,total:amount+commission};
}
