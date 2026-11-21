import { createHash } from 'node:crypto';
import { z } from 'zod';

// This descriptor can activate only code already reviewed and compiled into this release.
// It is not an executable package, a signature, or an authorization grant.
export const builtin={format:'hub-builtin-v1',id:'CORTA_CUOTAS',version:'1.0.0',name:'Calculadora Corta Cuotas',route:'/modules/corta-cuotas',permission:'CORTA_CUOTAS.USE',description:'Simula comisiones, cuota de capital y primer pago según el Excel de referencia.'} as const;
export const builtinHash=createHash('sha256').update(JSON.stringify(builtin)).digest('hex');
export const descriptor={...builtin,descriptorSha256:builtinHash};

export const offersBuiltin={format:'hub-builtin-v1',id:'OFERTAS',version:'1.0.0',name:'Buscador de ofertas y calculadoras',route:'/modules/ofertas',permission:'OFERTAS.USE',description:'Consulta ofertas por cliente y base; simula Extra, Intra y Corta Cuotas.'} as const;
export const offersDescriptor={...offersBuiltin,descriptorSha256:createHash('sha256').update(JSON.stringify(offersBuiltin)).digest('hex')};
export const descriptors=[descriptor,offersDescriptor];
export function moduleDescriptor(code:string){const found=descriptors.find(d=>d.id===code);if(!found)throw new Error('Módulo no integrado.');return found;}
export function validateDescriptor(value:unknown){
 const input=z.record(z.string(),z.unknown()).parse(value);
 const expected=moduleDescriptor(String(input['id']));
 if(Object.keys(input).length!==Object.keys(expected).length||Object.entries(expected).some(([key,val])=>input[key]!==val))throw new Error('Descriptor modificado.');
 return expected;
}
