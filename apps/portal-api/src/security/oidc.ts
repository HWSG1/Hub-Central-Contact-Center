import { Injectable,ServiceUnavailableException,UnauthorizedException } from '@nestjs/common';
import * as oidc from 'openid-client';
import { config } from '../config.js';
import { Database } from '../database.js';
import { digest,opaque } from './policy.js';
export interface IdentityProvider {begin():Promise<{url:string;binding:string}>;complete(url:URL,binding:string):Promise<{issuer:string;subject:string;mfa:boolean}>;}
@Injectable()
export class OidcProvider implements IdentityProvider {
 private client?:Promise<oidc.Configuration>;
 constructor(private db:Database){}
 private getClient(){if(!config.OIDC_ISSUER)throw new ServiceUnavailableException('Acceso corporativo no configurado');return this.client??=oidc.discovery(new URL(config.OIDC_ISSUER),config.OIDC_CLIENT_ID,config.OIDC_CLIENT_SECRET).catch(e=>{this.client=undefined;throw e;});}
 async begin(){const client=await this.getClient(),verifier=oidc.randomPKCECodeVerifier(),state=oidc.randomState(),nonce=oidc.randomNonce(),binding=opaque();
 await this.db.query('DELETE FROM core.oidc_transactions WHERE created_at<DATEADD(minute,-5,SYSUTCDATETIME()); INSERT core.oidc_transactions(state_hash,binding_hash,verifier,nonce) VALUES(@state,@binding,@verifier,@nonce)',{state:digest(state),binding:digest(binding),verifier,nonce});
 return {binding,url:oidc.buildAuthorizationUrl(client,{redirect_uri:config.OIDC_REDIRECT_URI,scope:'openid profile',response_type:'code',code_challenge:await oidc.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256',state,nonce}).href};}
 async complete(url:URL,binding:string){const state=url.searchParams.get('state');if(!state||!binding)throw new UnauthorizedException();
 const tx=(await this.db.query<{verifier:string;nonce:string}>('DELETE FROM core.oidc_transactions OUTPUT deleted.verifier,deleted.nonce WHERE state_hash=@state AND binding_hash=@binding AND created_at>DATEADD(minute,-5,SYSUTCDATETIME())',{state:digest(state),binding:digest(binding)})).recordset[0];
 if(!tx)throw new UnauthorizedException();const client=await this.getClient();const tokens=await oidc.authorizationCodeGrant(client,url,{pkceCodeVerifier:tx.verifier,expectedState:state,expectedNonce:tx.nonce,idTokenExpected:true});const claims=tokens.claims();if(!claims?.sub)throw new UnauthorizedException();return {issuer:claims.iss,subject:claims.sub,mfa:Array.isArray(claims.amr)&&claims.amr.includes('mfa')};
 }
}
