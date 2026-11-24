import { Body,Controller,Get,Post,Req,Res,ForbiddenException } from '@nestjs/common';
import { IsString,IsOptional,Length,Matches } from 'class-validator';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';
import { Public,SessionRequest } from './guard.js';
import { OidcProvider } from './oidc.js';
import { config } from '../config.js';
import { Database } from '../database.js';
class LoginDto {@IsString() @Length(1,128) @Matches(/^[a-zA-Z0-9@._-]+$/) username!:string; @IsString() @Length(1,256) password!:string; @IsOptional() @IsString() @Matches(/^\d{6}$/) otp?:string; @IsOptional() @IsString() @Length(15,128) newPassword?:string;}
const cookie={httpOnly:true,secure:config.NODE_ENV==='production',sameSite:'lax' as const,path:'/api'};
@Controller('auth')
export class AuthController {
 constructor(private auth:AuthService,private oidc:OidcProvider,private db:Database){}
 @Public() @Get('providers') providers(){return {local:config.LOCAL_AUTH_ENABLED==='true',corporate:!!config.OIDC_ISSUER};}
 @Public() @Post('login') async login(@Body() body:LoginDto,@Req() req:SessionRequest,@Res({passthrough:true}) res:Response){if(req.get('origin')!==config.APP_ORIGIN)throw new ForbiddenException();const session=await this.auth.local(body.username,body.password,req.correlation,body.otp,body.newPassword);if('requiresPasswordChange' in session)return session;res.cookie('hub_session',session.token,{...cookie,maxAge:43200000});return {csrf:session.csrf};}
 @Public() @Get('corporate') async corporate(@Res() res:Response){const flow=await this.oidc.begin();res.cookie('hub_oidc',flow.binding,{...cookie,maxAge:300000});res.redirect(flow.url);}
 @Public() @Get('callback') async callback(@Req() req:SessionRequest,@Res() res:Response){try{const identity=await this.oidc.complete(new URL(req.originalUrl,config.APP_ORIGIN),String(req.cookies?.['hub_oidc']??''));const session=await this.auth.corporate(identity.issuer,identity.subject,identity.mfa,req.correlation);res.cookie('hub_session',session.token,{...cookie,maxAge:43200000});res.clearCookie('hub_oidc',cookie);res.redirect(config.APP_ORIGIN+'/');}catch{res.clearCookie('hub_oidc',cookie);res.redirect(config.APP_ORIGIN+'/login?error=auth');}}
 @Get('me') async me(@Req() req:SessionRequest){
  const roles=(await this.db.query<{name:string}>(`
   SELECT DISTINCT r.name FROM core.roles r
   JOIN core.user_roles ur ON ur.role_id=r.id
   WHERE ur.user_id=@id AND r.enabled=1 ORDER BY r.name
  `,{id:req.user.id})).recordset.map(r=>r.name);
  return {id:req.user.id,name:req.user.display_name,roles,permissions:req.permissions,csrf:req.csrf};
 }
 @Post('logout') async logout(@Req() req:SessionRequest,@Res({passthrough:true}) res:Response){await this.db.query('UPDATE core.sessions SET revoked_at=SYSUTCDATETIME() WHERE token_hash=@hash',{hash:req.sessionHash});res.clearCookie('hub_session',cookie);await this.auth.audit('AUTH.LOGOUT','SUCCESS',req.user.id,req.correlation);return {ok:true};}
 @Post('revoke-all') async revokeAll(@Req() req:SessionRequest){await this.db.query('UPDATE core.sessions SET revoked_at=SYSUTCDATETIME() WHERE user_id=@id AND revoked_at IS NULL',{id:req.user.id});await this.auth.audit('SESSIONS.REVOKE_ALL','SUCCESS',req.user.id,req.correlation);return {ok:true};}
}
