import { createHash } from 'node:crypto';
import { z } from 'zod';

// This descriptor can activate only code already reviewed and compiled into this release.
// It is not an executable package, a signature, or an authorization grant.
export const builtin={format:'hub-builtin-v1',id:'CORTA_CUOTAS',version:'1.0.0',name:'Calculadora Corta Cuotas',route:'/modules/corta-cuotas',permission:'CORTA_CUOTAS.USE',description:'Simula comisiones, cuota de capital y primer pago según el Excel de referencia.'} as const;
export const builtinHash=createHash('sha256').update(JSON.stringify(builtin)).digest('hex');
export const descriptor={...builtin,descriptorSha256:builtinHash};
const schema=z.object({format:z.literal(builtin.format),id:z.literal(builtin.id),version:z.literal(builtin.version),name:z.literal(builtin.name),route:z.literal(builtin.route),permission:z.literal(builtin.permission),description:z.literal(builtin.description),descriptorSha256:z.literal(builtinHash)}).strict();
export function validateDescriptor(value:unknown){return schema.parse(value);}
