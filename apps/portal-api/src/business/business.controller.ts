import { Body,Controller,Get,Post,Req,BadRequestException,ForbiddenException } from '@nestjs/common';
import { IsBoolean,IsIn,IsNumber,Max,Min } from 'class-validator';
import { Database } from '../database.js';
import { Permission,type SessionRequest } from '../security/guard.js';
import { calculatePurchase,rates } from './corta-cuotas.js';
import { builtin } from './registry.js';
class PurchaseDto {
 @IsNumber({maxDecimalPlaces:2,allowNaN:false,allowInfinity:false}) @Min(0.01) @Max(500000) amount!:number;
 @IsIn([3,6,9,12,18,24]) months!:number;
 @IsBoolean() campaign!:boolean;
}
@Controller('business/corta-cuotas')
@Permission('CORTA_CUOTAS.USE')
export class BusinessController {
 constructor(private db:Database){}
 private async authorize(req:SessionRequest){
  // The calculator has no customer records or resource-specific scopes. Scoped identities
  // are denied until a scope mapping for this module is explicitly implemented.
  const row=(await this.db.query(`SELECT m.id FROM core.modules m JOIN core.application_catalog a ON a.module_id=m.id
   WHERE m.code=@code AND m.enabled=1 AND a.published=1 AND a.required_permission=@permission
   AND NOT EXISTS(SELECT 1 FROM core.user_scopes WHERE user_id=@user)
   AND EXISTS(SELECT 1 FROM core.module_versions v JOIN core.module_installations i ON i.version_id=v.id WHERE v.module_id=m.id AND v.version=@version AND i.state='PUBLISHED')`,{code:builtin.id,permission:builtin.permission,user:req.user.id,version:builtin.version})).recordset[0];
  if(!row)throw new ForbiddenException('El módulo no está publicado o tu cuenta tiene un alcance no compatible.');
 }
 @Get() async status(@Req() req:SessionRequest){await this.authorize(req);return {name:builtin.name,version:builtin.version,rates,maxAmount:500000,campaignThreshold:10000};}
 @Post('calculate') async calculate(@Req() req:SessionRequest,@Body() input:PurchaseDto){
  await this.authorize(req);
  try{return calculatePurchase(input);}catch{throw new BadRequestException('Revisa el monto, el plazo y la selección de campaña.');}
 }
}
