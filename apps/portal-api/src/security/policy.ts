import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
export const opaque=()=>randomBytes(32).toString('base64url');
export const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
export function same(a:unknown,b:string){return typeof a==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
export function active(u:{enabled:boolean;expires_at:Date|null},now=new Date()){return u.enabled && (!u.expires_at || new Date(u.expires_at)>now);}
export function live(s:{created_at:Date;last_seen_at:Date;revoked_at:Date|null},now=new Date()){return !s.revoked_at && now.getTime()-new Date(s.created_at).getTime()<28800000 && now.getTime()-new Date(s.last_seen_at).getTime()<900000;}
