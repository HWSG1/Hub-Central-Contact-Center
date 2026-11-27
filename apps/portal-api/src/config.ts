import { z } from 'zod';
const schema=z.object({NODE_ENV:z.enum(['development','test','production']).default('development'),PORT:z.coerce.number().int().min(1024).max(65535).default(3000),APP_ORIGIN:z.url(),SQL_SERVER:z.string().min(1),SQL_PORT:z.coerce.number().int().min(1).max(65535).default(14331),SQL_DATABASE:z.string().regex(/^[A-Za-z][A-Za-z0-9_]{1,63}$/),SQL_AUTH:z.enum(['windows','sql']).default('windows'),SQL_TRUST_SERVER_CERTIFICATE:z.enum(['true','false']).default('false'),SQL_USER:z.string().optional(),SQL_PASSWORD:z.string().optional(),LOCAL_AUTH_ENABLED:z.enum(['true','false']).default('false'),MFA_ENCRYPTION_KEY:z.string().default(''),OIDC_ISSUER:z.string().default(''),OIDC_CLIENT_ID:z.string().default(''),OIDC_CLIENT_SECRET:z.string().default(''),OIDC_REDIRECT_URI:z.string().default('')});
// BACKEND_PORT is the dedicated API setting; PORT remains compatible with existing .env files.
export const config=schema.parse({...process.env,PORT:process.env.BACKEND_PORT||process.env.PORT});
if(config.NODE_ENV==='production' && !config.APP_ORIGIN.startsWith('https://')) throw Error('HTTPS requerido');
if(config.SQL_AUTH==='sql' && (!config.SQL_USER || !config.SQL_PASSWORD)) throw Error('Faltan credenciales SQL');
if(new URL(config.APP_ORIGIN).origin!==config.APP_ORIGIN) throw Error('APP_ORIGIN debe ser un origen exacto');
if(config.OIDC_ISSUER && (!config.OIDC_ISSUER.startsWith('https://') || !config.OIDC_CLIENT_ID || !config.OIDC_CLIENT_SECRET || config.OIDC_REDIRECT_URI!==config.APP_ORIGIN+'/api/auth/callback')) throw Error('Configuración OIDC incompleta');

if(config.MFA_ENCRYPTION_KEY&&!/^[a-fA-F0-9]{64}$/.test(config.MFA_ENCRYPTION_KEY))throw Error('MFA_ENCRYPTION_KEY inválida');
if(config.NODE_ENV==='production'&&config.LOCAL_AUTH_ENABLED==='true'&&!config.MFA_ENCRYPTION_KEY)throw Error('Falta MFA_ENCRYPTION_KEY');
