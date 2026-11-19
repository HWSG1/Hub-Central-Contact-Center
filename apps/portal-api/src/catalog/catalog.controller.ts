import { Controller,Get,Req } from '@nestjs/common';
import { Database } from '../database.js';
import { Permission,SessionRequest } from '../security/guard.js';
@Controller()
export class CatalogController {
 constructor(private db:Database){}
 @Get('catalog') async catalog(@Req() req:SessionRequest){return (await this.db.query('SELECT a.id,a.name,a.description,a.route,m.code FROM core.application_catalog a JOIN core.modules m ON m.id=a.module_id WHERE a.published=1 AND m.enabled=1 AND EXISTS (SELECT 1 FROM core.permissions p JOIN core.role_permissions rp ON rp.permission_id=p.id JOIN core.roles role ON role.id=rp.role_id AND role.enabled=1 JOIN core.user_roles ur ON ur.role_id=rp.role_id WHERE ur.user_id=@userId AND p.code=a.required_permission)',{userId:req.user.id})).recordset;}
 @Permission('CORE.MODULES.READ') @Get('modules') async modules(){return (await this.db.query('SELECT id,code,name,enabled FROM core.modules ORDER BY name')).recordset;}
 @Permission('CORE.AUDIT.READ') @Get('audit') async audit(@Req() req:SessionRequest){await this.db.query(`INSERT core.audit_events(action,result,user_id,correlation_id) VALUES('AUDIT.READ','SUCCESS',@id,@correlation)`,{id:req.user.id,correlation:req.correlation});return(await this.db.query('SELECT TOP(100) id,created_at,user_id,action,result,correlation_id,resource_type,resource_id,details FROM core.audit_events ORDER BY created_at DESC')).recordset;}
}
