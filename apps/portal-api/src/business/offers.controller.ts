import { Body,Controller,Get,Post,Req,BadRequestException,ForbiddenException,NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { Database } from '../database.js';
import { Permission,type SessionRequest } from '../security/guard.js';
import { offersBuiltin } from './registry.js';
import { calculateOffers,terms,intraPlans } from './offers-calculator.js';
import { tlvSummary,tlvDetail,tlvDetailSelect,tlvSummarySelect } from './offers-tlv.js';
const searchSchema=z.object({field:z.enum(['dni','codigo_cliente','cuenta']),value:z.string().trim().regex(/^[0-9A-Za-z-]{1,32}$/),page:z.number().int().min(0).max(10000)}).strict();
const detailSchema=z.object({id:z.string().regex(/^(tlv:)?[1-9][0-9]{0,17}$/)}).strict();
const current="activo=1 AND (vigente_desde IS NULL OR vigente_desde<=CONVERT(date,SYSUTCDATETIME())) AND (vigente_hasta IS NULL OR vigente_hasta>=CONVERT(date,SYSUTCDATETIME()))";
@Controller('business/ofertas')
@Permission('OFERTAS.USE')
export class OffersController {
 constructor(private db:Database){}
 private async authorize(req:SessionRequest){
  const row=(await this.db.query(`SELECT m.id FROM core.modules m JOIN core.application_catalog a ON a.module_id=m.id
   WHERE m.code=@code AND m.enabled=1 AND a.published=1 AND a.required_permission=@permission
   AND NOT EXISTS(SELECT 1 FROM core.user_scopes WHERE user_id=@user)
   AND EXISTS(SELECT 1 FROM core.module_versions v JOIN core.module_installations i ON i.version_id=v.id WHERE v.module_id=m.id AND v.version=@version AND i.state='PUBLISHED')`,{code:offersBuiltin.id,permission:offersBuiltin.permission,user:req.user.id,version:offersBuiltin.version})).recordset[0];
  if(!row)throw new ForbiddenException('El módulo no está publicado o tu cuenta tiene un alcance no compatible.');
 }
 private audit(req:SessionRequest,action:string,details:Record<string,unknown>){
  return this.db.query("INSERT core.audit_events(user_id,action,result,correlation_id,resource_type,details) VALUES(@actor,@action,'SUCCESS',@correlation,'offers',@details)",{actor:req.user.id,action,correlation:req.correlation,details:JSON.stringify(details)});
 }
 @Get() async status(@Req() req:SessionRequest){await this.authorize(req);return {name:offersBuiltin.name,terms,intraPlans};}
 @Post('search') async search(@Req() req:SessionRequest,@Body() body:unknown){
  await this.authorize(req);const parsed=searchSchema.safeParse(body);if(!parsed.success)throw new BadRequestException('Selecciona DNI, IBS o cuenta e ingresa un identificador de hasta 32 caracteres.');
  const input=parsed.data;
  // Field is selected from a closed server-side enum; identifier stays a parameter.
  const tlvField={dni:'DNI',codigo_cliente:'CODIGO_CLIENTE',cuenta:'CUENTA'}[input.field];
  const records=(await this.db.query(`SELECT source,payload FROM (
   SELECT 0 AS source,id AS sort_id,(SELECT CONVERT(varchar(20),id) AS id,base_origen,producto,nombre_cliente,dni,codigo_cliente,cuenta,monto_oferta,tasa_anual,tasa_minima,tasa_maxima,oferta FOR JSON PATH,WITHOUT_ARRAY_WRAPPER) AS payload
    FROM ofertas.ofertas_cliente WHERE ${input.field}=CONVERT(varchar(32),@value) AND ${current}
   UNION ALL
   SELECT 1 AS source,id AS sort_id,(SELECT CONVERT(varchar(20),id) AS id,${tlvSummarySelect} FOR JSON PATH,WITHOUT_ARRAY_WRAPPER) AS payload
    FROM ofertas.base_tlv WHERE [${tlvField}]=CONVERT(varchar(40),@value) AND activo=1
   ) found ORDER BY source,sort_id OFFSET @offset ROWS FETCH NEXT 51 ROWS ONLY`,{value:input.value,offset:input.page*50})).recordset;
  const rows=records.map(record=>{const row=typeof record.payload==='string'?JSON.parse(record.payload):record;return record.source===1?tlvSummary(row):row;});
  await this.audit(req,'OFFERS.SEARCH',{field:input.field,page:input.page,returned:Math.min(rows.length,50)});
  return {rows:rows.slice(0,50),hasMore:rows.length>50,page:input.page};
 }
 @Post('detail') async detail(@Req() req:SessionRequest,@Body() body:unknown){
  await this.authorize(req);const parsed=detailSchema.safeParse(body);if(!parsed.success)throw new BadRequestException('Oferta inválida.');
  if(parsed.data.id.startsWith('tlv:')){
   const row=(await this.db.query(`SELECT CONVERT(varchar(20),id) AS id,${tlvDetailSelect} FROM ofertas.base_tlv WHERE id=CONVERT(bigint,@id) AND activo=1`,{id:parsed.data.id.slice(4)})).recordset[0];
   if(!row)throw new NotFoundException('La oferta no existe o está inactiva.');
   await this.audit(req,'OFFERS.DETAIL',{offerId:parsed.data.id});return {...tlvSummary(row),...tlvDetail(row)};
  }
  const row=(await this.db.query(`SELECT CONVERT(varchar(20),id) AS id,base_origen,producto,codigo_oferta,lote,dni,codigo_cliente,cuenta,nombre_cliente,agencia,telefono1,telefono2,telefono3,direccion,monto_oferta,tasa_anual,tasa_minima,tasa_maxima,oferta,tipo_tarjeta,limite_usd,limite_lps,limite_actual,nuevo_limite,vigente_desde,vigente_hasta FROM ofertas.ofertas_cliente WHERE id=CONVERT(bigint,@id) AND ${current}`,{id:parsed.data.id})).recordset[0];
  if(!row)throw new NotFoundException('La oferta no existe o ya no está vigente.');
  await this.audit(req,'OFFERS.DETAIL',{offerId:parsed.data.id});return row;
 }
 @Post('calculate') async calculate(@Req() req:SessionRequest,@Body() body:unknown){
  await this.authorize(req);let result;try{result=calculateOffers(body);}catch{throw new BadRequestException('Revisa monto, plazo, tasa y comisión. EXTRA al 0% admite 6, 9 o 12 meses.');}
  await this.audit(req,'OFFERS.CALCULATE',{product:result.product,months:result.months});return result;
 }
}
