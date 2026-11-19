import {Body,Controller,Post,Req,ForbiddenException} from '@nestjs/common';
import {IsString,Length,Matches} from 'class-validator';
import {Public,type SessionRequest} from './guard.js';
import {config} from '../config.js';
import {EnrollmentService} from './enrollment.service.js';
class TokenDto {@IsString() @Matches(/^[A-Za-z0-9_-]{43}$/) token!:string;}
class ActivateDto extends TokenDto {@IsString() @Length(15,128) password!:string; @IsString() @Matches(/^\d{6}$/) otp!:string;}
@Controller('auth/activation')
export class EnrollmentController {
 constructor(private service:EnrollmentService){}
 private origin(r:SessionRequest){if(r.get('origin')!==config.APP_ORIGIN)throw new ForbiddenException();}
 @Public() @Post('begin') begin(@Req() r:SessionRequest,@Body() b:TokenDto){this.origin(r);return this.service.begin(b.token);}
 @Public() @Post('complete') complete(@Req() r:SessionRequest,@Body() b:ActivateDto){this.origin(r);return this.service.complete(b.token,b.password,b.otp,r.correlation);}
}
