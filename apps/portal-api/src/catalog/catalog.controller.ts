import {BadRequestException,Body,Controller,Get,NotFoundException,Param,Put,Query,Req} from '@nestjs/common';
import {Database} from '../database.js';
import {Permission,SessionRequest} from '../security/guard.js';
import {ParseSqlGuidPipe} from '../security/sql-guid.js';

type AuditFilters = Record<string,string|undefined>;

const catalogSql = `
SELECT a.id,a.name,a.description,a.route,m.code,
 CAST(CASE WHEN EXISTS(SELECT 1 FROM core.user_favorites uf WHERE uf.application_id=a.id AND uf.user_id=@userId)
 THEN 1 ELSE 0 END AS bit) AS is_favorite
FROM core.application_catalog a
JOIN core.modules m ON m.id=a.module_id
WHERE a.published=1 AND m.enabled=1 AND EXISTS (
 SELECT 1 FROM core.permissions p
 JOIN core.role_permissions rp ON rp.permission_id=p.id
 JOIN core.roles role ON role.id=rp.role_id AND role.enabled=1
 JOIN core.user_roles ur ON ur.role_id=rp.role_id
 WHERE ur.user_id=@userId AND p.code=a.required_permission
)
`;

function numeric(value:string|undefined,defaultValue:number,min:number,max:number,field:string):number {
 if(value==null||value==='')return defaultValue;
 if(!/^\d+$/.test(value))throw new BadRequestException(field+' inválido.');
 const n=Number(value);
 if(!Number.isSafeInteger(n)||n<min||n>max)throw new BadRequestException(field+' fuera de rango.');
 return n;
}
function limited(value:string|undefined,max:number,field:string):string {
 if(value==null)return '';
 if(typeof value!=='string'||value.length>max)throw new BadRequestException(field+' inválido.');
 return value.trim();
}
function day(value:string|undefined,field:string):string|null {
 if(value==null||value==='')return null;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new BadRequestException(field+' debe tener formato AAAA-MM-DD.');
 const parsed=new Date(value+'T00:00:00.000Z');
 if(!Number.isFinite(parsed.valueOf())||parsed.toISOString().slice(0,10)!==value||value<'2000-01-01'||value>'2099-12-30')
  throw new BadRequestException(field+' no es una fecha válida.');
 return value;
}

@Controller()
export class CatalogController {
 constructor(private db:Database){}

 @Get('catalog')
 async catalog(@Req() req:SessionRequest){
  return (await this.db.query(catalogSql+' ORDER BY a.name',{userId:req.user.id})).recordset;
 }

 @Put('catalog/:id/favorite')
 async favorite(@Req() req:SessionRequest,@Param('id',new ParseSqlGuidPipe()) id:string,@Body() input:{favorite?:unknown}){
  if(typeof input?.favorite!=='boolean')throw new BadRequestException('Indica true o false para el favorito.');
  const visible=(await this.db.query(catalogSql+' AND a.id=@id',{userId:req.user.id,id})).recordset[0];
  if(!visible)throw new NotFoundException('Aplicación no disponible para este usuario.');
  await this.db.query(`
   IF @favorite=1
   BEGIN
    IF NOT EXISTS(SELECT 1 FROM core.user_favorites WITH (UPDLOCK,HOLDLOCK) WHERE user_id=@userId AND application_id=@id)
     INSERT core.user_favorites(user_id,application_id) VALUES(@userId,@id);
   END
   ELSE DELETE FROM core.user_favorites WHERE user_id=@userId AND application_id=@id;
  `,{userId:req.user.id,id,favorite:input.favorite});
  return {id,favorite:input.favorite};
 }

 @Permission('CORE.MODULES.READ')
 @Get('modules')
 async modules(){return (await this.db.query('SELECT id,code,name,enabled FROM core.modules ORDER BY name')).recordset;}

 @Permission('CORE.AUDIT.READ')
 @Get('audit')
 async audit(@Req() req:SessionRequest,@Query() filters:AuditFilters){
  const page=numeric(filters.page,1,1,10000,'Página');
  const pageSize=numeric(filters.pageSize,25,10,100,'Tamaño de página');
  const dateFrom=day(filters.dateFrom,'Fecha inicial');
  const dateTo=day(filters.dateTo,'Fecha final');
  if(dateFrom&&dateTo&&dateFrom>dateTo)throw new BadRequestException('La fecha inicial no puede superar la fecha final.');
  const search=limited(filters.search,100,'Búsqueda');
  const action=limited(filters.action,100,'Acción');
  const result=limited(filters.result,30,'Resultado');
  const actor=limited(filters.actor,120,'Usuario');
  const offset=(page-1)*pageSize;
  const requestedSnapshot=filters.snapshotId;
  if(requestedSnapshot!=null && !/^[1-9]\d{0,14}$/.test(requestedSnapshot))
   throw new BadRequestException('Punto de corte inválido.');
  await this.db.query(`INSERT core.audit_events(action,result,user_id,correlation_id) VALUES('AUDIT.READ','SUCCESS',@userId,@correlation)`,{userId:req.user.id,correlation:req.correlation});
  const latest=await this.db.query<{maxId:number}>('SELECT MAX(id) AS maxId FROM core.audit_events');
  const snapshotId=requestedSnapshot?Number(requestedSnapshot):Number(latest.recordset[0]?.maxId??0);
  const params={dateFrom,dateTo,search,action,result,actor,offset,pageSize,snapshotId};
  const base=`
   FROM core.audit_events ae
   LEFT JOIN core.users u ON u.id=ae.user_id
   LEFT JOIN core.local_credentials lc ON lc.user_id=ae.user_id
   WHERE ae.id<=@snapshotId AND (@dateFrom IS NULL OR ae.created_at>=CONVERT(date,@dateFrom,23))
     AND (@dateTo IS NULL OR ae.created_at<DATEADD(day,1,CONVERT(date,@dateTo,23)))
     AND (@search='' OR ae.action LIKE '%'+@search+'%' OR COALESCE(ae.resource_type,'') LIKE '%'+@search+'%'
          OR COALESCE(ae.resource_id,'') LIKE '%'+@search+'%')
     AND (@action='' OR ae.action LIKE '%'+@action+'%')
     AND (@result='' OR ae.result=@result)
     AND (@actor='' OR u.display_name LIKE '%'+@actor+'%' OR lc.login LIKE '%'+@actor+'%')
  `;
  const count=await this.db.query<{total:number}>(`SELECT COUNT_BIG(*) AS total ${base}`,params);
  const rows=await this.db.query(`
   SELECT ae.id,ae.created_at,
    COALESCE(u.display_name,CONVERT(nvarchar(36),ae.user_id),N'Sistema') AS actor,
    lc.login AS usuario,ae.action,ae.result,ae.resource_type,ae.resource_id,ae.details,ae.correlation_id
   ${base}
   ORDER BY ae.created_at DESC,ae.id DESC
   OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
  `,params);
  const total=Number(count.recordset[0]?.total??0);
  return {rows:rows.recordset,page,pageSize,total,snapshotId,hasMore:offset+rows.recordset.length<total};
 }
}
